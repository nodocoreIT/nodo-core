import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isLocalMode } from "@/lib/clinic/config";
import { LocalMedicoSettings } from "@/components/dashboard/local-medico-settings";
import { Loader2 } from "lucide-react";

function SettingsFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-brand" />
    </div>
  );
}

export default function MedicoConfiguracionPage() {
  if (!isLocalMode()) {
    redirect("/medico/dashboard");
  }
  return (
    <Suspense fallback={<SettingsFallback />}>
      <LocalMedicoSettings />
    </Suspense>
  );
}
