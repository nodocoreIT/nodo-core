"use client";

import { Command } from "lucide-react";

export default function CommandPaletteHint() {
  return (
    <p
      className="mt-8 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium uppercase tracking-[.14em]"
      style={{
        color: "rgba(234,240,247,.45)",
        border: "1px solid rgba(255,255,255,.08)",
        backgroundColor: "rgba(255,255,255,.03)",
      }}
    >
      <Command aria-hidden style={{ width: 13, height: 13 }} />
      Presioná <span className="text-white/70">Ctrl + K</span> para buscar
    </p>
  );
}
