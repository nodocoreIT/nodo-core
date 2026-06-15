export type UserRole = "medico" | "paciente" | "admin";

export type AppointmentStatus =
  | "scheduled"
  | "waiting"
  | "in_consultation"
  | "completed"
  | "cancelled";

export type PatientLifecycleStatus = "en_espera" | "en_consulta" | "finalizada";

export type PaymentStatus = "pending" | "confirmed" | "waived";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  specialty?: string;
  license_number?: string;
  signature_url?: string;
  logo_url?: string;
  created_at: string;
}

export interface Patient {
  id: string;
  profile_id: string;
  date_of_birth?: string;
  medical_record_number?: string;
  profile?: Profile;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_at: string;
  status: AppointmentStatus;
  queue_position: number;
  jitsi_room_id: string;
  access_token: string;
  token_expires_at: string;
  created_at: string;
  updated_at: string;
  patient?: Patient & { profile?: Profile };
  doctor?: Profile;
}

export interface ClinicalRecord {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id?: string;
  record_type: string;
  title: string;
  content: string;
  created_at: string;
  doctor?: Profile;
}

export interface ClinicalNote {
  id: string;
  appointment_id: string;
  doctor_id: string;
  content: string;
  updated_at: string;
}

export interface Transcription {
  id: string;
  appointment_id: string;
  content: string;
  segments: TranscriptionSegment[];
  updated_at: string;
}

export interface TranscriptionSegment {
  speaker: "doctor" | "patient" | "unknown";
  text: string;
  timestamp: string;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface Prescription {
  id: string;
  appointment_id: string;
  doctor_id: string;
  patient_id: string;
  medications: Medication[];
  pdf_url?: string;
  sent_at?: string;
  created_at: string;
}

export interface StudyOrder {
  id: string;
  appointment_id: string;
  doctor_id: string;
  patient_id: string;
  studies: string[];
  notes?: string;
  pdf_url?: string;
  created_at: string;
}

export interface SoapSummary {
  id: string;
  appointment_id: string;
  subjective: string;
  objective: string;
  analysis: string;
  plan: string;
  created_at: string;
}

export interface PatientDocument {
  id: string;
  patient_id: string;
  appointment_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  uploaded_at: string;
  notified_doctor: boolean;
}

export interface QueuePatient {
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  patientPhoto?: string;
  status: PatientLifecycleStatus;
  queuePosition: number;
  scheduledAt: string;
  hasNewDocuments?: boolean;
  documentCount?: number;
  clinicalRecordCount?: number;
  intakeReason?: string;
}

export interface TimeWindow {
  start: string;
  end: string;
}

export interface DoctorAvailability {
  monday?: TimeWindow[];
  tuesday?: TimeWindow[];
  wednesday?: TimeWindow[];
  thursday?: TimeWindow[];
  friday?: TimeWindow[];
  saturday?: TimeWindow[];
  sunday?: TimeWindow[];
  slotDurationMinutes?: number;
}

export interface DoctorPaymentSettings {
  consultationFee?: number;
  currency?: string;
  alias?: string;
  cbu?: string;
  bankName?: string;
  paymentInstructions?: string;
  qrImageData?: string;
  requirePaymentBeforeBooking?: boolean;
}

export function mapAppointmentStatusToLifecycle(
  status: AppointmentStatus,
): PatientLifecycleStatus {
  switch (status) {
    case "waiting":
    case "scheduled":
      return "en_espera";
    case "in_consultation":
      return "en_consulta";
    case "completed":
    case "cancelled":
      return "finalizada";
    default:
      return "en_espera";
  }
}

export function mapLifecycleToAppointmentStatus(
  lifecycle: PatientLifecycleStatus,
): AppointmentStatus {
  switch (lifecycle) {
    case "en_espera":
      return "waiting";
    case "en_consulta":
      return "in_consultation";
    case "finalizada":
      return "completed";
  }
}
