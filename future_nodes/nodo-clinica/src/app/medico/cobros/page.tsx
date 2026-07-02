import { isLocalMode } from "@/lib/clinic/config";
import { LocalMedicoCobros } from "@/components/dashboard/local-medico-cobros";
import { redirect } from "next/navigation";

export default function MedicoCobrosPage() {
  if (!isLocalMode()) {
    redirect("/medico/dashboard");
  }
  return <LocalMedicoCobros />;
}
