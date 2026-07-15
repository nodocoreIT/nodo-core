import Image from "next/image";
import { LoginNodeLockup } from "@/components/LoginNodeLockup";
import { LoginNodeDetail } from "@/components/LoginNodeDetail";
import { getNodeBySlug } from "@/lib/nodes";
import { type NodeAccent } from "@/lib/node-accents";
import type { LoginPanelDetails } from "@/lib/login-panel";

const TOP_LOGO_SRC = "/logos/logo compuesto estrella az letra blancazzz.png";

interface LoginBrandPanelProps extends LoginPanelDetails {
  accent: NodeAccent;
  wordmarkSlug?: string;
}

export default function LoginBrandPanel({
  accent,
  activeNodeSlug,
  nodeCode,
  description,
  coreHeadline,
  wordmarkSlug,
}: LoginBrandPanelProps) {
  const isNodePanel = Boolean(nodeCode);
  const detailNode = activeNodeSlug ? getNodeBySlug(activeNodeSlug) : null;
  const NodeIcon = detailNode?.Icon;

  return (
    <aside className="login-brand-panel relative overflow-hidden bg-navy-900 text-white p-12 hidden">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(72% 58% at 38% 42%, rgba(${accent.rgb},.22), transparent 72%)`,
        }}
      />

      <div className="login-brand-top relative z-1">
        <a href="https://www.nodocore.com.ar" target="_blank" rel="noopener noreferrer">
          <Image
            src={TOP_LOGO_SRC}
            alt="NODO"
            width={140}
            height={30}
            style={{ height: "30px", width: "auto" }}
            priority
          />
        </a>
      </div>

      <div className="login-brand-hero relative z-1 flex min-h-0 flex-1 flex-col items-center justify-center py-8">
        {isNodePanel ? (
          <div className="flex flex-wrap items-center justify-center gap-4">
            {NodeIcon && (
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `rgba(${accent.rgb}, 0.15)`,
                  border: `1px solid rgba(${accent.rgb}, 0.35)`,
                  color: accent.brand,
                }}
              >
                <NodeIcon aria-hidden className="h-7 w-7" strokeWidth={1.75} />
              </span>
            )}
            <LoginNodeLockup
              nodeCode={nodeCode!}
              wordmarkSlug={wordmarkSlug ?? activeNodeSlug}
              size="panel"
            />
          </div>
        ) : (
          <h2
            className="max-w-[14em] text-center font-display font-extrabold text-white"
            style={{
              fontSize: "clamp(28px, 2.8vw, 38px)",
              lineHeight: 1.12,
            }}
          >
            {coreHeadline}
          </h2>
        )}
      </div>

      <div className="login-brand-bottom relative z-1 border-t border-white/10 pt-8">
        {isNodePanel ? (
          <LoginNodeDetail description={description} />
        ) : (
          <p
            className="max-w-[34em] text-[14.5px] leading-relaxed"
            style={{ color: "rgba(234,240,247,.72)" }}
          >
            {description}
          </p>
        )}

        <p
          className="mt-8 text-[13px]"
          style={{ color: "rgba(234,240,247,.48)" }}
        >
          © 2026 Nodo Core · Transparencia tecnológica
        </p>
      </div>
    </aside>
  );
}
