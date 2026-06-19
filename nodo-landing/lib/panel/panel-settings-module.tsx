import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  SettingsModuleProvider,
  type AlertSettings,
  type SettingsModuleContextValue,
  DEFAULT_ALERT_SETTINGS,
  type ThemeSettings,
} from "@nodocore/nodo-modules/settings";
import { createClient } from "@/lib/supabase/client";
import {
  applyPanelThemeToDocument,
  PANEL_DEFAULT_THEME,
  persistPanelThemeToStorage,
  readPanelThemeFromStorage,
  useApplyPanelTheme,
} from "./use-panel-theme-settings";
import {
  getPanelLogoSignedUrl,
  uploadPanelLogo,
  upsertPanelOrgProfile,
  usePanelOrgProfile,
} from "./use-panel-org-profile";
import { usePanelStaff } from "./use-panel-staff";

const PANEL_MANAGED_NAV = [
  { to: "/panel/solicitudes", label: "Solicitudes pendientes" },
  { to: "/panel/ideas", label: "Ideas" },
  { to: "/panel/tareas", label: "Tareas" },
  { to: "/panel/clientes", label: "Clientes" },
  { to: "/panel/caja", label: "Caja" },
  { to: "/panel/equipo", label: "Equipo" },
  { to: "/panel/passwords", label: "Bóveda de contraseñas" },
  { to: "/panel/unidades", label: "Unidades" },
  { to: "/panel/informes", label: "Informes" },
];

const AI_STORAGE_KEY = "nodo-panel-ai-settings";

function readAiSettings() {
  try {
    const raw = localStorage.getItem(AI_STORAGE_KEY);
    if (raw) return { geminiApiKey: JSON.parse(raw).geminiApiKey ?? "" };
  } catch {
    // ignore
  }
  return { geminiApiKey: "" };
}

