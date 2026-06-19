import type { ReactNode } from "react";

export type SettingsTabId =
  | "profile"
  | "company"
  | "customization"
  | "users"
  | "ai"
  | "alerts"
  | "ipc";

export interface NavSection {
  to: string;
  label: string;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "Activo" | "Pendiente";
}

export interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  sidebarTextColor: string;
  fontColor: string;
  buttonFontColor: string;
  borderRadius: "none" | "md" | "full";
  fontFamily: "Inter" | "Roboto" | "Montserrat";
  logoType: "default" | "custom" | "text";
  brandText: string;
}

export interface AiSettings {
  geminiApiKey: string;
}

export interface AlertSettings {
  contractExpirationMonths: number;
  rentAdjustmentMonths: number;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  contractExpirationMonths: 2,
  rentAdjustmentMonths: 1,
};


export interface TenantProfileRow {
  legal_name?: string | null;
  address?: string | null;
  cuit?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_path?: string | null;
  pdf_logo_path?: string | null;
  theme_settings?: unknown;
  alert_settings?: unknown;
}

export type TenantProfileUpdate = Partial<TenantProfileRow>;

export interface BankAccountInput {
  bank_name: string;
  alias?: string;
  cbu: string;
  currency: "ARS" | "USD";
  initial_balance?: number;
}

export interface BankAccount {
  id: string;
  label: string;
  currency: "ARS" | "USD";
  bank_name?: string | null;
  alias?: string | null;
  cbu?: string | null;
  initial_balance?: number;
}

export interface BankAccountsApi {
  accounts: BankAccount[];
  isLoading: boolean;
  addAccount: (input: BankAccountInput) => Promise<void>;
  updateAccount: (id: string, input: BankAccountInput) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  isAdding: boolean;
  isUpdating: boolean;
  isRemoving: boolean;
}

export interface StaffApi {
  users: StaffUser[];
  loading: boolean;
  error: string | null;
  fetchMembers: () => Promise<void>;
  inviteUser: (name: string, email: string, role: string) => Promise<{ id: string; invited: boolean }>;
  updateMemberRole: (userId: string, role: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
}

export interface SettingsModuleContextValue {
  hiddenTabs?: SettingsTabId[];
  managedNav: NavSection[];
  roleOptions: { value: string; label: string }[];
  inviteMessages: { invited: string; existing: string };
  adminRole: string;
  adminDisplayRole: string;
  defaultInviteRole: string;

  themeSettings: ThemeSettings;
  setThemeSettings: (next: Partial<ThemeSettings>) => void;
  resetThemeSettings: () => void;

  aiSettings: AiSettings;
  setAiSettings: (next: Partial<AiSettings>) => void;

  profile: TenantProfileRow | null | undefined;
  profileLoading: boolean;
  upsertProfile: (input: TenantProfileUpdate) => Promise<void>;
  isUpsertingProfile: boolean;

  uploadLogo: (input: { file: File; variant?: "logo" | "pdf-logo" }) => Promise<string>;
  isUploadingLogo: boolean;

  logoSignedUrl: string | null;
  pdfLogoSignedUrl: string | null;

  alertSettings: AlertSettings;
  alertSettingsLoading: boolean;

  staff: StaffApi;

  updateUserProfile: (input: { full_name: string; password?: string }) => Promise<void>;
  isUpdatingUserProfile: boolean;

  bankAccounts?: BankAccountsApi;
  companyExtraContent?: ReactNode;

  saveManualIpc?: (value: number) => Promise<void>;
  isSavingManualIpc?: boolean;
}
