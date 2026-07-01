import { DEFAULT_THEME_SETTINGS } from "@/lib/clinic/theme-settings";
import { DEFAULT_CONSULTORIO_LAYOUT } from "@/lib/clinic/consultorio-layout";
import type { ClinicDatabase } from "@/lib/clinic/local-db";
import { DEFAULT_AVAILABILITY } from "@/lib/clinic/schedule";

/** Incrementar para resetear clinic.json / Blob en deploy (cuentas demo limpias). */
export const CLINIC_SEED_VERSION = 3;

export const DEMO_PASSWORD = "Probando1";

export function buildClinicSeed(now = new Date()): ClinicDatabase {
  const today = now.toISOString().slice(0, 10);

  return {
    meta: { seedVersion: CLINIC_SEED_VERSION },
    doctors: [
      {
        id: "doc-demo-1",
        fullName: "Dr. Demo 1",
        email: "doc.demo1@nodo.demo",
        password: DEMO_PASSWORD,
        specialty: "Medicina General",
        licenseNumber: "MN 10001",
        subscriptionStatus: "active",
        subscriptionPlan: "profesional",
        availability: DEFAULT_AVAILABILITY,
        signatureText: "Dr. Demo 1 — MN 10001",
        bio: "Consultorio demo Nodo Salud — Doc. Demo 1.",
        payment: {
          currency: "ARS",
          consultationFee: 25000,
          alias: "demo.salud.mp",
          requirePaymentBeforeBooking: true,
        },
        reminderSettings: { enabled: false, minutesBefore: 1440 },
        themeSettings: DEFAULT_THEME_SETTINGS,
        consultorioLayout: DEFAULT_CONSULTORIO_LAYOUT,
        createdAt: now.toISOString(),
      },
      {
        id: "doc-demo-2",
        fullName: "Dr. Demo 2",
        email: "doc.demo2@nodo.demo",
        password: DEMO_PASSWORD,
        specialty: "Cardiología",
        licenseNumber: "MN 10002",
        subscriptionStatus: "active",
        subscriptionPlan: "profesional",
        availability: DEFAULT_AVAILABILITY,
        signatureText: "Dr. Demo 2 — MN 10002",
        bio: "Consultorio demo Nodo Salud — Doc. Demo 2.",
        payment: {
          currency: "ARS",
          consultationFee: 30000,
          alias: "demo2.salud.mp",
          requirePaymentBeforeBooking: true,
        },
        reminderSettings: { enabled: false, minutesBefore: 1440 },
        createdAt: now.toISOString(),
      },
    ],
    patients: [
      {
        id: "pat-demo-1",
        fullName: "Paciente 1",
        email: "paciente1@nodo.demo",
        password: DEMO_PASSWORD,
        phone: "11 5555-0001",
        createdAt: now.toISOString(),
      },
      {
        id: "pat-demo-2",
        fullName: "Paciente 2",
        email: "paciente2@nodo.demo",
        password: DEMO_PASSWORD,
        phone: "11 5555-0002",
        createdAt: now.toISOString(),
      },
    ],
    appointments: [],
    documents: [],
    clinicalRecords: [],
    clinicalNotes: {},
    doctorTasks: [
      {
        id: "task-demo-1",
        doctorId: "doc-demo-1",
        title: "Revisar estudios de Paciente 1",
        dueDate: today,
        done: false,
        createdAt: now.toISOString(),
      },
    ],
    interconsultMessages: [
      {
        id: "ic-welcome-001",
        fromDoctorId: "doc-demo-1",
        fromDoctorName: "Dr. Demo 1",
        toDoctorId: null,
        content:
          "Bienvenidos a la sala de interconsultas de Nodo Salud. Consultá casos entre colegas Pro.",
        createdAt: new Date(now.getTime() - 3600000).toISOString(),
      },
      {
        id: "ic-demo-dm-001",
        fromDoctorId: "doc-demo-2",
        fromDoctorName: "Dr. Demo 2",
        toDoctorId: "doc-demo-1",
        content: "Demo 1, ¿podés ver este ECG de un paciente con palpitaciones?",
        createdAt: new Date(now.getTime() - 120000).toISOString(),
      },
    ],
    doctorPresence: {},
    nodoChatReadAt: {},
  };
}