export function PanelSettingsModuleProvider({ children }: { children: ReactNode }) {
  const { profile, loading: profileLoading, refresh } = usePanelOrgProfile();
  const staff = usePanelStaff();
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [themeSettings, setThemeState] = useState<ThemeSettings>(readPanelThemeFromStorage);
  const [aiSettings, setAiState] = useState(readAiSettings);
  const [logoSignedUrl, setLogoSignedUrl] = useState<string | null>(null);
  const [pdfLogoSignedUrl, setPdfLogoSignedUrl] = useState<string | null>(null);
  const [isUpsertingProfile, setIsUpsertingProfile] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUpdatingUserProfile, setIsUpdatingUserProfile] = useState(false);

  useApplyPanelTheme(themeSettings);

  useEffect(() => {
    async function loadSessionRole() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      setSessionRole(data?.role ?? null);
    }
    void loadSessionRole();
  }, []);

  useEffect(() => {
    if (profile?.theme_settings && typeof profile.theme_settings === "object") {
      const merged = { ...PANEL_DEFAULT_THEME, ...(profile.theme_settings as ThemeSettings) };
      setThemeState(merged);
      persistPanelThemeToStorage(merged);
      applyPanelThemeToDocument(merged);
    }
  }, [profile?.theme_settings]);

  useEffect(() => {
    void getPanelLogoSignedUrl(profile?.logo_path).then(setLogoSignedUrl);
    void getPanelLogoSignedUrl(profile?.pdf_logo_path).then(setPdfLogoSignedUrl);
  }, [profile?.logo_path, profile?.pdf_logo_path]);

  const setThemeSettings = useCallback((next: Partial<ThemeSettings>) => {
    setThemeState((prev) => {
      const merged = { ...prev, ...next };
      persistPanelThemeToStorage(merged);
      return merged;
    });
  }, []);

  const resetThemeSettings = useCallback(() => {
    setThemeState(PANEL_DEFAULT_THEME);
    persistPanelThemeToStorage(PANEL_DEFAULT_THEME);
    applyPanelThemeToDocument(PANEL_DEFAULT_THEME);
  }, []);

  const setAiSettings = useCallback((next: Partial<{ geminiApiKey: string }>) => {
    setAiState((prev) => {
      const merged = { ...prev, ...next };
      try {
        localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // ignore
      }
      return merged;
    });
  }, []);

  const upsertProfile = useCallback(
    async (input: Record<string, unknown>) => {
      setIsUpsertingProfile(true);
      try {
        let payload = { ...input };
        if (payload.logo_path && typeof payload.logo_path === "string") {
          const mergedTheme = { ...themeSettings, logoType: "custom" as const };
          setThemeState(mergedTheme);
          persistPanelThemeToStorage(mergedTheme);
          payload = {
            ...payload,
            theme_settings: {
              ...(typeof payload.theme_settings === "object" && payload.theme_settings
                ? payload.theme_settings
                : {}),
              ...mergedTheme,
            },
          };
        }
        await upsertPanelOrgProfile(payload);
        await refresh();
        if (typeof payload.logo_path === "string") {
          setLogoSignedUrl(await getPanelLogoSignedUrl(payload.logo_path));
        }
        if (payload.logo_path === null) {
          setLogoSignedUrl(null);
        }
        if (typeof payload.pdf_logo_path === "string") {
          setPdfLogoSignedUrl(await getPanelLogoSignedUrl(payload.pdf_logo_path));
        }
        if (payload.pdf_logo_path === null) {
          setPdfLogoSignedUrl(null);
        }
      } finally {
        setIsUpsertingProfile(false);
      }
    },
    [themeSettings, refresh],
  );

  const uploadLogo = useCallback(async (input: { file: File; variant?: "logo" | "pdf-logo" }) => {
    setIsUploadingLogo(true);
    try {
      const path = await uploadPanelLogo(input.file, input.variant);
      const url = await getPanelLogoSignedUrl(path);
      if (input.variant === "pdf-logo") {
        setPdfLogoSignedUrl(url);
      } else {
        setLogoSignedUrl(url);
      }
      return path;
    } finally {
      setIsUploadingLogo(false);
    }
  }, []);

  const updateUserProfile = useCallback(async (input: { full_name: string; password?: string }) => {
    setIsUpdatingUserProfile(true);
    try {
      const supabase = createClient();
      const attrs: { data: { full_name: string }; password?: string } = {
        data: { full_name: input.full_name },
      };
      if (input.password && input.password.length > 0) attrs.password = input.password;
      const { error } = await supabase.auth.updateUser(attrs);
      if (error) throw error;
    } finally {
      setIsUpdatingUserProfile(false);
    }
  }, []);

  const alertSettings: AlertSettings = DEFAULT_ALERT_SETTINGS;

  const value = useMemo((): SettingsModuleContextValue => {
    return {
      hiddenTabs: ["alerts", "ipc"],
      sessionRole,
      inviteRequiresPassword: true,
      managedNav: PANEL_MANAGED_NAV,
      roleOptions: [
        { value: "dev", label: "Desarrollador" },
        { value: "designer", label: "Diseñador" },
        { value: "manager", label: "Gerente" },
      ],
      inviteMessages: {
        invited: "Usuario creado correctamente. Compartí la contraseña inicial con el miembro del equipo.",
        existing: "Usuario actualizado.",
      },
      adminRole: "admin",
      adminDisplayRole: "Administrador",
      defaultInviteRole: "dev",
      themeSettings,
      setThemeSettings,
      resetThemeSettings,
      aiSettings,
      setAiSettings,
      profile,
      profileLoading,
      upsertProfile,
      isUpsertingProfile,
      uploadLogo,
      isUploadingLogo,
      logoSignedUrl,
      pdfLogoSignedUrl,
      alertSettings,
      alertSettingsLoading: profileLoading,
      staff,
      updateUserProfile,
      isUpdatingUserProfile,
    };
  }, [
    sessionRole,
    themeSettings,
    setThemeSettings,
    resetThemeSettings,
    aiSettings,
    setAiSettings,
    profile,
    profileLoading,
    upsertProfile,
    isUpsertingProfile,
    uploadLogo,
    isUploadingLogo,
    logoSignedUrl,
    pdfLogoSignedUrl,
    staff,
    updateUserProfile,
    isUpdatingUserProfile,
  ]);

  return <SettingsModuleProvider value={value}>{children}</SettingsModuleProvider>;
}
