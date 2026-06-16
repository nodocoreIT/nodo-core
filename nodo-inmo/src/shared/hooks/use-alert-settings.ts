import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";

export interface AlertSettings {
  contractExpirationMonths: number;
  rentAdjustmentMonths: number;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  contractExpirationMonths: 2,
  rentAdjustmentMonths: 1,
};

export function useAlertSettings() {
  const { data: profile, isLoading } = useOrgProfile();
  
  const settings = profile?.alert_settings
    ? (profile.alert_settings as unknown as AlertSettings)
    : DEFAULT_ALERT_SETTINGS;

  return { settings, isLoading };
}
