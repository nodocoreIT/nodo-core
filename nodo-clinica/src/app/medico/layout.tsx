import { MedicoAdminLayout } from "@/components/layout/medico-admin-layout";

export default function MedicoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MedicoAdminLayout>{children}</MedicoAdminLayout>;
}
