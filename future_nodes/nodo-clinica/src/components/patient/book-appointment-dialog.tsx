"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  Loader2,
  ArrowLeft,
  CreditCard,
  Wallet,
} from "lucide-react";
import { clinicApi } from "@/lib/clinic/client-api";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { parseLocalDate } from "@/lib/clinic/schedule";
import { ConsultationPaymentPanel } from "@/components/patient/consultation-payment-panel";
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

export function BookAppointmentDialog({
  doctorId,
  doctorName,
  payment,
  open,
  onOpenChange,
}: BookAppointmentDialogProps) {
  const [step, setStep] = useState<"slot" | "payment">("slot");
  const [dates, setDates] = useState<{ date: string; label: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ iso: string; label: string }[]>([]);
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
    clinicApi
      .getAvailableDates(doctorId)
      .then((data) => {
        setDates(data.dates ?? []);
        setDuration(data.slotDurationMinutes ?? 30);
      })
      .finally(() => setLoading(false));
  }, [open, doctorId]);

  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      return;
    }
    setLoading(true);
    clinicApi
      .getSlots(doctorId, selectedDate)
      .then((data) => setSlots(data.slots ?? []))
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

  const handleBook = async (
    mode: "none" | "transfer" | "mercadopago"
  ) => {
    if (!selectedSlot) return;
    setBooking(true);
    try {
      const result = await clinicApi.bookAppointment({
        doctorId,
        scheduledAt: selectedSlot,
        confirmPayment: mode === "transfer",
        paymentMethod: mode === "mercadopago" ? "mercadopago" : "transfer",
      });

      if (result.checkoutUrl) {
        toast.message("Redirigiendo a Mercado Pago…");
        onOpenChange(false);
        window.location.href = result.checkoutUrl;
        return;
      }

      toast.success("Turno confirmado. Revisá tu correo para los detalles.");
      onOpenChange(false);
      window.location.href = result.waitingRoomUrl;
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

            {needsPayment && selectedSlot && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md p-2.5">
                {mpEnabled
                  ? "Este médico requiere pagar antes de confirmar el turno."
                  : "Este médico requiere confirmar la transferencia antes de reservar el turno."}
              </p>
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

            {!payment?.consultationFee && !payment?.alias && !payment?.cbu && !mpEnabled && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md p-2.5">
                Si el médico aún no cargó alias o CBU, confirmá el monto acordado
                con el consultorio antes de marcar la casilla.
              </p>
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
