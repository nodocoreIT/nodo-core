"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ObraSocialCombobox } from "@/components/ui/obra-social-combobox";
import { ThemeSettingsPanel } from "@/components/settings/theme-settings-panel";
import { clinicApi } from "@/lib/clinic/client-api";
import { createClient } from "@/lib/supabase/client";
import { useThemeSettings } from "@/hooks/use-theme-settings";
import {
  Camera,
  Eye,
  EyeOff,
  HeartPulse,
  Loader2,
  Palette,
  Plug,
  User,
} from "lucide-react";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

type TabId = "perfil" | "salud" | "personalizacion" | "integraciones";

interface Tab {
  id: TabId;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  {
    id: "perfil",
    label: "Mi Perfil",
    description: "Actualizá tus datos personales y contraseña.",
    icon: <User className="h-4 w-4" />,
  },
  {
    id: "salud",
    label: "Mi Salud",
    description: "Cobertura médica y datos de salud.",
    icon: <HeartPulse className="h-4 w-4" />,
  },
  {
    id: "personalizacion",
    label: "Personalización",
    description: "Ajustá los colores y tipografía del portal.",
    icon: <Palette className="h-4 w-4" />,
  },
  {
    id: "integraciones",
    label: "Integraciones",
    description: "Conectores e integraciones con IA.",
    icon: <Plug className="h-4 w-4" />,
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  dni: string;
  address: string;
  profilePhotoUrl: string | null;
  bloodType: string;
  obraSocial: string;
  insuranceNumber: string;
  heightCm: number | null;
  weightKg: number | null;
  allergies: string;
  chronicConditions: string;
  medications: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readImageFile(file: File, maxKb = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxKb * 1024) {
      reject(new Error(`Imagen muy grande (máx ${maxKb}KB)`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Sub-panels ───────────────────────────────────────────────────────────────

function TabPerfil({ initialData }: { initialData: ProfileData }) {
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState(initialData.firstName ?? "");
  const [lastName, setLastName] = useState(initialData.lastName ?? "");
  const [email, setEmail] = useState(initialData.email ?? "");
  const [phone, setPhone] = useState(initialData.phone ?? "");
  const [dni, setDni] = useState(initialData.dni ?? "");
  const [address, setAddress] = useState(initialData.address ?? "");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(
    initialData.profilePhotoUrl ?? null
  );

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSectionOpen, setPasswordSectionOpen] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhoto = async (file: File) => {
    try {
      const profilePhotoData = await readImageFile(file);
      await clinicApi.updatePatientProfile({ profilePhotoData });
      setProfilePhotoUrl(profilePhotoData);
      toast.success("Foto actualizada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir foto");
    }
  };

  const handleSave = async () => {
    if (password && password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setSaving(true);
    try {
      await clinicApi.updatePatientProfile({ firstName, lastName, phone, dni, address });

      if (password) {
        const supabase = createClient();
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw new Error(error.message);
        setPassword("");
        setConfirmPassword("");
      }

      toast.success("Cambios guardados");
      // Invalidate cache so next load fetches fresh data
      try { sessionStorage.removeItem("clinic_patient_profile_cache"); } catch { /* ignore */ }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-none border-0">
      <CardContent className="space-y-5 pt-2">
        {/* Avatar */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Información Personal
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="relative group shrink-0"
              aria-label="Cambiar foto de perfil"
            >
              <UserAvatar
                name={`${firstName} ${lastName}`.trim()}
                photoUrl={profilePhotoUrl ?? undefined}
                size="lg"
              />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-4 w-4 text-white" />
              </span>
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handlePhoto(f);
              }}
            />
            <p className="text-xs text-slate-400">
              Hacé clic en la foto para cambiarla
            </p>
          </div>
        </div>

        {/* First / Last name */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">Nombre</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Tu nombre"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Apellido</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Tu apellido"
            />
          </div>
        </div>

        {/* Email — read-only */}
        <div className="space-y-1.5">
          <Label htmlFor="patient-profile-email">Email</Label>
          <Input
            id="patient-profile-email"
            name="patient-profile-email"
            value={email}
            readOnly
            disabled
            autoComplete="username"
            className="bg-muted text-muted-foreground cursor-not-allowed"
          />
          <p className="text-xs text-slate-400">
            El email no se puede modificar desde aquí.
          </p>
        </div>

        {/* Phone / DNI */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+54 9 11 xxxx-xxxx"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dni">DNI</Label>
            <Input
              id="dni"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="Número de documento"
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-1.5">
          <Label htmlFor="address">Domicilio</Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Calle, número, ciudad"
          />
        </div>

        <div className="flex justify-end pt-1">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Guardar cambios
          </Button>
        </div>

        {/* Password — toggled section (separate from visibility toggles) */}
        <div className="border-t border-border pt-5">
          {!passwordSectionOpen && password === "" && confirmPassword === "" ? (
            <button
              type="button"
              onClick={() => setPasswordSectionOpen(true)}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              Cambiar contraseña
            </button>
          ) : (
            <form
              className="space-y-4"
              autoComplete="off"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSave();
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Cambiar contraseña
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPassword("");
                    setConfirmPassword("");
                    setPasswordSectionOpen(false);
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancelar
                </button>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="patient-new-password">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="patient-new-password"
                    name="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showNewPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="patient-confirm-password">Confirmar contraseña</Label>
                <div className="relative">
                  <Input
                    id="patient-confirm-password"
                    name="confirm-new-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showConfirmPassword ? "Ocultar confirmación" : "Mostrar confirmación"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Guardar contraseña
                </Button>
              </div>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TabSalud({ initialData }: { initialData: ProfileData }) {
  const [saving, setSaving] = useState(false);

  const [bloodType, setBloodType] = useState(initialData.bloodType ?? "");
  const [obraSocial, setObraSocial] = useState(initialData.obraSocial ?? "");
  const [insuranceNumber, setInsuranceNumber] = useState(initialData.insuranceNumber ?? "");
  const [heightCm, setHeightCm] = useState(
    initialData.heightCm != null ? String(initialData.heightCm) : ""
  );
  const [weightKg, setWeightKg] = useState(
    initialData.weightKg != null ? String(initialData.weightKg) : ""
  );
  const [allergies, setAllergies] = useState(initialData.allergies ?? "");
  const [chronicConditions, setChronicConditions] = useState(initialData.chronicConditions ?? "");
  const [medications, setMedications] = useState(initialData.medications ?? "");
  const [emergencyContactName, setEmergencyContactName] = useState(
    initialData.emergencyContactName ?? ""
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    initialData.emergencyContactPhone ?? ""
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await clinicApi.updatePatientProfile({
        healthProfile: {
          bloodType: bloodType || null,
          obraSocial: obraSocial || null,
          insuranceNumber: insuranceNumber || null,
          heightCm: heightCm ? Number(heightCm) : null,
          weightKg: weightKg ? Number(weightKg) : null,
          allergies: allergies || null,
          chronicConditions: chronicConditions || null,
          medications: medications || null,
          emergencyContactName: emergencyContactName || null,
          emergencyContactPhone: emergencyContactPhone || null,
        },
      });
      toast.success("Datos de salud actualizados");
      try { sessionStorage.removeItem("clinic_patient_profile_cache"); } catch { /* ignore */ }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-none border-0">
      <CardContent className="space-y-5 pt-2">

        {/* ── Biometría ──────────────────────────────────────────── */}
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Datos biométricos
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="bloodType">Tipo de sangre</Label>
          <Select value={bloodType} onValueChange={setBloodType}>
            <SelectTrigger id="bloodType">
              <SelectValue placeholder="Seleccioná tu grupo sanguíneo" />
            </SelectTrigger>
            <SelectContent>
              {BLOOD_TYPES.map((bt) => (
                <SelectItem key={bt} value={bt}>
                  {bt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="heightCm">Estatura (cm)</Label>
            <Input
              id="heightCm"
              type="number"
              min={50}
              max={250}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="ej. 170"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="weightKg">Peso (kg)</Label>
            <Input
              id="weightKg"
              type="number"
              min={2}
              max={300}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="ej. 70"
            />
          </div>
        </div>

        {/* ── Cobertura médica ───────────────────────────────────── */}
        <div className="border-t border-border pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">
            Cobertura médica
          </p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Obra social / prepaga</Label>
              <ObraSocialCombobox
                value={obraSocial}
                onChange={setObraSocial}
                placeholder="Buscá tu cobertura médica..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="insuranceNumber">N° de credencial</Label>
              <Input
                id="insuranceNumber"
                value={insuranceNumber}
                onChange={(e) => setInsuranceNumber(e.target.value)}
                placeholder="Nº de afiliado / credencial"
              />
            </div>
          </div>
        </div>

        {/* ── Antecedentes clínicos ──────────────────────────────── */}
        <div className="border-t border-border pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">
            Antecedentes clínicos
          </p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="allergies">Alergias</Label>
              <textarea
                id="allergies"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="Medicamentos, alimentos..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chronicConditions">Enfermedades crónicas / antecedentes</Label>
              <textarea
                id="chronicConditions"
                value={chronicConditions}
                onChange={(e) => setChronicConditions(e.target.value)}
                placeholder="Diabetes, hipertensión..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="medications">Medicación habitual</Label>
              <textarea
                id="medications"
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                placeholder="Nombre, dosis y frecuencia..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>
        </div>

        {/* ── Contacto de emergencia ─────────────────────────────── */}
        <div className="border-t border-border pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">
            Contacto de emergencia
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="emergencyContactName">Nombre y apellido</Label>
              <Input
                id="emergencyContactName"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                placeholder="Juan Pérez"
                autoComplete="off"
                className="bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emergencyContactPhone">Teléfono</Label>
              <Input
                id="emergencyContactPhone"
                type="tel"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                placeholder="+54 9 11 xxxx-xxxx"
                autoComplete="off"
                className="bg-white"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Guardar datos de salud
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TabPersonalizacion() {
  const { settings, setSettings, resetSettings } = useThemeSettings();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Settings are already persisted to localStorage via useThemeSettings.
      // This explicit save call is just UX feedback.
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      toast.success("Personalización guardada");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-none border-0">
      <CardContent className="pt-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">
          Apariencia del portal
        </p>
        <ThemeSettingsPanel
          settings={settings}
          onChange={setSettings}
          onReset={resetSettings}
        />
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Guardar personalización
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TabIntegraciones() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-full bg-slate-100 p-5 mb-4">
        <Plug className="h-8 w-8 text-slate-400" />
      </div>
      <h2 className="text-base font-semibold text-slate-700 mb-1">
        Integraciones / IA
      </h2>
      <p className="text-sm text-slate-400 max-w-xs">
        Las integraciones para pacientes estarán disponibles próximamente.
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PROFILE_CACHE_KEY = "clinic_patient_profile_cache";

function readProfileCache(): ProfileData | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as ProfileData) : null;
  } catch {
    return null;
  }
}

function writeProfileCache(data: ProfileData) {
  try {
    sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
  } catch { /* storage full — ignore */ }
}

export default function PacientePerfilPage() {
  const [activeTab, setActiveTab] = useState<TabId>("perfil");
  const [profileData, setProfileData] = useState<ProfileData | null>(() => readProfileCache());
  const [profileLoading, setProfileLoading] = useState(!readProfileCache());

  useEffect(() => {
    void (async () => {
      try {
        const profile = await clinicApi.getPatientProfile();
        const data = profile as ProfileData;
        setProfileData(data);
        writeProfileCache(data);
      } catch {
        if (!profileData) toast.error("Error al cargar el perfil");
      } finally {
        setProfileLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentTab = TABS.find((t) => t.id === activeTab)!;

  if (profileLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!profileData) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Left nav */}
      <nav className="hidden sm:flex w-52 flex-shrink-0 flex-col border-r border-border bg-slate-50">
        <div className="flex-1 overflow-y-auto py-2">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors text-left border-l-2",
                  isActive
                    ? "border-emerald-600 bg-emerald-600/5 text-emerald-600"
                    : "border-transparent text-slate-500 hover:bg-white hover:text-slate-800",
                ].join(" ")}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Right content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-border px-6 py-4">
          <h1 className="text-base font-semibold text-slate-800">
            {currentTab.label}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentTab.description}
          </p>
        </div>

        {/* Mobile tab strip */}
        <div className="flex sm:hidden gap-1 overflow-x-auto px-4 pt-3 pb-0 border-b border-border">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-emerald-600 text-emerald-600"
                    : "border-transparent text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-xl">
            <div className={activeTab === "perfil" ? "" : "hidden"}>
              <TabPerfil initialData={profileData} />
            </div>
            <div className={activeTab === "salud" ? "" : "hidden"}>
              <TabSalud initialData={profileData} />
            </div>
            {activeTab === "personalizacion" && <TabPersonalizacion />}
            {activeTab === "integraciones" && <TabIntegraciones />}
          </div>
        </div>
      </div>
    </div>
  );
}
