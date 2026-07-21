"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  Clock,
  Loader2,
  ArrowLeft,
  CreditCard,
  Wallet,
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Mic,
  MicOff,
  ClipboardCheck,
} from "lucide-react";
import { clinicApi } from "@/lib/clinic/client-api";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { parseLocalDate, formatDateKeyLabel, clinicTimeLabelFromIso } from "@/lib/clinic/schedule";
import { ConsultationPaymentPanel } from "@/components/patient/consultation-payment-panel";
import { MonthCalendar, type CalendarDay } from "@/components/patient/month-calendar";
import { ReceiptValidationCard } from "@/components/patient/receipt-validation-card";
import {
  patientRequiresPayment,
  patientShowsPaymentStep,
  patientCanPayWithMercadoPago,
} from "@/lib/clinic/payment";
import type { PaymentReceiptAudit } from "@/lib/clinic/types";
import { toast } from "sonner";

interface BookAppointmentDialogProps {
  doctorId: string;
  doctorName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new appointment's access token and a success message
   * once booking succeeds (no further payment redirect needed). The message
   * should be shown once the waiting-room modal has finished loading, not
   * immediately. If omitted, falls back to navigating to the waiting-room page. */
  onBooked?: (accessToken: string, message: string) => void;
}

type WizardStep = "slot" | "payment" | "intake" | "studies" | "confirm";

