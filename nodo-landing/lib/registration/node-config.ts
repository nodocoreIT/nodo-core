import { NODES } from "@/lib/nodes";

/** Maps NODES.code → provisioning + routing metadata. */
export interface NodeRegistrationConfig {
  unitCode: string;
  slug: string;
  label: string;
  provisionable: boolean;
  /** Selfie holding ID + AI/manual identity check during onboarding. */
  requiresIdentityVerification: boolean;
  /** Plans that skip admin review (immediate activation after email verify). */
  selfServicePlans: string[];
  /** Product key used in shared.organizations.product */
  productKey?: string;
  accessUrl?: string;
}

const SELF_SERVICE = new Set(["paciente"]);

export const NODE_REGISTRATION_CONFIG: Record<string, NodeRegistrationConfig> =
  Object.fromEntries(
    NODES.map((n) => [
      n.code,
      {
        unitCode: n.code,
        slug: n.slug,
        label: n.label,
        provisionable: n.provisionable ?? false,
        requiresIdentityVerification: n.requiresIdentityVerification ?? false,
        selfServicePlans:
          n.code === "Salud" || n.code === "Clínica"
            ? ["paciente"]
            : n.code === "Finanzas"
              ? ["finanzas"]
              : [],
        productKey: n.slug,
        accessUrl: `/${n.slug}`,
      },
    ]),
  );

export function getNodeRegistrationConfig(unitCode: string): NodeRegistrationConfig | null {
  return NODE_REGISTRATION_CONFIG[unitCode] ?? null;
}

export function requiresIdentityVerification(unitCode: string, plan?: string | null): boolean {
  const cfg = getNodeRegistrationConfig(unitCode);
  if (!cfg?.requiresIdentityVerification) return false;

  // Salud / Clínica: paciente es self-service y no pasa por onboarding estricto.
  if (plan && isSelfServicePlan(unitCode, plan)) return false;

  return true;
}

export function isSelfServicePlan(unitCode: string, plan: string): boolean {
  const cfg = getNodeRegistrationConfig(unitCode);
  if (!cfg) return false;
  return SELF_SERVICE.has(plan.toLowerCase()) || cfg.selfServicePlans.includes(plan.toLowerCase());
}

export function unitCodeFromSlug(slug: string): string | null {
  const node = NODES.find((n) => n.slug === slug);
  return node?.code ?? null;
}

export function normalizeUnitCode(input: string): string | null {
  const byCode = NODES.find((n) => n.code.toLowerCase() === input.toLowerCase());
  if (byCode) return byCode.code;
  const bySlug = NODES.find((n) => n.slug.toLowerCase() === input.toLowerCase());
  return bySlug?.code ?? null;
}
