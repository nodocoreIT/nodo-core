import { PacienteAdminLayout } from "@/components/layout/paciente-admin-layout";

export default function PacientePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PacienteAdminLayout>{children}</PacienteAdminLayout>;
}
