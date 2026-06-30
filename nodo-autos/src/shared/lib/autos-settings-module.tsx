import { useMemo } from "react";
import {
  SettingsModuleProvider,
  type AlertSettings,
  type AiSettings,
  type SettingsModuleContextValue,
  DEFAULT_ALERT_SETTINGS,
  DEFAULT_AI_SETTINGS,
} from "@nodocore/nodo-modules/settings";
import { useThemeSettings } from "@/shared/hooks/use-theme-settings";
import { useAutosStaff } from "@/shared/hooks/use-autos-staff";
import { useAutosBankAccounts } from "@/shared/hooks/use-autos-bank-accounts";
import {
  autosTenantProfileHooks,
  autosLogoHooks,
} from "@/shared/lib/autos-module-hooks";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@nodocore/shared-components";

const AUTOS_MANAGED_NAV = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/vehiculos", label: "Vehículos" },
  { to: "/admin/clientes", label: "Clientes" },
  { to: "/admin/publicaciones", label: "Redes Sociales" },
  { to: "/admin/caja", label: "Caja" },
  { to: "/admin/agenda", label: "Agenda y Tareas" },
  { to: "/admin/documentacion", label: "Documentación" },
];

const { useTenantProfile, useUpsertTenantProfile } = autosTenantProfileHooks;
const { useUploadLogo, useLogoSignedUrl } = autosLogoHooks;

export function AutosSettingsModuleProvider({ children }: { children: React.ReactNode }) {
  const { settings, setSettings, resetSettings } = useThemeSettings();
  const profileQuery = useTenantProfile();
  const upsertMutation = useUpsertTenantProfile();
  const uploadLogoMutation = useUploadLogo();
  const logoUrlQuery = useLogoSignedUrl(profileQuery.data?.logo_path);
  const pdfLogoUrlQuery = useLogoSignedUrl(profileQuery.data?.pdf_logo_path);
  const staff = useAutosStaff();
  const bankAccounts = useAutosBankAccounts();
  const updateProfileMutation = useMutation({
    mutationFn: async ({ full_name, password }: { full_name: string; password?: string }) => {
      const attrs: { data: { full_name: string }; password?: string } = {
        data: { full_name },
      };
      if (password && password.length > 0) attrs.password = password;
      const { error } = await supabase.auth.updateUser(attrs);
      if (error) throw error;
    },
  });
  const { user } = useAuth();

  const alertSettings: AlertSettings = profileQuery.data?.alert_settings
    ? (profileQuery.data.alert_settings as unknown as AlertSettings)
    : DEFAULT_ALERT_SETTINGS;

  const rawAiSettings = profileQuery.data?.ai_settings;
  const aiSettings: AiSettings = rawAiSettings
    ? { ...DEFAULT_AI_SETTINGS, ...(rawAiSettings as unknown as AiSettings) }
    : DEFAULT_AI_SETTINGS;

  const setAiSettings = (next: Partial<AiSettings>) => {
    const merged = { ...aiSettings, ...next };
    upsertMutation.mutateAsync({ ai_settings: merged as unknown as Record<string, unknown> }).catch(console.error);
  };

  const value = useMemo((): SettingsModuleContextValue => {
    return {
      hiddenTabs: ["ipc"],
      managedNav: AUTOS_MANAGED_NAV,
      roleOptions: [
        { value: "seller", label: "Vendedor" },
        { value: "guest", label: "Invitado" },
      ],
      inviteMessages: {
        invited: "Invitación enviada por correo.",
        existing: "Usuario agregado a este nodo Autos.",
      },
      adminRole: "admin",
      adminDisplayRole: "Administrador",
      defaultInviteRole: "guest",
      themeSettings: settings,
      setThemeSettings: setSettings,
      resetThemeSettings: resetSettings,
      aiSettings,
      setAiSettings,
      profile: profileQuery.data,
      profileLoading: profileQuery.isLoading,
      upsertProfile: upsertMutation.mutateAsync,
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
      updateUserProfile: updateProfileMutation.mutateAsync,
      isUpdatingUserProfile: updateProfileMutation.isPending,
      bankAccounts: {
        accounts: bankAccounts.accounts,
        isLoading: bankAccounts.isLoading,
        addAccount: async (input) => {
          await bankAccounts.addAccount(input);
        },
        updateAccount: async (id, input) => {
          await bankAccounts.updateAccount(id, input);
        },
        removeAccount: bankAccounts.removeAccount,
        isAdding: bankAccounts.isAdding,
        isUpdating: bankAccounts.isUpdating,
        isRemoving: bankAccounts.isRemoving,
      },
    };
  }, [
    settings,
    setSettings,
    resetSettings,
    aiSettings,
    profileQuery.data,
    profileQuery.isLoading,
    upsertMutation.isPending,
    upsertMutation.mutateAsync,
    uploadLogoMutation.isPending,
    logoUrlQuery.data,
    pdfLogoUrlQuery.data,
    staff,
    bankAccounts,
    updateProfileMutation.isPending,
    alertSettings,
    user,
  ]);

  return <SettingsModuleProvider value={value}>{children}</SettingsModuleProvider>;
}
