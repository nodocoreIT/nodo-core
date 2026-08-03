"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Stethoscope, User, Loader2 } from "lucide-react";
import { clinicApi } from "@/lib/clinic/client-api";

interface RoleSwitcherProps {
  currentRole: "doctor" | "patient";
  canSwitchToOther: boolean;
  disabled?: boolean;
  onDisabledClick?: () => void;
}

const OTHER_ROLE_META = {
  doctor: { label: "Ver como médico", Icon: Stethoscope, path: "/medico/dashboard" },
  patient: { label: "Ver como paciente", Icon: User, path: "/paciente" },
};

/** Shown only for dual patient+doctor accounts — flips the active portal role. */
export function RoleSwitcher({
  currentRole,
  canSwitchToOther,
  disabled = false,
  onDisabledClick,
}: RoleSwitcherProps) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  if (!canSwitchToOther) return null;

  const otherRole = currentRole === "doctor" ? "patient" : "doctor";
  const meta = OTHER_ROLE_META[otherRole];

  async function handleSwitch() {
    if (disabled) {
      onDisabledClick?.();
      return;
    }
    setSwitching(true);
    try {
      await clinicApi.switchRole(otherRole);
      router.replace(meta.path);
      router.refresh();
    } catch {
      setSwitching(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleSwitch()}
      disabled={switching || disabled}
      className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60"
    >
      {switching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <meta.Icon className="h-3.5 w-3.5" />}
      {switching ? "Cambiando…" : meta.label}
    </button>
  );
}
