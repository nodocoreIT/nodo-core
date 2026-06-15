import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  useAuth,
} from "@nodocore/shared-components";
import {
  Stethoscope,
  CreditCard,
  CalendarDays,
  Bell,
  UserCircle,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabase";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";

// ─── Schema ────────────────────────────────────────────────────────────────
const officeSchema = z.object({
  full_name: z.string().min(2, "Nombre requerido"),
  specialty: z.string().min(2, "Especialidad requerida"),
  license_number: z.string().optional(),
  consultation_fee: z.coerce.number().optional(),
  currency: z.string().default("ARS"),
  alias: z.string().optional(),
  cbu: z.string().optional(),
  bank_name: z.string().optional(),
  payment_instructions: z.string().optional(),
  require_payment_before_booking: z.boolean().default(false),
  google_calendar_id: z.string().optional(),
  reminder_enabled: z.boolean().default(true),
  reminder_minutes_before: z.coerce.number().default(1440),
});

type OfficeForm = z.infer<typeof officeSchema>;

type Tab = "perfil" | "pago" | "calendario" | "fechas" | "recordatorios";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "perfil", label: "Perfil", icon: UserCircle },
  { key: "pago", label: "Pagos", icon: CreditCard },
  { key: "calendario", label: "Calendario", icon: CalendarDays },
  { key: "fechas", label: "Fechas bloqueadas", icon: CalendarDays },
  { key: "recordatorios", label: "Recordatorios", icon: Bell },
];

