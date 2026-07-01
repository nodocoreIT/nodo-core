import { randomBytes, randomUUID } from "crypto";
import { promises as fs } from "fs";

import type { DoctorAvailability } from "@/lib/clinic/schedule";
import { getClinicDataDir, getClinicDbPath } from "@/lib/clinic/data-dir";
import type { DoctorThemeSettings } from "@/lib/clinic/theme-settings";
import { buildClinicSeed, CLINIC_SEED_VERSION } from "@/lib/clinic/seed";
import { doctorHasMercadoPagoConnection } from "@/lib/mercadopago/connection";

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

export type PaymentStatus = "pending" | "confirmed" | "waived" | "rejected";

export interface PaymentReceiptAudit {
  validatedAt: string;
  valid: boolean;
  confidence: number;
  expectedAmount?: number;
  currency?: string;
  amount?: number;
  recipient?: string;
  payerName?: string;
  transferDate?: string;
  transferTime?: string;
  /** Nº de operación / id Op del comprobante bancario */
  operationId?: string;
  summary?: string;
  checks?: {
    amount: { pass: boolean; detail: string };
    recipient: { pass: boolean; detail: string };
    schedule: { pass: boolean; detail: string };
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
  /** Organización Nodo (JWT org_id) — modo plataforma */
  orgId?: string;
  /** auth.users.id de Supabase */
  supabaseUserId?: string;
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
  /** Disposición del consultorio (módulos, cola, calendario) */
  consultorioLayout?: import("@/lib/clinic/consultorio-layout").ConsultorioLayoutSettings;
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

const DATA_DIR = getClinicDataDir();
const DB_PATH = getClinicDbPath();

let writeQueue: Promise<void> = Promise.resolve();

const CLINIC_BLOB_PATH = "clinic/clinic.json";

function blobReadWriteToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined;
}

/** Vercel conecta Blob vía OIDC (BLOB_STORE_ID) o token legacy (BLOB_READ_WRITE_TOKEN). */
function isBlobConfigured(): boolean {
  if (blobReadWriteToken()) return true;
  if (process.env.BLOB_STORE_ID?.trim() && process.env.VERCEL) return true;
  return false;
}

function blobAuthOptions(): {
  token?: string;
  oidcToken?: string;
  storeId?: string;
  access?: "private";
} {
  const token = blobReadWriteToken();
  if (token) return { token, access: "private" };
  const oidcToken = process.env.VERCEL_OIDC_TOKEN?.trim();
  const storeId = process.env.BLOB_STORE_ID?.trim();
  if (oidcToken && storeId) {
    return { oidcToken, storeId, access: "private" };
  }
  return { access: "private" };
}

async function readStreamAsText(
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.byteLength) chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function readBlobText(): Promise<string | null> {
  if (!isBlobConfigured()) return null;
  const { get, head } = await import("@vercel/blob");
  const auth = blobAuthOptions();
  const getOpts = {
    access: "private" as const,
    useCache: false as const,
    ...(auth.token ? { token: auth.token } : {}),
    ...(auth.oidcToken && auth.storeId
      ? { oidcToken: auth.oidcToken, storeId: auth.storeId }
      : {}),
  };

  const info = await head(CLINIC_BLOB_PATH, auth).catch(() => null);
  if (!info) return null;

  const tryStream = async (
    target: string,
  ): Promise<string | null> => {
    const result = await get(target, getOpts).catch(() => null);
    if (!result?.stream) return null;
    return readStreamAsText(result.stream);
  };

  let text =
    (await tryStream(CLINIC_BLOB_PATH)) ??
    (info.url ? await tryStream(info.url) : null);

  if (!text && info.downloadUrl) {
    const res = await fetch(info.downloadUrl, { cache: "no-store" }).catch(
      () => null,
    );
    if (res?.ok) text = await res.text();
  }

  return text;
}

async function readFromBlob(): Promise<ClinicDatabase | null> {
  if (!isBlobConfigured()) return null;
  try {
    const text = await readBlobText();
    if (!text?.trim()) return null;
    return JSON.parse(text) as ClinicDatabase;
  } catch (err) {
    console.error("[clinic-db] readFromBlob failed", err);
    return null;
  }
}

async function blobStoreExists(): Promise<boolean> {
  if (!isBlobConfigured()) return false;
  try {
    const { head } = await import("@vercel/blob");
    await head(CLINIC_BLOB_PATH, blobAuthOptions());
    return true;
  } catch {
    return false;
  }
}

async function readFromBlobWithRetry(
  attempts = 6,
): Promise<ClinicDatabase | null> {
  for (let i = 0; i < attempts; i++) {
    const data = await readFromBlob();
    if (data) return data;
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 200 * (i + 1)));
    }
  }
  return null;
}

