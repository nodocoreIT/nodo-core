/**
 * Shared clinic types — safe to import from both client and server code.
 *
 * server-only modules (e.g. session.ts) re-export from here so
 * client bundles never pull in Node.js-only imports.
 */

import { randomUUID } from "crypto";

export type SessionRole = "doctor" | "patient";

export interface ClinicSession {
  userId: string;
  role: SessionRole;
  email: string;
  fullName: string;
}

export type SubscriptionStatus = "trial" | "active" | "expired";
export type AppointmentStatus =
  | "scheduled"
  | "waiting"
  | "in_consultation"
  | "completed"
  | "cancelled";

export interface DoctorPaymentSettings {
  consultationFee?: number;
  currency?: string;
  alias?: string;
  cbu?: string;
  /** Nombre del titular como figura en el comprobante bancario */
  beneficiaryName?: string;
  bankName?: string;
  paymentInstructions?: string;
  qrImageData?: string;
  /** Si true (default cuando hay honorario), el turno requiere confirmar transferencia. */
  requirePaymentBeforeBooking?: boolean;
  /** Cobro con Mercado Pago (Checkout Pro / QR) */
  mercadopagoEnabled?: boolean;
  /** Access Token OAuth o legacy manual — solo servidor. */
  mercadopagoAccessToken?: string;
  mercadopagoRefreshToken?: string;
  mercadopagoTokenExpiresAt?: string;
  mercadopagoUserId?: string;
  mercadopagoPublicKey?: string;
  mercadopagoConnectedAt?: string;
  /** Caja / POS para órdenes QR (external_pos_id en MP). */
  mercadopagoExternalPosId?: string;
  /** PKCE pendiente durante el flujo OAuth (efímero). */
  mercadopagoOAuthPending?: {
    state: string;
    codeVerifier: string;
    createdAt: string;
  };
}

export interface DoctorReminderSettings {
  enabled?: boolean;
  /** Minutos antes del turno para enviar recordatorio (ej. 1440 = 24 h). */
  minutesBefore?: number;
}

export type PaymentStatus = "pending" | "confirmed" | "waived" | "rejected" | "refunded" | "refund_failed";

export interface PaymentReceiptAudit {
  validatedAt: string;
  valid: boolean;
  confidence: number;
  expectedAmount?: number;
  currency?: string;
  amount?: number;
  alias?: string;
  holderName?: string;
  cbu?: string;
  payerName?: string;
  transferDate?: string;
  transferTime?: string;
  /** Nº de operación / id Op del comprobante bancario */
  operationId?: string;
  summary?: string;
  checks?: {
    amount: { pass: boolean; detail: string };
    cbu: { pass: boolean; detail: string };
    alias: { pass: boolean; detail: string };
    holderName: { pass: boolean; detail: string };
    receiptType: { pass: boolean; detail: string };
  };
  reasons?: string[];
}

export interface LocalDoctor {
  id: string;
  fullName: string;
  email: string;
  password: string;
  specialty: string;
  licenseNumber: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlan: string;
  availability?: import("@/lib/clinic/schedule").DoctorAvailability;
  signatureText?: string;
  signatureImageData?: string;
  profilePhotoData?: string;
  bio?: string;
  payment?: DoctorPaymentSettings;
  reminderSettings?: DoctorReminderSettings;
  googleCalendarId?: string;
  /** Colores, tipografía y marca del panel médico */
  themeSettings?: import("@/lib/clinic/theme-settings").DoctorThemeSettings;
  /** Estudios agregados manualmente por el médico */
  customStudyLabels?: string[];
  createdAt: string;
}

export interface PatientHealthProfile {
  birthDate?: string;
  sex?: "F" | "M" | "O" | "";
  heightCm?: number;
  weightKg?: number;
  bloodType?: string;
  allergies?: string;
  chronicConditions?: string;
  medications?: string;
  emergencyContact?: string;
  notes?: string;
  updatedAt?: string;
  // Insurance / obra social
  obraSocial?: string;
  insuranceNumber?: string;
  // Contact
  phone?: string;
}

export interface LocalPatient {
  id: string;
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  profilePhotoData?: string;
  healthProfile?: PatientHealthProfile;
  createdAt: string;
}

export interface LocalAppointment {
  id: string;
  doctorId: string;
  patientId: string;
  scheduledAt: string;
  status: AppointmentStatus;
  queuePosition: number;
  jitsiRoomId: string;
  accessToken: string;
  tokenExpiresAt: string;
  paymentStatus?: PaymentStatus;
  paymentConfirmedAt?: string;
  paymentProvider?: "transfer" | "mercadopago";
  mercadopagoPreferenceId?: string;
  mercadopagoPaymentId?: string;
  intakeReason?: string;
  /** Paciente autorizó compartir ficha de salud con este médico en este turno */
  shareHealthProfile?: boolean;
  reminderSentAt?: string;
  confirmationEmailSentAt?: string;
  paymentReceiptAudit?: PaymentReceiptAudit;
  createdAt: string;
  updatedAt: string;
}

export interface LocalDocument {
  id: string;
  patientId: string;
  appointmentId: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  uploadedAt: string;
  /** En Vercel el disco /tmp no persiste — guardamos el archivo en JSON/Blob. */
  inlineDataBase64?: string;
}

export interface LocalClinicalRecord {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId?: string;
  title: string;
  content: string;
  recordType: string;
  createdAt: string;
  /** PDF generado (receta, orden de estudios, etc.) */
  documentId?: string;
}

export interface LocalClinicalNote {
  appointmentId: string;
  doctorId: string;
  content: string;
  updatedAt: string;
}

/** Tarea manual del médico (además de turnos derivados de la agenda) */
export interface DoctorTask {
  id: string;
  doctorId: string;
  title: string;
  /** ISO date YYYY-MM-DD */
  dueDate?: string;
  done: boolean;
  createdAt: string;
}

export type DoctorNotificationType =
  | "mercadopago_payment"
  | "transfer_pending"
  | "general";

export interface DoctorNotification {
  id: string;
  doctorId: string;
  type: DoctorNotificationType;
  title: string;
  message: string;
  href?: string;
  read: boolean;
  createdAt: string;
  meta?: {
    appointmentId?: string;
    mercadopagoPaymentId?: string;
    amount?: number;
    currency?: string;
  };
}

export interface InterconsultMessage {
  id: string;
  fromDoctorId: string;
  fromDoctorName: string;
  /** null = sala general de interconsultas */
  toDoctorId: string | null;
  content: string;
  createdAt: string;
}

export interface DoctorPresenceEntry {
  doctorId: string;
  lastSeen: string;
}

export interface ClinicDatabase {
  /** Control de reset demo al desplegar (ver CLINIC_SEED_VERSION) */
  meta?: { seedVersion?: number; revision?: number };
  doctors: LocalDoctor[];
  patients: LocalPatient[];
  appointments: LocalAppointment[];
  documents: LocalDocument[];
  clinicalRecords: LocalClinicalRecord[];
  clinicalNotes: Record<string, LocalClinicalNote>;
  interconsultMessages?: InterconsultMessage[];
  doctorPresence?: Record<string, DoctorPresenceEntry>;
  /** Última vez que el médico leyó el chat (ISO por doctorId) */
  nodoChatReadAt?: Record<string, string>;
  doctorTasks?: DoctorTask[];
  doctorNotifications?: DoctorNotification[];
}

export function newId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}
