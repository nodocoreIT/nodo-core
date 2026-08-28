"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, LogIn, MailCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { clinicApi } from "@/lib/clinic/client-api";

type AccessResult = Awaited<ReturnType<typeof clinicApi.getPrescriptionAccess>>;

interface RecetaAccessLandingProps {
  accessToken: string;
}

/** Client-side data fetch + 4-way branch (needs_registration / needs_login /
 * authorized / not_found) for the receta magic-link landing page. See
 * resolvePrescriptionAccess() for the resolution rules this renders. */
export function RecetaAccessLanding({ accessToken }: RecetaAccessLandingProps) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AccessResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    clinicApi
      .getPrescriptionAccess(accessToken)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch(() => {
        if (!cancelled) setResult({ status: "not_found" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {result?.status === "needs_registration" && (
          <Card className="border-teal-100 shadow-sm text-center">
            <CardHeader>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-100">
                <FileText className="h-7 w-7 text-teal-600" />
              </div>
              <CardTitle className="text-lg">
                No tenés cuenta en Nodo Clínica todavía
              </CardTitle>
              <p className="text-sm text-slate-500">
                Creá tu cuenta para ver y pagar tu receta médica.
              </p>
            </CardHeader>
            <CardContent>
              <Link
                href={`/registro/paciente?email=${encodeURIComponent(
                  result.patientEmail,
                )}&fullName=${encodeURIComponent(
                  result.patientFullName ?? "",
                )}&next=${encodeURIComponent(`/paciente/receta/${accessToken}`)}`}
              >
                <Button className="w-full bg-teal-600 hover:bg-teal-700">
                  Crear mi cuenta
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {result?.status === "needs_login" && (
          <Card className="border-teal-100 shadow-sm text-center">
            <CardHeader>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-100">
                <LogIn className="h-7 w-7 text-teal-600" />
              </div>
              <CardTitle className="text-lg">Iniciá sesión para continuar</CardTitle>
              <p className="text-sm text-slate-500">
                Ya tenés una cuenta asociada a esta receta. Ingresá para verla.
              </p>
            </CardHeader>
            <CardContent>
              <Link
                href={`/login?role=paciente&next=${encodeURIComponent(
                  `/paciente/receta/${accessToken}`,
                )}`}
              >
                <Button className="w-full bg-teal-600 hover:bg-teal-700">
                  Iniciar sesión
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {result?.status === "authorized" && (
          <Card className="border-emerald-100 shadow-sm text-center">
            <CardHeader>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <MailCheck className="h-7 w-7 text-emerald-600" />
              </div>
              <CardTitle className="text-lg">Tu receta está lista</CardTitle>
              <p className="text-sm text-slate-500">
                Realizá el pago para acceder al PDF de tu receta médica.
              </p>
            </CardHeader>
            <CardContent>
              {/* El checkout real de Mercado Pago es Fase 4 — placeholder por ahora. */}
              <Button
                className="w-full"
                variant="outline"
                onClick={() => toast.message("Pago disponible pronto")}
              >
                Pagar y ver receta — Próximamente
              </Button>
            </CardContent>
          </Card>
        )}

        {(!result || result.status === "not_found") && (
          <Card className="border-red-200 shadow-sm text-center">
            <CardContent className="pt-6 space-y-3">
              <XCircle className="h-10 w-10 text-red-500 mx-auto" />
              <h2 className="text-lg font-semibold text-slate-800">
                Enlace inválido o expirado
              </h2>
              <p className="text-sm text-slate-600">
                Pedile a tu médico que te reenvíe la receta.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
