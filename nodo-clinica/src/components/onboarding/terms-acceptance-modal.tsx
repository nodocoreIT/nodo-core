"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { clinicApi } from "@/lib/clinic/client-api";
import { TERMS_CONTENT } from "@/lib/clinic/terms-content";

interface TermsAcceptanceModalProps {
  open: boolean;
  role: "medico" | "paciente";
  token: string;
  fullName: string;
  documentNumber?: string;
  onAccept: () => void;
  onClose: () => void;
}

export function TermsAcceptanceModal({
  open,
  role,
  token,
  fullName,
  documentNumber,
  onAccept,
  onClose,
}: TermsAcceptanceModalProps) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await clinicApi.acceptOnboardingTerms({ token, role, fullName, documentNumber });
      onAccept();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al aceptar los términos.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()} modal>
      <DialogContent
        showCloseButton
        className="grid max-h-[85vh] w-[calc(100%-2rem)] max-w-3xl sm:max-w-3xl grid-rows-[auto_1fr_auto] gap-0 p-0"
      >
        <div className="border-b border-border p-6 pr-10">
          <h2 className="font-heading text-base font-semibold">
            Términos y Condiciones de Uso — Nodo Clínica
          </h2>
        </div>

        <div className="prose prose-sm max-w-none overflow-y-auto px-6 py-4 text-slate-700 prose-headings:text-navy prose-strong:text-navy">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {TERMS_CONTENT}
          </ReactMarkdown>
        </div>

        <div className="flex flex-col gap-3 border-t border-border p-6">
          <label className="flex items-start gap-2 text-sm text-foreground">
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => setChecked(value)}
              className="mt-0.5"
            />
            Acepto los términos y condiciones
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            disabled={!checked || loading}
            onClick={handleConfirm}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
