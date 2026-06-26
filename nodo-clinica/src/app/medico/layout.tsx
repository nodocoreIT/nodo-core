import { MedicoAdminLayout } from "@/components/layout/medico-admin-layout";
import { MedicoThemeProvider } from "@/components/providers/medico-theme-provider";

export default function MedicoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MedicoThemeProvider>
      <MedicoAdminLayout>{children}</MedicoAdminLayout>
    </MedicoThemeProvider>
  );
}