/** Migra datos demo sin borrar médicos/pacientes reales registrados. */
function migrateDbToCurrentSeedVersion(db: ClinicDatabase): ClinicDatabase {
  const seed = buildClinicSeed();
  for (const doc of seed.doctors) {
    if (!db.doctors.some((d) => d.email === doc.email)) {
      db.doctors.push(doc);
    }
  }
  for (const pat of seed.patients) {
    if (!db.patients.some((p) => p.email === pat.email)) {
      db.patients.push(pat);
    }
  }
  if (!db.meta) db.meta = { seedVersion: CLINIC_SEED_VERSION, revision: 0 };
  db.meta.seedVersion = CLINIC_SEED_VERSION;
  return normalizeDb(db);
}

async function writeToBlob(db: ClinicDatabase): Promise<void> {
  if (!isBlobConfigured()) return;
  const { put } = await import("@vercel/blob");
  const auth = blobAuthOptions();
  await put(CLINIC_BLOB_PATH, JSON.stringify(db), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
    ...(auth.token ? { token: auth.token } : {}),
    ...(auth.oidcToken && auth.storeId
      ? { oidcToken: auth.oidcToken, storeId: auth.storeId }
      : {}),
  });
}

async function persistDb(db: ClinicDatabase): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8").catch(
    () => undefined,
  );
  if (!isBlobConfigured()) {
    if (process.env.VERCEL) {
      console.warn(
        "[clinic-db] Blob no configurado en Vercel — datos efímeros hasta conectar Storage",
      );
    }
    return;
  }
  try {
    await writeToBlob(db);
  } catch (err) {
    console.error("[clinic-db] writeToBlob failed", err);
    if (!process.env.VERCEL) throw err;
  }
}

async function loadDb(): Promise<ClinicDatabase> {
  let db: ClinicDatabase | null = null;
  const hasBlob = isBlobConfigured();

  try {
    const fromBlob = hasBlob
      ? await readFromBlobWithRetry()
      : await readFromBlob();
    if (fromBlob) {
      db = fromBlob;
    } else if (!hasBlob) {
      try {
        const raw = await fs.readFile(DB_PATH, "utf-8");
        db = JSON.parse(raw) as ClinicDatabase;
      } catch {
        db = null;
      }
    } else if (await blobStoreExists()) {
      console.error(
        "[clinic-db] clinic.json existe en Blob pero no se pudo leer — re-inicializando seed",
      );
      db = null;
    }
  } catch (err) {
    console.error("[clinic-db] blob unavailable", err);
    db = null;
  }

  if (!db) {
    const normalized = normalizeDb(buildClinicSeed());
    await persistDb(normalized);
    return normalized;
  }

  db = normalizeDb(db);
  const version = db.meta?.seedVersion ?? 0;

  if (version < CLINIC_SEED_VERSION) {
    const migrated = migrateDbToCurrentSeedVersion(db);
    await persistDb(migrated);
    return migrated;
  }

  const before = db.patients.length + db.doctors.length;
  const normalized = normalizeDb(db);
  if (normalized.patients.length + normalized.doctors.length > before) {
    await persistDb(normalized);
  }
  return normalized;
}

async function ensureDb(): Promise<ClinicDatabase> {
  return loadDb();
}

function normalizeDb(db: ClinicDatabase): ClinicDatabase {
  if (!db.interconsultMessages) db.interconsultMessages = [];
  if (!db.doctorPresence) db.doctorPresence = {};
  if (!db.nodoChatReadAt) db.nodoChatReadAt = {};
  if (!db.doctorTasks) db.doctorTasks = [];
  if (!db.doctorNotifications) db.doctorNotifications = [];
  ensureExtraDemoDoctors(db);
  ensureDemoPatients(db);
  return db;
}

function ensureDemoPatients(db: ClinicDatabase) {
  const now = new Date().toISOString();
  const extras = [
    {
      id: "pat-demo-1",
      fullName: "Paciente 1",
      email: "paciente1@nodo.demo",
    },
    {
      id: "pat-demo-2",
      fullName: "Paciente 2",
      email: "paciente2@nodo.demo",
    },
  ];
  for (const extra of extras) {
    if (db.patients.some((p) => p.email === extra.email)) continue;
    db.patients.push({
      ...extra,
      password: "Probando1",
      createdAt: now,
    });
  }
}

