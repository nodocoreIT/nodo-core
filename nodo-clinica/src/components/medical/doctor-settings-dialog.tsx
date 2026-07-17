"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarClock,
  Save,
  Loader2,
  User,
  CreditCard,
  CalendarOff,
  Bell,
  Palette,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { clinicApi } from "@/lib/clinic/client-api";
import { currencySymbol, formatThousands, parseThousands } from "@/lib/clinic/currency";
import { PAID_SUBSCRIPTION_PLANS, formatPlanPrice } from "@/lib/clinic/subscription-plans";
import {
  dayLabel,
  DEFAULT_AVAILABILITY,
  normalizeAvailability,
  type DoctorAvailability,
} from "@/lib/clinic/schedule";
import type { DoctorPaymentSettings, DoctorReminderSettings } from "@/lib/clinic/local-db";
import { parseGoogleCalendarSrc } from "@/lib/google-calendar";
import { format, addDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { ThemeSettingsPanel } from "@/components/settings/theme-settings-panel";
import {
  DEFAULT_THEME_SETTINGS,
  mergeThemeSettings,
  type DoctorThemeSettings,
} from "@/lib/clinic/theme-settings";
import { useConsultorioTheme } from "@/hooks/use-consultorio-theme";

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0];

export type SectionId =
  | "agenda"
  | "perfil"
  | "cobros"
  | "suscripcion"
  | "avisos"
  | "libres"
  | "apariencia";

const SECTIONS: { id: SectionId; label: string; icon: React.ElementType }[] = [
  { id: "agenda", label: "Agenda", icon: CalendarClock },
  { id: "perfil", label: "Perfil", icon: User },
  { id: "cobros", label: "Cobros", icon: CreditCard },
  { id: "suscripcion", label: "Suscripción", icon: Receipt },
  { id: "avisos", label: "Recordatorios", icon: Bell },
  { id: "libres", label: "Días libres", icon: CalendarOff },
  { id: "apariencia", label: "Apariencia", icon: Palette },
];

interface DoctorSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  initialSection?: SectionId;
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

