import { randomBytes, randomUUID } from "crypto";
import { promises as fs } from "fs";

import type { DoctorAvailability } from "@/lib/clinic/schedule";
import { getClinicDataDir, getClinicDbPath } from "@/lib/clinic/data-dir";
import type { DoctorThemeSettings } from "@/lib/clinic/theme-settings";
import { buildClinicSeed, CLINIC_SEED_VERSION } from "@/lib/clinic/seed";

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
  /** Colores, tipografía y marca del panel médico */
  themeSettings?: DoctorThemeSettings;
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
  meta?: { seedVersion?: number };
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
}

const DATA_DIR = getClinicDataDir();
const DB_PATH = getClinicDbPath();

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

async function loadDb(): Promise<ClinicDatabase> {
  let db: ClinicDatabase | null = null;

  const fromBlob = await readFromBlob();
  if (fromBlob) {
    db = normalizeDb(fromBlob);
  } else {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      const raw = await fs.readFile(DB_PATH, "utf-8");
      db = normalizeDb(JSON.parse(raw) as ClinicDatabase);
    } catch {
      db = null;
    }
  }

  const version = db?.meta?.seedVersion ?? 0;
  if (!db || version < CLINIC_SEED_VERSION) {
    const seed = buildClinicSeed();
    const normalized = normalizeDb(seed);
    await persistDb(normalized);
    return normalized;
  }

  return db;
}

async function ensureDb(): Promise<ClinicDatabase> {
  return loadDb();
}

function normalizeDb(db: ClinicDatabase): ClinicDatabase {
  if (!db.interconsultMessages) db.interconsultMessages = [];
  if (!db.doctorPresence) db.doctorPresence = {};
  if (!db.nodoChatReadAt) db.nodoChatReadAt = {};
  if (!db.doctorTasks) db.doctorTasks = [];
  return db;
}

export const ONLINE_THRESHOLD_MS = 90_000;

export async function readDb(): Promise<ClinicDatabase> {
  return ensureDb();
}

export async function writeDb(updater: (db: ClinicDatabase) => void): Promise<ClinicDatabase> {
  let saved: ClinicDatabase | null = null;
  writeQueue = writeQueue.then(async () => {
    const db = await loadDb();
    updater(db);
    if (!db.meta) {
      db.meta = { seedVersion: CLINIC_SEED_VERSION };
    }
    await persistDb(db);
    saved = db;
  });
  await writeQueue;
  return saved!;
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