interface PaymentInfo {
  consultationFee?: number;
  currency?: string;
  alias?: string;
  cbu?: string;
  beneficiaryName?: string;
  bankName?: string;
  paymentInstructions?: string;
  qrImageData?: string;
  requirePaymentBeforeBooking?: boolean;
  mercadopagoEnabled?: boolean;
  mercadopagoReady?: boolean;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

type ReceiptChecks = {
  amount: { pass: boolean; detail: string };
  recipient: { pass: boolean; detail: string };
  schedule: { pass: boolean; detail: string };
  receiptType: { pass: boolean; detail: string };
};

const STEP_LABELS: Record<WizardStep, string> = {
  slot: "Fecha y hora",
  payment: "Pago",
  intake: "Motivo",
  studies: "Estudios",
  confirm: "Confirmar",
};

function WizardProgress({
  steps,
  current,
  onSelect,
}: {
  steps: WizardStep[];
  current: WizardStep;
  onSelect: (step: WizardStep) => void;
}) {
  const idx = steps.indexOf(current);
  return (
    <div className="flex items-center gap-1 mb-1">
      {steps.map((s, i) => {
        const visited = i < idx;
        return (
          <button
            key={s}
            type="button"
            disabled={!visited}
            onClick={() => onSelect(s)}
            className={`flex-1 flex flex-col items-center gap-0.5 ${
              visited ? "cursor-pointer" : "cursor-default"
            }`}
          >
            <div
              className={`h-1.5 w-full rounded-full ${
                i <= idx ? "bg-emerald-500" : "bg-slate-200"
              }`}
            />
            <span
              className={`text-[11px] hidden sm:block ${
                i === idx ? "text-emerald-700 font-medium" : "text-slate-400"
              }`}
            >
              {STEP_LABELS[s]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function BookAppointmentDialog({
  doctorId,
  doctorName,
  open,
  onOpenChange,
  onBooked,
}: BookAppointmentDialogProps) {
  const [step, setStep] = useState<WizardStep>("slot");
  const [dates, setDates] = useState<CalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<
    { iso: string; label: string; status: "available" | "booked" }[]
  >([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [shareHealthProfile, setShareHealthProfile] = useState(true);
  const [duration, setDuration] = useState(30);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [intakeReason, setIntakeReason] = useState("");
  const [listening, setListening] = useState(false);
  const [studyFiles, setStudyFiles] = useState<File[]>([]);
  const [validationChecks, setValidationChecks] = useState<ReceiptChecks | null>(
    null,
  );
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const slotsSectionRef = useRef<HTMLDivElement | null>(null);
  const [resolvedPayment, setResolvedPayment] = useState<PaymentInfo | undefined>(
    undefined,
  );
  const [paymentRequiredOverride, setPaymentRequiredOverride] = useState(false);
  const [paymentSettingsReady, setPaymentSettingsReady] = useState(false);
  const [receiptAudit, setReceiptAudit] = useState<PaymentReceiptAudit | null>(null);
  const [validatingReceipt, setValidatingReceipt] = useState(false);
  const [receiptWarning, setReceiptWarning] = useState<string | null>(null);

  const showPaymentStep =
    patientShowsPaymentStep(resolvedPayment) || paymentRequiredOverride;
  const needsPayment =
    patientRequiresPayment(resolvedPayment) || paymentRequiredOverride;
  const mpReady = patientCanPayWithMercadoPago(resolvedPayment);
  const transferRequired = needsPayment && !mpReady;
  const paymentBlockedWithoutProof =
    needsPayment && !receiptFile && (transferRequired || mpReady);

  const steps = useMemo((): WizardStep[] => {
    if (showPaymentStep) {
      return ["slot", "payment", "intake", "studies", "confirm"];
    }
    return ["slot", "intake", "studies", "confirm"];
  }, [showPaymentStep]);

  const loadDoctorPayment = useCallback(async () => {
    const doctor = await clinicApi.getDoctorForBooking(doctorId);
    setResolvedPayment(doctor.payment);
    return doctor.payment;
  }, [doctorId]);

  const resetWizard = () => {
    setStep("slot");
    setShareHealthProfile(true);
    setReceiptFile(null);
    setIntakeReason("");
    setStudyFiles([]);
    setValidationChecks(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setListening(false);
    setPaymentRequiredOverride(false);
    setPaymentSettingsReady(false);
    setReceiptAudit(null);
    setValidatingReceipt(false);
    setResolvedPayment(undefined);
    recognitionRef.current?.stop();
  };

  useEffect(() => {
    if (!open) return;
    resetWizard();
    setLoadingDates(true);
    setPaymentSettingsReady(false);

    let cancelled = false;

    Promise.all([
      loadDoctorPayment(),
      clinicApi.getAvailableDates(doctorId),
    ])
      .then(([, dateData]) => {
        if (cancelled) return;
        setDates(dateData.dates ?? []);
        setDuration(dateData.slotDurationMinutes ?? 30);
        setPaymentSettingsReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar los honorarios del médico",
        );
        setPaymentSettingsReady(false);
        clinicApi
          .getAvailableDates(doctorId)
          .then((dateData) => {
            if (cancelled) return;
            setDates(dateData.dates ?? []);
            setDuration(dateData.slotDurationMinutes ?? 30);
          })
          .catch(() => undefined);
      })
      .finally(() => {
        if (!cancelled) setLoadingDates(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, doctorId, loadDoctorPayment]);

  useEffect(() => {
    if (!open || step !== "payment") return;
    void loadDoctorPayment().catch(() => {
      toast.error("No se pudieron actualizar los datos de cobro");
    });
  }, [open, step, doctorId, loadDoctorPayment]);

  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      setLoadingSlots(false);
      return;
    }
    setLoadingSlots(true);
    setSelectedSlot(null);
    clinicApi
      .getSlots(doctorId, selectedDate)
      .then((data) => {
        const nextSlots = data.slots ?? [];
        setSlots(nextSlots);
        const availableSlots = nextSlots.filter(
          (s: { status: string }) => s.status === "available",
        );
        if (availableSlots.length === 1) {
          setSelectedSlot(availableSlots[0].iso);
        }
      })
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, doctorId]);

  useEffect(() => {
    if (!selectedDate || loadingSlots) return;
    slotsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedDate, loadingSlots, slots.length]);

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  const slotLabel =
    selectedSlot &&
    selectedDate &&
    `${formatDateKeyLabel(selectedDate)} a las ${clinicTimeLabelFromIso(selectedSlot)}`;

  const goBack = () => {
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
  };

  const goNext = () => {
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) setStep(steps[idx + 1]);
  };

  const goToStep = (target: WizardStep) => {
    const idx = steps.indexOf(step);
    const targetIdx = steps.indexOf(target);
    if (targetIdx >= 0 && targetIdx < idx) setStep(target);
  };

  const toggleMic = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Dictado por voz no disponible en este navegador");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let chunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          chunk += event.results[i][0].transcript;
        }
      }
      if (chunk.trim()) {
        setIntakeReason((prev) =>
          prev ? `${prev.trim()} ${chunk.trim()}` : chunk.trim(),
        );
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const handleContinueFromSlot = () => {
    if (!paymentSettingsReady) {
      toast.message("Cargando datos del médico…");
      return;
    }
    if (!selectedSlot) {
      if (selectedDate && !loadingSlots) {
        toast.message("Elegí un horario para continuar");
      }
      return;
    }
    goNext();
  };

  const runReceiptPreview = async (file: File) => {
    if (!selectedSlot) {
      toast.error("Elegí fecha y horario antes del comprobante");
      return;
    }
    setValidatingReceipt(true);
    setReceiptAudit(null);
    setValidationChecks(null);
    setReceiptWarning(null);
    try {
      const result = await clinicApi.previewPaymentReceipt({
        doctorId,
        scheduledAt: selectedSlot,
        receipt: {
          fileName: file.name,
          mimeType: file.type || "image/jpeg",
          dataBase64: await fileToBase64(file),
        },
      });
      if (result.audit) setReceiptAudit(result.audit);
      if (result.checks) setValidationChecks(result.checks as ReceiptChecks);
      if (result.valid) {
        toast.success("Comprobante validado — podés continuar");
      } else {
        const failed = result.checks
          ? Object.values(result.checks).find((c) => !c.pass)?.detail
          : result.reasons?.[0];
        setReceiptWarning(failed ?? "Revisá los datos del comprobante");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo analizar el comprobante");
    } finally {
      setValidatingReceipt(false);
    }
  };

  const goToPaymentStep = () => {
    setPaymentRequiredOverride(true);
    setStep("payment");
  };

  const handleContinueFromPayment = () => {
    if (needsPayment && !receiptFile && mpReady) {
      toast.error(
        "Usá el botón «Pagar con Mercado Pago» o subí el comprobante de transferencia",
      );
      return;
    }
    if (transferRequired && !receiptFile) {
      toast.error("Subí el comprobante de transferencia para continuar");
      return;
    }
    if (transferRequired && validatingReceipt) {
      toast.message("Esperá el análisis del comprobante…");
      return;
    }
    goNext();
  };

  const handleFinalConfirm = async (
    mode: "none" | "transfer" | "mercadopago",
  ) => {
    if (!selectedSlot) return;
    if (needsPayment && mode === "transfer" && !receiptFile) {
      toast.error("Falta el comprobante de pago");
      goToPaymentStep();
      return;
    }

    setBooking(true);
    setValidationChecks(null);
    try {
      let receipt:
        | { fileName: string; mimeType: string; dataBase64: string }
        | undefined;
      if (mode === "transfer" && receiptFile) {
        receipt = {
          fileName: receiptFile.name,
          mimeType: receiptFile.type || "image/jpeg",
          dataBase64: await fileToBase64(receiptFile),
        };
      }

      const encodedStudies = await Promise.all(
        studyFiles.map(async (file) => ({
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          dataBase64: await fileToBase64(file),
        })),
      );

      const result = await clinicApi.bookAppointment({
        doctorId,
        scheduledAt: selectedSlot,
        paymentMethod: mode === "mercadopago" ? "mercadopago" : "transfer",
        shareHealthProfile,
        receipt,
        intakeReason: intakeReason.trim() || undefined,
        studyFiles: encodedStudies.length ? encodedStudies : undefined,
      });

      if (result.checkoutUrl) {
        toast.message("Redirigiendo a Mercado Pago…");
        onOpenChange(false);
        window.location.href = result.checkoutUrl;
        return;
      }

      const successMessage = result.paymentPendingReview
        ? "Turno reservado. El médico revisará tu comprobante antes de la consulta."
        : "Turno confirmado. Te esperamos en la sala virtual.";
      onOpenChange(false);
      if (onBooked && result.accessToken) {
        onBooked(result.accessToken, successMessage);
      } else {
        toast.success(successMessage);
        window.location.assign(result.waitingRoomUrl);
      }
    } catch (e) {
      const err = e as Error & {
        checks?: ReceiptChecks;
        requiresReceipt?: boolean;
      };
      if (err.requiresReceipt || err.checks) {
        if (err.checks) setValidationChecks(err.checks);
        goToPaymentStep();
      }
      toast.error(err.message || "Error al confirmar el turno");
    } finally {
      setBooking(false);
    }
  };

  const stepTitle = (() => {
    switch (step) {
      case "slot":
        return `Pedir turno — ${doctorName}`;
      case "payment":
        return "Pago de la consulta";
      case "intake":
        return "Motivo de consulta";
      case "studies":
        return "Estudios previos";
      case "confirm":
        return "Revisá y confirmá";
      default:
        return doctorName;
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[85%] sm:max-w-2xl max-h-[95vh] overflow-y-auto px-8 pt-8">
        <DialogHeader>
          <WizardProgress steps={steps} current={step} onSelect={goToStep} />
          <DialogTitle className="flex items-center gap-2 text-base">
            {step === "slot" && <Calendar className="h-5 w-5 text-blue-600" />}
            {step === "payment" && (
              <CreditCard className="h-5 w-5 text-emerald-600" />
            )}
            {step === "intake" && (
              <MessageSquare className="h-5 w-5 text-violet-600" />
            )}
            {step === "studies" && (
              <Upload className="h-5 w-5 text-blue-600" />
            )}
            {step === "confirm" && (
              <ClipboardCheck className="h-5 w-5 text-emerald-600" />
            )}
            {stepTitle}
          </DialogTitle>
          <p className="text-sm text-slate-500">
            Paso {steps.indexOf(step) + 1} de {steps.length}
            {step === "slot" && ` · Duración ~${duration} min`}
          </p>
        </DialogHeader>

        {slotLabel && step !== "slot" && (
          <Badge className="w-full justify-center py-2 bg-slate-100 text-slate-700 hover:bg-slate-100 text-xs">
            {slotLabel}
          </Badge>
        )}

        {step === "slot" && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Elegí el día</p>
              {loadingDates && dates.length === 0 ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                </div>
              ) : dates.every((d) => d.status !== "available") ? (
                <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-lg">
                  No hay turnos disponibles.
                </p>
              ) : (
                <MonthCalendar
                  days={dates}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />
              )}
            </div>

            {selectedDate && (
              <div ref={slotsSectionRef}>
                <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Elegí el horario —{" "}
                  {format(parseLocalDate(selectedDate), "dd MMM yyyy", {
                    locale: es,
                  })}
                </p>
                {loadingSlots ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                  </div>
                ) : slots.every((s) => s.status !== "available") ? (
                  <p className="text-sm text-amber-700 text-center py-4 bg-amber-50 rounded-lg border border-amber-100">
                    No hay horarios libres este día. Probá con otro día.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((slot) => {
                      const isBooked = slot.status === "booked";
                      const isSelected = selectedSlot === slot.iso;
                      return (
                        <button
                          key={slot.iso}
                          type="button"
                          disabled={isBooked}
                          title={isBooked ? "Turno ocupado" : undefined}
                          onClick={() => !isBooked && setSelectedSlot(slot.iso)}
                          className={`h-9 rounded-md border text-sm transition-colors ${
                            isBooked
                              ? "bg-red-50 text-red-400 border-red-200 line-through cursor-not-allowed"
                              : isSelected
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                          }`}
                        >
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {selectedDate &&
              !selectedSlot &&
              !loadingSlots &&
              slots.some((s) => s.status === "available") && (
              <p className="text-xs text-slate-500 text-center">
                Seleccioná un horario de la lista para continuar.
              </p>
            )}

            <Button
              type="button"
              className="w-full bg-emerald-700 hover:bg-emerald-800"
              disabled={!selectedSlot || loadingSlots || !paymentSettingsReady}
              onClick={handleContinueFromSlot}
            >
              Continuar
            </Button>
          </div>
        )}

        {step === "payment" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              {mpReady
                ? "Recomendado: pagá con Mercado Pago desde el celular (confirmación al instante). También podés transferir y subir comprobante."
                : "Transferí el honorario y subí el comprobante para continuar."}
            </p>
            <ConsultationPaymentPanel
              doctorName={doctorName}
              payment={resolvedPayment}
            />

            {mpReady && (
              <>
                <Button
                  className="w-full bg-[#009ee3] hover:bg-[#008ecf] text-white h-11"
                  disabled={booking}
                  onClick={() => handleFinalConfirm("mercadopago")}
                >
                  {booking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Wallet className="h-4 w-4 mr-2" />
                      Pagar con Mercado Pago (celular o QR)
                    </>
                  )}
                </Button>
                <p className="text-[10px] text-center text-slate-400">
                  Abrís Mercado Pago, pagás con tarjeta, débito o dinero en
                  cuenta — el turno se confirma solo.
                </p>
                <p className="text-xs text-center text-slate-400">
                  — o transferencia manual —
                </p>
              </>
            )}

            {resolvedPayment?.mercadopagoEnabled && !mpReady && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                Mercado Pago está activado pero falta el Access Token del
                médico. Usá transferencia por ahora.
              </p>
            )}

            <div className="rounded-lg border border-dashed border-violet-200 bg-violet-50/40 p-3 space-y-2">
              <p className="text-xs font-medium text-violet-900">
                Subí el ticket / comprobante de transferencia
              </p>
              <label className="flex items-center justify-center gap-2 rounded-md border border-violet-300 bg-white px-3 py-2 text-xs font-medium text-violet-700 cursor-pointer hover:bg-violet-100">
                <Upload className="h-4 w-4" />
                Seleccionar archivo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0] ?? null;
                    setReceiptFile(file);
                    setReceiptAudit(null);
                    setValidationChecks(null);
                    setReceiptWarning(null);
                    if (file) await runReceiptPreview(file);
                  }}
                />
              </label>
              {receiptFile && (
                <p className="text-[11px] text-slate-600 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {receiptFile.name}
                </p>
              )}
              <ReceiptValidationCard
                audit={receiptAudit}
                loading={validatingReceipt}
              />
              {receiptWarning && (
                <p className="text-[11px] text-red-800 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
                  {receiptWarning}
                </p>
              )}
              {receiptAudit && !receiptAudit.valid && receiptFile && (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                  La validación automática no fue concluyente. Podés continuar:
                  el médico revisará el comprobante manualmente.
                </p>
              )}
              <p className="text-[10px] text-slate-500">
                Validamos monto, destinatario y fecha del turno al subir el archivo.
              </p>
            </div>

            <NavButtons
              onBack={goBack}
              onContinue={handleContinueFromPayment}
              continueDisabled={
                paymentBlockedWithoutProof || validatingReceipt
              }
              continueLabel="Continuar"
            />
          </div>
        )}

        {step === "intake" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Contanos por qué venís. Podés escribir o dictar — el médico lo verá
              antes de atenderte. (Opcional)
            </p>
            <Textarea
              value={intakeReason}
              onChange={(e) => setIntakeReason(e.target.value)}
              placeholder="Ej: dolor abdominal hace 3 días, necesito renovar receta..."
              className="min-h-[100px] text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`w-full ${listening ? "border-red-300 text-red-700" : ""}`}
              onClick={toggleMic}
            >
              {listening ? (
                <>
                  <MicOff className="h-4 w-4 mr-1" />
                  Detener dictado
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-1" />
                  Dictar motivo
                </>
              )}
            </Button>
            <NavButtons onBack={goBack} onContinue={goNext} continueLabel="Continuar" />
          </div>
        )}

        {step === "studies" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Si tenés estudios previos (PDF, JPG, PNG), subilos ahora. El médico
              los revisará antes de la consulta. (Opcional)
            </p>
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/40 p-6 cursor-pointer hover:bg-blue-50">
              <Upload className="h-8 w-8 text-blue-500" />
              <span className="text-sm text-slate-600">
                Arrastrá o seleccioná archivos
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg,application/pdf"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) {
                    setStudyFiles((prev) => [...prev, ...files]);
                  }
                  e.target.value = "";
                }}
              />
            </label>
            {studyFiles.length > 0 && (
              <ul className="space-y-1">
                {studyFiles.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between text-xs bg-white border rounded px-2 py-1.5"
                  >
                    <span className="truncate flex-1">{f.name}</span>
                    <button
                      type="button"
                      className="text-red-500 ml-2 shrink-0"
                      onClick={() =>
                        setStudyFiles((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <NavButtons onBack={goBack} onContinue={goNext} continueLabel="Continuar" />
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-slate-50 p-3 text-sm space-y-2">
              <p>
                <span className="text-slate-500">Médico:</span> {doctorName}
              </p>
              <p>
                <span className="text-slate-500">Turno:</span> {slotLabel}
              </p>
              {needsPayment && receiptFile && (
                <p className="flex items-center gap-1">
                  <span className="text-slate-500">Comprobante:</span>
                  <FileText className="h-3.5 w-3.5" />
                  {receiptFile.name}
                </p>
              )}
              {receiptAudit && (
                <ReceiptValidationCard audit={receiptAudit} title="Verificación del Pago" />
              )}
              {intakeReason.trim() && (
                <p className="text-xs text-slate-600 line-clamp-2">
                  <span className="font-medium">Motivo:</span> {intakeReason}
                </p>
              )}
              {studyFiles.length > 0 && (
                <p className="text-xs text-slate-600">
                  {studyFiles.length} estudio(s) adjunto(s)
                </p>
              )}
            </div>

            {needsPayment && mpReady && !receiptFile && (
              <div className="rounded-lg border border-[#009ee3]/30 bg-sky-50 p-3 text-sm space-y-2">
                <p className="text-sky-900 font-medium">
                  Pagá con Mercado Pago para confirmar al instante
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="w-full bg-[#009ee3] hover:bg-[#008ecf] text-white"
                  disabled={booking}
                  onClick={() => handleFinalConfirm("mercadopago")}
                >
                  <Wallet className="h-4 w-4 mr-1" />
                  Ir a Mercado Pago
                </Button>
              </div>
            )}

            {needsPayment && !receiptAudit?.valid && transferRequired && !receiptFile && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm space-y-2">
                <p className="text-amber-900 font-medium">
                  Falta el comprobante de pago
                </p>
                <p className="text-xs text-amber-800">
                  Este médico exige transferencia antes de confirmar el turno.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="w-full bg-amber-700 hover:bg-amber-800"
                  onClick={goToPaymentStep}
                >
                  <CreditCard className="h-4 w-4 mr-1" />
                  Ir a pagar y subir comprobante
                </Button>
              </div>
            )}

            {needsPayment && receiptAudit && !receiptAudit.valid && receiptFile && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                El comprobante quedará en revisión manual del médico. Podés confirmar el turno igual.
              </p>
            )}

            {needsPayment && receiptFile && (
              <p className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-1.5">
                <FileText className="h-3.5 w-3.5" />
                Comprobante listo: {receiptFile.name}
              </p>
            )}

            <label className="flex items-start gap-2 rounded-md border border-emerald-100 bg-emerald-50/50 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={shareHealthProfile}
                onChange={(e) => setShareHealthProfile(e.target.checked)}
                className="mt-0.5 rounded"
              />
              <span className="text-xs text-slate-700">
                Autorizo a <strong>{doctorName}</strong> a ver mi ficha de salud
                para esta consulta.
              </span>
            </label>

            {validationChecks && (
              <ul className="text-xs space-y-1 rounded-lg border border-red-200 bg-red-50 p-3">
                {Object.entries(validationChecks).map(([key, check]) => (
                  <li
                    key={key}
                    className={`flex items-start gap-1.5 ${check.pass ? "text-emerald-800" : "text-red-800"}`}
                  >
                    {check.pass ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {check.detail}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={goBack} disabled={booking}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={
                  booking ||
                  (needsPayment &&
                    !receiptFile &&
                    !mpReady &&
                    transferRequired)
                }
                onClick={() =>
                  handleFinalConfirm(
                    !needsPayment
                      ? "none"
                      : receiptFile
                        ? "transfer"
                        : mpReady
                          ? "mercadopago"
                          : "transfer",
                  )
                }
              >
                {booking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Confirmar turno"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NavButtons({
  onBack,
  onContinue,
  continueDisabled,
  continueLabel = "Continuar",
}: {
  onBack: () => void;
  onContinue: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
}) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" className="flex-1" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Volver
      </Button>
      <Button
        className="flex-1 bg-blue-700 hover:bg-blue-800"
        disabled={continueDisabled}
        onClick={onContinue}
      >
        {continueLabel}
      </Button>
    </div>
  );
}
