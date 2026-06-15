import { randomBytes, randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import type { DoctorAvailability } from "@/lib/clinic/schedule";
import { DEFAULT_AVAILABILITY } from "@/lib/clinic/schedule";

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
  bankName?: string;
  paymentInstructions?: string;
  qrImageData?: string;
  /** Si true (default cuando hay honorario), el turno requiere confirmar transferencia. */
  requirePaymentBeforeBooking?: boolean;
  /** Cobro con Mercado Pago Checkout Pro */
  mercadopagoEnabled?: boolean;
  /** Access Token de la app MP del médico (no se expone al paciente). */
  mercadopagoAccessToken?: string;
}

export interface DoctorReminderSettings {
  enabled?: boolean;
  /** Minutos antes del turno para enviar recordatorio (ej. 1440 = 24 h). */
  minutesBefore?: number;
}

export type PaymentStatus = "pending" | "confirmed" | "waived";

export interface LocalDoctor {
  id: string;
  fullName: string;
  email: string;
  password: string;
  specialty: string;
  licenseNumber: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlan: string;
  availability?: DoctorAvailability;
  signatureText?: string;
  signatureImageData?: string;
  profilePhotoData?: string;
  bio?: string;
  payment?: DoctorPaymentSettings;
  reminderSettings?: DoctorReminderSettings;
  googleCalendarId?: string;
  createdAt: string;
}

export interface LocalPatient {
  id: string;
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  profilePhotoData?: string;
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
  reminderSentAt?: string;
  confirmationEmailSentAt?: string;
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
}

export interface LocalClinicalRecord {
  id: string;
  patientId: string;
  doctorId: string;
  title: string;
  content: string;
  recordType: string;
  createdAt: string;
}

export interface LocalClinicalNote {
  appointmentId: string;
  doctorId: string;
  content: string;
  updatedAt: string;
}

/** Mensaje en sala general o DM entre médicos */
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
  doctors: LocalDoctor[];
  patients: LocalPatient[];
  appointments: LocalAppointment[];
  documents: LocalDocument[];
  clinicalRecords: LocalClinicalRecord[];
  clinicalNotes: Record<string, LocalClinicalNote>;
  interconsultMessages?: InterconsultMessage[];
  doctorPresence?: Record<string, DoctorPresenceEntry>;
}

const DATA_DIR = process.env.CLINIC_DATA_DIR
  ? path.resolve(process.env.CLINIC_DATA_DIR)
  : process.env.VERCEL === "1"
    ? "/tmp/clinic-data"
    : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "clinic.json");

const SEED: ClinicDatabase = {
  doctors: [
    {
      id: "doc-mauro-001",
      fullName: "Mauro Lluch",
      email: "maurolluch@gmail.com",
      password: "Probando1",
      specialty: "Gastroenterología",
      licenseNumber: "MN 98765",
      subscriptionStatus: "active",
      subscriptionPlan: "profesional",
      availability: DEFAULT_AVAILABILITY,
      signatureText: "Mauro Lluch — MN 98765",
      createdAt: new Date().toISOString(),
    },
    {
      id: "doc-demo-001",
      fullName: "Dra. María González",
      email: "maria@demo.com",
      password: "Probando1",
      specialty: "Medicina General",
      licenseNumber: "MN 12345",
      subscriptionStatus: "active",
      subscriptionPlan: "profesional",
      availability: DEFAULT_AVAILABILITY,
      signatureText: "Dra. María González — MN 12345",
      createdAt: new Date().toISOString(),
    },
  ],
  patients: [
    {
      id: "pat-demo-001",
      fullName: "Juan Pérez",
      email: "paciente@demo.com",
      password: "Probando1",
      phone: "11 5555-0001",
      createdAt: new Date().toISOString(),
    },
    {
      id: "pat-demo-002",
      fullName: "Laura Fernández",
      email: "paciente2@demo.com",
      password: "Probando1",
      phone: "11 5555-0002",
      createdAt: new Date().toISOString(),
    },
  ],
  appointments: [],
  documents: [],
  clinicalRecords: [
    {
      id: "rec-001",
      patientId: "pat-demo-001",
      doctorId: "doc-mauro-001",
      title: "Consulta previa — Control digestivo",
      content: "Paciente refiere mejoría. Continuar tratamiento actual.",
      recordType: "consultation",
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    },
  ],
  clinicalNotes: {},
  interconsultMessages: [
    {
      id: "ic-welcome-001",
      fromDoctorId: "doc-mauro-001",
      fromDoctorName: "Mauro Lluch",
      toDoctorId: null,
      content:
        "Bienvenidos a la sala de interconsultas. Acá pueden consultar casos clínicos entre colegas en tiempo real.",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ],
  doctorPresence: {},
};

let writeQueue: Promise<void> = Promise.resolve();

const CLINIC_BLOB_PATH = "clinic/clinic.json";

async function readFromBlob(): Promise<ClinicDatabase | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  try {
    const { head } = await import("@vercel/blob");
    const info = await head(CLINIC_BLOB_PATH, { token });
    const res = await fetch(info.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return JSON.parse(await res.text()) as ClinicDatabase;
  } catch {
    return null;
  }
}

async function writeToBlob(db: ClinicDatabase): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;
  const { put } = await import("@vercel/blob");
  await put(CLINIC_BLOB_PATH, JSON.stringify(db), {
    access: "private",
    addRandomSuffix: false,
    token,
    contentType: "application/json",
  });
}

