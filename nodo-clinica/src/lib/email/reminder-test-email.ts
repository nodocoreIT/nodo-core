import "server-only";

/** Optional inbox for reminder test sends (see REMINDER_TEST_EMAIL in .env.local). */
export function getReminderTestEmail(): string | undefined {
  const raw = process.env.REMINDER_TEST_EMAIL?.trim();
  return raw && raw.includes("@") ? raw : undefined;
}

export const REMINDER_TEST_PATIENT_NAME = "Paciente de prueba";
