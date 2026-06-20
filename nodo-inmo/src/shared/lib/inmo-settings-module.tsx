import { useMemo } from "react";
import {
  SettingsModuleProvider,
  type AlertSettings,
  type SettingsModuleContextValue,
  DEFAULT_ALERT_SETTINGS,
} from "@nodocore/nodo-modules/settings";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useThemeSettings } from "@/shared/hooks/use-theme-settings";
import { useAiSettings } from "@/shared/hooks/use-ai-settings";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import {
  useUpsertOrgProfile,
  type UpsertOrgProfileInput,
} from "@/features/agency-profile/hooks/use-upsert-org-profile";
import { useUploadLogo } from "@/features/agency-profile/hooks/use-upload-logo";
import { useLogoUrl } from "@/features/agency-profile/hooks/use-logo-url";
import { useStaff } from "@/shared/hooks/use-staff";
import { useUpdateProfile } from "@/features/profile/hooks/use-update-profile";
import { useCashAccounts } from "@/shared/hooks/use-cash-accounts";
import { supabase } from "@/shared/lib/supabase";
import {
  INMO_ADMIN_DISPLAY_ROLE,
  INMO_DEFAULT_EMPLOYEE_SECTIONS,
  INMO_EMPLOYEE_DISPLAY_ROLE,
  INMO_FIXED_ACCESS_ROLES,
  INMO_MANAGED_NAV,
  INMO_STAFF_ROLE_OPTIONS,
} from "@/shared/lib/inmo-staff-nav";

const INMO_MANAGED_NAV_LIST = INMO_MANAGED_NAV.map((item) => ({ ...item }));

export function InmoSettingsModuleProvider({ children }: { children: React.ReactNode }) {
  const { settings, setSettings, resetSettings } = useThemeSettings();
  const { aiSettings, setAiSettings } = useAiSettings();
  const profileQuery = useOrgProfile();
  const upsertMutation = useUpsertOrgProfile();
  const uploadLogoMutation = useUploadLogo();
  const logoUrlQuery = useLogoUrl(profileQuery.data?.logo_path);
  const pdfLogoUrlQuery = useLogoUrl(profileQuery.data?.pdf_logo_path);
  const staff = useStaff();
  const updateProfileMutation = useUpdateProfile();
  const cashAccounts = useCashAccounts();
  const queryClient = useQueryClient();

  const ipcMutation = useMutation({
    mutationFn: async (val: number) => {
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const { error } = await supabase.schema("shared").rpc("upsert_index_value", {
        p_kind: "IPC",
        p_period: period,
        p_value: val,
        p_source: "Manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ipc", "current"] });
    },
  });

  const alertSettings: AlertSettings = profileQuery.data?.alert_settings
    ? (profileQuery.data.alert_settings as unknown as AlertSettings)
    : DEFAULT_ALERT_SETTINGS;

  const value = useMemo((): SettingsModuleContextValue => {
    return {
      managedNav: INMO_MANAGED_NAV_LIST,
      roleOptions: [...INMO_STAFF_ROLE_OPTIONS],
      fixedAccessRoles: [...INMO_FIXED_ACCESS_ROLES],
      staffSectionRole: INMO_EMPLOYEE_DISPLAY_ROLE,
      defaultEmployeeSections: [...INMO_DEFAULT_EMPLOYEE_SECTIONS],
      inviteMessages: {
        invited:
          "Usuario invitado correctamente. Le enviamos un correo para que realice la activación de su cuenta.",
        existing:
          "Usuario agregado correctamente. Le enviamos un correo para avisarle que ya puede ingresar.",
        emailSkipped:
          "El usuario fue agregado, pero no se pudo enviar el correo de notificación.",
      },
      adminRole: "admin",
      superAdminRole: "super_admin",
      adminDisplayRole: INMO_ADMIN_DISPLAY_ROLE,
      defaultInviteRole: INMO_EMPLOYEE_DISPLAY_ROLE,
      themeSettings: settings,
      setThemeSettings: setSettings,
      resetThemeSettings: resetSettings,
      aiSettings,
      setAiSettings,
      profile: profileQuery.data,
      profileLoading: profileQuery.isLoading,
      upsertProfile: async (input) => {
        await upsertMutation.mutateAsync(input as UpsertOrgProfileInput);
      },
      isUpsertingProfile: upsertMutation.isPending,
      uploadLogo: (input) => uploadLogoMutation.mutateAsync(input),
      isUploadingLogo: uploadLogoMutation.isPending,
      logoSignedUrl: logoUrlQuery.data ?? null,
      pdfLogoSignedUrl: pdfLogoUrlQuery.data ?? null,
      alertSettings,
      alertSettingsLoading: profileQuery.isLoading,
      staff: {
        users: staff.users,
        loading: staff.loading,
        error: staff.error,
        fetchMembers: staff.fetchMembers,
        inviteUser: staff.inviteUser,
        updateMemberRole: staff.updateMemberRole,
        removeMember: staff.removeMember,
      },
      updateUserProfile: async (input) => {
        await updateProfileMutation.mutateAsync(input);
      },
      isUpdatingUserProfile: updateProfileMutation.isPending,
      bankAccounts: {
        accounts: cashAccounts.accounts,
        isLoading: cashAccounts.isLoading,
        addAccount: async (input) => {
          await cashAccounts.addAccount(input);
        },
        updateAccount: async (id, input) => {
          await cashAccounts.updateAccount({ id, ...input });
        },
        removeAccount: cashAccounts.removeAccount,
        isAdding: cashAccounts.isAdding,
        isUpdating: cashAccounts.isUpdating,
        isRemoving: cashAccounts.isRemoving,
      },
      saveManualIpc: ipcMutation.mutateAsync,
      isSavingManualIpc: ipcMutation.isPending,
    };
  }, [
    settings,
    setSettings,
    resetSettings,
    aiSettings,
    setAiSettings,
    profileQuery.data,
    profileQuery.isLoading,
    upsertMutation.isPending,
    uploadLogoMutation.isPending,
    logoUrlQuery.data,
    pdfLogoUrlQuery.data,
    staff,
    updateProfileMutation.isPending,
    cashAccounts,
    ipcMutation.isPending,
    alertSettings,
  ]);

  return <SettingsModuleProvider value={value}>{children}</SettingsModuleProvider>;
}
