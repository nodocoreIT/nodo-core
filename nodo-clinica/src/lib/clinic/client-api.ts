import type { ClinicSession } from "@/lib/clinic/types";
import type { AppointmentStatus } from "@/lib/clinic/types";
import type { MedicationSearchResponse } from "@/lib/clinic/medication-catalog";
import { clearSessionClock } from "@nodocore/shared-components";
import { CLINICA_SESSION_STORAGE_KEY_PREFIX } from "@/lib/clinic/platform-config";

export interface InstitutionRecord {
  id: string;
  org_id: string;
  professional_id: string;
  name: string;
  city: string | null;
  address: string | null;
  extra_info: string | null;
  schedule: { days: Array<{ dayOfWeek: number; startTime: string; endTime: string }> };
  active: boolean;
  created_at: string;
  updated_at: string;
}

const BASE = "";
const SESSION_KEY = "clinica_local_session";
const AUTH_TOKEN_CACHE = "clinica_access_token";

// ── Browser Supabase client (lazy-loaded, client-only) ────────────────────

let _supabasePromise: Promise<ReturnType<typeof import("@/lib/supabase/client").createClient>> | null = null;

import { isBrowserSupabaseEnabled } from "@/lib/clinic/config";

function useBrowserSupabaseAuth(): boolean {
  if (typeof window === "undefined") return false;
  return isBrowserSupabaseEnabled();
}

function getBrowserSupabase() {
  if (!useBrowserSupabaseAuth()) return null;
  if (!_supabasePromise) {
    _supabasePromise = import("@/lib/supabase/client").then((m) => m.createClient());
  }
  return _supabasePromise;
}

// ── Session helpers (sessionStorage — backwards-compat) ───────────────────

export function saveClientSession(session: ClinicSession) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getClientSession(): ClinicSession | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ClinicSession;
  } catch {
    return null;
  }
}

export function clearClientSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_CACHE);
  invalidateClinicApiCache();
}

type ClinicSessionResult = {
  session: {
    userId: string;
    email?: string;
    role: "doctor" | "patient";
    org_id?: string | null;
  } | null;
  user: {
    id: string;
    email?: string;
    fullName?: string;
    profilePhotoUrl?: string;
    role?: "doctor" | "patient";
    subscriptionPlan?: string;
    subscriptionStatus?: string;
    trialDaysRemaining?: number;
    org_id?: string | null;
    canSwitchToDoctor?: boolean;
    canSwitchToPatient?: boolean;
  } | null;
};

const SESSION_CACHE_MS = 30_000;
const APPOINTMENTS_CACHE_MS = 15_000;

let sessionInflight: Promise<ClinicSessionResult> | null = null;
let sessionCache: { at: number; value: ClinicSessionResult } | null = null;
const appointmentsInflight = new Map<string, Promise<unknown>>();
const appointmentsCache = new Map<string, { at: number; value: unknown }>();

export function invalidateClinicApiCache(
  scope: "session" | "appointments" | "all" = "all",
) {
  if (scope === "session" || scope === "all") {
    sessionCache = null;
    sessionInflight = null;
  }
  if (scope === "appointments" || scope === "all") {
    appointmentsCache.clear();
    appointmentsInflight.clear();
  }
}

async function fetchClinicJson(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(input, init);
  return parseJsonResponse(res);
}

async function syncAuthTokenCache(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const client = getBrowserSupabase();
  if (!client) {
    sessionStorage.removeItem(AUTH_TOKEN_CACHE);
    return null;
  }
  try {
    const supabase = await client;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? null;
    if (token) {
      sessionStorage.setItem(AUTH_TOKEN_CACHE, token);
    } else {
      sessionStorage.removeItem(AUTH_TOKEN_CACHE);
    }
    return token;
  } catch {
    sessionStorage.removeItem(AUTH_TOKEN_CACHE);
    return null;
  }
}

function clinicFetchOpts(): RequestInit {
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem(AUTH_TOKEN_CACHE);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return {
    credentials: "include",
    headers,
  };
}

