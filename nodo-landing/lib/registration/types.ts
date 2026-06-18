/** Client unit status lifecycle for cross-node registration. */
export type ClientUnitStatus =
  | "pending_review"
  | "pending_onboarding"
  | "onboarding"
  | "activo"
  | "pausado";

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
  demoDays?: number;
  username: string;
  password: string;
}

export type RegistrationActionState = {
  status: "idle" | "success" | "error";
  message: string;
};
