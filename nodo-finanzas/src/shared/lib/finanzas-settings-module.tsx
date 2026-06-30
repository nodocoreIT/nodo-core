import { useMemo } from "react";
import {
  SettingsModuleProvider,
  type SettingsModuleContextValue,
  DEFAULT_ALERT_SETTINGS,
} from "@nodocore/nodo-modules/settings";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useThemeSettings } from "@/shared/hooks/use-theme-settings";
import { useAiSettings } from "@/hooks/use-ai-settings";
// useAiSettings reads from AiSettingsContext — single shared instance mounted in admin-layout
import { useFinanzasStaff } from "@/shared/hooks/use-finanzas-staff";
import { ConfiguracionPage } from "@/features/configuracion/configuracion-page";

const FINANZAS_MANAGED_NAV = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/gastos-diarios", label: "Gastos del Día" },
  { to: "/admin/gastos-fijos", label: "Gastos Fijos" },
  { to: "/admin/tarjetas", label: "Tarjetas" },
  { to: "/admin/prestamos", label: "Préstamos" },
  { to: "/admin/planes-ahorro", label: "Planes de Ahorro" },
  { to: "/admin/saldos", label: "Saldos" },
  { to: "/admin/informe-mensual", label: "Informe Mensual" },
  { to: "/admin/configuracion", label: "Administración" },
];

export function FinanzasSettingsModuleProvider({ children }: { children: React.ReactNode }) {
  const { settings, setSettings, resetSettings } = useThemeSettings();
  const { aiSettings, setAiSettings } = useAiSettings();
  const staff = useFinanzasStaff();

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

  const value = useMemo((): SettingsModuleContextValue => {
    return {
      // Hide tabs not applicable to finanzas
      hiddenTabs: ["company", "alerts", "ipc", "redes-sociales", "system-config"],
      managedNav: FINANZAS_MANAGED_NAV,
      roleOptions: [
        { value: "member", label: "Miembro" },
      ],
      inviteMessages: {
        invited: "Invitación enviada por correo.",
        existing: "Usuario agregado a Finanzas.",
      },
      adminRole: "super_admin",
      superAdminRole: "super_admin",
      adminDisplayRole: "Super Admin",
      defaultInviteRole: "member",
      themeSettings: settings,
      setThemeSettings: setSettings,
      resetThemeSettings: resetSettings,
      aiSettings,
      setAiSettings,
      // No org profile in finanzas — provide empty no-ops
      profile: null,
      profileLoading: false,
      upsertProfile: async () => {},
      isUpsertingProfile: false,
      uploadLogo: async () => "",
      isUploadingLogo: false,
      logoSignedUrl: null,
      pdfLogoSignedUrl: null,
      alertSettings: DEFAULT_ALERT_SETTINGS,
      alertSettingsLoading: false,
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
      systemConfigContent: <ConfiguracionPage embedded />,
      aiUseCases: [
        {
          icon: "🎤",
          title: "Gastos diarios:",
          description: "Dictás un gasto en lenguaje natural y el sistema extrae monto, rubro, fecha y medio de pago automáticamente.",
        },
        {
          icon: "📌",
          title: "Gastos fijos:",
          description: "Registrás un gasto mensual recurrente por voz: descripción, monto, rubro y forma de pago.",
        },
        {
          icon: "🔄",
          title: "Movimientos entre cuentas:",
          description: "Dictás una transferencia entre tus cuentas indicando origen, destino y monto.",
        },
        {
          icon: "🔒",
          description: "La clave se guarda de forma segura en tu organización y está disponible en todos los dispositivos.",
        },
      ],
    };
  }, [
    settings,
    setSettings,
    resetSettings,
    aiSettings,
    setAiSettings,
    staff,
    updateProfileMutation.isPending,
  ]);

  return <SettingsModuleProvider value={value}>{children}</SettingsModuleProvider>;
}
