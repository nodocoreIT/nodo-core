/** Modo JSON local — misma lógica en servidor y cliente (Vercel incluido). */
import { DEMO_PASSWORD } from "@/lib/clinic/seed";

export function isLocalMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_CLINIC_MODE === "local" ||
    process.env.CLINIC_MODE === "local" ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your-project")
  );
}

export const DEMO_CREDENTIALS = {
  doctor: { email: "doc.demo1@nodo.demo", password: DEMO_PASSWORD },
  patient: { email: "paciente1@nodo.demo", password: DEMO_PASSWORD },
};

/** Cuentas precargadas — en producción se provisionan desde nodocore.com.ar/panel/clientes */
export const DEMO_ACCOUNTS = {
  doctors: [
    { name: "Dr. Demo 1", email: "doc.demo1@nodo.demo", password: DEMO_PASSWORD },
    { name: "Dr. Demo 2", email: "doc.demo2@nodo.demo", password: DEMO_PASSWORD },
  ],
  patients: [
    { name: "Paciente 1", email: "paciente1@nodo.demo", password: DEMO_PASSWORD },
    { name: "Paciente 2", email: "paciente2@nodo.demo", password: DEMO_PASSWORD },
  ],
};