// ─── Component ─────────────────────────────────────────────────────────────
export function DoctorOfficePanel() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("perfil");
  const [loading, setLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<OfficeForm>({
    resolver: zodResolver(officeSchema),
    defaultValues: {
      full_name: "",
      specialty: "",
      license_number: "",
      currency: "ARS",
      reminder_enabled: true,
      reminder_minutes_before: 1440,
      require_payment_before_booking: false,
    },
  });

  // Load existing profile
  useEffect(() => {
    if (!session?.user.id) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        form.reset({
          full_name: data.full_name ?? "",
          specialty: data.specialty ?? "",
          license_number: data.license_number ?? "",
          consultation_fee: data.consultation_fee ?? undefined,
          currency: data.currency ?? "ARS",
          alias: data.alias ?? "",
          cbu: data.cbu ?? "",
          bank_name: data.bank_name ?? "",
          payment_instructions: data.payment_instructions ?? "",
          require_payment_before_booking: data.require_payment_before_booking ?? false,
          google_calendar_id: data.google_calendar_id ?? "",
          reminder_enabled: data.reminder_enabled ?? true,
          reminder_minutes_before: data.reminder_minutes_before ?? 1440,
        });
        setPhotoUrl(data.photo_url ?? null);
        setQrUrl(data.qr_image_url ?? null);
        setBlockedDates((data.blocked_dates as string[] | null) ?? []);
      })
      .finally(() => setLoading(false));
  }, [session?.user.id, form]);

  const onSubmit = async (data: OfficeForm) => {
    if (!session?.user.id) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: data.full_name,
        specialty: data.specialty,
        license_number: data.license_number,
        consultation_fee: data.consultation_fee,
        currency: data.currency,
        alias: data.alias,
        cbu: data.cbu,
        bank_name: data.bank_name,
        payment_instructions: data.payment_instructions,
        require_payment_before_booking: data.require_payment_before_booking,
        google_calendar_id: data.google_calendar_id,
        reminder_enabled: data.reminder_enabled,
        reminder_minutes_before: data.reminder_minutes_before,
        blocked_dates: blockedDates,
      })
      .eq("id", session.user.id);

    if (error) {
      toast.error("Error al guardar");
    } else {
      toast.success("Consultorio actualizado");
    }
  };

  // Photo upload
  const handlePhotoUpload = async (file: File) => {
    if (!session?.user.id) return;
    const path = `profiles/${session.user.id}/photo`;
    const { error } = await supabase.storage
      .from("clinica")
      .upload(path, file, { upsert: true });
    if (error) { toast.error("Error subiendo foto"); return; }
    const { data } = supabase.storage.from("clinica").getPublicUrl(path);
    setPhotoUrl(data.publicUrl);
    await supabase.from("profiles").update({ photo_url: data.publicUrl }).eq("id", session.user.id);
    toast.success("Foto actualizada");
  };

  // QR upload
  const handleQrUpload = async (file: File) => {
    if (!session?.user.id) return;
    const path = `profiles/${session.user.id}/qr`;
    const { error } = await supabase.storage
      .from("clinica")
      .upload(path, file, { upsert: true });
    if (error) { toast.error("Error subiendo QR"); return; }
    const { data } = supabase.storage.from("clinica").getPublicUrl(path);
    setQrUrl(data.publicUrl);
    await supabase.from("profiles").update({ qr_image_url: data.publicUrl }).eq("id", session.user.id);
    toast.success("QR actualizado");
  };

  const addBlockedDate = () => {
    if (!newBlockedDate) return;
    if (blockedDates.includes(newBlockedDate)) {
      toast.info("Esa fecha ya está bloqueada");
      return;
    }
    setBlockedDates((prev) => [...prev, newBlockedDate].sort());
    setNewBlockedDate("");
  };

  const removeBlockedDate = (date: string) => {
    setBlockedDates((prev) => prev.filter((d) => d !== date));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}>
        {/* Tab bar */}
        <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={[
                "flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors",
                activeTab === key
                  ? "border-brand text-brand"
                  : "border-transparent text-slate-500 hover:text-navy",
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Perfil ── */}
        {activeTab === "perfil" && (
          <Card className="border-slate-200">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
                <Stethoscope className="h-4 w-4 text-brand" />
                Datos profesionales
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Photo */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Foto" className="h-full w-full object-cover" />
                  ) : (
                    <UserCircle className="h-8 w-8 text-slate-300" />
                  )}
                </div>
                <div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handlePhotoUpload(f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
                    Subir foto
                  </Button>
                  <p className="text-[11px] text-slate-400 mt-1">PNG o JPG, max 2 MB</p>
                </div>
              </div>

              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Nombre completo</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Dr. Juan Pérez" className="h-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="specialty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Especialidad</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Medicina General" className="h-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="license_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Matrícula</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="MN 12345" className="h-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="bg-brand hover:bg-brand-600">
                Guardar perfil
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Pagos ── */}
        {activeTab === "pago" && (
          <Card className="border-slate-200">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
                <CreditCard className="h-4 w-4 text-brand" />
                Configuración de pagos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="consultation_fee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Honorario</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" placeholder="5000" className="h-9" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Moneda</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="ARS" className="h-9" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="alias"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Alias CBU / CVU</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="mi.alias.mp" className="h-9" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cbu"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">CBU / CVU</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="0000003100000000000000" className="h-9" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bank_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Banco / Billetera</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Mercado Pago" className="h-9" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Instrucciones adicionales</FormLabel>
                    <FormControl>
                      <textarea
                        {...field}
                        rows={3}
                        placeholder="Transferir antes de la consulta y enviar comprobante por WhatsApp..."
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* QR Image */}
              <div>
                <Label className="text-xs block mb-2">Imagen QR de pago</Label>
                {qrUrl && (
                  <img
                    src={qrUrl}
                    alt="QR"
                    className="h-24 w-24 object-contain border border-slate-200 rounded-md mb-2"
                  />
                )}
                <input
                  ref={qrInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleQrUpload(f);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => qrInputRef.current?.click()}
                >
                  <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
                  {qrUrl ? "Cambiar QR" : "Subir QR"}
                </Button>
              </div>

              <FormField
                control={form.control}
                name="require_payment_before_booking"
                render={({ field }) => (
                  <FormItem>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700">
                        Requerir confirmación de pago antes de confirmar el turno
                      </span>
                    </label>
                  </FormItem>
                )}
              />

              <Button type="submit" className="bg-brand hover:bg-brand-600">
                Guardar pagos
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Calendario Google ── */}
        {activeTab === "calendario" && (
          <Card className="border-slate-200">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
                <CalendarDays className="h-4 w-4 text-brand" />
                Google Calendar
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Pegá la URL de tu Google Calendar para verlo en el panel de Agenda.
                <br />
                <span className="text-slate-400">
                  Ejemplo: calendar.google.com/calendar/embed?src=tu@email.com
                </span>
              </p>
              <FormField
                control={form.control}
                name="google_calendar_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">URL o ID del calendario</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="calendar.google.com/calendar/embed?src=..."
                        className="h-9"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="bg-brand hover:bg-brand-600">
                Guardar calendario
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Fechas bloqueadas ── */}
        {activeTab === "fechas" && (
          <Card className="border-slate-200">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
                <CalendarDays className="h-4 w-4 text-red-400" />
                Días no disponibles
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <p className="text-xs text-slate-500">
                Bloqueá días en los que no vas a atender. Los pacientes no podrán reservar en esas fechas.
              </p>

              {/* Quick-add next 30 days */}
              <div>
                <Label className="text-xs mb-2 block">Próximos 30 días</Label>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {Array.from({ length: 30 }, (_, i) => {
                    const d = addDays(new Date(), i + 1);
                    const iso = format(d, "yyyy-MM-dd");
                    const label = format(d, "d MMM", { locale: es });
                    const isBlocked = blockedDates.includes(iso);
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() =>
                          isBlocked ? removeBlockedDate(iso) : setBlockedDates((p) => [...p, iso].sort())
                        }
                        className={[
                          "text-[11px] px-2 py-1 rounded-md border transition-colors",
                          isBlocked
                            ? "bg-red-100 border-red-300 text-red-700 font-semibold"
                            : "border-slate-200 text-slate-600 hover:border-slate-300",
                        ].join(" ")}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Manual date input */}
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={newBlockedDate}
                  onChange={(e) => setNewBlockedDate(e.target.value)}
                  className="h-9 flex-1"
                />
                <Button type="button" variant="outline" onClick={addBlockedDate}>
                  Agregar
                </Button>
              </div>

              {blockedDates.length > 0 && (
                <div>
                  <Label className="text-xs mb-2 block text-red-600">
                    Fechas bloqueadas ({blockedDates.length})
                  </Label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {blockedDates.map((d) => (
                      <div
                        key={d}
                        className="flex items-center justify-between rounded-md border border-red-100 bg-red-50 px-3 py-1.5"
                      >
                        <span className="text-xs text-red-700">
                          {format(new Date(d + "T12:00:00"), "EEEE d 'de' MMMM yyyy", { locale: es })}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeBlockedDate(d)}
                          className="text-red-400 hover:text-red-600 ml-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button type="submit" className="bg-brand hover:bg-brand-600">
                Guardar fechas
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Recordatorios ── */}
        {activeTab === "recordatorios" && (
          <Card className="border-slate-200">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
                <Bell className="h-4 w-4 text-brand" />
                Recordatorios automáticos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <p className="text-xs text-slate-500">
                Cuando está activo, los pacientes reciben un email de recordatorio antes de su turno.
              </p>

              <FormField
                control={form.control}
                name="reminder_enabled"
                render={({ field }) => (
                  <FormItem>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div
                        onClick={() => field.onChange(!field.value)}
                        className={[
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                          field.value ? "bg-brand" : "bg-slate-300",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            field.value ? "translate-x-6" : "translate-x-1",
                          ].join(" ")}
                        />
                      </div>
                      <span className="text-sm text-slate-700">
                        Enviar recordatorios por email
                      </span>
                    </label>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reminder_minutes_before"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Enviar con anticipación</FormLabel>
                    <FormControl>
                      <select
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-9 focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value={60}>1 hora antes</option>
                        <option value={180}>3 horas antes</option>
                        <option value={720}>12 horas antes</option>
                        <option value={1440}>24 horas antes</option>
                        <option value={2880}>48 horas antes</option>
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />

              <Button type="submit" className="bg-brand hover:bg-brand-600">
                Guardar recordatorios
              </Button>
            </CardContent>
          </Card>
        )}
      </form>
    </Form>
  );
}