function ensureExtraDemoDoctors(db: ClinicDatabase) {
  const now = new Date().toISOString();
  const extras = [
    {
      id: "doc-demo-3",
      fullName: "Dra. Demo 3",
      email: "doc.demo3@nodo.demo",
      specialty: "Gastroenterología",
      licenseNumber: "MN 10003",
    },
    {
      id: "doc-demo-4",
      fullName: "Lic. Demo 4",
      email: "doc.demo4@nodo.demo",
      specialty: "Psicología",
      licenseNumber: "MN 10004",
    },
  ];

  for (const extra of extras) {
    if (db.doctors.some((d) => d.email === extra.email)) continue;
    db.doctors.push({
      ...extra,
      password: "Probando1",
      subscriptionStatus: "active",
      subscriptionPlan: "profesional",
      availability: {
        slotDurationMinutes: 30,
        days: [
          { dayOfWeek: 1, startTime: "09:00", endTime: "13:00" },
          { dayOfWeek: 3, startTime: "09:00", endTime: "13:00" },
          { dayOfWeek: 5, startTime: "09:00", endTime: "12:00" },
        ],
      },
      signatureText: `${extra.fullName} — ${extra.licenseNumber}`,
      bio: `Consultorio demo Nodo Salud — ${extra.fullName}.`,
      payment: {
        currency: "ARS",
        consultationFee: 35000,
        requirePaymentBeforeBooking: true,
        alias: "nodo.demo",
        paymentInstructions:
          "Transferí el honorario y subí el comprobante en la sala de espera para validar tu turno.",
      },
      reminderSettings: { enabled: false, minutesBefore: 1440 },
      createdAt: now,
    });
  }
}

export const ONLINE_THRESHOLD_MS = 90_000;

export async function readDb(): Promise<ClinicDatabase> {
  await writeQueue;
  return ensureDb();
}

export async function writeDb(
  updater: (db: ClinicDatabase) => void | Promise<void>,
): Promise<ClinicDatabase> {
  let saved: ClinicDatabase | null = null;
  writeQueue = writeQueue.then(async () => {
    saved = await writeDbWithRetry(updater);
  });
  await writeQueue;
  return saved!;
}

async function writeDbWithRetry(
  updater: (db: ClinicDatabase) => void | Promise<void>,
  maxAttempts = 5,
): Promise<ClinicDatabase> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const db = await loadDb();
      const revBefore = db.meta?.revision ?? 0;
      await updater(db);
      if (!db.meta) {
        db.meta = { seedVersion: CLINIC_SEED_VERSION, revision: 0 };
      }
      db.meta.seedVersion = CLINIC_SEED_VERSION;
      db.meta.revision = revBefore + 1;
      await persistDb(db);

      if (isBlobConfigured() && attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 80 * (attempt + 1)));
        const fresh = await readFromBlob();
        if (fresh) {
          const freshRev = fresh.meta?.revision ?? 0;
          if (freshRev < (db.meta.revision ?? 0)) {
            continue;
          }
        }
      }
      return db;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("No se pudo guardar la configuración, reintentá");
}

export function newToken(): string {
  return randomBytes(24).toString("hex");
}

export function newId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function publicPaymentSettings(
  payment?: DoctorPaymentSettings,
  doctor?: LocalDoctor,
) {
  if (!payment) {
    return { requirePaymentBeforeBooking: true as const, mercadopagoReady: false };
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
    mercadopagoReady: doctor ? doctorHasMercadoPagoConnection(doctor) && (payment.consultationFee ?? 0) > 0 : false,
    mercadopagoConnected: doctor ? doctorHasMercadoPagoConnection(doctor) : false,
    mercadopagoUserId: payment.mercadopagoUserId
      ? `···${payment.mercadopagoUserId.slice(-4)}`
      : undefined,
    mercadopagoExternalPosId: payment.mercadopagoExternalPosId,
    mercadopagoConnectedAt: payment.mercadopagoConnectedAt,
  };
}

export function publicDoctorSummary(doctor: LocalDoctor) {
  return {
    id: doctor.id,
    fullName: doctor.fullName,
    specialty: doctor.specialty,
    licenseNumber: doctor.licenseNumber,
    profilePhotoData: doctor.profilePhotoData,
    payment: publicPaymentSettings(doctor.payment, doctor),
  };
}

export function publicDoctor(doctor: LocalDoctor) {
  const { password: _, ...rest } = doctor;
  return {
    ...rest,
    payment: publicPaymentSettings(doctor.payment, doctor),
  };
}

export function publicPatient(
  patient: LocalPatient,
  options?: { includeHealth?: boolean },
) {
  const { password: _, healthProfile, ...rest } = patient;
  return {
    ...rest,
    ...(options?.includeHealth && healthProfile ? { healthProfile } : {}),
  };
}
