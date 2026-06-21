import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2, Mail, UserPlus, Image as ImageIcon, BrainCircuit, CheckCircle2, AlertTriangle, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Label,
  useAuth,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormSelect,
} from "@nodocore/shared-components";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSettingsModule } from "./context";
import { AgencyProfileForm } from "./agency-profile-form";
import { BankAccountsSection } from "./bank-accounts-section";
import type { SettingsTabId, StaffUser } from "./types";

const profileSchema = z
  .object({
    full_name: z.string().min(1, "El nombre es requerido"),
    password: z.string().optional(),
    confirm_password: z.string().optional(),
  })
  .refine(
    (v) => !v.password || v.password.length >= 6,
    { path: ["password"], message: "Mínimo 6 caracteres" },
  )
  .refine((v) => (v.password ?? "") === (v.confirm_password ?? ""), {
    path: ["confirm_password"],
    message: "Las contraseñas no coinciden",
  });

type ProfileFormValues = z.infer<typeof profileSchema>;

function ProfileSettingsSection() {
  const { user } = useAuth();
  const { updateUserProfile, isUpdatingUserProfile } = useSettingsModule();
  const mutateAsync = updateUserProfile;
  const isPending = isUpdatingUserProfile;
  const currentName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const email = user?.email ?? "";

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema) as any,
    defaultValues: { full_name: currentName, password: "", confirm_password: "" },
  });

  async function handleSubmit(values: ProfileFormValues) {
    await mutateAsync({ full_name: values.full_name, password: values.password });
    form.reset({ full_name: values.full_name, password: "", confirm_password: "" });
  }

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h3 className="text-base font-bold text-navy">Información Personal</h3>
        <p className="text-xs text-slate2">Actualizá tu nombre y contraseña de acceso.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit as any)} className="space-y-4">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={email} disabled readOnly className="bg-muted" />
          </div>

          <FormField
            control={form.control as any}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Tu nombre" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nueva contraseña</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Ingresé contraseña…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name="confirm_password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirmar contraseña</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Repetí la contraseña…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Cambios
          </Button>
        </form>
      </Form>
    </div>
  );
}


function LogoCustomUploader() {
  const { uploadLogo, isUploadingLogo, upsertProfile, isUpsertingProfile, logoSignedUrl } = useSettingsModule();
  const isUploading = isUploadingLogo;
  const isSaving = isUpsertingProfile;
  const logoUrl = logoSignedUrl;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const path = await uploadLogo({ file, variant: "logo" });
      await upsertProfile({ logo_path: path });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir el logo");
    }
  };

  const handleClearLogo = async () => {
    setError(null);
    try {
      await upsertProfile({ logo_path: null });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar el logo");
    }
  };

  const isPending = isUploading || isSaving;

  return (
    <div className="space-y-4">
      <Label className="text-xs font-bold text-navy">Archivo del Logo</Label>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {logoUrl ? (
          <div className="relative group rounded-md overflow-hidden border border-border bg-white p-2">
            <img src={logoUrl} alt="Logo de la empresa" className="h-16 w-auto object-contain" />
            <button
              onClick={handleClearLogo}
              disabled={isPending}
              type="button"
              className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-semibold text-xs rounded-md"
            >
              Eliminar
            </button>
          </div>
        ) : (
          <div className="h-16 w-16 bg-border flex items-center justify-center rounded-md text-slate2">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
        <div className="flex-1 space-y-1">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={isPending}
            className="text-xs file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20 cursor-pointer"
          />
          <p className="text-[10px] text-slate2">
            Formatos soportados: JPG, PNG o WebP. Tamaño máximo: 2 MB.
          </p>
          <p className="text-[10px] text-slate2">
            Tamaño recomendado: <span className="font-semibold">480 × 128 px</span> (PNG con fondo transparente, proporción 15:4). El logo ocupa todo el ancho del sidebar sin deformarse.
          </p>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {isPending && (
        <div className="flex items-center gap-2 text-xs text-brand font-semibold">
          <Loader2 className="h-3 w-3 animate-spin" />
          Subiendo y guardando logo...
        </div>
      )}
    </div>
  );
}

function PdfLogoUploader() {
  const { uploadLogo, isUploadingLogo, upsertProfile, isUpsertingProfile, pdfLogoSignedUrl } = useSettingsModule();
  const isUploading = isUploadingLogo;
  const isSaving = isUpsertingProfile;
  const logoUrl = pdfLogoSignedUrl;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const path = await uploadLogo({ file, variant: "pdf-logo" });
      await upsertProfile({ pdf_logo_path: path });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir el logo");
    }
  };

  const handleClearLogo = async () => {
    setError(null);
    try {
      await upsertProfile({ pdf_logo_path: null });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar el logo");
    }
  };

  const isPending = isUploading || isSaving;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {logoUrl ? (
          <div className="relative group rounded-md overflow-hidden border border-border bg-white p-2">
            <img src={logoUrl} alt="Logo para PDFs" className="h-16 w-auto object-contain" />
            <button
              onClick={handleClearLogo}
              disabled={isPending}
              type="button"
              className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-semibold text-xs rounded-md"
            >
              Eliminar
            </button>
          </div>
        ) : (
          <div className="h-16 w-16 bg-border flex items-center justify-center rounded-md text-slate2">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
        <div className="flex-1 space-y-1">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={isPending}
            className="text-xs file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20 cursor-pointer"
          />
          <p className="text-[10px] text-slate2">
            Formatos soportados: JPG, PNG o WebP. Tamaño máximo: 2 MB.
          </p>
          <p className="text-[10px] text-slate2">
            Recomendado: logo con <span className="font-semibold">fondo blanco o sólido</span> (no transparente). Se usa en recibos, liquidaciones, contratos y reportes PDF.
          </p>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {isPending && (
        <div className="flex items-center gap-2 text-xs text-brand font-semibold">
          <Loader2 className="h-3 w-3 animate-spin" />
          Subiendo y guardando logo...
        </div>
      )}
    </div>
  );
}

