/**
 * Returns true when Supabase is not configured (demo/local mode).
 * In the Vite SPA we only have client-side env vars.
 */
export function isLocalMode(): boolean {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  return (
    import.meta.env.VITE_CLINIC_MODE === "local" ||
    !supabaseUrl ||
    supabaseUrl.includes("your-project")
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
