import { MedicoAdminLayout } from "@/components/layout/medico-admin-layout";
import { MedicoThemeProvider } from "@/components/providers/medico-theme-provider";
import { Suspense } from "react";

function MedicoLayoutFallback() {
  return (
    <div className="flex h-dvh items-center justify-center bg-paper">
      <div
        role="status"
        aria-label="Cargando"
        className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent"
      />
    </div>
  );
}

export default function MedicoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MedicoThemeProvider>
      <Suspense fallback={<MedicoLayoutFallback />}>
        <MedicoAdminLayout>{children}</MedicoAdminLayout>
      </Suspense>
    </MedicoThemeProvider>
  );
}
