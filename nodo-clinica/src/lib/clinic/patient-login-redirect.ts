/** Safe post-login redirect for patients (blocks open redirects). */
export function safePatientNextPath(next: string | null | undefined): string | null {
  if (!next?.startsWith("/paciente") || next.startsWith("//")) return null;
  return next;
}
