import type { ClinicSession } from "@/lib/clinic/types";
import type { AppointmentStatus } from "@/lib/clinic/types";
import type { MedicationSearchResponse } from "@/lib/clinic/medication-catalog";

const BASE = "";
const SESSION_KEY = "clinica_local_session";

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
}

// ── Fetch helpers ─────────────────────────────────────────────────────────

function clinicFetchOpts(): RequestInit {
  return {
    credentials: "include",
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

// ── Role helpers ──────────────────────────────────────────────────────────

const PRIVILEGED_ROLES = ["super_admin", "admin", "medico", "agent"];

function mapSessionRole(appMetadataRole: string | null | undefined): "doctor" | "patient" {
  return PRIVILEGED_ROLES.includes(appMetadataRole ?? "") ? "doctor" : "patient";
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
  async getSession() {
    // 1. Try browser Supabase client (fast, no round-trip)
    const client = getBrowserSupabase();
    if (client) {
      try {
        const supabase = await client;
        const { data: { session } } = await supabase.auth.getSession();
        // getUser() is more reliable when getSession() returns null — it verifies
        // the token server-side (handles split-cookie edge cases and stale state).
        let authUser = session?.user;
        if (!authUser) {
          const { data: { user: freshUser } } = await supabase.auth.getUser();
          authUser = freshUser ?? undefined;
        }
        if (authUser) {
          const appMeta = authUser.app_metadata ?? {};
          const userMeta = authUser.user_metadata ?? {};
          const sessionRole = mapSessionRole(appMeta.role);

          // A privileged user (doctor) can also log in as a patient.
          // If they explicitly chose "patient" at login (stored in sessionStorage),
          // honour that choice so the patient portal works correctly.
          const stored = getClientSession();
          const effectiveRole: "doctor" | "patient" =
            stored?.userId === authUser.id &&
            stored?.role === "patient" &&
            sessionRole === "doctor"
              ? "patient"
              : sessionRole;

          // user_metadata.full_name is set once at provisioning time and can
          // go stale (e.g. carry a name from a different account). Prefer the
          // canonical name resolved server-side from professionals/patients.
          let fullName: string =
            userMeta.full_name ?? userMeta.name ?? authUser.email ?? "";
          let profilePhotoUrl: string | undefined;
          // For a doctor, the business id is professionals.id, not the Supabase
          // Auth user id (authUser.id === professionals.user_id, a different
          // column) — appointments.doctor_id and every doctor-scoped query
          // expect professionals.id. /api/clinic/account/session resolves it
          // server-side; keep authUser.id only as a last-resort fallback.
          let resolvedId: string = authUser.id;
          try {
            const sessionRes = await fetch(`${BASE}/api/clinic/account/session`, {
              credentials: "include",
              cache: "no-store",
            });
            if (sessionRes.ok) {
              const sessionData = await parseJsonResponse(sessionRes);
              if (sessionData.user?.fullName) {
                fullName = sessionData.user.fullName;
              }
              profilePhotoUrl = sessionData.user?.profilePhotoUrl;
              if (sessionData.user?.id) {
                resolvedId = sessionData.user.id;
              }
            }
          } catch {
            /* keep the auth id / user_metadata fallback */
          }
          return {
            session: {
              userId: authUser.id,
              email: authUser.email,
              role: effectiveRole,
              org_id: appMeta.org_id ?? null,
            },
            user: {
              id: resolvedId,
              email: authUser.email,
              fullName,
              profilePhotoUrl,
              role: effectiveRole,
              subscriptionPlan: appMeta.plan ?? appMeta.subscription_plan ?? undefined,
              org_id: appMeta.org_id ?? null,
            },
          };
        }
      } catch {
        /* fall through to HTTP */
      }
    }

    // 2. Local mode: clinic_session cookie + JSON DB
    if (!useBrowserSupabaseAuth()) {
      const res = await fetch(`${BASE}/api/clinic/auth/session`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await parseJsonResponse(res);
      return { session: data.session ?? null, user: data.user ?? null };
    }

    // 3. Supabase: HTTP session API
    const res = await fetch(`${BASE}/api/clinic/account/session`, {
      credentials: "include",
    });
    return parseJsonResponse(res);
  },

  /**
   * Sign in via the browser Supabase client (sets cookies in document.cookie
   * so both browser reads and server API calls work).
   *
   * This matches how nodo-inmo / nodo-autos / nodo-finanzas handle login.
   */
  async login(email: string, password: string, role: "doctor" | "patient") {
    const client = getBrowserSupabase();
    if (client) {
      const supabase = await client;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        const msg = (error.message ?? "").toLowerCase();
        if (msg.includes("invalid login") || msg.includes("invalid_credentials")) {
          throw new Error("Credenciales incorrectas. Verificá tu email y contraseña.");
        }
        throw new Error(error.message || "Credenciales incorrectas");
      }
      if (!data.user) throw new Error("Credenciales incorrectas");

      const appMeta = data.user.app_metadata ?? {};
      const userMeta = data.user.user_metadata ?? {};
      const fullName: string =
        userMeta.full_name ?? data.user.email?.split("@")[0] ?? "";
      const sessionRole = mapSessionRole(appMeta.role);

      const effectiveRole = role === "patient" ? "patient" : sessionRole;

      // Save to sessionStorage for client components that still use it
      saveClientSession({
        userId: data.user.id,
        role: effectiveRole,
        email: data.user.email ?? "",
        fullName,
      });

      // Persist role choice server-side via ClinicSession cookie so API routes
      // (requireAuth) can honour a privileged user acting as "patient".
      await fetch(`${BASE}/api/clinic/auth/set-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: effectiveRole }),
      });

      return {
        user: {
          id: data.user.id,
          email: data.user.email,
          fullName,
          role: effectiveRole,
          org_id: appMeta.org_id ?? null,
        },
        role: effectiveRole,
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
    return respData;
  },

  async register(payload: {
    email: string;
    role: "medico" | "paciente";
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

  async completeOnboardingMedico(data: {
    fullName: string;
    specialty: string;
    licenseNumber: string;
    plan: string;
    token: string;
  }): Promise<{ ok: boolean }> {
    const res = await fetch(`${BASE}/api/clinic/account/onboarding/medico`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    const resData = await parseJsonResponse(res);
    if (!res.ok) throw new Error(resData.error || "Error en onboarding");
    return resData as { ok: boolean };
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
    if (!res.ok) throw new Error(resData.error || "Error en onboarding");
    return resData as { ok: boolean };
  },

  async logout() {
    clearClientSession();
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
      payment?: import("@/lib/clinic/types").DoctorPaymentSettings & {
        requirePaymentBeforeBooking?: boolean;
        mercadopagoEnabled?: boolean;
      };
    };
  },

  async bookAppointment(payload: {
    doctorId: string;
    scheduledAt?: string;
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
  }) {
    const q = new URLSearchParams();
    if (params.accessToken) q.set("accessToken", params.accessToken);
    if (params.appointmentId) q.set("appointmentId", params.appointmentId);
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
    };
  },

  async startSubscriptionCheckout(planId: string) {
    const res = await fetch(`${BASE}/api/clinic/subscription/checkout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
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
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        accessToken,
        action: "patientRemoveAppointment",
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al eliminar turno");
    return data;
  },

  async deleteCancelledAppointment(accessToken: string) {
    const res = await fetch(`${BASE}/api/clinic/appointments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
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
    const res = await fetch(
      `${BASE}/api/clinic/appointments?patientId=${patientId}`,
      clinicFetchOpts(),
    );
    return parseJsonResponse(res);
  },

  async getDoctorAppointments(
    doctorId: string,
    scope: "today" | "upcoming" | "active" = "today",
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
    return this.getDoctorAppointments(doctorId, "upcoming");
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

  async getAvailableDates(doctorId: string) {
    const res = await fetch(
      `${BASE}/api/clinic/schedule?doctorId=${doctorId}`,
      clinicFetchOpts()
    );
    return res.json();
  },

  async getSlots(doctorId: string, date: string) {
    const res = await fetch(
      `${BASE}/api/clinic/schedule?doctorId=${doctorId}&date=${date}`,
      clinicFetchOpts()
    );
    return res.json();
  },

  async getDoctorSchedule(doctorId: string) {
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

  async uploadDocument(file: File, accessToken: string) {
    const form = new FormData();
    form.append("file", file);
    form.append("accessToken", accessToken);
    const res = await fetch(`${BASE}/api/clinic/documents`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al subir archivo");
    return data;
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
    appointmentId: string;
    doctorId: string;
    patientId: string;
    medications: Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions?: string;
    }>;
    pdfBase64?: string;
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

  async searchPatients(doctorId: string, q = "") {
    const params = new URLSearchParams({ doctorId });
    if (q) params.set("q", q);
    const res = await fetch(`${BASE}/api/clinic/patients?${params}`, clinicFetchOpts());
    return res.json();
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
        scheduledAt: string;
        patientName: string;
        patientPhone?: string;
        paymentStatus?: string;
        paymentProvider?: string;
        audit?: import("@/lib/clinic/types").PaymentReceiptAudit;
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

  async getCobrosUnreadCount() {
    const res = await fetch(
      `${BASE}/api/clinic/notifications?scope=unread_count`,
      clinicFetchOpts(),
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar notificaciones");
    return data as { count: number; cobrosCount: number };
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
};
