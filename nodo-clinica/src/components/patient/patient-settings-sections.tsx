"use client";

import { useRef, useState, useEffect } from "react";
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
import { usePatientThemeSettings } from "@/hooks/use-theme-settings";
import {
  getPatientPlanById,
  PATIENT_SUBSCRIPTION_PLANS,
  patientPlanRequiresCheckout,
  resolvePatientPlanId,
} from "@/lib/clinic/patient-subscription-plans";
import { cn } from "@/lib/utils";
import { Camera, Eye, EyeOff, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

export interface PatientProfileData {
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
  subscriptionPlan: string | null;
}

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

function invalidateProfileCache() {
  try {
    sessionStorage.removeItem("clinic_patient_profile_cache");
  } catch {
    /* ignore */
  }
}

export function PatientPerfilSection({ initialData, onDirtyChange }: { initialData: PatientProfileData; onDirtyChange?: (dirty: boolean) => void }) {
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState(initialData.firstName ?? "");
  const [lastName, setLastName] = useState(initialData.lastName ?? "");
  const [email] = useState(initialData.email ?? "");
  const [phone, setPhone] = useState(initialData.phone ?? "");
  const [dni, setDni] = useState(initialData.dni ?? "");
  const [address, setAddress] = useState(initialData.address ?? "");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(
    initialData.profilePhotoUrl ?? null,
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSectionOpen, setPasswordSectionOpen] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!onDirtyChange) return;
    const isDirty =
      firstName !== (initialData.firstName ?? "") ||
      lastName !== (initialData.lastName ?? "") ||
      phone !== (initialData.phone ?? "") ||
      dni !== (initialData.dni ?? "") ||
      address !== (initialData.address ?? "") ||
      password !== "" ||
      confirmPassword !== "";
    onDirtyChange(isDirty);
  }, [firstName, lastName, phone, dni, address, password, confirmPassword, initialData, onDirtyChange]);

  const handlePhoto = async (file: File) => {
    try {
      const profilePhotoData = await readImageFile(file);
      await clinicApi.updatePatientProfile({ profilePhotoData });
      setProfilePhotoUrl(profilePhotoData);
      invalidateProfileCache();
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
        setPasswordSectionOpen(false);
      }

      invalidateProfileCache();
      onDirtyChange?.(false);
      toast.success("Cambios guardados");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          Información personal
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
          <p className="text-xs text-slate-400">Hacé clic en la foto para cambiarla</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="patient-firstName">Nombre</Label>
          <Input
            id="patient-firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Tu nombre"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="patient-lastName">Apellido</Label>
          <Input
            id="patient-lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Tu apellido"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="patient-profile-email">Email</Label>
        <Input
          id="patient-profile-email"
          value={email}
          readOnly
          disabled
          autoComplete="username"
          className="bg-muted text-muted-foreground cursor-not-allowed"
        />
        <p className="text-xs text-slate-400">El email no se puede modificar desde aquí.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="patient-phone">Teléfono</Label>
          <Input
            id="patient-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+54 9 11 xxxx-xxxx"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="patient-dni">DNI</Label>
          <Input
            id="patient-dni"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            placeholder="Número de documento"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="patient-address">Domicilio</Label>
        <Input
          id="patient-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Calle, número, ciudad"
        />
      </div>

      <div className="border-t border-border pt-5">
        {!passwordSectionOpen && password === "" && confirmPassword === "" ? (
          <button
            type="button"
            onClick={() => setPasswordSectionOpen(true)}
            className="text-sm font-medium text-[var(--color-primary)] hover:opacity-80 hover:underline"
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
                  type={showNewPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                  autoComplete="new-password"
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
                  aria-label={
                    showConfirmPassword ? "Ocultar confirmación" : "Mostrar confirmación"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      <div className="flex justify-end pt-1">
        <Button
          onClick={() => void handleSave()}
          disabled={saving}
          className="bg-[var(--color-primary)] hover:opacity-90 text-white"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}

export function PatientSaludSection({ initialData, onDirtyChange }: { initialData: PatientProfileData; onDirtyChange?: (dirty: boolean) => void }) {
  const [saving, setSaving] = useState(false);
  const [bloodType, setBloodType] = useState(initialData.bloodType ?? "");
  const [obraSocial, setObraSocial] = useState(initialData.obraSocial ?? "");
  const [insuranceNumber, setInsuranceNumber] = useState(initialData.insuranceNumber ?? "");
  const [heightCm, setHeightCm] = useState(
    initialData.heightCm != null ? String(initialData.heightCm) : "",
  );
  const [weightKg, setWeightKg] = useState(
    initialData.weightKg != null ? String(initialData.weightKg) : "",
  );
  const [allergies, setAllergies] = useState(initialData.allergies ?? "");
  const [chronicConditions, setChronicConditions] = useState(
    initialData.chronicConditions ?? "",
  );
  const [medications, setMedications] = useState(initialData.medications ?? "");
  const [emergencyContactName, setEmergencyContactName] = useState(
    initialData.emergencyContactName ?? "",
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    initialData.emergencyContactPhone ?? "",
  );

  useEffect(() => {
    if (!onDirtyChange) return;
    const isDirty =
      bloodType !== (initialData.bloodType ?? "") ||
      obraSocial !== (initialData.obraSocial ?? "") ||
      insuranceNumber !== (initialData.insuranceNumber ?? "") ||
      heightCm !== (initialData.heightCm != null ? String(initialData.heightCm) : "") ||
      weightKg !== (initialData.weightKg != null ? String(initialData.weightKg) : "") ||
      allergies !== (initialData.allergies ?? "") ||
      chronicConditions !== (initialData.chronicConditions ?? "") ||
      medications !== (initialData.medications ?? "") ||
      emergencyContactName !== (initialData.emergencyContactName ?? "") ||
      emergencyContactPhone !== (initialData.emergencyContactPhone ?? "");
    onDirtyChange(isDirty);
  }, [bloodType, obraSocial, insuranceNumber, heightCm, weightKg, allergies, chronicConditions, medications, emergencyContactName, emergencyContactPhone, initialData, onDirtyChange]);

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
      invalidateProfileCache();
      onDirtyChange?.(false);
      toast.success("Datos de salud actualizados");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Datos biométricos
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="patient-bloodType">Tipo de sangre</Label>
        <Select value={bloodType} onValueChange={setBloodType}>
          <SelectTrigger id="patient-bloodType">
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
          <Label htmlFor="patient-heightCm">Estatura (cm)</Label>
          <Input
            id="patient-heightCm"
            type="number"
            min={50}
            max={250}
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            placeholder="ej. 170"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="patient-weightKg">Peso (kg)</Label>
          <Input
            id="patient-weightKg"
            type="number"
            min={2}
            max={300}
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            placeholder="ej. 70"
          />
        </div>
      </div>

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
            <Label htmlFor="patient-insuranceNumber">N° de credencial</Label>
            <Input
              id="patient-insuranceNumber"
              value={insuranceNumber}
              onChange={(e) => setInsuranceNumber(e.target.value)}
              placeholder="Nº de afiliado / credencial"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">
          Antecedentes clínicos
        </p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="patient-allergies">Alergias</Label>
            <textarea
              id="patient-allergies"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="Medicamentos, alimentos..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="patient-chronicConditions">
              Enfermedades crónicas / antecedentes
            </Label>
            <textarea
              id="patient-chronicConditions"
              value={chronicConditions}
              onChange={(e) => setChronicConditions(e.target.value)}
              placeholder="Diabetes, hipertensión..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="patient-medications">Medicación habitual</Label>
            <textarea
              id="patient-medications"
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
              placeholder="Nombre, dosis y frecuencia..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">
          Contacto de emergencia
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="patient-emergencyContactName">Nombre y apellido</Label>
            <Input
              id="patient-emergencyContactName"
              value={emergencyContactName}
              onChange={(e) => setEmergencyContactName(e.target.value)}
              placeholder="Juan Pérez"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="patient-emergencyContactPhone">Teléfono</Label>
            <Input
              id="patient-emergencyContactPhone"
              type="tel"
              value={emergencyContactPhone}
              onChange={(e) => setEmergencyContactPhone(e.target.value)}
              placeholder="+54 9 11 xxxx-xxxx"
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <Button
          onClick={() => void handleSave()}
          disabled={saving}
          className="bg-[var(--color-primary)] hover:opacity-90 text-white"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Guardar datos de salud
        </Button>
      </div>
    </div>
  );
}

export function PatientPersonalizacionSection() {
  const { settings, setSettings, resetSettings } = usePatientThemeSettings();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      toast.success("Personalización guardada");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Apariencia del portal
      </p>
      <ThemeSettingsPanel settings={settings} onChange={setSettings} onReset={resetSettings} />
      <div className="flex justify-end pt-1">
        <Button
          onClick={() => void handleSave()}
          disabled={saving}
          className="bg-[var(--color-primary)] hover:opacity-90 text-white"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Guardar personalización
        </Button>
      </div>
    </div>
  );
}

export function PatientIntegracionesSection() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-slate-100 p-5 mb-4">
        <Plug className="h-8 w-8 text-slate-400" />
      </div>
      <h2 className="text-base font-semibold text-slate-700 mb-1">Integraciones / IA</h2>
      <p className="text-sm text-slate-400 max-w-xs">
        Las integraciones para pacientes estarán disponibles próximamente.
      </p>
    </div>
  );
}