function AlertsSettingsSection() {
  const { alertSettings: settings, alertSettingsLoading: isLoading, upsertProfile, isUpsertingProfile } = useSettingsModule();
  const isPending = isUpsertingProfile;
  const [contractExpirationMonths, setContractExpirationMonths] = useState(
    settings.contractExpirationMonths.toString()
  );
  const [rentAdjustmentMonths, setRentAdjustmentMonths] = useState(
    settings.rentAdjustmentMonths.toString()
  );

  const handleSave = async () => {
    const parsedExp = parseInt(contractExpirationMonths, 10);
    const parsedAdj = parseInt(rentAdjustmentMonths, 10);
    if (isNaN(parsedExp) || isNaN(parsedAdj)) return;

    await upsertProfile({
      alert_settings: {
        contractExpirationMonths: parsedExp,
        rentAdjustmentMonths: parsedAdj,
      },
    });
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>;
  }

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h3 className="text-base font-bold text-navy">Configuración de Alertas</h3>
        <p className="text-xs text-slate2">
          Definí con cuánta anticipación querés que el sistema te avise sobre los vencimientos y ajustes de contratos en el panel principal.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-bold text-navy">
            Vencimiento de Contrato (meses)
          </Label>
          <Input
            type="number"
            min={1}
            max={12}
            value={contractExpirationMonths}
            onChange={(e) => setContractExpirationMonths(e.target.value)}
          />
          <p className="text-[10px] text-slate2">Ej: 2 para avisar dos meses antes del final del contrato.</p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-bold text-navy">
            Ajuste de Alquiler (meses)
          </Label>
          <Input
            type="number"
            min={1}
            max={12}
            value={rentAdjustmentMonths}
            onChange={(e) => setRentAdjustmentMonths(e.target.value)}
          />
          <p className="text-[10px] text-slate2">Ej: 1 para avisar un mes antes del próximo ajuste por índice.</p>
        </div>

        <Button onClick={handleSave} disabled={isPending} className="w-full">
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar Configuración
        </Button>
      </div>
    </div>
  );
}

function IpcSettingsSection() {
  const { saveManualIpc, isSavingManualIpc } = useSettingsModule();
  const [ipcValue, setIpcValue] = useState("");
  const [success, setSuccess] = useState(false);
  const isPending = isSavingManualIpc ?? false;

  const handleSave = async () => {
    if (!saveManualIpc) return;
    const parsed = parseFloat(ipcValue);
    if (isNaN(parsed)) return;
    try {
      await saveManualIpc(parsed);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setIpcValue("");
    } catch (err) {
      console.error(err);
      alert("Error al guardar el IPC manual");
    }
  };

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h3 className="text-base font-bold text-navy">Carga Manual de IPC</h3>
        <p className="text-xs text-slate2">
          Si la actualización automática falla o trae un valor incorrecto, podés forzar el valor del mes actual acá.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-bold text-navy">
            Valor del IPC (%)
          </Label>
          <Input
            type="number"
            step="0.01"
            placeholder="Ej: 4.2"
            value={ipcValue}
            onChange={(e) => setIpcValue(e.target.value)}
          />
          <p className="text-[10px] text-slate2">Ingresá el porcentaje (ej. 4.2). Se aplicará para el mes actual.</p>
        </div>

        <Button onClick={handleSave} disabled={isPending || !ipcValue} className="w-full">
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar IPC Manual
        </Button>
        {success && <p className="text-xs text-brand font-semibold text-center mt-2">¡IPC guardado con éxito!</p>}
      </div>
    </div>
  );
}

// ── Section visibility helpers ───────────────────────────────────────────────

function defaultSections(managedNav: { to: string; label: string }[]): string[] {
  return managedNav.map((n) => n.to);
}

function employeeDefaultSections(module: {
  defaultEmployeeSections?: string[];
  managedNav: { to: string; label: string }[];
}): string[] {
  return module.defaultEmployeeSections ?? defaultSections(module.managedNav);
}

function roleUsesSectionPicker(
  role: string,
  module: {
    adminDisplayRole: string;
    staffSectionRole?: string;
    fixedAccessRoles?: string[];
  },
): boolean {
  if (module.fixedAccessRoles?.includes(role)) return false;
  if (module.staffSectionRole) return role === module.staffSectionRole;
  return role !== module.adminDisplayRole;
}

