"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { clinicApi } from "@/lib/clinic/client-api";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

export function ResendButton({ appointmentId }: { appointmentId: string }) {
  const [loading, setLoading] = useState(false);

  const handleResend = async () => {
    setLoading(true);
    try {
      const result = await clinicApi.resendAppointmentConfirmation({ appointmentId });
      toast.success(result.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2"
      disabled={loading}
      onClick={handleResend}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Mail className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
