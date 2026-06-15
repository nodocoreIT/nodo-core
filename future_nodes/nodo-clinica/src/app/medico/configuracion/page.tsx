import { redirect } from "next/navigation";
import { isLocalMode } from "@/lib/clinic/config";
import { LocalMedicoSettings } from "@/components/dashboard/local-medico-settings";

export default function MedicoConfiguracionPage() {
  if (!isLocalMode()) {
    redirect("/medico/dashboard");
  }
  return <LocalMedicoSettings />;
}
