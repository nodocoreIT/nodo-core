import type { LucideIcon } from "lucide-react";
import { LoginNodeLockup } from "@/components/LoginNodeLockup";
import type { NodeAccent } from "@/lib/node-accents";

interface OnboardingNodeHeaderProps {
  nodeCode: string;
  wordmarkSlug: string;
  Icon?: LucideIcon;
  accent: NodeAccent;
}

/** Dark onboarding card header with NODO | {nodo} branding. */
export function OnboardingNodeHeader({
  nodeCode,
  wordmarkSlug,
  Icon,
  accent,
}: OnboardingNodeHeaderProps) {
  return (
    <div className="mb-8 flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {Icon && (
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: `rgba(${accent.rgb}, 0.15)`,
              border: `1px solid rgba(${accent.rgb}, 0.35)`,
              color: accent.brand,
            }}
          >
            <Icon aria-hidden className="h-6 w-6" strokeWidth={1.75} />
          </span>
        )}
        <LoginNodeLockup
          nodeCode={nodeCode}
          wordmarkSlug={wordmarkSlug}
          size="form"
          theme="dark"
        />
      </div>
    </div>
  );
}
