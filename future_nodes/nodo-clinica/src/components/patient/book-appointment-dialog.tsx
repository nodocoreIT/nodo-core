"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type WizardStep = "slot" | "payment" | "intake" | "studies" | "confirm";

function requiresPaymentStep(payment?: PaymentInfo): boolean {
  return payment?.requirePaymentBeforeBooking !== false;
}

function usesMercadoPago(payment?: PaymentInfo): boolean {
  return !!(
    payment?.mercadopagoEnabled && (payment.consultationFee ?? 0) > 0
  );
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
}: {
  steps: WizardStep[];
  current: WizardStep;
}) {
  const idx = steps.indexOf(current);
  return (
    <div className="flex items-center gap-1 mb-1">
      {steps.map((s, i) => (
        <div key={s} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className={`h-1.5 w-full rounded-full ${
              i <= idx ? "bg-emerald-500" : "bg-slate-200"
            }`}
          />
          <span
            className={`text-[9px] hidden sm:block ${
              i === idx ? "text-emerald-700 font-medium" : "text-slate-400"
            }`}
          >
            {STEP_LABELS[s]}
          </span>
        </div>
      ))}
    </div>
  );
}

export function BookAppointmentDialog({
  doctorId,
  doctorName,
  payment,
  open,
  onOpenChange,
}: BookAppointmentDialogProps) {
  const [step, setStep] = useState<WizardStep>("slot");
  const [dates, setDates] = useState<{ date: string; label: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ iso: string; label: string }[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

  const needsPayment = requiresPaymentStep(payment);
  const mpEnabled = usesMercadoPago(payment);

  const steps = useMemo((): WizardStep[] => {
    if (needsPayment) {
      return ["slot", "payment", "intake", "studies", "confirm"];
    }
    return ["slot", "intake", "studies", "confirm"];
  }, [needsPayment]);

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
    recognitionRef.current?.stop();
  };

  useEffect(() => {
    if (!open) return;
    resetWizard();
    setLoading(true);
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

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  const slotLabel =
    selectedSlot &&
    format(parseISO(selectedSlot), "EEEE dd/MM 'a las' HH:mm", { locale: es });

  const goBack = () => {
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
  };

  const goNext = () => {
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) setStep(steps[idx + 1]);
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
    if (!selectedSlot) return;
    goNext();
  };

  const handleContinueFromPayment = () => {
    if (needsPayment && !receiptFile) {
      toast.error("Subí el comprobante de transferencia para continuar");
      return;
    }
    goNext();
  };

  const handleFinalConfirm = async (
    mode: "none" | "transfer" | "mercadopago",
  ) => {
    if (!selectedSlot) return;
    if (mode === "transfer" && needsPayment && !receiptFile) {
      toast.error("Falta el comprobante de pago");
      setStep("payment");
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

      toast.success("Turno confirmado. Te esperamos en la sala virtual.");
      onOpenChange(false);
      window.location.assign(result.waitingRoomUrl);
    } catch (e) {
      const err = e as Error & { checks?: ReceiptChecks };
      if (err.checks) {
        setValidationChecks(err.checks);
        setStep("payment");
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <WizardProgress steps={steps} current={step} />
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
              {loading && dates.length === 0 ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : dates.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-lg">
                  No hay turnos disponibles.
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
                  Horario —{" "}
                  {format(parseLocalDate(selectedDate), "dd MMM yyyy", {
                    locale: es,
                  })}
                </p>
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
                ) : slots.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">
                    Sin horarios este día
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

            <Button
              className="w-full bg-blue-700 hover:bg-blue-800"
              disabled={!selectedSlot}
              onClick={handleContinueFromSlot}
            >
              Continuar
            </Button>
          </div>
        )}

        {step === "payment" && (
          <div className="space-y-4">
            <ConsultationPaymentPanel doctorName={doctorName} payment={payment} />

            {mpEnabled && (
              <>
                <Button
                  className="w-full bg-[#009ee3] hover:bg-[#008ecf] text-white"
                  disabled={booking}
                  onClick={() => handleFinalConfirm("mercadopago")}
                >
                  {booking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Wallet className="h-4 w-4 mr-2" />
                      Pagar con Mercado Pago y confirmar
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-slate-400">
                  — o transferencia manual —
                </p>
              </>
            )}

            <div className="rounded-lg border border-dashed border-violet-200 bg-violet-50/40 p-3 space-y-2">
              <p className="text-xs font-medium text-violet-900">
                Subí el ticket / comprobante de transferencia
              </p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg,application/pdf"
                className="text-xs w-full"
                onChange={(e) => {
                  setReceiptFile(e.target.files?.[0] ?? null);
                  setValidationChecks(null);
                }}
              />
              {receiptFile && (
                <p className="text-[11px] text-slate-600 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {receiptFile.name}
                </p>
              )}
              <p className="text-[10px] text-slate-500">
                Validamos monto, alias del médico y coherencia con el turno al
                confirmar.
              </p>
            </div>

            <NavButtons
              onBack={goBack}
              onContinue={handleContinueFromPayment}
              continueDisabled={!receiptFile}
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
                disabled={booking}
                onClick={() =>
                  handleFinalConfirm(needsPayment ? "transfer" : "none")
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
