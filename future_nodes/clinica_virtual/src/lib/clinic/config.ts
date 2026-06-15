/** Modo JSON local — misma lógica en servidor y cliente (Vercel incluido). */
export function isLocalMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_CLINIC_MODE === "local" ||
    process.env.CLINIC_MODE === "local" ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your-project")
  );
}

export const DEMO_CREDENTIALS = {
  doctor: { email: "maurolluch@gmail.com", password: "Probando1" },
  patient: { email: "paciente@demo.com", password: "Probando1" },
};

export const DEMO_ACCOUNTS = {
  doctors: [
    { name: "Mauro Lluch", email: "maurolluch@gmail.com", password: "Probando1" },
    { name: "Dra. María González", email: "maria@demo.com", password: "Probando1" },
  ],
  patients: [
    { name: "Juan Pérez", email: "paciente@demo.com", password: "Probando1" },
    { name: "Laura Fernández", email: "paciente2@demo.com", password: "Probando1" },
  ],
};