export function DoctorSettingsDialog({
  open,
  onOpenChange,
  doctorId,
  initialSection = "agenda",
}: DoctorSettingsDialogProps) {
  const [activeSection, setActiveSection] = useState<SectionId>(initialSection);

  const [availability, setAvailability] = useState<DoctorAvailability>(DEFAULT_AVAILABILITY);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [fullName, setFullName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [signatureText, setSignatureText] = useState("");
  const [signatureImageData, setSignatureImageData] = useState("");
  const [profilePhotoData, setProfilePhotoData] = useState("");
  const [bio, setBio] = useState("");
  const [payment, setPayment] = useState<DoctorPaymentSettings>({
    currency: "ARS",
    requirePaymentBeforeBooking: true,
  });
  const [reminderSettings, setReminderSettings] = useState<DoctorReminderSettings>({
    enabled: false,
    minutesBefore: 1440,
  });
  const [googleCalendarId, setGoogleCalendarId] = useState("");
  const [themeSettings, setThemeSettings] = useState<DoctorThemeSettings>(DEFAULT_THEME_SETTINGS);
  const { hydrateSettings } = useConsultorioTheme();
  const [newBlockDate, setNewBlockDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [testingReminder, setTestingReminder] = useState(false);
  const [mpOAuthConfigured, setMpOAuthConfigured] = useState<boolean | null>(null);
  const [testingMpConnection, setTestingMpConnection] = useState(false);
  const [subscription, setSubscription] = useState<{
    status: string;
    plan: string | null;
    nextPaymentAt: string | null;
  } | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [choosingPlan, setChoosingPlan] = useState(false);
  const [startingPlanId, setStartingPlanId] = useState<string | null>(null);
  const loadGen = useRef(0);

  useEffect(() => {
    void clinicApi.getMercadoPagoOAuthConfig().then((cfg) => {
      setMpOAuthConfigured(!!cfg.configured);
    });
  }, []);

  useEffect(() => {
    if (activeSection !== "suscripcion" || subscription || subscriptionLoading) return;
    setSubscriptionLoading(true);
    clinicApi
      .getSubscriptionStatus()
      .then(setSubscription)
      .catch(() => toast.error("No se pudo consultar el estado de la suscripción"))
      .finally(() => setSubscriptionLoading(false));
  }, [activeSection, subscription, subscriptionLoading]);

  type OfficeData = Record<string, unknown>;

  const applyOfficeData = useCallback(
    (data: OfficeData) => {
      if (data.availability) {
        setAvailability(normalizeAvailability(data.availability as DoctorAvailability));
        const avail = data.availability as DoctorAvailability;
        setBlockedDates(avail.blockedDates ?? (data.blockedDates as string[]) ?? []);
      }
      if (data.fullName != null) setFullName(String(data.fullName));
      if (data.licenseNumber != null) setLicenseNumber(String(data.licenseNumber));
      if (Array.isArray(data.specialties)) setSpecialties(data.specialties as string[]);
      if (data.signatureText != null) setSignatureText(String(data.signatureText));
      if (data.signatureImageData != null) setSignatureImageData(String(data.signatureImageData));
      if (data.profilePhotoData != null) setProfilePhotoData(String(data.profilePhotoData));
      if (data.bio != null) setBio(String(data.bio));
      if (data.payment) {
        setPayment({ currency: "ARS", requirePaymentBeforeBooking: true, ...(data.payment as DoctorPaymentSettings) });
      }
      if (data.reminderSettings) {
        setReminderSettings({ enabled: false, minutesBefore: 1440, ...(data.reminderSettings as DoctorReminderSettings) });
      }
      if (data.googleCalendarId != null) setGoogleCalendarId(String(data.googleCalendarId));
      if (data.themeSettings) {
        const merged = mergeThemeSettings(data.themeSettings as DoctorThemeSettings);
        setThemeSettings(merged);
        hydrateSettings(merged);
      }
    },
    [hydrateSettings],
  );

  useEffect(() => {
    if (open && initialSection) setActiveSection(initialSection);
  }, [open, initialSection]);

  useEffect(() => {
    if (!open) return;
    const gen = ++loadGen.current;
    clinicApi
      .getDoctorSchedule(doctorId)
      .then((data) => {
        if (gen !== loadGen.current) return;
        applyOfficeData(data);
      })
      .catch(() => {
        if (gen === loadGen.current) {
          toast.error("No se pudo cargar la configuración del consultorio");
        }
      });
  }, [doctorId, applyOfficeData, open]);

  const toggleDay = (dayOfWeek: number) => {
    setAvailability((prev) => {
      const exists = prev.days.some((d) => d.dayOfWeek === dayOfWeek);
      if (exists) return { ...prev, days: prev.days.filter((d) => d.dayOfWeek !== dayOfWeek) };
      return {
        ...prev,
        days: [
          ...prev.days,
          { dayOfWeek, startTime: "09:00", endTime: "13:00" },
        ].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
      };
    });
  };

  const blocksForDay = (dayOfWeek: number) =>
    availability.days.filter((d) => d.dayOfWeek === dayOfWeek);

  const updateBlockTime = (
    dayOfWeek: number,
    blockIndex: number,
    field: "startTime" | "endTime",
    value: string,
  ) => {
    setAvailability((prev) => {
      let idx = -1;
      return {
        ...prev,
        days: prev.days.map((d) => {
          if (d.dayOfWeek !== dayOfWeek) return d;
          idx += 1;
          if (idx !== blockIndex) return d;
          return { ...d, [field]: value };
        }),
      };
    });
  };

  const addBlockForDay = (dayOfWeek: number) => {
    setAvailability((prev) => ({
      ...prev,
      days: [
        ...prev.days,
        { dayOfWeek, startTime: "16:00", endTime: "19:00" },
      ].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
    }));
  };

  const removeBlockForDay = (dayOfWeek: number, blockIndex: number) => {
    setAvailability((prev) => {
      let idx = -1;
      const next = prev.days.filter((d) => {
        if (d.dayOfWeek !== dayOfWeek) return true;
        idx += 1;
        return idx !== blockIndex;
      });
      return { ...prev, days: next };
    });
  };

  const copyMondayToWeekdays = () => {
    setAvailability((prev) => {
      const monday = prev.days.filter((d) => d.dayOfWeek === 1);
      if (!monday.length) return prev;
      const rest = prev.days.filter((d) => ![2, 3, 4, 5].includes(d.dayOfWeek));
      const copied = [2, 3, 4, 5].flatMap((dayOfWeek) =>
        monday.map((b) => ({ ...b, dayOfWeek })),
      );
      return {
        ...prev,
        days: [...rest, ...copied].sort(
          (a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
        ),
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await clinicApi.saveDoctorOffice({
        fullName,
        licenseNumber,
        specialties,
        availability: { ...availability, blockedDates },
        blockedDates,
        signatureText,
        signatureImageData,
        profilePhotoData,
        bio,
        payment,
        reminderSettings,
        googleCalendarId: parseGoogleCalendarSrc(googleCalendarId) ?? googleCalendarId.trim(),
        themeSettings,
      });
      if (result.office) {
        loadGen.current += 1;
        applyOfficeData(result.office);
      }
      hydrateSettings(themeSettings);
      toast.success("Configuración guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const addBlockedDate = () => {
    if (!newBlockDate || blockedDates.includes(newBlockDate)) return;
    setBlockedDates((prev) => [...prev, newBlockDate].sort());
    setNewBlockDate("");
  };

  const handleTestReminder = async () => {
    setTestingReminder(true);
    try {
      const result = await clinicApi.sendTestReminderEmail();
      if (result.mock) {
        toast.warning(result.message, { duration: 10_000 });
      } else {
        toast.success(result.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el email");
    } finally {
      setTestingReminder(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl h-[92vh] md:h-[800px] flex flex-col sm:flex-row gap-0 p-0 overflow-hidden bg-white">
        {/* Left sidebar nav */}
        <nav
          aria-label="Secciones de configuración"
          className="hidden sm:flex sm:w-52 md:w-56 flex-shrink-0 flex-col border-r border-border bg-slate-50 overflow-y-auto"
        >
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors border-l-2 flex items-center gap-2.5 ${
                activeSection === id
                  ? "border-[var(--color-primary,#2563eb)] bg-[var(--color-primary,#2563eb)]/5 text-[var(--color-primary,#2563eb)]"
                  : "border-transparent text-slate-500 hover:bg-white hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Right content area */}
        <div className="flex flex-1 min-h-0 flex-col min-w-0 bg-white">
          {/* Fixed header */}
          <div className="bg-white px-6 py-4 flex-shrink-0 border-b border-border">
            <DialogHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mr-6">
                <DialogTitle className="text-xl">Configuración</DialogTitle>
                {activeSection === "apariencia" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setThemeSettings(DEFAULT_THEME_SETTINGS);
                      hydrateSettings(DEFAULT_THEME_SETTINGS);
                    }}
                    className="text-xs border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white"
                  >
                    Default Nodo (Restablecer)
                  </Button>
                )}
              </div>
              <DialogDescription className="text-xs sm:text-sm">
                Agenda, perfil, cobros, recordatorios, días libres y apariencia del panel.
              </DialogDescription>
            </DialogHeader>

            {/* Mobile section picker */}
            <div className="sm:hidden mt-3">
              <Select value={activeSection} onValueChange={(v) => setActiveSection(v as SectionId)}>
                <SelectTrigger className="h-9 font-semibold text-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTIONS.map(({ id, label }) => (
                    <SelectItem key={id} value={id}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Scrollable content */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6 space-y-4">

              {/* ── Agenda ── */}
              {activeSection === "agenda" && (
                <>
                  <div>
                    <Label className="text-xs">Duración de cada turno</Label>
                    <Select
                      value={String(availability.slotDurationMinutes)}
                      onValueChange={(v) =>
                        setAvailability((prev) => ({ ...prev, slotDurationMinutes: Number(v) }))
                      }
                    >
                      <SelectTrigger className="mt-1 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[15, 20, 30, 45, 60].map((m) => (
                          <SelectItem key={m} value={String(m)}>{m} minutos</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Días que atiendo</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-40"
                        disabled={blocksForDay(1).length === 0}
                        onClick={copyMondayToWeekdays}
                      >
                        Copiar Lun a Vie
                      </Button>
                    </div>
                    <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                      {ALL_DAYS.map((dow) => {
                        const active = availability.days.some((d) => d.dayOfWeek === dow);
                        const blocks = blocksForDay(dow);
                        return (
                          <div
                            key={dow}
                            className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 ${
                              active ? "bg-blue-50/30" : ""
                            }`}
                          >
                            <label className="flex items-center gap-2 w-14 shrink-0 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={active}
                                onChange={() => toggleDay(dow)}
                                className="rounded"
                              />
                              <span className="text-sm font-medium">{dayLabel(dow)}</span>
                            </label>
                            {active ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {blocks.map((block, blockIndex) => (
                                  <div key={blockIndex} className="flex items-center gap-1">
                                    <Input
                                      type="time"
                                      value={block.startTime}
                                      onChange={(e) =>
                                        updateBlockTime(dow, blockIndex, "startTime", e.target.value)
                                      }
                                      className="h-7 w-26 text-xs px-1.5"
                                    />
                                    <span className="text-xs text-slate-400">a</span>
                                    <Input
                                      type="time"
                                      value={block.endTime}
                                      onChange={(e) =>
                                        updateBlockTime(dow, blockIndex, "endTime", e.target.value)
                                      }
                                      className="h-7 w-26 text-xs px-1.5"
                                    />
                                    {blocks.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => removeBlockForDay(dow, blockIndex)}
                                        className="text-red-500 hover:text-red-700 text-xs px-1"
                                        aria-label="Quitar franja"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => addBlockForDay(dow)}
                                  className="text-xs text-blue-600 hover:text-blue-700 px-1"
                                >
                                  + franja
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">No atiende</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* ── Perfil ── */}
              {activeSection === "perfil" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Nombre y apellido</Label>
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Dr. Juan García"
                        className="mt-1 h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Matrícula</Label>
                      <Input
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        placeholder="MP 12345"
                        className="mt-1 h-9 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Especialidades</Label>
                    <div className="mt-1 flex flex-wrap gap-1.5 min-h-[36px] rounded-md border border-slate-200 px-2 py-1.5 bg-white">
                      {specialties.map((s, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 bg-brand/10 text-brand text-xs font-medium px-2 py-0.5 rounded-full"
                        >
                          {s}
                          <button
                            type="button"
                            onClick={() =>
                              setSpecialties((prev) => prev.filter((_, idx) => idx !== i))
                            }
                            className="hover:text-red-500 transition-colors"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={specialtyInput}
                        onChange={(e) => setSpecialtyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.key === "Enter" || e.key === ",") && specialtyInput.trim()) {
                            e.preventDefault();
                            const val = specialtyInput.trim();
                            if (!specialties.includes(val)) {
                              setSpecialties((prev) => [...prev, val]);
                            }
                            setSpecialtyInput("");
                          }
                          if (e.key === "Backspace" && !specialtyInput && specialties.length > 0) {
                            setSpecialties((prev) => prev.slice(0, -1));
                          }
                        }}
                        placeholder={
                          specialties.length === 0
                            ? "Ej: Cardiología, Clínica…  (Enter para agregar)"
                            : "Agregar…"
                        }
                        className="flex-1 min-w-[120px] text-xs outline-none bg-transparent text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Presioná Enter o coma para agregar cada especialidad.
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                      {profilePhotoData ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profilePhotoData} alt="Foto perfil" className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-8 w-8 text-slate-300" />
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">Foto de perfil</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        className="mt-1 h-9 text-xs cursor-pointer file:cursor-pointer file:bg-brand file:text-white file:border-0 file:rounded file:px-3 file:text-xs file:font-medium hover:border-brand/50 transition-colors"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            const photoData = await readImageFile(f);
                            setProfilePhotoData(photoData);
                            const result = await clinicApi.saveDoctorOffice({ profilePhotoData: photoData });
                            if (result.office) {
                              loadGen.current += 1;
                              applyOfficeData(result.office);
                            }
                            toast.success("Foto de perfil guardada");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Error");
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Bio / presentación</Label>
                    <Textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Especialista en... Atiendo por telemedicina..."
                      className="mt-1 text-sm min-h-[80px]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Google Calendar — URL de integración</Label>
                    <Input
                      value={googleCalendarId}
                      onChange={(e) => setGoogleCalendarId(e.target.value)}
                      placeholder="https://calendar.google.com/calendar/embed?src=..."
                      className="mt-1 h-9 text-sm font-mono text-[11px]"
                    />
                    <div className="mt-2 rounded-md bg-blue-50/80 border border-blue-100 p-3 text-[11px] text-slate-600 space-y-2">
                      <p className="font-medium text-slate-800">Cómo obtener la URL (recomendado)</p>
                      <ol className="list-decimal list-inside space-y-1.5">
                        <li>Abrí <strong>Google Calendar</strong> → ⚙️ <strong>Configuración</strong></li>
                        <li>Bajá a <strong>Integrar el calendario</strong></li>
                        <li>Activá <strong>Compartir públicamente</strong> → Ver todos los detalles</li>
                        <li>
                          Copiá la <strong>URL pública</strong> que empieza con{" "}
                          <code className="bg-white px-1 rounded text-[10px]">
                            https://calendar.google.com/calendar/embed?src=
                          </code>
                        </li>
                        <li>Pegala acá arriba y guardá el consultorio</li>
                      </ol>
                      <p className="text-[10px] text-slate-500 pt-1 border-t border-blue-100">
                        Ejemplo:{" "}
                        <span className="font-mono break-all">
                          https://calendar.google.com/calendar/embed?src=usuario%40gmail.com&amp;ctz=America%2FArgentina%2FBuenos_Aires
                        </span>
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Texto de firma en documentos</Label>
                    <Input
                      value={signatureText}
                      onChange={(e) => setSignatureText(e.target.value)}
                      placeholder="Dr. Nombre — Mat. 12345"
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Imagen de firma para documentos (opcional)</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      className="mt-1 h-9 text-xs cursor-pointer file:cursor-pointer file:bg-brand file:text-white file:border-0 file:rounded file:px-3 file:text-xs file:font-medium hover:border-brand/50 transition-colors"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          setSignatureImageData(await readImageFile(f, 200));
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Error");
                        }
                      }}
                    />
                    {signatureImageData && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={signatureImageData} alt="Firma" className="mt-2 h-12 object-contain" />
                    )}
                  </div>
                </>
              )}

              {/* ── Cobros ── */}
              {activeSection === "cobros" && (
                <>
                  <div className="rounded-lg border border-[#009ee3]/25 bg-sky-50/60 p-3 space-y-1.5">
                    <p className="text-sm font-medium text-sky-950">Cobros directos a tu cuenta</p>
                    <p className="text-[11px] text-sky-900/90 leading-relaxed">
                      Cada médico vincula <strong>su propia cuenta</strong> de Mercado Pago. El
                      paciente paga el honorario y el dinero{" "}
                      <strong>ingresa en tu cuenta</strong> — la plataforma no retiene ni
                      intermedia el cobro.
                    </p>
                  </div>

                  <label className="flex items-start gap-2 rounded-md border border-emerald-100 bg-emerald-50/50 p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={payment.requirePaymentBeforeBooking !== false}
                      onChange={(e) =>
                        setPayment((p) => ({ ...p, requirePaymentBeforeBooking: e.target.checked }))
                      }
                      className="mt-0.5"
                    />
                    <span className="text-sm text-slate-700">Exigir pago antes de reservar el turno</span>
                  </label>

                  <div className="rounded-lg border border-[#009ee3]/30 bg-sky-50/50 p-3 space-y-3">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!payment.mercadopagoEnabled}
                        onChange={(e) =>
                          setPayment((p) => ({ ...p, mercadopagoEnabled: e.target.checked }))
                        }
                        className="mt-0.5"
                      />
                      <span className="text-sm text-slate-700">
                        Cobrar con <strong>Mercado Pago</strong> (Checkout Pro)
                      </span>
                    </label>
                    {payment.mercadopagoEnabled && (
                      <div className="space-y-3 pl-1">
                        {(payment as DoctorPaymentSettings & {
                          mercadopagoConnected?: boolean;
                          mercadopagoUserId?: string;
                        }).mercadopagoConnected ? (
                          <div className="rounded-md border border-emerald-200 bg-emerald-50/80 p-3 space-y-2">
                            <p className="text-sm font-medium text-emerald-900">
                              Cuenta conectada
                              {(payment as { mercadopagoUserId?: string }).mercadopagoUserId && (
                                <span className="font-normal text-emerald-700">
                                  {" "}· MP user{" "}
                                  {(payment as { mercadopagoUserId?: string }).mercadopagoUserId}
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-emerald-800">
                              Los pacientes pueden pagarte con Mercado Pago. Los cobros van a tu
                              cuenta vinculada.
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              disabled={testingMpConnection}
                              onClick={async () => {
                                setTestingMpConnection(true);
                                try {
                                  const result = await clinicApi.testMercadoPagoConnection();
                                  toast.success(result.message ?? "Conexión con Mercado Pago OK");
                                } catch (e) {
                                  toast.error(
                                    e instanceof Error ? e.message : "Token de Mercado Pago inválido",
                                    { duration: 12_000 },
                                  );
                                } finally {
                                  setTestingMpConnection(false);
                                }
                              }}
                            >
                              {testingMpConnection ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                "Probar conexión"
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs border-red-200 text-red-700"
                              onClick={async () => {
                                try {
                                  await clinicApi.disconnectMercadoPago();
                                  toast.success("Mercado Pago desconectado");
                                  const data = await clinicApi.getDoctorSchedule(doctorId);
                                  applyOfficeData(data);
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : "Error al desconectar");
                                }
                              }}
                            >
                              Desconectar
                            </Button>
                          </div>
                        ) : (
                          <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2">
                            {mpOAuthConfigured === false ? (
                              <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2 leading-relaxed">
                                El botón OAuth requiere que la <strong>plataforma</strong> tenga
                                configurada la app en{" "}
                                <code className="text-[10px]">nodo-clinica/.env.local</code>{" "}
                                (<code className="text-[10px]">MERCADOPAGO_CLIENT_ID</code> y{" "}
                                <code className="text-[10px]">MERCADOPAGO_CLIENT_SECRET</code>).
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-600">
                                Te llevamos a Mercado Pago para iniciar sesión con tu cuenta
                                vendedor y autorizar los cobros. No pegás contraseñas acá.
                              </p>
                            )}
                            <div className="flex justify-center">
                              <Button
                                type="button"
                                size="sm"
                                className="h-9 px-5 text-sm bg-[#009ee3] hover:bg-[#008ecf] text-white"
                                disabled={mpOAuthConfigured !== true}
                                onClick={() => {
                                  window.location.href =
                                    "/api/clinic/mercadopago/oauth/connect";
                                }}
                              >
                                <CreditCard className="h-4 w-4 mr-2" />
                                Vincular mi cuenta de Mercado Pago
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Transferencia manual: alias/CBU abajo. MP tiene prioridad si está activo y hay
                    honorario cargado.
                  </p>
                  <div className="grid grid-cols-[6.5rem_1fr] gap-3">
                    <div>
                      <Label className="text-xs">Moneda</Label>
                      <Select
                        value={payment.currency ?? "ARS"}
                        onValueChange={(v) => setPayment((p) => ({ ...p, currency: v }))}
                      >
                        <SelectTrigger className="mt-1 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ARS">$AR</SelectItem>
                          <SelectItem value="USD">U$S</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Honorario consulta</Label>
                      <div className="relative mt-1">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                          {currencySymbol(payment.currency)}
                        </span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={formatThousands(payment.consultationFee)}
                          onChange={(e) =>
                            setPayment((p) => ({
                              ...p,
                              consultationFee: parseThousands(e.target.value),
                            }))
                          }
                          className={`h-9 ${payment.currency === "USD" ? "pl-12" : "pl-8"}`}
                          placeholder="15.000"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Alias / CBU transferencia</Label>
                    <Input
                      value={payment.alias ?? ""}
                      onChange={(e) => setPayment((p) => ({ ...p, alias: e.target.value }))}
                      placeholder="mi.alias.mp"
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">CBU (opcional)</Label>
                    <Input
                      value={payment.cbu ?? ""}
                      onChange={(e) => setPayment((p) => ({ ...p, cbu: e.target.value }))}
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Titular de la cuenta (como figura en el banco)</Label>
                    <Input
                      value={payment.beneficiaryName ?? ""}
                      onChange={(e) =>
                        setPayment((p) => ({ ...p, beneficiaryName: e.target.value }))
                      }
                      placeholder="Ej: Mendia Juan Esteban"
                      className="mt-1 h-9"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      La IA compara este nombre con el destinatario del comprobante.
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs">Instrucciones de pago</Label>
                    <Textarea
                      value={payment.paymentInstructions ?? ""}
                      onChange={(e) =>
                        setPayment((p) => ({ ...p, paymentInstructions: e.target.value }))
                      }
                      placeholder="Transferir antes o después de la consulta..."
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      <CreditCard className="h-3.5 w-3.5" />
                      QR de cobro (Mercado Pago, etc.)
                    </Label>
                    <Input
                      type="file"
                      accept="image/*"
                      className="mt-1 h-9 text-xs cursor-pointer file:cursor-pointer file:bg-brand file:text-white file:border-0 file:rounded file:px-3 file:text-xs file:font-medium hover:border-brand/50 transition-colors"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          const data = await readImageFile(f, 500);
                          setPayment((p) => ({ ...p, qrImageData: data }));
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Error");
                        }
                      }}
                    />
                    {payment.qrImageData && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={payment.qrImageData}
                        alt="QR pago"
                        className="mt-2 max-h-40 mx-auto border rounded-lg"
                      />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2">
                    Para revisar comprobantes, validaciones y aprobar pagos, usá el menú{" "}
                    <Link href="/medico/cobros" className="font-semibold text-brand hover:underline">
                      Cobros
                    </Link>
                    .
                  </p>
                  <p className="text-[10px] text-slate-400 text-center">
                    El paciente verá honorarios y datos de pago al pedir turno.
                  </p>
                </>
              )}

              {/* ── Suscripción a Nodo ── */}
              {activeSection === "suscripcion" && (
                <>
                  <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3 space-y-1.5">
                    <p className="text-sm font-medium text-violet-950">
                      Suscripción mensual a Nodo Clínica
                    </p>
                    <p className="text-[11px] text-violet-900/90 leading-relaxed">
                      Esto es distinto de "Cobros": acá es Nodo cobrándote a vos por usar la
                      plataforma, no vos cobrando a tus pacientes.
                    </p>
                  </div>

                  {subscriptionLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                    </div>
                  ) : subscription?.status === "active" ? (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50/80 p-3 space-y-1">
                      <p className="text-sm font-medium text-emerald-900">Suscripción activa</p>
                      {subscription.nextPaymentAt && (
                        <p className="text-[11px] text-emerald-800">
                          Próximo cobro:{" "}
                          {format(new Date(subscription.nextPaymentAt), "dd MMM yyyy", {
                            locale: es,
                          })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 space-y-3">
                      <p className="text-sm text-amber-900">
                        {subscription?.status === "expired"
                          ? "Tu suscripción no está activa."
                          : "Todavía no tenés una suscripción paga a Nodocore."}
                      </p>
                      {!choosingPlan ? (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 text-xs bg-violet-700 hover:bg-violet-800"
                          onClick={() => setChoosingPlan(true)}
                        >
                          Suscribirme
                        </Button>
                      ) : (
                        <div className="grid sm:grid-cols-2 gap-3">
                          {PAID_SUBSCRIPTION_PLANS.map((p) => (
                            <div
                              key={p.id}
                              className="rounded-lg border border-violet-200 bg-white p-3 space-y-2"
                            >
                              <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                              <p className="text-base font-bold text-violet-700">
                                {formatPlanPrice(p)}{" "}
                                <span className="text-xs font-normal text-slate-400">
                                  {p.period}
                                </span>
                              </p>
                              <ul className="space-y-1">
                                {p.features.map((f) => (
                                  <li
                                    key={f}
                                    className="text-xs text-slate-500 flex items-center gap-1"
                                  >
                                    <span className="text-violet-500">✓</span> {f}
                                  </li>
                                ))}
                              </ul>
                              <Button
                                type="button"
                                size="sm"
                                className="w-full h-8 text-xs bg-violet-700 hover:bg-violet-800"
                                disabled={startingPlanId !== null}
                                onClick={async () => {
                                  setStartingPlanId(p.id);
                                  try {
                                    const result = await clinicApi.startSubscriptionCheckout(p.id);
                                    window.location.href = result.initPoint;
                                  } catch (e) {
                                    toast.error(
                                      e instanceof Error
                                        ? e.message
                                        : "No se pudo iniciar la suscripción",
                                    );
                                  } finally {
                                    setStartingPlanId(null);
                                  }
                                }}
                              >
                                {startingPlanId === p.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  "Elegir este plan"
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── Recordatorios ── */}
              {activeSection === "avisos" && (
                <>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <Bell className="h-4 w-4 text-blue-600" />
                    Recordatorio por email al paciente
                  </div>
                  <label className="flex items-start gap-2 rounded-md border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={!!reminderSettings.enabled}
                      onChange={(e) =>
                        setReminderSettings((r) => ({ ...r, enabled: e.target.checked }))
                      }
                      className="mt-0.5"
                    />
                    <span className="text-sm text-slate-700">
                      Enviar recordatorio automático antes del turno
                    </span>
                  </label>
                  <div>
                    <Label className="text-xs">Anticipación del aviso</Label>
                    <Select
                      value={String(reminderSettings.minutesBefore ?? 1440)}
                      onValueChange={(v) =>
                        setReminderSettings((r) => ({ ...r, minutesBefore: Number(v) }))
                      }
                      disabled={!reminderSettings.enabled}
                    >
                      <SelectTrigger className="mt-1 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="60">1 hora antes</SelectItem>
                        <SelectItem value="120">2 horas antes</SelectItem>
                        <SelectItem value="720">12 horas antes</SelectItem>
                        <SelectItem value="1440">1 día antes</SelectItem>
                        <SelectItem value="2880">2 días antes</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Al reservar un turno, el paciente recibe un email de confirmación con fecha,
                      hora y enlace a la sala. Si activás el recordatorio, también se avisa antes
                      del turno. Requiere{" "}
                      <code className="text-[10px] bg-slate-100 px-1 rounded">RESEND_API_KEY</code>{" "}
                      en Vercel.
                    </p>
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md p-2 mt-2">
                      En plan Vercel Hobby el aviso automático se revisa 1 vez al día (~9:00 UTC).
                      Para avisos de 1–2 horas antes, usá <strong>1 día antes</strong> o el botón
                      de reenvío manual del paciente.
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-4 text-xs"
                      disabled={testingReminder}
                      onClick={handleTestReminder}
                    >
                      {testingReminder ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Bell className="h-3.5 w-3.5 mr-1" />
                      )}
                      Enviar email de prueba a mi correo
                    </Button>
                  </div>
                </>
              )}

              {/* ── Días libres ── */}
              {activeSection === "libres" && (
                <>
                  <p className="text-xs text-slate-500">
                    Marcá feriados, vacaciones o días que no atendés. El paciente no verá esos
                    días al pedir turno.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={newBlockDate}
                      min={format(startOfDay(new Date()), "yyyy-MM-dd")}
                      onChange={(e) => setNewBlockDate(e.target.value)}
                      className="h-9"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addBlockedDate}>
                      Agregar
                    </Button>
                  </div>
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {blockedDates.length === 0 ? (
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <CalendarOff className="h-3.5 w-3.5" />
                        Sin días bloqueados
                      </p>
                    ) : (
                      blockedDates.map((d) => (
                        <div
                          key={d}
                          className="flex items-center justify-between text-sm bg-slate-50 rounded px-2 py-1.5"
                        >
                          <span>
                            {format(new Date(d + "T12:00:00"), "EEEE dd/MM/yyyy", { locale: es })}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-red-600"
                            onClick={() =>
                              setBlockedDates((prev) => prev.filter((x) => x !== d))
                            }
                          >
                            Quitar
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[1, 2, 3, 7].map((n) => (
                      <Button
                        key={n}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          const d = format(addDays(startOfDay(new Date()), n), "yyyy-MM-dd");
                          if (!blockedDates.includes(d)) {
                            setBlockedDates((prev) => [...prev, d].sort());
                          }
                        }}
                      >
                        +{n}d
                      </Button>
                    ))}
                  </div>
                </>
              )}

              {/* ── Apariencia ── */}
              {activeSection === "apariencia" && (
                <>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5" />
                    Personalizá colores, tipografía y marca de tu panel médico.
                  </p>
                  <ThemeSettingsPanel
                    settings={themeSettings}
                    onChange={(patch) => {
                      const next = mergeThemeSettings({ ...themeSettings, ...patch });
                      setThemeSettings(next);
                      hydrateSettings(next);
                    }}
                    onReset={() => {
                      setThemeSettings(DEFAULT_THEME_SETTINGS);
                      hydrateSettings(DEFAULT_THEME_SETTINGS);
                    }}
                    compact
                  />
                </>
              )}

            </div>
          </ScrollArea>

          {/* Fixed save footer */}
          <div className="flex-shrink-0 border-t border-border px-6 py-4 bg-white flex items-center justify-between gap-3">
            <p className="text-[10px] text-slate-400 hidden sm:block">
              Un solo guardado para agenda, perfil, cobros, recordatorios y apariencia.
            </p>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="ml-auto gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar cambios
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
