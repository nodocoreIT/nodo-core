import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
} from "@nodocore/shared-components";
import { Badge } from "@/shared/components/ui/badge";
import {
  Calendar,
  Clock,
  Loader2,
  ArrowLeft,
  CreditCard,
  Wallet,
} from "lucide-react";
import { supabase } from "@/shared/lib/supabase";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { parseLocalDate } from "@/shared/lib/schedule";
import { ConsultationPaymentPanel } from "@/features/paciente/consultation-payment-panel";
import { toast } from "sonner";

interface PaymentInfo {
  consultationFee?: number;
  currency?: string;
  alias?: string;
  cbu?: string;
  bankName?: string;
  paymentInstructions?: string;
  qrImageData?: string;
  requirePaymentBeforeBooking?: boolean;
  mercadopagoEnabled?: boolean;
}

interface BookAppointmentDialogProps {
  doctorId: string;
  doctorName: string;
  payment?: PaymentInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function requiresPaymentStep(payment?: PaymentInfo): boolean {
  return payment?.requirePaymentBeforeBooking !== false;
}

function usesMercadoPago(payment?: PaymentInfo): boolean {
  return !!(
    payment?.mercadopagoEnabled && (payment.consultationFee ?? 0) > 0
  );
}

interface SlotDate {
  date: string;
  label: string;
}

interface Slot {
  iso: string;
  label: string;
}

async function fetchAvailableDates(doctorId: string): Promise<{ dates: SlotDate[]; slotDurationMinutes: number }> {
  // Fetch doctor availability from profiles (stored in metadata)
  // Fall back to showing next 7 working days
  const today = new Date();
  const dates: SlotDate[] = [];
  for (let i = 0; i < 28 && dates.length < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    const iso = format(d, "yyyy-MM-dd");
    dates.push({
      date: iso,
      label: format(d, "EEE d MMM", { locale: es }),
    });
  }
  return { dates, slotDurationMinutes: 30 };
}

async function fetchSlots(doctorId: string, date: string): Promise<{ slots: Slot[] }> {
  // Get booked appointments for this doctor on this date
  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;
  const { data: booked } = await supabase
    .from("appointments")
    .select("scheduled_at")
    .eq("doctor_id", doctorId)
    .gte("scheduled_at", dayStart)
    .lte("scheduled_at", dayEnd)
    .in("status", ["scheduled", "waiting", "in_consultation"]);

  const bookedTimes = new Set(
    (booked ?? []).map((a) => a.scheduled_at.slice(11, 16))
  );

  const slots: Slot[] = [];
  const d = parseLocalDate(date);
  // Default working hours 9–13 and 16–19
  const blocks = [
    { start: 9, end: 13 },
    { start: 16, end: 19 },
  ];
  for (const block of blocks) {
    for (let h = block.start; h < block.end; h++) {
      for (const m of [0, 30]) {
        const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        if (bookedTimes.has(time)) continue;
        const iso = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString();
        if (new Date(iso) <= new Date()) continue;
        slots.push({ iso, label: time });
      }
    }
  }
  return { slots };
}

export function BookAppointmentDialog({
  doctorId,
  doctorName,
  payment,
  open,
  onOpenChange,
}: BookAppointmentDialogProps) {
  const [step, setStep] = useState<"slot" | "payment">("slot");
  const [dates, setDates] = useState<SlotDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [duration, setDuration] = useState(30);

  const needsPayment = requiresPaymentStep(payment);
  const mpEnabled = usesMercadoPago(payment);

  useEffect(() => {
    if (!open) return;
    setStep("slot");
    setPaymentConfirmed(false);
    setLoading(true);
    setSelectedDate(null);
    setSelectedSlot(null);
    fetchAvailableDates(doctorId)
      .then((data) => {
        setDates(data.dates);
        setDuration(data.slotDurationMinutes);
      })
      .finally(() => setLoading(false));
  }, [open, doctorId]);

  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      return;
    }
    setLoading(true);
    fetchSlots(doctorId, selectedDate)
      .then((data) => setSlots(data.slots))
      .finally(() => setLoading(false));
  }, [selectedDate, doctorId]);

  const handleContinue = () => {
    if (!selectedSlot) return;
    if (needsPayment) {
      setStep("payment");
      return;
    }
    void handleBook("none");
  };

  const handleBook = async (mode: "none" | "transfer" | "mercadopago") => {
    if (!selectedSlot) return;
    setBooking(true);
    try {
      // Create appointment in Supabase
      const { data: apt, error } = await supabase
        .from("appointments")
        .insert({
          doctor_id: doctorId,
          scheduled_at: selectedSlot,
          status: mode === "transfer" ? "scheduled" : "scheduled",
          jitsi_room_id: `consulta-${doctorId}-${Date.now()}`,
          access_token: crypto.randomUUID(),
          token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          queue_position: 0,
          payment_status: mode === "transfer" ? "confirmed" : mode === "none" ? "waived" : "pending",
          payment_provider: mode === "mercadopago" ? "mercadopago" : null,
        } as Parameters<typeof supabase.from>[0] extends never ? never : Record<string, unknown>)
        .select("id, access_token")
        .single();

      if (error) throw new Error(error.message);

      toast.success("Turno confirmado. Revisá tu correo para los detalles.");
      onOpenChange(false);
      if (apt?.access_token) {
        window.location.href = `/paciente/sala/${apt.access_token}`;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al reservar");
    } finally {
      setBooking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "payment" ? (
              <CreditCard className="h-5 w-5 text-emerald-600" />
            ) : (
              <Calendar className="h-5 w-5 text-blue-600" />
            )}
            {step === "payment"
              ? `Pago — ${doctorName}`
              : `Pedir turno — ${doctorName}`}
          </DialogTitle>
          <p className="text-sm text-slate-500">
            {step === "payment"
              ? mpEnabled
                ? "Pagá con Mercado Pago o confirmá una transferencia manual"
                : "Transferí el honorario y confirmá el pago para reservar el turno"
              : `Duración aproximada: ${duration} minutos`}
          </p>
        </DialogHeader>

        {step === "slot" ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Elegí el día</p>
              {loading && dates.length === 0 ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : dates.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-lg">
                  No hay turnos disponibles en los próximos días.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {dates.map((d) => (
                    <Button
                      key={d.date}
                      size="sm"
                      variant={selectedDate === d.date ? "default" : "outline"}
                      className={
                        selectedDate === d.date ? "bg-blue-700 hover:bg-blue-800" : ""
                      }
                      onClick={() => {
                        setSelectedDate(d.date);
                        setSelectedSlot(null);
                      }}
                    >
                      {d.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {selectedDate && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Horarios —{" "}
                  {format(parseLocalDate(selectedDate), "dd MMM yyyy", { locale: es })}
                </p>
                {loading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">
                    No hay turnos disponibles este día
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((slot) => (
                      <Button
                        key={slot.iso}
                        size="sm"
                        variant={selectedSlot === slot.iso ? "default" : "outline"}
                        className={
                          selectedSlot === slot.iso
                            ? "bg-emerald-600 hover:bg-emerald-700"
                            : ""
                        }
                        onClick={() => setSelectedSlot(slot.iso)}
                      >
                        {slot.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedSlot && (
              <Badge className="w-full justify-center py-2 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                Turno:{" "}
                {format(parseISO(selectedSlot), "EEEE dd/MM 'a las' HH:mm", {
                  locale: es,
                })}
              </Badge>
            )}

            <Button
              className="w-full bg-blue-700 hover:bg-blue-800"
              disabled={!selectedSlot || booking}
              onClick={handleContinue}
            >
              {booking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : needsPayment ? (
                "Continuar al pago"
              ) : (
                "Confirmar turno"
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Badge className="w-full justify-center py-2 bg-slate-100 text-slate-700 hover:bg-slate-100">
              {selectedSlot &&
                format(parseISO(selectedSlot), "EEEE dd/MM 'a las' HH:mm", {
                  locale: es,
                })}
            </Badge>

            <ConsultationPaymentPanel doctorName={doctorName} payment={payment} />

            {mpEnabled && (
              <Button
                className="w-full bg-[#009ee3] hover:bg-[#008ecf] text-white h-11"
                disabled={booking}
                onClick={() => handleBook("mercadopago")}
              >
                {booking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Wallet className="h-4 w-4 mr-2" />
                    Pagar con Mercado Pago
                  </>
                )}
              </Button>
            )}

            {mpEnabled && (
              <p className="text-xs text-center text-slate-400">— o transferencia manual —</p>
            )}

            <label className="flex items-start gap-2 rounded-md border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={paymentConfirmed}
                onChange={(e) => setPaymentConfirmed(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm text-slate-700">
                Confirmo que realicé la transferencia por el monto indicado
              </span>
            </label>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep("slot")}
                disabled={booking}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={!paymentConfirmed || booking}
                onClick={() => handleBook("transfer")}
              >
                {booking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Confirmar transferencia"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
