import type { ClinicSession } from "@/lib/clinic/session";
import type { AppointmentStatus } from "@/lib/clinic/local-db";

const SESSION_KEY = "clinica_local_session";

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

function authHeaders(): HeadersInit {
  const session = getClientSession();
  if (!session) return {};
  return {
    "X-Clinic-User-Id": session.userId,
    "X-Clinic-Role": session.role,
    "X-Clinic-Email": session.email,
    "X-Clinic-Name": session.fullName,
  };
}

const fetchOpts: RequestInit = {
  credentials: "include",
  headers: authHeaders(),
};

export const clinicApi = {
  async getSession() {
    const res = await fetch("/api/clinic/auth/session", {
      credentials: "include",
      headers: authHeaders(),
    });
    return res.json();
  },

  async login(email: string, password: string, role: "doctor" | "patient") {
    const res = await fetch("/api/clinic/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error de login");
    if (data.session) saveClientSession(data.session);
    return data;
  },

  async register(payload: Record<string, unknown>) {
    const res = await fetch("/api/clinic/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error de registro");
    if (data.session) saveClientSession(data.session);
    return data;
  },

  async logout() {
    clearClientSession();
    await fetch("/api/clinic/auth/session", {
      method: "POST",
      credentials: "include",
    });
  },

  async getDoctors() {
    const res = await fetch("/api/clinic/doctors", fetchOpts);
    return res.json();
  },

  async bookAppointment(payload: {
    doctorId: string;
    scheduledAt?: string;
    confirmPayment?: boolean;
    paymentMethod?: "transfer" | "mercadopago";
  }) {
    const {
      doctorId,
      scheduledAt,
      confirmPayment = false,
      paymentMethod = "transfer",
    } = payload;
    const res = await fetch("/api/clinic/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({
        doctorId,
        scheduledAt,
        confirmPayment,
        paymentMethod,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al reservar");
    return data as {
      waitingRoomUrl: string;
      checkoutUrl?: string;
      paymentProvider?: string;
    };
  },

  async getMercadoPagoCheckout(params: {
    accessToken?: string;
    appointmentId?: string;
  }) {
    const q = new URLSearchParams();
    if (params.accessToken) q.set("accessToken", params.accessToken);
    if (params.appointmentId) q.set("appointmentId", params.appointmentId);
    const res = await fetch(`/api/clinic/mercadopago?${q}`, {
      credentials: "include",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al obtener checkout");
    return data as {
      checkoutUrl?: string;
      paid?: boolean;
      waitingRoomUrl?: string;
    };
  },

  async confirmAppointmentPayment(accessToken: string) {
    const res = await fetch("/api/clinic/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ accessToken, action: "confirmPayment" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al confirmar pago");
    return data;
  },

  async saveIntakeReason(accessToken: string, intakeReason: string) {
    const res = await fetch("/api/clinic/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
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
    const res = await fetch("/api/clinic/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ action: "resendConfirmation", ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al enviar email");
    return data as { ok: boolean; message: string };
  },

  async sendTestReminderEmail() {
    const res = await fetch("/api/clinic/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ action: "testReminder" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al enviar prueba");
    return data as { ok: boolean; message: string };
  },

  async getPatientAppointments(patientId: string) {
    const res = await fetch(
      `/api/clinic/appointments?patientId=${patientId}`,
      fetchOpts
    );
    return res.json();
  },

  async getDoctorQueue(doctorId: string) {
    const res = await fetch(
      `/api/clinic/appointments?doctorId=${doctorId}&scope=upcoming`,
      fetchOpts
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar cola");
    return data;
  },

  async getAppointmentByToken(token: string) {
    const res = await fetch(
      `/api/clinic/appointments?token=${token}`,
      fetchOpts
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Turno no encontrado");
    return data;
  },

  async updateAppointmentStatus(
    appointmentId: string,
    status: AppointmentStatus
  ) {
    const res = await fetch("/api/clinic/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ appointmentId, status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al actualizar turno");
    return data;
  },

  async clearStuckConsultations(doctorId: string) {
    const res = await fetch("/api/clinic/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ doctorId, action: "clearStuck" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al limpiar cola");
    return data;
  },

  async getClinicalRecords(patientId: string) {
    const res = await fetch(
      `/api/clinic/clinical-records?patientId=${patientId}`,
      fetchOpts
    );
    return res.json();
  },

  async saveNotes(
    appointmentId: string,
    doctorId: string,
    content: string
  ) {
    await fetch("/api/clinic/notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ appointmentId, doctorId, content }),
    });
  },

  async getNotes(appointmentId: string) {
    const res = await fetch(
      `/api/clinic/notes?appointmentId=${appointmentId}`,
      fetchOpts
    );
    return res.json();
  },

  async getAvailableDates(doctorId: string) {
    const res = await fetch(
      `/api/clinic/schedule?doctorId=${doctorId}`,
      fetchOpts
    );
    return res.json();
  },

  async getSlots(doctorId: string, date: string) {
    const res = await fetch(
      `/api/clinic/schedule?doctorId=${doctorId}&date=${date}`,
      fetchOpts
    );
    return res.json();
  },

  async getDoctorSchedule(doctorId: string) {
    const res = await fetch(`/api/clinic/schedule?own=true`, fetchOpts);
    return res.json();
  },

  async saveDoctorOffice(payload: {
    availability?: import("@/lib/clinic/schedule").DoctorAvailability;
    blockedDates?: string[];
    signatureText?: string;
    signatureImageData?: string;
    profilePhotoData?: string;
    bio?: string;
    payment?: import("@/lib/clinic/local-db").DoctorPaymentSettings;
    reminderSettings?: import("@/lib/clinic/local-db").DoctorReminderSettings;
    googleCalendarId?: string;
  }) {
    const res = await fetch("/api/clinic/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Error al guardar consultorio");
    return res.json();
  },

  /** @deprecated use saveDoctorOffice */
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
    const res = await fetch("/api/clinic/documents", {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
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
    const res = await fetch(`/api/clinic/documents?${q}`, fetchOpts);
    return res.json();
  },

  async getPatientHistory(patientId: string) {
    const res = await fetch(
      `/api/clinic/patient-history?patientId=${patientId}`,
      fetchOpts
    );
    return res.json();
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
    const res = await fetch("/api/clinic/clinical-report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al generar informe");
    return data as { report: string };
  },

  async saveClinicalRecord(payload: {
    patientId: string;
    doctorId: string;
    appointmentId?: string;
    title?: string;
    content: string;
    recordType?: string;
  }) {
    const res = await fetch("/api/clinic/clinical-records", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al guardar informe");
    return data;
  },

  async searchPatients(doctorId: string, q = "") {
    const params = new URLSearchParams({ doctorId });
    if (q) params.set("q", q);
    const res = await fetch(`/api/clinic/patients?${params}`, fetchOpts);
    return res.json();
  },

  async updatePatientProfile(payload: { profilePhotoData?: string }) {
    const res = await fetch("/api/clinic/patients", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al actualizar perfil");
    return data;
  },

  async getInterconsultMessages(peerId: string | null = null) {
    const params = peerId ? `?peerId=${encodeURIComponent(peerId)}` : "";
    const res = await fetch(`/api/clinic/interconsult/messages${params}`, fetchOpts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar mensajes");
    return data as {
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
    const res = await fetch("/api/clinic/interconsult/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ content, toDoctorId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al enviar mensaje");
    return data;
  },

  async getInterconsultPresence() {
    const res = await fetch("/api/clinic/interconsult/presence", fetchOpts);
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
    await fetch("/api/clinic/interconsult/presence", {
      method: "POST",
      headers: authHeaders(),
      credentials: "include",
    });
  },

  async searchNodoChatDirectory(q = "") {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    const res = await fetch(`/api/clinic/interconsult/directory${params}`, fetchOpts);
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
    const res = await fetch("/api/clinic/interconsult/unread", fetchOpts);
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
    const res = await fetch("/api/clinic/interconsult/read", {
      method: "POST",
      headers: authHeaders(),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al marcar leído");
    return data as { readAt: string };
  },
};