export function PatientSuscripcionSection({
  subscriptionPlan,
}: {
  subscriptionPlan: string | null;
}) {
  const currentId = resolvePatientPlanId(subscriptionPlan);
  const current = getPatientPlanById(subscriptionPlan);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(currentId);
  const [checkingOut, setCheckingOut] = useState(false);
  const [pricing, setPricing] = useState<{ amount: number; currency: string } | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(true);

  useEffect(() => {
    clinicApi
      .getPatientSubscriptionPricing()
      .then((res) => setPricing(res.pricing ?? null))
      .catch((e) => console.error("Failed to load pricing:", e))
      .finally(() => setLoadingPricing(false));
  }, []);

  const canCheckout = patientPlanRequiresCheckout(subscriptionPlan, selectedPlanId);

  const handleCheckout = async () => {
    if (!canCheckout) return;
    setCheckingOut(true);
    try {
      const result = await clinicApi.startPatientSubscriptionCheckout(selectedPlanId);
      window.location.href = result.initPoint;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo iniciar el pago");
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3 space-y-1.5">
        <p className="text-sm font-medium text-violet-950">Tu plan de paciente</p>
        <p className="text-[11px] text-violet-900/90 leading-relaxed">
          Elegí un plan y completá el pago en Mercado Pago para activarlo en tu cuenta.
        </p>
      </div>

      <div className="rounded-md border border-emerald-200 bg-emerald-50/80 p-3 space-y-1">
        <p className="text-sm font-medium text-emerald-900">Plan actual: {current.name}</p>
        <p className="text-base font-bold text-emerald-800">
          {current.price}{" "}
          <span className="text-xs font-normal text-emerald-700/80">{current.period}</span>
        </p>
        <ul className="mt-2 space-y-1">
          {current.features.map((feature) => (
            <li key={feature} className="text-xs text-emerald-900/90 flex items-center gap-1.5">
              <span className="text-emerald-600">✓</span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {PATIENT_SUBSCRIPTION_PLANS.map((plan) => {
          const isCurrent = plan.id === currentId;
          const isSelected = plan.id === selectedPlanId;

          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlanId(plan.id)}
              className={cn(
                "rounded-lg border p-3 space-y-2 text-left transition-colors",
                isSelected
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)]/20"
                  : "border-slate-200 bg-white hover:border-[var(--color-primary)]/60",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{plan.name}</p>
                {isCurrent ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Actual
                  </span>
                ) : null}
              </div>
              <p className="text-base font-bold text-slate-800">
                {plan.id === "pago" && pricing
                  ? `${pricing.currency === "USD" ? "US$ " : "$ "}${pricing.currency === "USD" ? pricing.amount : pricing.amount.toLocaleString("es-AR")}`
                  : plan.price}{" "}
                <span className="text-xs font-normal text-slate-400">/mes</span>
              </p>
              <ul className="space-y-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="text-xs text-slate-500 flex items-center gap-1">
                    <span className="text-emerald-500">✓</span> {feature}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {canCheckout ? (
        <div className="flex justify-end">
          <Button
            type="button"
            disabled={checkingOut}
            onClick={() => void handleCheckout()}
            className="bg-[var(--color-primary)] hover:opacity-90 text-white gap-2"
          >
            {checkingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Cambiar a este plan
          </Button>
        </div>
      ) : selectedPlanId === "gratuito" && currentId === "pago" ? (
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Para volver al plan gratuito contactá al equipo de Nodo Clínica.
        </p>
      ) : null}
    </div>
  );
}
