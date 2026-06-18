import { StaffAdminLayout } from "@/components/layout/staff-admin-layout";

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StaffAdminLayout>{children}</StaffAdminLayout>;
}
