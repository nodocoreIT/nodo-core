import type { LucideIcon } from "lucide-react";
import { LoginNodeLockup } from "@/components/LoginNodeLockup";
import type { NodeAccent } from "@/lib/node-accents";

interface LoginFormNodeHeaderProps {
  nodeCode: string;
  wordmarkSlug?: string;
  Icon: LucideIcon;
  accent: NodeAccent;
  subtitle: string;
}

/** Right-panel header for node login screens (light background). */
export function LoginFormNodeHeader({
  nodeCode,
  wordmarkSlug,
  Icon,
  accent,
  subtitle,
}: LoginFormNodeHeaderProps) {
  // Bright yellows (high R+G, low B) vanish on white backgrounds.
  const channels = accent.rgb.split(",").map(Number);
  const rVal = channels[0];
  const gVal = channels[1];
  const bVal = channels[2];
  const isLightAccent = rVal > 200 && gVal > 200 && bVal < 100;

  const darkGold = "#b89b00";

  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: isLightAccent
              ? "rgba(184, 155, 0, 0.12)"
              : `rgba(${accent.rgb}, 0.12)`,
            border: `1px solid ${isLightAccent ? "rgba(184, 155, 0, 0.35)" : `rgba(${accent.rgb}, 0.28)`}`,
            color: isLightAccent ? darkGold : accent.brand,
          }}
        >
          <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <LoginNodeLockup
          nodeCode={nodeCode}
          wordmarkSlug={wordmarkSlug}
          size="form"
          theme="light"
        />
      </div>
      <h1 className="font-display text-[26px] font-bold text-ink">Iniciar sesión</h1>
      <p className="mt-1 text-[14.5px] text-slate2">{subtitle}</p>
    </div>
  );
}
