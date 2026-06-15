"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { toast } from "sonner";
import { clinicApi } from "@/lib/clinic/client-api";
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

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0];

interface DoctorOfficePanelProps {
  doctorId: string;
  fullPage?: boolean;
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

export function DoctorOfficePanel({ doctorId, fullPage = false }: DoctorOfficePanelProps) {
  const [availability, setAvailability] =
    useState<DoctorAvailability>(DEFAULT_AVAILABILITY);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
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
  const [newBlockDate, setNewBlockDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [testingReminder, setTestingReminder] = useState(false);

  useEffect(() => {
    clinicApi.getDoctorSchedule(doctorId).then((data) => {
      if (data.availability) {
        setAvailability(normalizeAvailability(data.availability));
        setBlockedDates(data.availability.blockedDates ?? data.blockedDates ?? []);
      }
      if (data.signatureText) setSignatureText(data.signatureText);
      if (data.signatureImageData) setSignatureImageData(data.signatureImageData);
      if (data.profilePhotoData) setProfilePhotoData(data.profilePhotoData);
      if (data.bio) setBio(data.bio);
      if (data.payment) setPayment({ currency: "ARS", requirePaymentBeforeBooking: true, ...data.payment });
      if (data.reminderSettings) {
        setReminderSettings({
          enabled: false,
          minutesBefore: 1440,
          ...data.reminderSettings,
        });
      }
      if (data.googleCalendarId) setGoogleCalendarId(data.googleCalendarId);
    });
  }, [doctorId]);

  const toggleDay = (dayOfWeek: number) => {
    setAvailability((prev) => {
      const exists = prev.days.some((d) => d.dayOfWeek === dayOfWeek);
      if (exists) {
        return {
          ...prev,
          days: prev.days.filter((d) => d.dayOfWeek !== dayOfWeek),
        };
      }
      return {
        ...prev,
        days: [
          ...prev.days,
          { dayOfWeek, startTime: "09:00", endTime: "13:00" },
        ].sort((a, b) => a.dayOfWeek - b.dayOfWeek),
      };
    });
  };

  const updateDayTime = (
    dayOfWeek: number,
    field: "startTime" | "endTime",
    value: string
  ) => {
    setAvailability((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d
      ),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await clinicApi.saveDoctorOffice({
        availability: { ...availability, blockedDates },
        blockedDates,
        signatureText,
        signatureImageData,
        profilePhotoData,
        bio,
        payment,
        reminderSettings,
        googleCalendarId:
          parseGoogleCalendarSrc(googleCalendarId) ?? googleCalendarId.trim(),
      });
      toast.success("Consultorio guardado");
    } catch {
      toast.error("Error al guardar");
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
      toast.success(result.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el email");
    } finally {
      setTestingReminder(false);
    }
  };

  return (
    <Card className={fullPage ? "border-slate-200 shadow-sm" : "border-slate-200"}>
      <CardHeader className="py-3 px-4 bg-slate-50 border-b">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-blue-600" />
          {fullPage ? "Configuración del consultorio" : "Mi Consultorio"}
        </CardTitle>
        {fullPage && (
          <p className="text-xs text-slate-500 mt-1">
            Los cambios se aplican a tu agenda, perfil público y calendario embebido
            en el panel principal.
          </p>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="agenda" className="w-full">
          <TabsList className="grid w-full grid-cols-5 rounded-none border-b bg-slate-50 h-auto p-1">
            <TabsTrigger value="agenda" className="text-xs">Agenda</TabsTrigger>
            <TabsTrigger value="perfil" className="text-xs">Perfil</TabsTrigger>
            <TabsTrigger value="cobros" className="text-xs">Cobros</TabsTrigger>
            <TabsTrigger value="avisos" className="text-xs">Recordatorios</TabsTrigger>
            <TabsTrigger value="libres" className="text-xs">Días libres</TabsTrigger>
          </TabsList>

          <TabsContent value="agenda" className="p-4 space-y-4 mt-0">
            <div>
              <Label className="text-xs">Duración de cada turno</Label>
              <Select
                value={String(availability.slotDurationMinutes)}
                onValueChange={(v) =>
                  setAvailability((prev) => ({
                    ...prev,
                    slotDurationMinutes: Number(v),
                  }))
                }
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[15, 20, 30, 45, 60].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} minutos
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <Label className="text-xs">Días que atiendo</Label>
              {ALL_DAYS.map((dow) => {
                const active = availability.days.some((d) => d.dayOfWeek === dow);
                const day = availability.days.find((d) => d.dayOfWeek === dow);
                return (
                  <div
                    key={dow}
                    className={`rounded-lg border p-2.5 ${
                      active ? "border-blue-200 bg-blue-50/30" : "border-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleDay(dow)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium">{dayLabel(dow)}</span>
                    </div>
                    {active && day && (
                      <div className="grid grid-cols-2 gap-2 pl-6">
                        <Input
                          type="time"
                          value={day.startTime}
                          onChange={(e) =>
                            updateDayTime(dow, "startTime", e.target.value)
                          }
                          className="h-8 text-sm"
                        />
                        <Input
                          type="time"
                          value={day.endTime}
                          onChange={(e) =>
                            updateDayTime(dow, "endTime", e.target.value)
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="perfil" className="p-4 space-y-4 mt-0">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                {profilePhotoData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profilePhotoData}
                    alt="Foto perfil"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 text-slate-300" />
                )}
              </div>
              <div>
                <Label className="text-xs">Foto de perfil</Label>
                <Input
                  type="file"
                  accept="image/*"
                  className="mt-1 h-9 text-xs"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      setProfilePhotoData(await readImageFile(f));
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
                <p className="font-medium text-slate-800">
                  Cómo obtener la URL (recomendado)
                </p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>
                    Abrí{" "}
                    <strong>Google Calendar</strong> → ⚙️{" "}
                    <strong>Configuración</strong>
                  </li>
                  <li>
                    En la lista izquierda elegí tu calendario (ej.{" "}
                    <strong>Pela Semanales</strong>)
                  </li>
                  <li>
                    Bajá a <strong>Integrar el calendario</strong>
                  </li>
                  <li>
                    Activá <strong>Compartir públicamente</strong> → Ver todos
                    los detalles
                  </li>
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
                    https://calendar.google.com/calendar/embed?src=juanmendia%40gmail.com&amp;ctz=America%2FArgentina%2FBuenos_Aires
                  </span>
                </p>
              </div>
            </div>
            <div>
              <Label className="text-xs">Firma textual (informes y recetas)</Label>
              <Input
                value={signatureText}
                onChange={(e) => setSignatureText(e.target.value)}
                placeholder="Dr. Nombre — Mat. 12345"
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Imagen de firma (opcional)</Label>
              <Input
                type="file"
                accept="image/*"
                className="mt-1 h-9 text-xs"
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
                <img
                  src={signatureImageData}
                  alt="Firma"
                  className="mt-2 h-12 object-contain"
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="cobros" className="p-4 space-y-4 mt-0">
            <label className="flex items-start gap-2 rounded-md border border-emerald-100 bg-emerald-50/50 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={payment.requirePaymentBeforeBooking !== false}
                onChange={(e) =>
                  setPayment((p) => ({
                    ...p,
                    requirePaymentBeforeBooking: e.target.checked,
                  }))
                }
                className="mt-0.5"
              />
              <span className="text-sm text-slate-700">
                Exigir pago antes de reservar el turno
              </span>
            </label>

            <div className="rounded-lg border border-[#009ee3]/30 bg-sky-50/50 p-3 space-y-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!payment.mercadopagoEnabled}
                  onChange={(e) =>
                    setPayment((p) => ({
                      ...p,
                      mercadopagoEnabled: e.target.checked,
                    }))
                  }
                  className="mt-0.5"
                />
                <span className="text-sm text-slate-700">
                  Cobrar con <strong>Mercado Pago</strong> (Checkout Pro)
                </span>
              </label>
              {payment.mercadopagoEnabled && (
                <>
                  <div>
                    <Label className="text-xs">Access Token de Mercado Pago</Label>
                    <Input
                      type="password"
                      value={payment.mercadopagoAccessToken ?? ""}
                      onChange={(e) =>
                        setPayment((p) => ({
                          ...p,
                          mercadopagoAccessToken: e.target.value,
                        }))
                      }
                      placeholder="TEST-... o APP_USR-..."
                      className="mt-1 h-9 font-mono text-xs"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Credenciales en{" "}
                      <a
                        href="https://www.mercadopago.com.ar/developers/panel/app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        developers.mercadopago.com
                      </a>
                      . Webhook:{" "}
                      <code className="text-[10px] bg-white px-1 rounded">
                        /api/clinic/mercadopago/webhook
                      </code>
                    </p>
                  </div>
                </>
              )}
            </div>

            <p className="text-[11px] text-slate-500">
              Transferencia manual: alias/CBU abajo. MP tiene prioridad si está activo
              y hay honorario cargado.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Honorario consulta</Label>
                <Input
                  type="number"
                  value={payment.consultationFee ?? ""}
                  onChange={(e) =>
                    setPayment((p) => ({
                      ...p,
                      consultationFee: Number(e.target.value) || undefined,
                    }))
                  }
                  className="mt-1 h-9"
                  placeholder="15000"
                />
              </div>
              <div>
                <Label className="text-xs">Moneda</Label>
                <Input
                  value={payment.currency ?? "ARS"}
                  onChange={(e) =>
                    setPayment((p) => ({ ...p, currency: e.target.value }))
                  }
                  className="mt-1 h-9"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Alias / CBU transferencia</Label>
              <Input
                value={payment.alias ?? ""}
                onChange={(e) =>
                  setPayment((p) => ({ ...p, alias: e.target.value }))
                }
                placeholder="mi.alias.mp"
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs">CBU (opcional)</Label>
              <Input
                value={payment.cbu ?? ""}
                onChange={(e) =>
                  setPayment((p) => ({ ...p, cbu: e.target.value }))
                }
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Instrucciones de pago</Label>
              <Textarea
                value={payment.paymentInstructions ?? ""}
                onChange={(e) =>
                  setPayment((p) => ({
                    ...p,
                    paymentInstructions: e.target.value,
                  }))
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
                className="mt-1 h-9 text-xs"
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
          </TabsContent>

          <TabsContent value="avisos" className="p-4 space-y-4 mt-0">
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
                  setReminderSettings((r) => ({
                    ...r,
                    minutesBefore: Number(v),
                  }))
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
                Al reservar un turno, el paciente recibe un email de confirmación
                con fecha, hora y enlace a la sala. Si activás el recordatorio,
                también se avisa antes del turno. Requiere{" "}
                <code className="text-[10px] bg-slate-100 px-1 rounded">RESEND_API_KEY</code>{" "}
                en Vercel.
              </p>
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md p-2 mt-2">
                En plan Vercel Hobby el aviso automático se revisa 1 vez al día
                (~9:00 UTC). Para avisos de 1–2 horas antes, usá{" "}
                <strong>1 día antes</strong> o el botón de reenvío manual del
                paciente.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
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
          </TabsContent>

          <TabsContent value="libres" className="p-4 space-y-4 mt-0">
            <p className="text-xs text-slate-500">
              Marcá feriados, vacaciones o días que no atendés. El paciente no
              verá esos días al pedir turno.
            </p>
            <div className="flex gap-2">
              <Input
                type="date"
                value={newBlockDate}
                min={format(startOfDay(new Date()), "yyyy-MM-dd")}
                onChange={(e) => setNewBlockDate(e.target.value)}
                className="h-9"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addBlockedDate}
              >
                Agregar
              </Button>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
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
                      {format(new Date(d + "T12:00:00"), "EEEE dd/MM/yyyy", {
                        locale: es,
                      })}
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
          </TabsContent>
        </Tabs>

        <div className="p-4 border-t">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-700 hover:bg-blue-800"
            size="sm"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" />
                Guardar consultorio
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
