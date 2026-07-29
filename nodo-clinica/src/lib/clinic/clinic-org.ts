/** Org compartida de Nodo Clínica — pacientes y médicos del portal usan la misma. */
export const CLINIC_ORG_ID =
  process.env.CLINIC_ORG_ID ?? "843524dc-0c3b-4340-bc8e-e3ae5aa00fd2";

export function getClinicOrgId(): string {
  return CLINIC_ORG_ID;
}

/**
 * JWT claims alineados con patients/professionals.org_id en registro y onboarding.
 * Nunca pisa el role/org_id si ese global user ya pertenece a OTRO nodo — su
 * membresía de Clínica ya quedó registrada en patients/professionals por su
 * propio user_id, que es la fuente de verdad real (ver auth-guard.ts).
 */
export async function syncClinicaAuthClaims(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authAdmin: { auth: { admin: { getUserById: (id: string) => Promise<any>; updateUserById: (id: string, attrs: object) => Promise<any> } } },
  userId: string,
  role: "medico" | "paciente",
): Promise<void> {
  const { data: userData } = await authAdmin.auth.admin.getUserById(userId);
  const current = userData.user?.app_metadata ?? {};
  const foreign =
    typeof current.org_id === "string" && current.org_id.length > 0 && current.org_id !== CLINIC_ORG_ID;
  if (foreign) return;

  await authAdmin.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...current,
      role,
      org_id: CLINIC_ORG_ID,
    },
  });
}
