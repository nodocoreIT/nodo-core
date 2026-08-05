import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  SettingsModuleProvider,
  type AlertSettings,
  type SettingsModuleContextValue,
  DEFAULT_ALERT_SETTINGS,
  type ThemeSettings,
  type AiSettings,
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
import { getPanelAvatarSignedUrl, uploadPanelAvatar } from "./use-panel-avatar";
import { usePanelStaff } from "./use-panel-staff";

const PANEL_MANAGED_NAV = [
  { to: "/panel/solicitudes", label: "Solicitudes pendientes" },
  { to: "/panel/ideas", label: "Ideas" },
  { to: "/panel/tareas", label: "Tareas" },
  { to: "/panel/clientes", label: "Clientes" },
  { to: "/panel/usuarios-nodo", label: "Usuarios de Nodo" },
  { to: "/panel/caja", label: "Caja" },
  { to: "/panel/equipo", label: "Equipo" },
  { to: "/panel/passwords", label: "Bóveda de contraseñas" },
  { to: "/panel/unidades", label: "Unidades" },
  { to: "/panel/informes", label: "Informes" },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

const AI_STORAGE_KEY = "nodo-panel-ai-settings";

const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: "gemini",
  geminiApiKey: "",
  openaiApiKey: "",
  anthropicApiKey: "",
  groqApiKey: "",
};

function readAiSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_AI_SETTINGS };
  try {
    const raw = localStorage.getItem(AI_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.provider) parsed.provider = "gemini";
      if (!parsed.openaiApiKey) parsed.openaiApiKey = "";
      if (!parsed.anthropicApiKey) parsed.anthropicApiKey = "";
      return { ...DEFAULT_AI_SETTINGS, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_AI_SETTINGS };
}

export function PanelSettingsModuleProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { profile, loading: profileLoading, refresh } = usePanelOrgProfile();
  const staff = usePanelStaff();
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [themeSettings, setThemeState] = useState<ThemeSettings>(PANEL_DEFAULT_THEME);
  const [aiSettings, setAiState] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [logoSignedUrl, setLogoSignedUrl] = useState<string | null>(null);
  const [pdfLogoSignedUrl, setPdfLogoSignedUrl] = useState<string | null>(null);
  const [isUpsertingProfile, setIsUpsertingProfile] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUpdatingUserProfile, setIsUpdatingUserProfile] = useState(false);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarSignedUrl, setAvatarSignedUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useApplyPanelTheme(themeSettings);

  useEffect(() => {
    setThemeState(readPanelThemeFromStorage());
    setAiState(readAiSettings());
  }, []);

  useEffect(() => {
    async function loadSessionRole() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("role, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      setSessionRole(data?.role ?? null);
      setAvatarPath(data?.avatar_url ?? null);
    }
    void loadSessionRole();
  }, []);

  useEffect(() => {
    void getPanelAvatarSignedUrl(avatarPath).then(setAvatarSignedUrl);
  }, [avatarPath]);

  const uploadAvatar = useCallback(async (file: File) => {
    setIsUploadingAvatar(true);
    try {
      const path = await uploadPanelAvatar(file);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay sesión activa.");
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
      if (error) throw error;
      setAvatarPath(path);
      // El Sidebar lee userAvatarUrl como prop de un Server Component
      // (app/panel/layout.tsx) — sin esto, la foto nueva no aparece ahí
      // hasta una recarga manual del navegador.
      router.refresh();
      return path;
    } finally {
      setIsUploadingAvatar(false);
    }
  }, [router]);

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

  const setAiSettings = useCallback((next: Partial<AiSettings>) => {
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
      const { data: userData, error } = await supabase.auth.updateUser(attrs);
      if (error) throw error;

      // The Sidebar/Equipo list read nodo_core.profiles.full_name, NOT
      // auth.users.user_metadata — the line above alone never changed what
      // shows on screen. Own-row write, RLS ("own profile", auth.uid() = id)
      // allows this from the browser client, no server route needed.
      const userId = userData.user?.id;
      if (userId) {
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({ full_name: input.full_name, initials: getInitials(input.full_name) })
          .eq("id", userId);
        if (profileErr) throw profileErr;
        // Mismo motivo que en uploadAvatar: el Sidebar es un Server
        // Component, necesita este refresh para mostrar el nombre nuevo.
        router.refresh();
      }
    } finally {
      setIsUpdatingUserProfile(false);
    }
  }, [router]);

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
      uploadAvatar,
      isUploadingAvatar,
      avatarSignedUrl,
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
    uploadAvatar,
    isUploadingAvatar,
    avatarSignedUrl,
  ]);

  return <SettingsModuleProvider value={value}>{children}</SettingsModuleProvider>;
}