async function persistDb(db: ClinicDatabase): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  await writeToBlob(db);
}

async function ensureDb(): Promise<ClinicDatabase> {
  const fromBlob = await readFromBlob();
  if (fromBlob) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const normalized = normalizeDb(fromBlob);
    await fs.writeFile(DB_PATH, JSON.stringify(normalized, null, 2), "utf-8");
    return normalized;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    const parsed = normalizeDb(JSON.parse(raw) as ClinicDatabase);
    await writeToBlob(parsed);
    return parsed;
  } catch {
    const seed = structuredClone(SEED);
    await fs.writeFile(DB_PATH, JSON.stringify(seed, null, 2), "utf-8");
    return seed;
  }
}

function normalizeDb(db: ClinicDatabase): ClinicDatabase {
  if (!db.interconsultMessages) db.interconsultMessages = [];
  if (!db.doctorPresence) db.doctorPresence = {};
  return db;
}

export const ONLINE_THRESHOLD_MS = 90_000;

export async function readDb(): Promise<ClinicDatabase> {
  return ensureDb();
}

export async function writeDb(updater: (db: ClinicDatabase) => void): Promise<ClinicDatabase> {
  writeQueue = writeQueue.then(async () => {
    const db = await ensureDb();
    updater(db);
    await persistDb(db);
  });
  await writeQueue;
  return ensureDb();
}

export function newToken(): string {
  return randomBytes(24).toString("hex");
}

export function newId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function publicPaymentSettings(payment?: DoctorPaymentSettings) {
  if (!payment) {
    return { requirePaymentBeforeBooking: true as const };
  }
  return {
    consultationFee: payment.consultationFee,
    currency: payment.currency ?? "ARS",
    alias: payment.alias,
    cbu: payment.cbu,
    bankName: payment.bankName,
    paymentInstructions: payment.paymentInstructions,
    qrImageData: payment.qrImageData,
    requirePaymentBeforeBooking: payment.requirePaymentBeforeBooking !== false,
    mercadopagoEnabled: !!payment.mercadopagoEnabled,
  };
}

export function publicDoctorSummary(doctor: LocalDoctor) {
  return {
    id: doctor.id,
    fullName: doctor.fullName,
    specialty: doctor.specialty,
    licenseNumber: doctor.licenseNumber,
    profilePhotoData: doctor.profilePhotoData,
    payment: publicPaymentSettings(doctor.payment),
  };
}

export function publicDoctor(doctor: LocalDoctor) {
  const { password: _, ...rest } = doctor;
  return {
    ...rest,
    payment: publicPaymentSettings(doctor.payment),
  };
}

export function publicPatient(patient: LocalPatient) {
  const { password: _, ...rest } = patient;
  return rest;
}
