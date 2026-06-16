export type AutomationStatus = "active" | "coming_soon" | "not_configured";

export interface AutomationDef {
  id: string;
  title: string;
  description: string;
  category: "whatsapp" | "email" | "payments" | "social" | "sheets" | "internal";
  status: AutomationStatus;
  /** If status is "active", this shows how to configure it */
  configHint?: string;
}