async function parseJsonResponse(res: Response) {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? "Respuesta vacía del servidor"
        : `Error del servidor (HTTP ${res.status})`,
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respuesta inválida del servidor (HTTP ${res.status})`);
  }
}

export class OnboardingSubmitError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "OnboardingSubmitError";
    this.code = code;
  }
}

// ── Role helpers ──────────────────────────────────────────────────────────

const DOCTOR_JWT_ROLES = new Set(["super_admin", "admin", "medico", "doctor", "agent"]);

function mapSessionRole(appMetadataRole: string | null | undefined): "doctor" | "patient" {
  const role = appMetadataRole ?? "";
  if (role === "patient" || role === "paciente") return "patient";
  if (DOCTOR_JWT_ROLES.has(role)) return "doctor";
  return "patient";
}

async function fetchSessionUncached(): Promise<ClinicSessionResult> {
  await syncAuthTokenCache();

  const client = getBrowserSupabase();
  if (client) {
    try {
      const supabase = await client;
      const { data: { session } } = await supabase.auth.getSession();
      let authUser = session?.user;
      if (!authUser) {
        const { data: { user: freshUser } } = await supabase.auth.getUser();
        authUser = freshUser ?? undefined;
      }
      if (authUser) {
        const appMeta = authUser.app_metadata ?? {};
        const userMeta = authUser.user_metadata ?? {};
        let dbRole: "doctor" | "patient" = mapSessionRole(appMeta.role);

        let fullName: string =
          userMeta.full_name ?? userMeta.name ?? authUser.email ?? "";
        let profilePhotoUrl: string | undefined;
        let resolvedId: string = authUser.id;

        let subscriptionPlan: string | undefined;
        let subscriptionStatus: string | undefined;
        let trialDaysRemaining: number | undefined;
        let canSwitchToDoctor: boolean | undefined;
        let canSwitchToPatient: boolean | undefined;

        try {
          const sessionRes = await fetch(`${BASE}/api/clinic/account/session`, {
            ...clinicFetchOpts(),
            cache: "no-store",
          });
          if (!sessionRes.ok) {
            return { session: null, user: null };
          }
          const sessionData = await parseJsonResponse(sessionRes);
          if (sessionData.session?.role === "doctor" || sessionData.session?.role === "patient") {
            dbRole = sessionData.session.role;
          } else if (sessionData.user?.role === "doctor" || sessionData.user?.role === "patient") {
            dbRole = sessionData.user.role;
          } else {
            return { session: null, user: null };
          }
          if (sessionData.user?.fullName) {
            fullName = sessionData.user.fullName;
          }
          profilePhotoUrl = sessionData.user?.profilePhotoUrl;
          if (sessionData.user?.id) {
            resolvedId = sessionData.user.id;
          }
          subscriptionPlan = sessionData.user?.subscriptionPlan;
          subscriptionStatus = sessionData.user?.subscriptionStatus;
          trialDaysRemaining = sessionData.user?.trialDaysRemaining;
          canSwitchToDoctor = sessionData.user?.canSwitchToDoctor;
          canSwitchToPatient = sessionData.user?.canSwitchToPatient;
        } catch {
          return { session: null, user: null };
        }

        const stored = getClientSession();
        if (
          stored?.userId === authUser.id &&
          stored.role !== dbRole
        ) {
          saveClientSession({
            userId: authUser.id,
            role: dbRole,
            email: authUser.email ?? stored.email,
            fullName: fullName || stored.fullName,
            profilePhotoUrl: profilePhotoUrl ?? stored.profilePhotoUrl,
          });
        }

        return {
          session: {
            userId: authUser.id,
            email: authUser.email,
            role: dbRole,
            org_id: appMeta.org_id ?? null,
          },
          user: {
            id: resolvedId,
            email: authUser.email,
            fullName,
            profilePhotoUrl,
            role: dbRole,
            subscriptionPlan:
              subscriptionPlan ?? appMeta.plan ?? appMeta.subscription_plan ?? undefined,
            subscriptionStatus,
            trialDaysRemaining,
            org_id: appMeta.org_id ?? null,
            canSwitchToDoctor,
            canSwitchToPatient,
          },
        };
      }
    } catch {
      /* fall through to HTTP */
    }
  }

  // Local mode: cookie is what API routes trust. sessionStorage alone can lie
  // (e.g. patient tab + doctor login in another tab → booking 401).
  if (!useBrowserSupabaseAuth()) {
    const res = await fetch(`${BASE}/api/clinic/auth/session`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await parseJsonResponse(res);
    if (data.session && data.user) {
      saveClientSession({
        userId: data.user.id ?? data.session.userId,
        role: data.session.role,
        email: data.user.email ?? data.session.email ?? "",
        fullName: data.user.fullName ?? data.session.fullName ?? "",
        profilePhotoUrl: data.user.profilePhotoUrl,
      });
      return {
        session: data.session,
        user: data.user,
      };
    }
    clearClientSession();
    return { session: null, user: null };
  }

  const stored = getClientSession();
  if (stored) {
    return {
      session: {
        userId: stored.userId,
        email: stored.email,
        role: stored.role,
        org_id: null,
      },
      user: {
        id: stored.userId,
        email: stored.email,
        fullName: stored.fullName,
        role: stored.role,
        org_id: null,
      },
    };
  }

  const res = await fetch(`${BASE}/api/clinic/account/session`, clinicFetchOpts());
  const data = await parseJsonResponse(res);
  if (!res.ok) {
    return { session: null, user: null };
  }
  return data as ClinicSessionResult;
}

// ── Public API ────────────────────────────────────────────────────────────

export const clinicApi = {
  /**
   * Returns the current session.
   *
   * Primary: browser Supabase client (reads from cookies/localStorage — same
   *          pattern as nodo-inmo / nodo-autos / nodo-finanzas).
   * Fallback: HTTP API (clinica_session JWT cookie for platform-sync logins).
   */
  async getSession(): Promise<ClinicSessionResult> {
    const now = Date.now();
    if (sessionCache && now - sessionCache.at < SESSION_CACHE_MS) {
      return sessionCache.value;
    }
    if (sessionInflight) return sessionInflight;

    sessionInflight = fetchSessionUncached()
      .then((value) => {
        sessionCache = { at: Date.now(), value };
        return value;
      })
      .finally(() => {
        sessionInflight = null;
      });

    return sessionInflight;
  },

  /** Switches the active portal role for a dual patient+doctor account. */
  async switchRole(role: "doctor" | "patient"): Promise<void> {
    const res = await fetch(`${BASE}/api/clinic/auth/set-role`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...clinicFetchOpts().headers },
      body: JSON.stringify({ role }),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(data.error || "No se pudo cambiar de rol");
    }
    invalidateClinicApiCache("session");
  },

  /**
   * Sign in via the browser Supabase client (sets cookies in document.cookie
   * so both browser reads and server API calls work).
   *
   * This matches how nodo-inmo / nodo-autos / nodo-finanzas handle login.
   */
  async login(email: string, password: string, role: "doctor" | "patient") {
    if (useBrowserSupabaseAuth()) {
      const res = await fetch(`${BASE}/api/clinic/account/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, role }),
      });
      const respData = await parseJsonResponse(res);
      if (!res.ok) throw new Error(respData.error || "Error de login");

      const client = getBrowserSupabase();
      if (client && respData.supabaseSession?.access_token) {
        try {
          const supabase = await client;
          await supabase.auth.setSession({
            access_token: respData.supabaseSession.access_token,
            refresh_token: respData.supabaseSession.refresh_token,
          });
          await syncAuthTokenCache();
        } catch {
          /* server cookies + clinica_session are enough for API routes */
        }
      }

      const sessionRole: "doctor" | "patient" =
        respData.role === "doctor" || respData.role === "patient"
          ? respData.role
          : role;

      if (respData.user?.id) {
        saveClientSession({
          userId: respData.user.id,
          role: sessionRole,
          email: respData.user.email ?? email,
          fullName: respData.user.fullName ?? email.split("@")[0],
        });
      }

      invalidateClinicApiCache();
      return {
        user: respData.user,
        role: sessionRole,
      };
    }

    // Local mode: JSON DB + clinic_session cookie
    const res = await fetch(`${BASE}/api/clinic/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, role }),
    });
    const respData = await parseJsonResponse(res);
    if (!res.ok) throw new Error(respData.error || "Error de login");
    if (respData.user?.id) {
      saveClientSession({
        userId: respData.user.id,
        role: respData.role ?? role,
        email: respData.user.email,
        fullName: respData.user.fullName,
      });
    }
    invalidateClinicApiCache();
    return respData;
  },

  async register(payload: {
    email: string;
    fullName: string;
    role: "medico" | "paciente";
    // Fase 3 de Recetas — post-onboarding redirect (must start with
    // /paciente or /medico). Optional: omitted for every other caller.
    nextPath?: string;
  }): Promise<{ ok: boolean }> {
    const res = await fetch(`${BASE}/api/clinic/account/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "Error de registro");
    return data as { ok: boolean };
  },

  /**
   * Display-only pricing for the onboarding plan cards, read from
   * nodo_core.planes. Returns an empty map on any failure — callers keep
   * their static fallback copy, this never blocks onboarding.
   */
  async getOnboardingPlanPricing(): Promise<
    Record<string, { label: string; amount: number; amountAnnual: number; currency: string }>
  > {
    try {
      const res = await fetch(`${BASE}/api/clinic/account/onboarding/plans`);
      const data = await parseJsonResponse(res);
      if (!res.ok || !data.ok) return {};
      return data.plans as Record<
        string,
        { label: string; amount: number; amountAnnual: number; currency: string }
      >;
    } catch {
      return {};
    }
  },

  async acceptOnboardingTerms(data: {
    token: string;
    role: "medico" | "paciente";
    fullName: string;
    documentNumber?: string;
  }): Promise<{ ok: boolean }> {
    const res = await fetch(`${BASE}/api/clinic/account/onboarding/aceptar-terminos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    const resData = await parseJsonResponse(res);
    if (!res.ok) throw new Error(resData.error || "Error al aceptar términos");
    return resData as { ok: boolean };
  },

  async completeOnboardingMedico(
    formData: FormData,
  ): Promise<{ ok: boolean; checkoutUrl?: string; checkoutFailed?: boolean }> {
    // No Content-Type header — browser sets multipart boundary automatically
    const res = await fetch(`${BASE}/api/clinic/account/onboarding/medico`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const resData = await parseJsonResponse(res);
    if (!res.ok) throw new Error(resData.error || "Error en onboarding");
    return resData as { ok: boolean; checkoutUrl?: string; checkoutFailed?: boolean };
  },

  async completeOnboardingPaciente(
    formData: FormData,
  ): Promise<{ ok: boolean }> {
    // No Content-Type header — browser sets multipart boundary automatically
    const res = await fetch(`${BASE}/api/clinic/account/onboarding/paciente`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const resData = await parseJsonResponse(res);
    if (!res.ok) {
      throw new OnboardingSubmitError(
        resData.error || "Error en onboarding",
        typeof resData.code === "string" ? resData.code : undefined,
      );
    }
    return resData as { ok: boolean };
  },

  async logout() {
    clearClientSession();
    invalidateClinicApiCache();
    // Also clears SessionTimeoutGuard's idle/absolute-timeout clock — this is
    // the "Cerrar sesión" path used across every layout, and without this the
    // next login on this browser inherits the previous session's stale clock
    // and gets bounced with sesion_inactividad seconds after signing in.
    clearSessionClock(CLINICA_SESSION_STORAGE_KEY_PREFIX);
    // Sign out from browser Supabase client (clears cookies)
    const client = getBrowserSupabase();
    if (client) {
      try {
        const supabase = await client;
        await supabase.auth.signOut();
      } catch {
        /* best-effort */
      }
    }
    // Also clear server-side session
    await fetch(`${BASE}/api/clinic/account/session`, {
      method: "POST",
      credentials: "include",
    });
  },

  async getDoctors() {
    const res = await fetch(`${BASE}/api/clinic/doctors`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(
        (data as { error?: string }).error || "Error al cargar médicos",
      );
    }
    return data;
  },

  async getPharmacyOnCallSchedule(year: number, month: number) {
    const res = await fetch(
      `${BASE}/api/clinic/pharmacy-on-call?year=${year}&month=${month}`,
      { credentials: "include", cache: "no-store" },
    );
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(
        (data as { error?: string }).error || "Error al cargar el turnero de farmacias",
      );
    }
    return data as {
      schedule: {
        city: string;
        year: number;
        month: number;
        dayLetters: Record<string, string>;
        letterPharmacies: Record<
          string,
          Array<{ name: string; address: string; phones: string[]; lat?: number; lon?: number }>
        >;
        sourcePdfUrl: string;
        fetchedAt: string;
      } | null;
    };
  },

  async getMedicalDirectory(category: string) {
    const res = await fetch(
      `${BASE}/api/clinic/medical-directory?category=${encodeURIComponent(category)}`,
      { credentials: "include", cache: "no-store" },
    );
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(
        (data as { error?: string }).error || "Error al cargar el directorio",
      );
    }
    return data as {
      entries: Array<{
        placeId: string;
        name: string;
        address: string | null;
        phone: string | null;
        website: string | null;
        lat: number | null;
        lon: number | null;
      }>;
    };
  },

  async getDoctorForBooking(doctorId: string) {
    const res = await fetch(
      `${BASE}/api/clinic/doctors?doctorId=${encodeURIComponent(doctorId)}`,
      { credentials: "include", cache: "no-store" },
    );
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(
        (data as { error?: string }).error || "Error al cargar datos del médico",
      );
    }
    return data as {
      id: string;
      fullName: string;
      offersInPerson?: boolean;
      payment?: import("@/lib/clinic/types").DoctorPaymentSettings & {
        requirePaymentBeforeBooking?: boolean;
        mercadopagoEnabled?: boolean;
      };
    };
  },

  async bookAppointment(payload: {
    doctorId: string;
    scheduledAt?: string;
    appointmentType?: "virtual" | "in_person";
    paymentMethod?: "transfer" | "mercadopago";
    shareHealthProfile?: boolean;
    receipt?: {
      fileName: string;
      mimeType: string;
      dataBase64: string;
    };
    intakeReason?: string;
    studyFiles?: Array<{
      fileName: string;
      mimeType: string;
      dataBase64: string;
    }>;
  }) {
    const {
      doctorId,
      scheduledAt,
      appointmentType,
      paymentMethod = "transfer",
      shareHealthProfile = false,
      receipt,
      intakeReason,
      studyFiles,
    } = payload;
    const res = await fetch(`${BASE}/api/clinic/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        doctorId,
        scheduledAt,
        appointmentType,
        paymentMethod,
        shareHealthProfile,
        receipt,
        intakeReason,
        studyFiles,
      }),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      const err = new Error(data.error || "Error al reservar") as Error & {
        checks?: unknown;
        reasons?: string[];
        valid?: boolean;
        confidence?: number;
        requiresReceipt?: boolean;
      };
      err.checks = data.checks;
      err.reasons = data.reasons;
      err.requiresReceipt = data.requiresReceipt;
      throw err;
    }
    return data as {
      waitingRoomUrl: string;
      accessToken?: string;
      checkoutUrl?: string;
      paymentProvider?: string;
      paymentPendingReview?: boolean;
    };
  },

  async doctorAssignAppointments(payload: {
    patientId: string;
    patientEmail?: string;
    scheduledAtList: string[];
    intakeReason?: string;
    requirePayment?: boolean;
    appointmentType?: "virtual" | "in_person";
  }) {
    const res = await fetch(`${BASE}/api/clinic/appointments/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(data.error || "Error al asignar turno");
    }
    return data as {
      ok: boolean;
      count: number;
      patientEmail: string;
      patientName: string;
      appointments: Array<{
        id: string;
        scheduledAt: string;
        accessToken: string;
        paymentStatus: string;
        requiresPayment: boolean;
      }>;
    };
  },

  async getMercadoPagoCheckout(params: {
    accessToken?: string;
    appointmentId?: string;
    returnTo?: "sala" | "portal";
  }) {
    const q = new URLSearchParams();
    if (params.accessToken) q.set("accessToken", params.accessToken);
    if (params.appointmentId) q.set("appointmentId", params.appointmentId);
    if (params.returnTo) q.set("returnTo", params.returnTo);
    const res = await fetch(`${BASE}/api/clinic/mercadopago?${q}`, {
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al obtener checkout");
    return data as {
      checkoutUrl?: string;
      paid?: boolean;
      waitingRoomUrl?: string;
    };
  },

  async syncMercadoPagoPayment(accessToken: string, paymentId?: string) {
    const res = await fetch(`${BASE}/api/clinic/mercadopago/sync`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, paymentId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al sincronizar pago");
    return data as { ok?: boolean; paymentStatus?: string; alreadyConfirmed?: boolean };
  },

  async disconnectMercadoPago() {
    const res = await fetch(`${BASE}/api/clinic/mercadopago/oauth/disconnect`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al desconectar");
    return data as { ok: boolean };
  },

  async getSubscriptionStatus() {
    const res = await fetch(`${BASE}/api/clinic/subscription/checkout`, {
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al consultar la suscripción");
    return data as {
      status: string;
      plan: string | null;
      nextPaymentAt: string | null;
      trialEndsAt: string | null;
    };
  },

  async startSubscriptionCheckout(planId: string, billingCycle: "monthly" | "annual" = "monthly") {
    const res = await fetch(`${BASE}/api/clinic/subscription/checkout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, billingCycle }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al iniciar la suscripción");
    return data as { initPoint: string };
  },

  async testMercadoPagoConnection() {
    const res = await fetch(`${BASE}/api/clinic/mercadopago/test/connection`, {
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al probar conexión");
    return data as {
      ok: boolean;
      message?: string;
      tokenKind?: string;
      nickname?: string;
    };
  },

  async testMercadoPagoQr(amount?: number) {
    const res = await fetch(`${BASE}/api/clinic/mercadopago/test/qr`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(amount != null ? { amount } : {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error en prueba QR");
    return data as {
      ok: boolean;
      orderId?: string;
      qrData?: string;
      message?: string;
    };
  },

  async confirmAppointmentPayment(accessToken: string) {
    const res = await fetch(`${BASE}/api/clinic/appointments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ accessToken, action: "confirmPayment" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al confirmar pago");
    return data;
  },

  async saveIntakeReason(accessToken: string, intakeReason: string) {
    const res = await fetch(`${BASE}/api/clinic/appointments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ accessToken, action: "saveIntake", intakeReason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al guardar motivo");
    return data;
  },

  async resendAppointmentConfirmation(payload: {
    appointmentId?: string;
    accessToken?: string;
  }) {
    const res = await fetch(`${BASE}/api/clinic/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "resendConfirmation", ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al enviar email");
    return data as { ok: boolean; message: string };
  },

  async sendTestReminderEmail() {
    const res = await fetch(`${BASE}/api/clinic/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "testReminder" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al enviar prueba");
    return data as { ok: boolean; message: string; mock?: boolean; emailId?: string };
  },

  async cancelPendingAppointment(accessToken: string) {
    const res = await fetch(`${BASE}/api/clinic/appointments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ accessToken, action: "patientCancelAppointment" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cancelar turno");
    return data;
  },

  async removePatientAppointment(accessToken: string) {
    const res = await fetch(`${BASE}/api/clinic/appointments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...clinicFetchOpts().headers },
      credentials: "include",
      body: JSON.stringify({
        accessToken,
        action: "patientRemoveAppointment",
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al eliminar turno");
    invalidateClinicApiCache("appointments");
    return data;
  },

  async deleteCancelledAppointment(accessToken: string) {
    const res = await fetch(`${BASE}/api/clinic/appointments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...clinicFetchOpts().headers },
      credentials: "include",
      body: JSON.stringify({
        accessToken,
        action: "patientDeleteCancelledAppointment",
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al eliminar turno");
    return data;
  },

  async getPatientAppointments(patientId: string) {
    const now = Date.now();
    const cached = appointmentsCache.get(patientId);
    if (cached && now - cached.at < APPOINTMENTS_CACHE_MS) {
      return cached.value;
    }

    const inflight = appointmentsInflight.get(patientId);
    if (inflight) return inflight;

    const promise = fetchClinicJson(
      `${BASE}/api/clinic/appointments?patientId=${encodeURIComponent(patientId)}`,
      clinicFetchOpts(),
    ).then((value) => {
      appointmentsCache.set(patientId, { at: Date.now(), value });
      return value;
    }).finally(() => {
      appointmentsInflight.delete(patientId);
    });

    appointmentsInflight.set(patientId, promise);
    return promise;
  },

  async getDoctorAppointments(
    doctorId: string,
    scope: "today" | "upcoming" | "active" | "queue" = "today",
  ) {
    const res = await fetch(
      `${BASE}/api/clinic/appointments?doctorId=${doctorId}&scope=${scope}`,
      clinicFetchOpts(),
    );
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "Error al cargar turnos");
    return data;
  },

  async getDoctorQueue(doctorId: string) {
    return this.getDoctorAppointments(doctorId, "queue");
  },

  async getPendingPaymentAppointments(doctorId: string) {
    const res = await fetch(
      `${BASE}/api/clinic/appointments?doctorId=${doctorId}&scope=pending_payment`,
      clinicFetchOpts(),
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar pagos pendientes");
    return data as Array<{
      id: string;
      scheduledAt: string;
      paymentReceiptAudit?: import("@/lib/clinic/types").PaymentReceiptAudit;
      patient?: { fullName: string; email?: string };
      documentCount?: number;
      documents?: Array<{ id: string; fileName: string; downloadUrl: string }>;
    }>;
  },

  async doctorConfirmPayment(appointmentId: string) {
    const res = await fetch(`${BASE}/api/clinic/appointments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ appointmentId, action: "doctorConfirmPayment" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al confirmar pago");
    return data;
  },

  async doctorRejectPayment(appointmentId: string, reason?: string) {
    const res = await fetch(`${BASE}/api/clinic/appointments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ appointmentId, action: "doctorRejectPayment", reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al rechazar pago");
    return data as {
      requiresRefund?: boolean;
      paymentProvider?: string;
    };
  },

  async getDoctorAppointmentsMonth(doctorId: string, monthKey: string) {
    const res = await fetch(
      `${BASE}/api/clinic/appointments?doctorId=${doctorId}&scope=month&month=${monthKey}`,
      clinicFetchOpts(),
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar el calendario de turnos");
    return data as { days: Array<{ date: string; count: number; patientCount: number }> };
  },

  async getDoctorAppointmentsDay(doctorId: string, dateKey: string) {
    const res = await fetch(
      `${BASE}/api/clinic/appointments?doctorId=${doctorId}&scope=day&date=${dateKey}`,
      clinicFetchOpts(),
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar los turnos del día");
    return data as { appointments: Array<Record<string, unknown>> };
  },

  async doctorCancelAppointments(appointmentIds: string[]) {
    const res = await fetch(`${BASE}/api/clinic/appointments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ appointmentIds, action: "doctorCancelAppointments" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cancelar turnos");
    return data as {
      results: Array<{
        id: string;
        ok: boolean;
        requiresRefund?: boolean;
        paymentProvider?: string | null;
        mercadopagoPaymentId?: string | null;
        error?: string;
      }>;
    };
  },

  /** Hard-deletes a turno that is already cancelled — use doctorCancelAppointments for active ones. */
  async doctorDeleteAppointment(appointmentId: string) {
    const res = await fetch(`${BASE}/api/clinic/appointments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ appointmentId, action: "doctorDeleteAppointment" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al eliminar el turno");
    return data as { ok: true };
  },

  async refundAppointmentMercadoPago(appointmentId: string) {
    const res = await fetch(`${BASE}/api/clinic/appointments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ appointmentId, action: "refundAppointmentMercadoPago" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al reembolsar el pago");
    return data;
  },

  async markAppointmentRefundedManually(appointmentId: string) {
    const res = await fetch(`${BASE}/api/clinic/appointments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ appointmentId, action: "markAppointmentRefundedManually" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al registrar la devolución");
    return data;
  },

  async getAppointmentByToken(token: string) {
    const res = await fetch(
      `${BASE}/api/clinic/appointments?token=${token}`,
      clinicFetchOpts()
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Turno no encontrado");
    return data;
  },

  async updateAppointmentStatus(
    appointmentId: string,
    status: AppointmentStatus,
    extras?: { transcription?: string; clinicalNotes?: string },
  ) {
    const res = await fetch(`${BASE}/api/clinic/appointments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        appointmentId,
        status,
        transcription: extras?.transcription,
        clinicalNotes: extras?.clinicalNotes,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al actualizar turno");
    return data;
  },

  async clearStuckConsultations(doctorId: string) {
    const res = await fetch(`${BASE}/api/clinic/appointments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ doctorId, action: "clearStuck" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al limpiar cola");
    return data;
  },

  async getClinicalRecords(patientId: string) {
    const res = await fetch(
      `${BASE}/api/clinic/clinical-records?patientId=${patientId}`,
      clinicFetchOpts()
    );
    return res.json();
  },

  async deleteClinicalRecord(id: string) {
    const res = await fetch(
      `${BASE}/api/clinic/clinical-records?id=${id}`,
      { ...clinicFetchOpts(), method: "DELETE" },
    );
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "Error al eliminar registro");
    return data as { ok: boolean };
  },

  async saveNotes(
    appointmentId: string,
    doctorId: string,
    content: string
  ) {
    await fetch(`${BASE}/api/clinic/notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ appointmentId, doctorId, content }),
    });
  },

  async getNotes(appointmentId: string) {
    const res = await fetch(
      `${BASE}/api/clinic/notes?appointmentId=${appointmentId}`,
      clinicFetchOpts()
    );
    return res.json();
  },

  async getAvailableDates(doctorId: string, appointmentType?: "virtual" | "in_person") {
    const params = new URLSearchParams({ doctorId });
    if (appointmentType === "in_person") params.set("type", "in_person");
    const res = await fetch(`${BASE}/api/clinic/schedule?${params}`, clinicFetchOpts());
    return res.json();
  },

  async getSlots(doctorId: string, date: string, appointmentType?: "virtual" | "in_person") {
    const params = new URLSearchParams({ doctorId, date });
    if (appointmentType === "in_person") params.set("type", "in_person");
    const res = await fetch(`${BASE}/api/clinic/schedule?${params}`, clinicFetchOpts());
    return res.json() as Promise<{
      slots: Array<{
        iso: string;
        label: string;
        status: "available" | "booked";
        institutionName?: string;
        institutionAddress?: string;
      }>;
      slotDurationMinutes: number;
    }>;
  },

  async getDoctorSchedule(doctorId?: string) {
    const res = await fetch(`${BASE}/api/clinic/schedule?own=true`, clinicFetchOpts());
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Error al cargar agenda");
    }
    return data;
  },

  async saveDoctorOffice(payload: {
    fullName?: string;
    licenseNumber?: string;
    specialties?: string[];
    availability?: import("@/lib/clinic/schedule").DoctorAvailability;
    blockedDates?: string[];
    signatureText?: string;
    signatureImageData?: string;
    profilePhotoData?: string;
    bio?: string;
    payment?: import("@/lib/clinic/types").DoctorPaymentSettings;
    reminderSettings?: import("@/lib/clinic/types").DoctorReminderSettings;
    googleCalendarId?: string;
    themeSettings?: import("@/lib/clinic/theme-settings").DoctorThemeSettings;
  }) {
    const res = await fetch(`${BASE}/api/clinic/schedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (data as { error?: string }).error || "Error al guardar consultorio",
      );
    }
    return data as {
      ok: boolean;
      office?: Record<string, unknown>;
    };
  },

  async saveDoctorPayment(
    payment: import("@/lib/clinic/types").DoctorPaymentSettings,
  ) {
    return this.saveDoctorOffice({ payment });
  },
  async saveSchedule(payload: {
    availability?: import("@/lib/clinic/schedule").DoctorAvailability;
    signatureText?: string;
  }) {
    return this.saveDoctorOffice(payload);
  },

  async uploadDocument(
    file: File,
    accessToken: string,
    documentType: "payment_receipt" | "study" = "study",
  ) {
    const form = new FormData();
    form.append("file", file);
    form.append("accessToken", accessToken);
    form.append("documentType", documentType);
    const res = await fetch(`${BASE}/api/clinic/documents`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "Error al subir archivo");
    return data as {
      id: string;
      fileName: string;
      uploadedAt: string;
      downloadUrl?: string;
      documentType?: "payment_receipt" | "study";
    };
  },

  async deleteDocument(documentId: string, accessToken?: string) {
    const q = new URLSearchParams({ id: documentId });
    if (accessToken) q.set("token", accessToken);
    const res = await fetch(`${BASE}/api/clinic/documents?${q}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "Error al eliminar archivo");
    return data as { ok: boolean };
  },

  async getDocuments(params: {
    patientId?: string;
    appointmentId?: string;
    token?: string;
  }) {
    const q = new URLSearchParams();
    if (params.patientId) q.set("patientId", params.patientId);
    if (params.appointmentId) q.set("appointmentId", params.appointmentId);
    if (params.token) q.set("token", params.token);
    const res = await fetch(`${BASE}/api/clinic/documents?${q}`, clinicFetchOpts());
    return res.json();
  },

  /**
   * Uploads a personal study file (no appointment). PRO-plan patients only —
   * the server re-validates the plan regardless of client-side gating.
   */
  async uploadStudy(file: File) {
    const form = new FormData();
    form.append("file", file);
    form.append("documentType", "study");
    const res = await fetch(`${BASE}/api/clinic/documents`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "Error al subir archivo");
    return data as {
      id: string;
      fileName: string;
      uploadedAt: string;
      downloadUrl?: string;
      documentType?: "payment_receipt" | "study";
    };
  },

  /** Lists the authenticated patient's own appointment-less studies. */
  async getPatientStudies() {
    const res = await fetch(
      `${BASE}/api/clinic/documents?personal=1`,
      clinicFetchOpts(),
    );
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "Error al cargar estudios");
    return data as Array<{
      id: string;
      patientId: string;
      appointmentId: string | null;
      fileName: string;
      mimeType: string;
      uploadedAt: string;
      documentType?: "payment_receipt" | "study";
      downloadUrl: string;
    }>;
  },

  /** "Mis recetas" — unified standalone + live-consultation recetas for the
   * logged-in patient, with the 10-day access window already resolved
   * server-side (isExpired). */
  async getPatientPrescriptions() {
    const res = await fetch(
      `${BASE}/api/clinic/patient-prescriptions`,
      clinicFetchOpts(),
    );
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "Error al cargar recetas");
    return data as Array<{
      id: string;
      source: "standalone" | "consultation";
      doctorName: string;
      issuedAt: string;
      expiresAt: string;
      isExpired: boolean;
      isViewed: boolean;
      medicationsSummary: string;
    }>;
  },

  /** Count of not-yet-downloaded recetas, for the "Mis recetas" sidebar badge. */
  async getPatientPrescriptionsUnreadCount() {
    const res = await fetch(
      `${BASE}/api/clinic/patient-prescriptions/unread-count`,
      clinicFetchOpts(),
    );
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "Error al cargar recetas pendientes");
    return data as { count: number };
  },

  /** Marks a receta as downloaded/viewed so it stops counting toward the badge. */
  async markPrescriptionViewed(id: string, source: "standalone" | "consultation") {
    const res = await fetch(
      `${BASE}/api/clinic/patient-prescriptions/${id}/view`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...clinicFetchOpts().headers },
        credentials: "include",
        body: JSON.stringify({ source }),
      },
    );
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "Error al marcar receta como vista");
    return data as { ok: boolean };
  },

  async getPatientHistory(patientId: string, doctorId?: string) {
    const params = new URLSearchParams({ patientId });
    if (doctorId) params.set("doctorId", doctorId);
    const res = await fetch(
      `${BASE}/api/clinic/patient-history?${params}`,
      clinicFetchOpts()
    );
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(data.error || "Error al cargar historial");
    }
    return data;
  },

  async generateClinicalReport(payload: {
    dictation?: string;
    transcription?: string;
    clinicalNotes?: string;
    patientName: string;
    doctorName: string;
    doctorSpecialty?: string;
    doctorLicense?: string;
  }) {
    const res = await fetch(`${BASE}/api/clinic/clinical-report/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al generar informe");
    return data as { report: string; quotaFallback?: boolean };
  },

  async saveClinicalRecord(payload: {
    patientId: string;
    doctorId: string;
    appointmentId?: string;
    title?: string;
    content: string;
    recordType?: string;
  }) {
    const res = await fetch(`${BASE}/api/clinic/clinical-records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "Error al guardar informe");
    return data;
  },

  async searchMedications(query: string): Promise<MedicationSearchResponse> {
    const res = await fetch(
      `${BASE}/api/clinic/medications/search?q=${encodeURIComponent(query)}`,
      clinicFetchOpts(),
    );
    const data = (await parseJsonResponse(res)) as MedicationSearchResponse;
    return data;
  },

  async savePrescription(payload: {
    appointmentId?: string;
    doctorId: string;
    patientId?: string;
    medications: Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions?: string;
    }>;
    pdfBase64?: string;
    // Fase 2 — standalone (fuera de consulta) recetas.
    institutionId?: string;
    priceAmount?: number;
    notes?: string;
    patientEmail?: string;
    patientFullName?: string;
  }) {
    const res = await fetch(`${BASE}/api/clinic/prescriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "Error al guardar receta");
    return data;
  },

  /** Fase 6 de Recetas — obtiene una receta propia (borrador o no) para
   * precargar el form de edición. */
  async getPrescription(id: string) {
    const res = await fetch(`${BASE}/api/clinic/prescriptions/${id}`, clinicFetchOpts());
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "No se pudo obtener la receta");
    return data as {
      id: string;
      patient_id: string | null;
      patient_email: string | null;
      patient_full_name: string | null;
      institution_id: string | null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      medications: any;
      notes: string | null;
      price_amount: number | null;
      price_currency: string | null;
      sent_at: string | null;
      payment_status: string;
    };
  },

  /** Fase 6 de Recetas — actualiza una receta en estado borrador. El backend
   * rechaza con 409 si ya fue enviada o pagada. */
  async updatePrescription(
    id: string,
    payload: {
      patientId?: string;
      medications: Array<{
        name: string;
        dosage: string;
        frequency: string;
        duration: string;
        instructions?: string;
      }>;
      institutionId?: string;
      priceAmount?: number;
      notes?: string;
      patientEmail?: string;
      patientFullName?: string;
    },
  ) {
    const res = await fetch(`${BASE}/api/clinic/prescriptions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "Error al actualizar la receta");
    return data as { id: string };
  },

  /** Fase 3 de Recetas — envía (o reenvía) el magic link de una receta ya guardada. */
  async sendPrescription(id: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${BASE}/api/clinic/prescriptions/${id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "Error al enviar la receta");
    return data as { ok: boolean };
  },

  /** Fase 3 de Recetas — resuelve qué debe ver el paciente en el magic link
   * (needs_registration / needs_login / authorized / not_found). Sesión de
   * paciente opcional: se manda con credentials:"include" si existe. */
  async getPrescriptionAccess(accessToken: string) {
    const res = await fetch(
      `${BASE}/api/clinic/prescriptions/access?token=${encodeURIComponent(accessToken)}`,
      { credentials: "include" },
    );
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "No se pudo resolver la receta");
    return data as
      | { status: "not_found" }
      | {
          status: "needs_registration";
          patientEmail: string;
          patientFullName: string | null;
          accessToken: string;
        }
      | { status: "needs_login"; accessToken: string }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | { status: "authorized"; prescription: any };
  },

  /** Fase 4 de Recetas — obtiene (o regenera) la URL de checkout MP para una
   * receta standalone pendiente de pago, o {paid:true} si ya está pagada. */
  async getPrescriptionCheckout(
    accessToken: string,
  ): Promise<{ paid: true } | { checkoutUrl: string; preferenceId: string }> {
    const res = await fetch(
      `${BASE}/api/clinic/prescriptions/mercadopago?accessToken=${encodeURIComponent(accessToken)}`,
      { credentials: "include" },
    );
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "No se pudo iniciar el pago");
    return data;
  },

  /** Fase 5 de Recetas — historial de recetas emitidas por el médico logueado
   * (borrador / enviada / pagada), para <RecetasList />. */
  async getPrescriptionsByDoctor() {
    const res = await fetch(`${BASE}/api/clinic/prescriptions`, clinicFetchOpts());
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "No se pudieron obtener las recetas");
    return data as {
      prescriptions: Array<{
        id: string;
        patientFullName: string;
        institutionSnapshot: {
          name: string;
          city: string | null;
          address: string | null;
          extraInfo: string | null;
        } | null;
        priceAmount: number | null;
        priceCurrency: string | null;
        paymentStatus: string;
        sentAt: string | null;
        createdAt: string;
      }>;
    };
  },

  async saveStudyOrder(payload: {
    appointmentId: string;
    doctorId: string;
    patientId: string;
    studies: string[];
    notes?: string;
    pdfBase64?: string;
    newStudyLabels?: string[];
  }) {
    const res = await fetch(`${BASE}/api/clinic/study-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "Error al guardar orden");
    return data;
  },

  async updatePatientProfile(payload: {
    profilePhotoData?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    phone?: string;
    dni?: string;
    address?: string;
    healthProfile?: {
      bloodType?: string | null;
      obraSocial?: string | null;
      insuranceNumber?: string | null;
      allergies?: string | null;
      chronicConditions?: string | null;
      heightCm?: number | null;
      weightKg?: number | null;
      medications?: string | null;
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
    };
  }) {
    const res = await fetch(`${BASE}/api/clinic/patients`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al actualizar perfil");
    return data;
  },

  async getPatientProfile() {
    const res = await fetch(`${BASE}/api/clinic/patients/me`, clinicFetchOpts());
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al obtener perfil");
    return data as {
      id: string;
      firstName: string;
      lastName: string;
      fullName: string;
      email: string;
      phone: string;
      dni: string;
      address: string;
      profilePhotoUrl: string | null;
      bloodType: string;
      obraSocial: string;
      insuranceNumber: string;
      heightCm: number | null;
      weightKg: number | null;
      allergies: string;
      chronicConditions: string;
      medications: string;
      emergencyContactName: string;
      emergencyContactPhone: string;
    };
  },

  async getObrasSociales(q?: string) {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    const res = await fetch(`${BASE}/api/clinic/obras-sociales${params}`, clinicFetchOpts());
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar obras sociales");
    return data as { obrasSociales: Array<{ id: string; name: string }> };
  },

  async suggestObraSocial(name: string) {
    const res = await fetch(`${BASE}/api/clinic/obras-sociales`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al sugerir obra social");
    return data as { created?: boolean; exists?: boolean; obraSocial: { id: string; name: string } };
  },

  async previewPaymentReceipt(payload: {
    doctorId: string;
    scheduledAt: string;
    receipt: { fileName: string; mimeType: string; dataBase64: string };
  }) {
    const res = await fetch(`${BASE}/api/clinic/payment-receipt/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "Error al validar comprobante");
    return data as {
      valid: boolean;
      confidence: number;
      reasons: string[];
      checks?: {
        amount: { pass: boolean; detail: string };
        recipient: { pass: boolean; detail: string };
        schedule: { pass: boolean; detail: string };
        receiptType: { pass: boolean; detail: string };
      };
      audit?: import("@/lib/clinic/types").PaymentReceiptAudit;
    };
  },

  async getJitsiToken(params: {
    room: string;
    displayName: string;
    moderator?: boolean;
    accessToken?: string;
  }) {
    const qs = new URLSearchParams({
      room: params.room,
      displayName: params.displayName,
      moderator: params.moderator ? "true" : "false",
    });
    if (params.accessToken) {
      qs.set("accessToken", params.accessToken);
    }
    const res = await fetch(`${BASE}/api/clinic/jitsi-token?${qs}`, clinicFetchOpts());
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al obtener token de video");
    return data as { jwt: string; roomName: string; domain: string };
  },

  async getCobrosReceived(doctorId: string) {
    const res = await fetch(
      `${BASE}/api/clinic/appointments?doctorId=${encodeURIComponent(doctorId)}&scope=cobros_received`,
      clinicFetchOpts(),
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar cobros");
    return data as {
      entries: Array<{
        id: string;
        patientName: string;
        paidAt: string;
        bookedAt: string;
        scheduledAt: string;
        paymentProvider?: "transfer" | "mercadopago";
        amount: number;
        currency: "ARS";
        receiptTransferDate?: string;
        receiptTransferTime?: string;
        operationId?: string;
        mercadopagoPaymentId?: string;
        receiptOlderThanBooking?: boolean;
        documents?: Array<{
          id: string;
          fileName: string;
          downloadUrl: string;
        }>;
      }>;
    };
  },

  async getPaymentLedger(doctorId: string) {
    const res = await fetch(
      `${BASE}/api/clinic/appointments?doctorId=${encodeURIComponent(doctorId)}&scope=payment_ledger`,
      clinicFetchOpts(),
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar cobros");
    return data as {
      entries: Array<{
        id: string;
        source?: "appointment" | "prescription";
        status?: string;
        scheduledAt: string;
        createdAt?: string;
        patientName: string;
        patientPhone?: string;
        paymentStatus?: string;
        paymentProvider?: string;
        concept?: string;
        audit?: import("@/lib/clinic/types").PaymentReceiptAudit;
        needsReview?: boolean;
        documents?: Array<{ id: string; fileName: string; downloadUrl: string }>;
      }>;
    };
  },

  async validatePaymentReceipt(accessToken: string, documentId: string) {
    const res = await fetch(`${BASE}/api/clinic/payment-receipt/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ accessToken, documentId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al validar comprobante");
    return data as {
      valid: boolean;
      confidence: number;
      reasons: string[];
      strictMode?: boolean;
      checks?: {
        amount: { pass: boolean; detail: string };
        recipient: { pass: boolean; detail: string };
        date: { pass: boolean; detail: string };
        schedule: { pass: boolean; detail: string };
        receiptType: { pass: boolean; detail: string };
      };
    };
  },

  async getInterconsultMessages(peerId: string | null = null) {
    const params = peerId ? `?peerId=${encodeURIComponent(peerId)}` : "";
    const res = await fetch(`${BASE}/api/clinic/interconsult/messages${params}`, clinicFetchOpts());
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar mensajes");
    return data as {
      meId: string;
      messages: Array<{
        id: string;
        fromDoctorId: string;
        fromDoctorName: string;
        toDoctorId: string | null;
        content: string;
        createdAt: string;
      }>;
    };
  },

  async sendInterconsultMessage(content: string, toDoctorId: string | null = null) {
    const res = await fetch(`${BASE}/api/clinic/interconsult/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content, toDoctorId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al enviar mensaje");
    return data;
  },

  async getInterconsultPresence() {
    const res = await fetch(`${BASE}/api/clinic/interconsult/presence`, clinicFetchOpts());
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar presencia");
    return data as {
      doctors: Array<{
        id: string;
        fullName: string;
        specialty: string;
        online: boolean;
        lastSeen: string | null;
      }>;
    };
  },

  async pingInterconsultPresence() {
    await fetch(`${BASE}/api/clinic/interconsult/presence`, {
      method: "POST",
      credentials: "include",
    });
  },

  async searchNodoChatDirectory(q = "") {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    const res = await fetch(`${BASE}/api/clinic/interconsult/directory${params}`, clinicFetchOpts());
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al buscar contactos");
    return data as {
      contacts: Array<{
        id: string;
        fullName: string;
        role: string;
        nodeSlug: string;
        nodeLabel: string;
        specialty?: string;
        online: boolean;
      }>;
      currentPlan: string;
    };
  },

  async getNodoChatUnread() {
    const res = await fetch(`${BASE}/api/clinic/interconsult/unread`, clinicFetchOpts());
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar notificaciones");
    return data as {
      count: number;
      items: Array<{
        id: string;
        fromDoctorId: string;
        fromDoctorName: string;
        toDoctorId: string | null;
        content: string;
        createdAt: string;
      }>;
    };
  },

  async markNodoChatRead() {
    const res = await fetch(`${BASE}/api/clinic/interconsult/read`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al marcar leído");
    return data as { readAt: string };
  },

  async getDoctorTasks(due?: string) {
    const params = due ? `?due=${encodeURIComponent(due)}` : "";
    const res = await fetch(`${BASE}/api/clinic/tasks${params}`, clinicFetchOpts());
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar tareas");
    return data as {
      tasks: Array<{
        id: string;
        doctorId: string;
        title: string;
        dueDate?: string;
        done: boolean;
        createdAt: string;
      }>;
    };
  },

  async saveDoctorTask(payload: {
    title: string;
    dueDate?: string;
  }) {
    const res = await fetch(`${BASE}/api/clinic/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al crear tarea");
    return data;
  },

  async updateDoctorTask(payload: {
    id: string;
    title?: string;
    dueDate?: string;
    done?: boolean;
  }) {
    const res = await fetch(`${BASE}/api/clinic/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al actualizar tarea");
    return data;
  },

  async getMyPatients() {
    const res = await fetch(`${BASE}/api/clinic/medico/pacientes`, clinicFetchOpts());
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar pacientes");
    return data as {
      patients: Array<{
        id: string;
        fullName: string;
        profilePhotoUrl: string | null;
        lastVisit: string;
        visitCount: number;
      }>;
    };
  },

  async getMyPatientHistory(patientId: string) {
    const res = await fetch(
      `${BASE}/api/clinic/medico/pacientes/${encodeURIComponent(patientId)}`,
      clinicFetchOpts(),
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar la historia clínica");
    return data as {
      patient: {
        id: string;
        fullName: string;
        profilePhotoUrl: string | null;
        dateOfBirth: string | null;
        dni: string | null;
      };
      consultations: Array<{
        id: string;
        scheduledAt: string;
        intakeReason: string | null;
        notes: string | null;
        soap: {
          subjective: string | null;
          objective: string | null;
          analysis: string | null;
          plan: string | null;
        } | null;
        prescriptions: Array<{ id: string; medications: unknown; pdfUrl: string | null; createdAt: string }>;
        studyOrders: Array<{ id: string; studies: unknown; notes: string | null; pdfUrl: string | null; createdAt: string }>;
      }>;
    };
  },

  async updateConsultationNotes(patientId: string, appointmentId: string, content: string) {
    const res = await fetch(
      `${BASE}/api/clinic/medico/pacientes/${encodeURIComponent(patientId)}/consultations/${encodeURIComponent(appointmentId)}/notes`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...clinicFetchOpts().headers },
        credentials: "include",
        body: JSON.stringify({ content }),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al guardar las notas");
    return data as { content: string; updatedAt: string };
  },

  async getCobrosUnreadCount() {
    const res = await fetch(
      `${BASE}/api/clinic/notifications?scope=unread_count`,
      clinicFetchOpts(),
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar notificaciones");
    return data as { count: number; cobrosCount: number };
  },

  async getMercadoPagoPaymentNotifications() {
    const res = await fetch(
      `${BASE}/api/clinic/notifications?scope=unread&types=mercadopago_payment`,
      clinicFetchOpts(),
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar notificaciones");
    return data as {
      items: Array<{
        id: string;
        title: string;
        message: string;
        href?: string;
        createdAt: string;
      }>;
    };
  },

  async markNotificationsRead(ids: string[]) {
    const res = await fetch(`${BASE}/api/clinic/notifications`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ids }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al marcar notificación");
    return data as { ok: boolean; marked: number };
  },

  async getMercadoPagoOAuthConfig() {
    const res = await fetch(
      `${BASE}/api/clinic/mercadopago/oauth/config`,
      clinicFetchOpts(),
    );
    const data = await res.json();
    return data as {
      configured: boolean;
      redirectUri?: string;
      clientId?: string;
      checklist?: string[];
      diagnoseUrl?: string;
      error?: string;
    };
  },

  async getInPersonAvailability() {
    const res = await fetch(`${BASE}/api/clinic/in-person-availability`, clinicFetchOpts());
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "No se pudo cargar la agenda presencial");
    return data as {
      enabled: boolean;
      availability: { slotDurationMinutes: number; days: Array<{ dayOfWeek: number; startTime: string; endTime: string }> };
      location_info: { phone?: string; parkingNotes?: string };
    };
  },

  async saveInPersonAvailability(payload: {
    enabled: boolean;
    availability: { slotDurationMinutes: number; days: Array<{ dayOfWeek: number; startTime: string; endTime: string }> };
    location_info: { phone?: string; parkingNotes?: string };
  }) {
    const res = await fetch(`${BASE}/api/clinic/in-person-availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudo guardar la agenda presencial");
    return data;
  },

  async getInstitutions() {
    const res = await fetch(
      `${BASE}/api/clinic/institutions`,
      clinicFetchOpts(),
    );
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "No se pudieron obtener las instituciones");
    return data as { institutions: InstitutionRecord[] };
  },

  async saveInstitution(data: {
    name: string;
    city?: string;
    address?: string;
    extra_info?: string;
    schedule?: { days: Array<{ dayOfWeek: number; startTime: string; endTime: string }> };
  }) {
    const res = await fetch(`${BASE}/api/clinic/institutions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    const json = await parseJsonResponse(res);
    if (!res.ok) throw new Error(json.error || "No se pudo guardar la institución");
    return json as { institution: InstitutionRecord };
  },

  async updateInstitution(
    id: string,
    data: {
      name?: string;
      city?: string;
      address?: string;
      extra_info?: string;
      schedule?: { days: Array<{ dayOfWeek: number; startTime: string; endTime: string }> };
    },
  ) {
    const res = await fetch(`${BASE}/api/clinic/institutions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    const json = await parseJsonResponse(res);
    if (!res.ok) throw new Error(json.error || "No se pudo actualizar la institución");
    return json as { institution: InstitutionRecord };
  },

  async deleteInstitution(id: string) {
    const res = await fetch(`${BASE}/api/clinic/institutions/${id}`, {
      ...clinicFetchOpts(),
      method: "DELETE",
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "No se pudo eliminar la institución");
    return data as { ok: boolean };
  },

  /** Org-scoped patient search with visit stats (appointments/documents/
   * clinical records) — used by the dashboard header/panel search that shows
   * those badges. Doesn't need a doctorId: results are already scoped by
   * the session's org_id server-side. */
  async searchPatientsDetailed(query: string) {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    const res = await fetch(`${BASE}/api/clinic/patients?${params}`, clinicFetchOpts());
    return res.json();
  },

  async searchPatients(query: string) {
    if (!query.trim()) return [];
    const res = await fetch(
      `${BASE}/api/clinic/patients/search?q=${encodeURIComponent(query)}`,
      clinicFetchOpts(),
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al buscar pacientes");
    return data as Array<{
      id: string;
      fullName: string;
      email: string;
      dni?: string;
      lastAppointmentAt?: string;
    }>;
  },
};
