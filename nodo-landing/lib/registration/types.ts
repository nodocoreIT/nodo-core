/** Client unit status lifecycle for cross-node registration. */
export type ClientUnitStatus =
  | "pending_review"
  | "pending_onboarding"
  | "onboarding"
  | "activo"
  | "pausado"
  /** Credentials wiped after deleting the nodo user — distinct from a
   * reversible business "pausado" (which keeps credentials intact). */
  | "sin_acceso"
  /** Set by the billing reconciliation job when MercadoPago reports a
   * terminal failure for the cycle (all of MP's own retries exhausted).
   * Access stays allowed (user_has_node_access is unaffected) — only the
   * machine-readable reason RPC surfaces this, gating routes client-side. */
  | "impago";

export type VerificationDocType =
  | "id_photo"
  | "credit_card"
  | "debit_card"
  | "payment_proof"
  | "other";

export type PlanChoice = "starter" | "pro" | "demo";

export type RegistrationPlan =
  | "medico"
  | "paciente"
  | "inmo"
  | "autos"
  | "finanzas"
  | string;

export interface NodeRegistrationInput {
  unitCode: string;
  fullName: string;
  email: string;
  phone?: string;
  plan: RegistrationPlan;
  origin: string;
  /** Legacy self-service flows still pass password at signup (e.g. paciente). */
  password?: string;
}

export interface OnboardingPayload {
  token: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  province: string;
  phone: string;
  planChoice: PlanChoice;
  username: string;
  password: string;
}

export type RegistrationActionState = {
  status: "idle" | "success" | "error";
  message: string;
};
