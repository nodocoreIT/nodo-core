import { PacienteAdminLayout } from "@/components/layout/paciente-admin-layout";
import { Suspense } from "react";

function PacienteLayoutFallback() {
  return (
    <div className="flex h-dvh items-center justify-center bg-paper">
      <div
        role="status"
        aria-label="Cargando"
        className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent"
      />
    </div>
  );
}

export default function PacientePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<PacienteLayoutFallback />}>
      <PacienteAdminLayout>{children}</PacienteAdminLayout>
    </Suspense>
  );
}
