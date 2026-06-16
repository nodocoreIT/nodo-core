export interface DoctorThemeSettings {
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

export const DEFAULT_THEME_SETTINGS: DoctorThemeSettings = {
  primaryColor: "#da5a0e",
  secondaryColor: "#121e2f",
  sidebarTextColor: "#9dacbe",
  fontColor: "#16202e",
  buttonFontColor: "#ffffff",
  borderRadius: "md",
  fontFamily: "Inter",
  logoType: "default",
  brandText: "nodo salud",
};

export function mergeThemeSettings(
  partial?: Partial<DoctorThemeSettings> | null,
): DoctorThemeSettings {
  return { ...DEFAULT_THEME_SETTINGS, ...partial };
}