function sectionsForMemberRole(
  role: string,
  module: {
    adminDisplayRole: string;
    staffSectionRole?: string;
    defaultEmployeeSections?: string[];
    managedNav: { to: string; label: string }[];
  },
): string[] {
  if (role === module.adminDisplayRole) return defaultSections(module.managedNav);
  if (module.staffSectionRole && role === module.staffSectionRole) {
    return employeeDefaultSections(module);
  }
  return defaultSections(module.managedNav);
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ALL_SETTINGS_TABS: { id: SettingsTabId; label: string }[] = [
  { id: "profile", label: "Mi Perfil" },
  { id: "company", label: "Datos de Empresa" },
  { id: "users", label: "Usuarios y Roles" },
  { id: "customization", label: "Personalización" },
  { id: "ai", label: "Integraciones / IA" },
  { id: "alerts", label: "Alertas" },
  { id: "ipc", label: "Índices" },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const module = useSettingsModule();
  const managedNav = module.managedNav;
  const settingsTabs = ALL_SETTINGS_TABS.filter((tab) => !module.hiddenTabs?.includes(tab.id));
  const [activeTab, setActiveTab] = useState<SettingsTabId>(settingsTabs[0]?.id ?? "profile");
  const { aiSettings, setAiSettings } = { aiSettings: module.aiSettings, setAiSettings: module.setAiSettings };
  const [apiKeyInput, setApiKeyInput] = useState(aiSettings.geminiApiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiKeySaved, setAiKeySaved] = useState(false);

  const handleSaveApiKey = () => {
    setAiSettings({ geminiApiKey: apiKeyInput.trim() });
    setAiKeySaved(true);
    setTimeout(() => setAiKeySaved(false), 2500);
  };
  const { role: authRole, user: authUser } = useAuth();
  const effectiveRole = module.sessionRole ?? authRole;
  const isSuperAdmin = !!module.superAdminRole && effectiveRole === module.superAdminRole;
  const hasAdminAccess = effectiveRole === module.adminRole || isSuperAdmin;
  const profile = module.profile;
  const { settings, setSettings, resetSettings } = { settings: module.themeSettings, setSettings: module.setThemeSettings, resetSettings: module.resetThemeSettings };
  const upsertProfile = module.upsertProfile;

  const [savingTheme, setSavingTheme] = useState(false);
  const [themeSaved, setThemeSaved] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);

  const handleSaveTheme = async () => {
    setSavingTheme(true);
    setThemeError(null);
    setThemeSaved(false);
    try {
      await upsertProfile({ theme_settings: settings as any });
      setThemeSaved(true);
      setTimeout(() => setThemeSaved(false), 3000);
    } catch (err) {
      setThemeError(err instanceof Error ? err.message : "Error al guardar la configuración");
    } finally {
      setSavingTheme(false);
    }
  };

  // Persist theme to Supabase when the dialog closes so all admins share branding.
  const handleOpenChange = useCallback(
    async (nextOpen: boolean) => {
      if (!nextOpen) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await upsertProfile({ theme_settings: settings as any });
        } catch {
          // Best-effort — localStorage already has the settings as fallback.
        }
      }
      onOpenChange(nextOpen);
    },
    [settings, upsertProfile, onOpenChange],
  );

  // ── User section visibility ─────────────────────────────────────────────────
  const [userPermissions, setUserPermissions] = useState<Record<string, string[]>>({});
  const [draftSections, setDraftSections] = useState<string[]>(() =>
    employeeDefaultSections(module),
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [savingPerms, setSavingPerms] = useState(false);
  const [permsSaved, setPermsSaved] = useState(false);

  useEffect(() => {
    if (profile?.theme_settings) {
      const stored = (profile.theme_settings as Record<string, unknown>).userPermissions;
      if (stored && typeof stored === "object") {
        setUserPermissions(stored as Record<string, string[]>);
      }
    }
  }, [profile]);

  const toggleSection = (path: string) => {
    setDraftSections((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  };

  const persistUserPermissions = async (next: Record<string, string[]>) => {
    setUserPermissions(next);
    await upsertProfile({
      theme_settings: {
        ...((profile?.theme_settings as object) ?? {}),
        userPermissions: next,
      } as any,
    });
  };

  const handleSavePermissions = async () => {
    if (!selectedUserId) return;
    setSavingPerms(true);
    setMemberActionError(null);
    try {
      const selected = users.find((u) => u.id === selectedUserId);
      if (selected && selected.role !== newMember.role) {
        await updateMemberRole(selectedUserId, newMember.role);
      }
      if (roleUsesSectionPicker(newMember.role, module)) {
        const next = { ...userPermissions, [selectedUserId]: draftSections };
        await persistUserPermissions(next);
      }
      setPermsSaved(true);
      setTimeout(() => setPermsSaved(false), 3000);
    } catch (err) {
      setMemberActionError(
        err instanceof Error ? err.message : "No se pudieron guardar los cambios",
      );
    } finally {
      setSavingPerms(false);
    }
  };

  const handleSelectUser = (user: StaffUser) => {
    setSelectedUserId(user.id);
    setNewMember({ name: user.name, email: user.email, role: user.role });
    setDraftSections(
      roleUsesSectionPicker(user.role, module)
        ? (userPermissions[user.id] ?? employeeDefaultSections(module))
        : sectionsForMemberRole(user.role, module),
    );
    setMemberActionError(null);
  };

  const handleNewUser = () => {
    setSelectedUserId(null);
    setNewMember({ name: "", email: "", role: module.defaultInviteRole });
    setDraftSections(sectionsForMemberRole(module.defaultInviteRole, module));
  };

  const handleMemberRoleChange = (role: string) => {
    setNewMember({ ...newMember, role });
    if (roleUsesSectionPicker(role, module)) {
      setDraftSections(sectionsForMemberRole(role, module));
    }
  };

  // ── Dynamic Users state ─────────────────────────────────────────────────────
  const { users, loading: usersLoading, error: usersError, fetchMembers, inviteUser, updateMemberRole, removeMember } = module.staff;
  const [newMember, setNewMember] = useState({
    name: "",
    email: "",
    role: module.defaultInviteRole,
  });
  const [invitePassword, setInvitePassword] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccessMessage, setInviteSuccessMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<StaffUser | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  useEffect(() => {
    if (open && activeTab === "users" && hasAdminAccess) {
      void fetchMembers();
    }
  }, [open, activeTab, hasAdminAccess, fetchMembers]);

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    setMemberActionError(null);
    try {
      await removeMember(userToDelete.id);
      const nextPerms = { ...userPermissions };
      delete nextPerms[userToDelete.id];
      await persistUserPermissions(nextPerms);
      if (selectedUserId === userToDelete.id) {
        handleNewUser();
      }
      setUserToDelete(null);
    } catch (err) {
      setMemberActionError(
        err instanceof Error ? err.message : "No se pudo eliminar el usuario",
      );
    } finally {
      setDeletingUser(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.name || !newMember.email) return;
    if (module.inviteRequiresPassword && !invitePassword.trim()) {
      setInviteError("La contraseña inicial es obligatoria.");
      return;
    }
    setIsInviting(true);
    setInviteError(null);
    setInviteSuccessMessage(null);
    try {
      const { id: userId, invited, emailSent, emailWarning } = await inviteUser(
        newMember.name,
        newMember.email,
        newMember.role,
        module.inviteRequiresPassword ? invitePassword.trim() : undefined,
      );
      if (roleUsesSectionPicker(newMember.role, module)) {
        const next = { ...userPermissions, [userId]: draftSections };
        await persistUserPermissions(next);
      }
      handleNewUser();
      setInvitePassword("");
      const baseMessage = invited
        ? module.inviteMessages.invited
        : module.inviteMessages.existing;
      const emailNote =
        emailSent === false
          ? module.inviteMessages.emailSkipped ??
            `Usuario agregado, pero no se pudo enviar el correo${emailWarning ? `: ${emailWarning}` : "."}`
          : null;
      setInviteSuccessMessage(emailNote ? `${baseMessage} ${emailNote}` : baseMessage);
      setTimeout(() => setInviteSuccessMessage(null), 7000);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "No se pudo enviar la invitación");
    } finally {
      setIsInviting(false);
    }
  };

  const showSectionPicker =
    hasAdminAccess &&
    roleUsesSectionPicker(newMember.role, module);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl h-[92vh] md:h-[800px] flex flex-col sm:flex-row gap-0 p-0 overflow-hidden bg-white data-[state=open]:animate-none data-[state=closed]:animate-none">
        {isInviting && (
          <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-white/40">
            <div className="flex flex-col items-center gap-3 bg-white rounded-xl px-8 py-6 shadow-xl border border-border">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
              <span className="text-sm font-semibold text-navy">Invitando usuario...</span>
            </div>
          </div>
        )}
          <nav
            aria-label="Secciones de configuración"
            className="hidden sm:flex sm:w-52 md:w-56 flex-shrink-0 flex-col border-r border-border bg-slate-50 overflow-y-auto"
          >
            {settingsTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors border-l-2 ${
                  activeTab === tab.id
                    ? "border-brand bg-brand/5 text-brand"
                    : "border-transparent text-slate2 hover:bg-white hover:text-navy"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

        <div className="flex flex-1 min-h-0 flex-col min-w-0 bg-white">
          <div className="bg-white p-6 pb-4 flex-shrink-0 border-b border-border">
            <DialogHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mr-6">
                <DialogTitle className="text-xl">
                  Configuración del Panel
                </DialogTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    resetSettings();
                    try {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      await upsertProfile({ theme_settings: null as any });
                    } catch {
                      // Best-effort
                    }
                  }}
                  className="text-xs border-brand text-brand hover:bg-brand hover:text-white"
                >
                  Default Nodo (Restablecer)
                </Button>
              </div>
              <DialogDescription className="text-xs sm:text-sm">
                Personalizá los datos de tu empresa, el look & feel del panel y
                los accesos de tu equipo.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="sm:hidden border-b border-border px-4 py-3 flex-shrink-0">
            <label htmlFor="settings-section" className="sr-only">
              Sección de configuración
            </label>
            <FormSelect
              id="settings-section"
              value={activeTab}
              onChange={(value) => setActiveTab(value as SettingsTabId)}
              options={settingsTabs.map((tab) => ({ value: tab.id, label: tab.label }))}
              triggerClassName="font-semibold text-navy"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-white">
          {/* TAB 0: Mi Perfil */}
          {activeTab === "profile" && <ProfileSettingsSection />}

          {/* TAB: Alertas */}
          {activeTab === "alerts" && <AlertsSettingsSection />}

          {/* TAB: Indices */}
          {activeTab === "ipc" && <IpcSettingsSection />}

          {/* TAB 1: Mi Perfil / Empresa */}
          {activeTab === "company" && (
            <div className="space-y-8">
              <div>
                <h3 className="text-base font-bold text-navy mb-4">
                  Datos Fiscales y Comerciales
                </h3>
                <AgencyProfileForm onSuccess={() => {}} />
              </div>

              <BankAccountsSection />
              {module.companyExtraContent}
            </div>
          )}

          {/* TAB 2: Personalización del Panel */}
          {activeTab === "customization" && (
            <div className="space-y-6">
              {/* Color Primario */}
              <div className="space-y-2">
                <Label className="text-base font-bold text-navy">
                  Color Primario
                </Label>
                <p className="text-xs text-slate2">
                  Elegí el color de marca que representa el dashboard (Botones y
                  Detalles). Puedes elegirlo o ingresar su código hexadecimal.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(settings.primaryColor) ? settings.primaryColor : "#da5a0e"}
                    onChange={(e) =>
                      setSettings({ primaryColor: e.target.value })
                    }
                    className="h-10 w-12 cursor-pointer rounded border border-border p-1 bg-white flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1">
                    <Input
                      type="text"
                      placeholder="#DA5A0E"
                      value={settings.primaryColor}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val && !val.startsWith("#") && /^[0-9A-Fa-f]/.test(val)) {
                          val = "#" + val;
                        }
                        setSettings({ primaryColor: val });
                      }}
                      className="h-9 w-28 text-xs font-mono uppercase"
                      maxLength={7}
                    />
                    <button
                      onClick={() => setSettings({ primaryColor: "#da5a0e" })}
                      className="text-left text-xs text-brand hover:underline font-semibold"
                    >
                      Restablecer Naranja Nodo Inmo
                    </button>
                  </div>
                </div>
              </div>

              {/* Color Secundario (Menu lateral) */}
              <div className="space-y-2 border-t border-border pt-6">
                <Label className="text-base font-bold text-navy">
                  Color Secundario (Menú Lateral)
                </Label>
                <p className="text-xs text-slate2">
                  Elegí el color de fondo para la barra de navegación lateral. Puedes elegirlo o ingresar su código hexadecimal.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(settings.secondaryColor) ? settings.secondaryColor : "#121e2f"}
                    onChange={(e) =>
                      setSettings({ secondaryColor: e.target.value })
                    }
                    className="h-10 w-12 cursor-pointer rounded border border-border p-1 bg-white flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1">
                    <Input
                      type="text"
                      placeholder="#121E2F"
                      value={settings.secondaryColor}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val && !val.startsWith("#") && /^[0-9A-Fa-f]/.test(val)) {
                          val = "#" + val;
                        }
                        setSettings({ secondaryColor: val });
                      }}
                      className="h-9 w-28 text-xs font-mono uppercase"
                      maxLength={7}
                    />
                    <button
                      onClick={() => setSettings({ secondaryColor: "#121e2f" })}
                      className="text-left text-xs text-brand hover:underline font-semibold"
                    >
                      Restablecer Azul Marino Original
                    </button>
                  </div>
                </div>
              </div>

              {/* Color del Texto del Menú Lateral (Sin Seleccionar) */}
              <div className="space-y-2 border-t border-border pt-6">
                <Label className="text-base font-bold text-navy">
                  Color del Texto del Menú Lateral (Sin Seleccionar)
                </Label>
                <p className="text-xs text-slate2">
                  Elegí el color de fuente para los elementos del menú que no estén seleccionados (ej. Contratos, Pagos).
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(settings.sidebarTextColor) ? settings.sidebarTextColor : "#9dacbe"}
                    onChange={(e) =>
                      setSettings({ sidebarTextColor: e.target.value })
                    }
                    className="h-10 w-12 cursor-pointer rounded border border-border p-1 bg-white flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1">
                    <Input
                      type="text"
                      placeholder="#9DACBE"
                      value={settings.sidebarTextColor}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val && !val.startsWith("#") && /^[0-9A-Fa-f]/.test(val)) {
                          val = "#" + val;
                        }
                        setSettings({ sidebarTextColor: val });
                      }}
                      className="h-9 w-28 text-xs font-mono uppercase"
                      maxLength={7}
                    />
                    <button
                      onClick={() => setSettings({ sidebarTextColor: "#9dacbe" })}
                      className="text-left text-xs text-brand hover:underline font-semibold"
                    >
                      Restablecer Gris Azulado Original
                    </button>
                  </div>
                </div>
              </div>

              {/* Color de Fuente */}
              <div className="space-y-2 border-t border-border pt-6">
                <Label className="text-base font-bold text-navy">
                  Color de Fuente (Textos)
                </Label>
                <p className="text-xs text-slate2">
                  Elegí el color para los textos y títulos del sistema. Puedes elegirlo o ingresar su código hexadecimal.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(settings.fontColor) ? settings.fontColor : "#16202e"}
                    onChange={(e) => setSettings({ fontColor: e.target.value })}
                    className="h-10 w-12 cursor-pointer rounded border border-border p-1 bg-white flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1">
                    <Input
                      type="text"
                      placeholder="#16202E"
                      value={settings.fontColor}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val && !val.startsWith("#") && /^[0-9A-Fa-f]/.test(val)) {
                          val = "#" + val;
                        }
                        setSettings({ fontColor: val });
                      }}
                      className="h-9 w-28 text-xs font-mono uppercase"
                      maxLength={7}
                    />
                    <button
                      onClick={() => setSettings({ fontColor: "#16202e" })}
                      className="text-left text-xs text-brand hover:underline font-semibold"
                    >
                      Restablecer Color de Texto Original
                    </button>
                  </div>
                </div>
              </div>

              {/* Color de Fuente de Botones */}
              <div className="space-y-2 border-t border-border pt-6">
                <Label className="text-base font-bold text-navy">
                  Color de Texto en Botones Primarios
                </Label>
                <p className="text-xs text-slate2">
                  Elegí el color del texto y los iconos dentro de los botones rellenos. Puedes elegirlo o ingresar su código hexadecimal.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(settings.buttonFontColor) ? settings.buttonFontColor : "#ffffff"}
                    onChange={(e) =>
                      setSettings({ buttonFontColor: e.target.value })
                    }
                    className="h-10 w-12 cursor-pointer rounded border border-border p-1 bg-white flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1">
                    <Input
                      type="text"
                      placeholder="#FFFFFF"
                      value={settings.buttonFontColor}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val && !val.startsWith("#") && /^[0-9A-Fa-f]/.test(val)) {
                          val = "#" + val;
                        }
                        setSettings({ buttonFontColor: val });
                      }}
                      className="h-9 w-28 text-xs font-mono uppercase"
                      maxLength={7}
                    />
                    <button
                      onClick={() =>
                        setSettings({ buttonFontColor: "#ffffff" })
                      }
                      className="text-left text-xs text-brand hover:underline font-semibold"
                    >
                      Restablecer Color de Texto de Botón Original
                    </button>
                  </div>
                </div>
              </div>

              {/* Logo del Panel */}
              <div className="space-y-2 border-t border-border pt-6">
                <Label className="text-base font-bold text-navy">
                  Logo del Panel
                </Label>
                <p className="text-xs text-slate2">
                  Elegí si preferís usar el logo de Nodo, el logo cargado de tu
                  empresa, o un texto personalizado.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-4">
                  {[
                    { id: "default", label: "Predeterminado Nodo" },
                    { id: "custom", label: "Logo de mi Empresa" },
                    { id: "text", label: "Texto / Nombre" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        setSettings({ logoType: option.id as any })
                      }
                      className={`p-3 border text-center text-sm font-semibold rounded-md transition-all ${
                        settings.logoType === option.id
                          ? "border-brand bg-brand/5 text-brand"
                          : "border-border hover:bg-paper text-slate2"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {settings.logoType === "text" && (
                  <div className="space-y-2 bg-paper p-4 rounded-md border border-border">
                    <Label htmlFor="brandText">Texto de la Marca</Label>
                    <Input
                      id="brandText"
                      placeholder="Ej. Mi Inmobiliaria"
                      value={settings.brandText}
                      onChange={(e) =>
                        setSettings({ brandText: e.target.value })
                      }
                    />
                  </div>
                )}

                {settings.logoType === "custom" && (
                  <div className="space-y-4 bg-paper p-4 rounded-md border border-border">
                    <LogoCustomUploader />
                  </div>
                )}
              </div>

              {/* Logo para PDFs */}
              <div className="space-y-2 border-t border-border pt-6">
                <Label className="text-base font-bold text-navy">
                  Logo para PDFs
                </Label>
                <p className="text-xs text-slate2">
                  Logo separado para recibos, liquidaciones, contratos y reportes.
                  Distinto al del panel: conviene usar una versión con fondo sólido
                  para que se vea bien al imprimir.
                </p>
                <div className="bg-paper p-4 rounded-md border border-border">
                  <PdfLogoUploader />
                </div>
              </div>

              {/* Estilo de Bordes */}
              <div className="space-y-2 border-t border-border pt-6">
                <Label className="text-base font-bold text-navy">
                  Estilo de Bordes
                </Label>
                <p className="text-xs text-slate2">
                  Ajustá la redondez de los botones, inputs y tarjetas.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {[
                    {
                      id: "none",
                      label: "Rectos / Cuadrados",
                      previewClass: "rounded-none",
                    },
                    {
                      id: "md",
                      label: "Redondeados",
                      previewClass: "rounded-md",
                    },
                    {
                      id: "full",
                      label: "Curvos / Orgánicos",
                      previewClass: "rounded-full",
                    },
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={() =>
                        setSettings({ borderRadius: style.id as any })
                      }
                      className={`p-4 border text-left flex flex-col justify-between h-28 transition-all ${
                        settings.borderRadius === style.id
                          ? "border-brand bg-brand/5 shadow-sm"
                          : "border-border hover:bg-paper"
                      }`}
                      style={{
                        borderRadius:
                          style.id === "none"
                            ? "0px"
                            : style.id === "full"
                              ? "22px"
                              : "14px",
                      }}
                    >
                      <span className="text-sm font-bold text-navy">
                        {style.label}
                      </span>
                      <div
                        className="w-full h-8 bg-border flex items-center justify-center text-[10px] text-slate2 font-medium"
                        style={{
                          borderRadius:
                            style.id === "none"
                              ? "0px"
                              : style.id === "full"
                                ? "22px"
                                : "8px",
                        }}
                      >
                        Vista previa
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipografía */}
              <div className="space-y-2 border-t border-border pt-6">
                <Label className="text-base font-bold text-navy">
                  Tipografía del Sistema
                </Label>
                <p className="text-xs text-slate2">
                  Seleccioná una tipografía segura para maximizar la
                  legibilidad.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {(["Inter", "Roboto", "Montserrat"] as const).map((font) => (
                    <button
                      key={font}
                      onClick={() => setSettings({ fontFamily: font })}
                      className={`p-4 border text-left flex flex-col gap-2 transition-all ${
                        settings.fontFamily === font
                          ? "border-brand bg-brand/5 shadow-sm"
                          : "border-border hover:bg-paper"
                      }`}
                      style={{ fontFamily: font }}
                    >
                      <span className="text-base font-bold text-navy text-sm sm:text-base">
                        {font}
                      </span>
                      <span className="text-[10px] sm:text-xs text-slate2 leading-tight">
                        El veloz murciélago hindú comía feliz cardillo y kiwi.
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Guardar Personalización Button */}
              <div className="border-t border-border pt-6 flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3">
                  {themeSaved && (
                    <span className="text-xs text-green-600 font-semibold flex items-center justify-end gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Configuración de branding guardada en la base de datos
                    </span>
                  )}
                  {themeError && (
                    <span className="text-xs text-destructive font-semibold text-right">
                      {themeError}
                    </span>
                  )}
                  <Button
                    onClick={handleSaveTheme}
                    disabled={savingTheme}
                    className="w-full sm:w-auto"
                  >
                    {savingTheme && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar Personalización
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Integraciones / IA */}
          {activeTab === "ai" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-navy mb-1 flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-brand" />
                  Inteligencia Artificial
                </h3>
                <p className="text-xs text-slate2">
                  Configurá tu API key personal de Google Gemini para habilitar
                  funciones de IA como el dictado de propiedades por voz.
                  La clave se guarda localmente en tu navegador y nunca se
                  envía a ningún servidor externo de Nodo.
                </p>
              </div>

              <div className="border-t border-border pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-navy">Gemini API Key</Label>
                  {aiSettings.geminiApiKey ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Configurada
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-amber-600 font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Sin configurar
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Input
                    id="gemini-api-key"
                    type={showApiKey ? "text" : "password"}
                    placeholder="AIza..."
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="pr-10 font-mono text-sm"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate2 hover:text-navy transition-colors"
                    aria-label={showApiKey ? "Ocultar clave" : "Mostrar clave"}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-slate2 leading-relaxed">
                  Obtenés tu clave gratis en{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand underline hover:no-underline font-semibold"
                  >
                    Google AI Studio
                  </a>
                  . El tier gratuito soporta hasta 1.500 requests/día con
                  Gemini 1.5 Flash.
                </p>

                <Button
                  onClick={handleSaveApiKey}
                  size="sm"
                  disabled={apiKeyInput === aiSettings.geminiApiKey}
                  className="gap-2"
                >
                  {aiKeySaved ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Guardada
                    </>
                  ) : (
                    "Guardar API key"
                  )}
                </Button>
              </div>

              <div className="border-t border-border pt-6">
                <h4 className="text-sm font-bold text-navy mb-2">¿Para qué se usa?</h4>
                <ul className="space-y-2 text-xs text-slate2">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-brand font-bold">🎤</span>
                    <span>
                      <strong className="text-navy">Dictado de propiedades:</strong> Hablás en lenguaje natural
                      y el sistema extrae automáticamente dirección, tipo, precio, moneda y ambientes.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-brand font-bold">🔒</span>
                    <span>
                      La clave <strong className="text-navy">nunca sale de tu navegador</strong>.
                      Nodo no la almacena ni la transmite.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: Gestión de Usuarios y Roles */}
          {activeTab === "users" && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-navy">
                    Equipo & Accesos
                  </h3>
                  <p className="text-xs text-slate2">
                    Administrá los roles mapeados directamente a la lógica de
                    nodos.
                  </p>
                </div>
              </div>

              {/* Formulario de invitación rápida */}
              <form
                onSubmit={selectedUserId ? (e) => e.preventDefault() : handleInviteUser}
                className="bg-paper p-4 rounded-md border border-border gap-4 grid grid-cols-1 md:grid-cols-3 items-end"
              >
                {selectedUserId && (
                  <div className="md:col-span-3 flex items-center justify-between gap-2 rounded-md border border-brand/30 bg-brand/5 px-3 py-2">
                    <p className="text-xs text-navy">
                      Editando accesos de{" "}
                      <strong>{newMember.name}</strong> ({newMember.role})
                    </p>
                    <Button type="button" variant="ghost" size="sm" onClick={handleNewUser} className="text-xs">
                      + Nuevo usuario
                    </Button>
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="memberName">Nombre completo</Label>
                  <Input
                    id="memberName"
                    placeholder="Ej. Lucas Gómez"
                    value={newMember.name}
                    onChange={(e) =>
                      setNewMember({ ...newMember, name: e.target.value })
                    }
                    disabled={!!selectedUserId}
                    required={!selectedUserId}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="memberEmail">Email</Label>
                  <Input
                    id="memberEmail"
                    type="email"
                    placeholder="lucas@nodoinmo.com"
                    value={newMember.email}
                    onChange={(e) =>
                      setNewMember({ ...newMember, email: e.target.value })
                    }
                    disabled={!!selectedUserId}
                    required={!selectedUserId}
                  />
                </div>
                {module.inviteRequiresPassword && !selectedUserId && (
                  <div className="space-y-1 md:col-span-3">
                    <Label htmlFor="memberPassword">Contraseña inicial</Label>
                    <Input
                      id="memberPassword"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={invitePassword}
                      onChange={(e) => setInvitePassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="memberRole">Rol del Usuario</Label>
                  <FormSelect
                    id="memberRole"
                    value={newMember.role}
                    onChange={handleMemberRoleChange}
                    disabled={
                      !!selectedUserId &&
                      users.find((u) => u.id === selectedUserId)?.role === module.adminDisplayRole
                    }
                    options={
                      selectedUserId &&
                      users.find((u) => u.id === selectedUserId)?.role === module.adminDisplayRole
                        ? [{ value: module.adminDisplayRole, label: module.adminDisplayRole }]
                        : [...module.roleOptions]
                    }
                  />
                </div>

                {showSectionPicker && (
                  <div className="md:col-span-3 space-y-2 border-t border-border pt-4">
                    <div>
                      <h4 className="text-sm font-bold text-navy">Secciones visibles</h4>
                      <p className="text-xs text-slate2">
                        Marcá qué partes del panel verá este empleado. Propietarios e inquilinos usan su portal propio.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                      {managedNav.map(({ to, label }) => (
                        <label
                          key={to}
                          className="flex items-center gap-2 text-sm text-slate2 cursor-pointer hover:text-navy"
                        >
                          <input
                            type="checkbox"
                            checked={draftSections.includes(to)}
                            onChange={() => toggleSection(to)}
                            className="h-4 w-4 accent-brand cursor-pointer"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="md:col-span-3 flex justify-end gap-2">
                  {selectedUserId ? (
                    <>
                      {permsSaved && (
                        <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 self-center">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Accesos guardados
                        </span>
                      )}
                      <Button
                        type="button"
                        onClick={handleSavePermissions}
                        disabled={savingPerms}
                        className="gap-2"
                      >
                        {savingPerms ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          "Guardar cambios"
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button type="submit" disabled={isInviting} className="gap-2">
                      {isInviting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Invitando...
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" />
                          Invitar Usuario
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </form>

              {inviteSuccessMessage && (
                <div className="bg-emerald-50 text-emerald-800 text-sm p-3 rounded-md flex items-center gap-2 border border-emerald-200">
                  <Mail className="h-4 w-4 text-emerald-600" />
                  <span>{inviteSuccessMessage}</span>
                </div>
              )}

              {inviteError && (
                <div className="bg-red-50 text-red-800 text-sm p-3 rounded-md flex items-center gap-2 border border-red-200">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span>{inviteError}</span>
                </div>
              )}

              {memberActionError && (
                <div className="bg-red-50 text-red-800 text-sm p-3 rounded-md flex items-center gap-2 border border-red-200">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span>{memberActionError}</span>
                </div>
              )}

              {usersError && (
                <div className="bg-amber-50 text-amber-900 text-sm p-3 rounded-md border border-amber-200">
                  {usersError}
                </div>
              )}

              {/* Tabla de Usuarios */}
              <div className="border border-border rounded-md overflow-x-auto bg-card">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-paper border-b border-border text-navy font-bold">
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Rol asignado</th>
                      <th className="p-3">Estado</th>
                      {hasAdminAccess && (
                        <th className="p-3 text-right">Acciones</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-slate2">
                    {usersLoading && (
                      <tr>
                        <td colSpan={effectiveRole === module.adminRole ? 4 : 3} className="p-6 text-center text-slate2">
                          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                        </td>
                      </tr>
                    )}
                    {!usersLoading &&
                      users.map((user) => {
                        const isSelf = authUser?.id === user.id;
                        const isAdminUser = user.role === module.adminDisplayRole;
                        const canDelete = !isSelf && (isSuperAdmin || !isAdminUser);
                        return (
                          <tr
                            key={user.id}
                            className={`transition-colors ${
                              selectedUserId === user.id ? "bg-brand/10" : "hover:bg-paper/50"
                            }`}
                          >
                            <td className="p-3 font-semibold text-navy">{user.name}</td>
                            <td className="p-3">
                              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-navy/10 text-navy">
                                {user.role}
                              </span>
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 text-xs font-semibold rounded-md ${
                                  user.status === "Activo"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {user.status}
                              </span>
                            </td>
                            {hasAdminAccess && (
                              <td className="p-3">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-1"
                                    onClick={() => handleSelectUser(user)}
                                    aria-label={`Editar ${user.name}`}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Editar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-1 text-destructive hover:text-destructive"
                                    disabled={!canDelete}
                                    onClick={() => setUserToDelete(user)}
                                    aria-label={`Eliminar ${user.name}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Eliminar
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {hasAdminAccess && (
                  <p className="text-[11px] text-slate2 px-3 py-2 border-t border-border">
                    Usá <strong>Editar</strong> para cambiar el rol y las secciones visibles.{" "}
                    <strong>Eliminar</strong> quita el acceso al panel{isSuperAdmin ? "." : " (no borra administradores ni tu propia cuenta)."}
                  </p>
                )}
              </div>

              <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar usuario del equipo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {userToDelete
                        ? `${userToDelete.name} (${userToDelete.email}) dejará de acceder a este nodo Inmo. La cuenta de auth no se borra del sistema.`
                        : ""}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deletingUser}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={deletingUser}
                      onClick={(e) => {
                        e.preventDefault();
                        void handleDeleteUser();
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deletingUser ? "Eliminando..." : "Eliminar"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
