import { getNodoLogoSrc } from "@/lib/node-accents";

interface LoginNodeLockupProps {
  nodeCode: string;
  /** Slug used to pick the colored NODO wordmark PNG. */
  wordmarkSlug?: string;
  size?: "panel" | "form";
  /** Panel = dark left sidebar. Form = light login form. */
  theme?: "dark" | "light";
}

export function LoginNodeLockup({
  nodeCode,
  wordmarkSlug,
  size = "panel",
  theme = "dark",
}: LoginNodeLockupProps) {
  const wordmarkSrc = getNodoLogoSrc(wordmarkSlug ?? nodeCode);
  const titleSize =
    size === "panel" ? "clamp(30px, 3vw, 40px)" : "clamp(22px, 2.4vw, 28px)";
  const wordmarkHeight =
    size === "panel" ? "clamp(30px, 3vw, 40px)" : "clamp(22px, 2.4vw, 28px)";
  const codeClass =
    theme === "dark" ? "text-white" : "text-ink";
  const sepClass =
    theme === "dark" ? "text-white/30" : "text-slate2/70";

  return (
    <div className="flex items-center gap-[0.4em] flex-wrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={wordmarkSrc}
        alt="NODO"
        className="inline-block shrink-0"
        style={{ height: wordmarkHeight, width: "auto" }}
      />
      <span
        aria-hidden
        className={`font-light leading-none ${sepClass}`}
        style={{ fontSize: titleSize }}
      >
        |
      </span>
      <span
        className={`font-display font-extrabold ${codeClass}`}
        style={{ fontSize: titleSize, lineHeight: 1.1 }}
      >
        {nodeCode}
      </span>
    </div>
  );
}
