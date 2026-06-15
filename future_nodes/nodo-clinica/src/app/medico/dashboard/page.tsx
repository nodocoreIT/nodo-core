import { isLocalMode } from "@/lib/clinic/config";
import { LocalMedicoDashboard } from "@/components/dashboard/local-medico-dashboard";
import { SupabaseMedicoDashboard } from "@/components/dashboard/supabase-medico-dashboard";

export default function MedicoDashboardPage() {
  if (isLocalMode()) {
    return <LocalMedicoDashboard />;
  }
  return <SupabaseMedicoDashboard />;
}
