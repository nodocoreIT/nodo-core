"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SettingsDesktopNav,
  SettingsMobileNav,
  type SettingsSectionNavItem,
} from "@nodocore/shared-components";
import { clinicApi } from "@/lib/clinic/client-api";
import {
  PatientIntegracionesSection,
  PatientPerfilSection,
  PatientPersonalizacionSection,
  PatientSaludSection,
  PatientSuscripcionSection,
  type PatientProfileData,
} from "@/components/patient/patient-settings-sections";
import {
  PATIENT_THEME_SETTINGS,
  mergeThemeSettings,
} from "@/lib/clinic/theme-settings";
import { useThemeSettings } from "@/hooks/use-theme-settings";
import { HeartPulse, Loader2, Palette, Plug, Receipt, User } from "lucide-react";
import { toast } from "sonner";

export type PatientSettingsSectionId =
  | "perfil"
  | "salud"
  | "personalizacion"
  | "integraciones"
  | "suscripcion";

const SECTIONS: {
  id: PatientSettingsSectionId;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "perfil", label: "Mi perfil", icon: User },
  { id: "salud", label: "Mi salud", icon: HeartPulse },
  { id: "personalizacion", label: "Personalización", icon: Palette },
  { id: "integraciones", label: "Integraciones", icon: Plug },
  { id: "suscripcion", label: "Suscripción", icon: Receipt },
];

const PATIENT_SETTINGS_NAV: SettingsSectionNavItem<PatientSettingsSectionId>[] =
  SECTIONS.map(({ id, label, icon }) => ({
    id,
    label,
    icon,
    mobileLabel:
      id === "personalizacion"
        ? "Tema"
        : id === "integraciones"
          ? "IA"
          : id === "suscripcion"
            ? "Plan"
            : label,
  }));

const PROFILE_CACHE_KEY = "clinic_patient_profile_cache";

function readProfileCache(): PatientProfileData | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as PatientProfileData) : null;
  } catch {
    return null;
  }
}

function writeProfileCache(data: PatientProfileData) {
  try {
    sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

interface PatientSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: PatientSettingsSectionId;
}

export function PatientSettingsDialog({
  open,
  onOpenChange,
  initialSection = "perfil",
}: PatientSettingsDialogProps) {
  const [activeSection, setActiveSection] =
    useState<PatientSettingsSectionId>(initialSection);
  const [profileData, setProfileData] = useState<PatientProfileData | null>(() =>
    readProfileCache(),
  );
  const [profileLoading, setProfileLoading] = useState(false);
  const loadGen = useRef(0);
  const { setSettings, hydrateSettings } = useThemeSettings();

  useEffect(() => {
    if (open && initialSection) setActiveSection(initialSection);
  }, [open, initialSection]);

  useEffect(() => {
    if (!open) return;
    const gen = ++loadGen.current;
    setProfileLoading(!profileData);
    void clinicApi
      .getPatientProfile()
      .then((profile) => {
        if (gen !== loadGen.current) return;
        const data = profile as PatientProfileData;
        setProfileData(data);
        writeProfileCache(data);
      })
      .catch(() => {
        if (gen === loadGen.current && !profileData) {
          toast.error("No se pudo cargar tu perfil");
        }
      })
      .finally(() => {
        if (gen === loadGen.current) setProfileLoading(false);
      });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const sectionDescription =
    activeSection === "perfil"
      ? "Actualizá tus datos personales y contraseña."
      : activeSection === "salud"
        ? "Cobertura médica y datos de salud."
        : activeSection === "personalizacion"
          ? "Ajustá los colores y tipografía del portal."
          : activeSection === "integraciones"
            ? "Conectores e integraciones con IA."
            : "Información de tu plan de paciente en Nodo Clínica.";

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl h-[92vh] md:h-[90vh] flex flex-col sm:flex-row gap-0 p-0 overflow-hidden bg-white">
        <SettingsDesktopNav
          items={PATIENT_SETTINGS_NAV}
          activeId={activeSection}
          onSelect={setActiveSection}
        />

        <div className="flex flex-1 min-h-0 flex-col min-w-0 bg-white">
          <div className="bg-white px-4 sm:px-6 py-4 flex-shrink-0 border-b border-border">
            <DialogHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mr-6">
                <DialogTitle className="text-xl">Configuración</DialogTitle>
                {activeSection === "personalizacion" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const next = mergeThemeSettings(PATIENT_THEME_SETTINGS);
                      setSettings(next);
                      hydrateSettings(next);
                    }}
                    className="text-xs border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white"
                  >
                    Restablecer tema paciente
                  </Button>
                )}
              </div>
              <DialogDescription className="text-xs sm:text-sm">
                {sectionDescription}
              </DialogDescription>
            </DialogHeader>

            <SettingsMobileNav
              items={PATIENT_SETTINGS_NAV}
              activeId={activeSection}
              onSelect={setActiveSection}
              className="mt-4"
            />
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6 space-y-4 max-w-xl">
              {profileLoading &&
              (activeSection === "perfil" ||
                activeSection === "salud" ||
                activeSection === "suscripcion") ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                </div>
              ) : (
                <>
                  {activeSection === "perfil" && profileData ? (
                    <PatientPerfilSection initialData={profileData} />
                  ) : null}

                  {activeSection === "salud" && profileData ? (
                    <PatientSaludSection initialData={profileData} />
                  ) : null}

                  {activeSection === "personalizacion" ? (
                    <PatientPersonalizacionSection />
                  ) : null}

                  {activeSection === "integraciones" ? (
                    <PatientIntegracionesSection />
                  ) : null}

                  {activeSection === "suscripcion" && profileData ? (
                    <PatientSuscripcionSection
                      subscriptionPlan={profileData.subscriptionPlan}
                    />
                  ) : null}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
