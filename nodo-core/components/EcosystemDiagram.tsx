"use client";

import Link from "next/link";
import { NODES, type NodeDef } from "@/lib/nodes";

interface EcosystemDiagramProps {
  dark?: boolean;
  /** Optional subset/ordering by code. Defaults to the full catalog. */
  units?: { code: string }[];
  /** When true, satellites become links with hover detail and navigation. */
  interactive?: boolean;
  className?: string;
  activeNodeSlug?: string;
  /** Custom behavior when rendered on the login page. */
  isLoginPage?: boolean;
}

// ─── Geometry (SVG view-box space) ──────────────────────────────────────────
const W = 520;
const H = 520;
const CX = W / 2;
const CY = H / 2;
const R = 190; // orbit radius
const CORE_R = 46;
const HALO_R = CORE_R + 14;
// Satellite diameter as a fraction of the container width → drives `cqw` sizing
// so the HTML overlay scales exactly like the SVG backdrop.
const SAT_DIAMETER_CQW = 15.5;

export default function EcosystemDiagram({
  dark = false,
  units,
  interactive = false,
  className = "",
  activeNodeSlug,
  isLoginPage = false,
}: EcosystemDiagramProps) {
  const resolved: NodeDef[] = units
    ? units
        .map((u) => NODES.find((n) => n.code === u.code))
        .filter((n): n is NodeDef => Boolean(n))
    : NODES;

  const n = resolved.length;

  const stroke = dark ? "rgba(222,231,241,.34)" : "rgba(100,120,144,.55)";
  const shadowOpacity = dark ? 0.45 : 0.14;

  const points = resolved.map((node, i) => {
    const angle = ((-90 + (i * 360) / n) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      node,
      cos,
      sin,
      x: CX + R * cos,
      y: CY + R * sin,
      // Percentage position for the HTML overlay.
      left: `${((CX + R * cos) / W) * 100}%`,
      top: `${((CY + R * sin) / H) * 100}%`,
    };
  });

  const activePoint = activeNodeSlug
    ? points.find((p) => p.node.slug === activeNodeSlug)
    : null;

  return (
    <div
      className={`relative ${className}`}
      style={{ containerType: "inline-size" }}
    >
      {/* Static backdrop: orbit ring, connectors and core */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 h-full w-full"
        style={{ overflow: "visible" }}
        aria-hidden="true"
      >
        <defs>
          <filter id="nodoShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow
              dx="0"
              dy="4"
              stdDeviation="6"
              floodColor="#1B2A41"
              floodOpacity={shadowOpacity}
            />
          </filter>
        </defs>

        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={stroke}
          strokeDasharray="2 7"
          strokeWidth="1.5"
        />

        {points.map((p, i) => (
          <line
            key={`line-${i}`}
            x1={CX}
            y1={CY}
            x2={p.x}
            y2={p.y}
            stroke={p.node.slug === activeNodeSlug ? "var(--color-brand)" : stroke}
            strokeWidth={p.node.slug === activeNodeSlug ? "2" : "1.5"}
            opacity={p.node.inDevelopment ? 0.35 : 1}
          />
        ))}

        {activePoint && (
          <>
            <circle
              className="ecosystem-core-pulse"
              cx={activePoint.x}
              cy={activePoint.y}
              r={58}
              fill="#DA5A0E"
            />
            <circle r="7" fill="var(--color-brand)" style={{ filter: "drop-shadow(0 2px 4px rgba(218,90,14,0.4))" }}>
              <animate
                attributeName="cx"
                from={CX}
                to={activePoint.x}
                dur="1.8s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="cy"
                from={CY}
                to={activePoint.y}
                dur="1.8s"
                repeatCount="indefinite"
              />
            </circle>
          </>
        )}

        <circle
          className="ecosystem-core-pulse"
          cx={CX}
          cy={CY}
          r={HALO_R}
          fill="#DA5A0E"
        />
        <circle cx={CX} cy={CY} r={CORE_R} fill="#DA5A0E" />
        <text
          x={CX}
          y={CY + 6}
          textAnchor="middle"
          fill="#fff"
          fontFamily="var(--font-display)"
          fontSize="19"
          fontWeight="700"
        >
          Core
        </text>
      </svg>

      {/* Interactive satellite overlay */}
      {points.map((p) => (
        <Satellite
          key={p.node.code}
          point={p}
          dark={dark}
          interactive={interactive}
          isActive={p.node.slug === activeNodeSlug}
          isLoginPage={isLoginPage}
        />
      ))}
    </div>
  );
}

// ─── Satellite ─────────────────────────────────────────────────────────────

interface SatellitePoint {
  node: NodeDef;
  cos: number;
  sin: number;
  left: string;
  top: string;
}

function Satellite({
  point,
  dark,
  interactive,
  isActive,
  isLoginPage,
}: {
  point: SatellitePoint;
  dark: boolean;
  interactive: boolean;
  isActive: boolean;
  isLoginPage: boolean;
}) {
  const { node, cos, sin, left, top } = point;
  const { Icon } = node;

  const circleClasses = [
    "flex flex-col items-center justify-center gap-[1.2cqw] rounded-full text-center",
    "border transition-all duration-200 ease-out",
    isActive
      ? "bg-navy-700 border-brand text-white shadow-[0_0_12px_rgba(218,90,14,0.4)]"
      : dark
        ? "bg-navy-700 border-[rgba(222,231,241,.55)] text-[#DEE7F1]"
        : "bg-white border-[#C6D3E2] text-navy",
    interactive && !node.inDevelopment ? "group-hover:scale-[1.18] group-focus-visible:scale-[1.18]" : "",
    node.inDevelopment ? "opacity-35 grayscale" : "",
  ].join(" ");

  const circle = (
    <span
      className={circleClasses}
      style={{
        width: `${SAT_DIAMETER_CQW}cqw`,
        height: `${SAT_DIAMETER_CQW}cqw`,
        boxShadow: dark
          ? "0 4px 12px rgba(0,0,0,.35)"
          : "0 4px 12px rgba(27,42,65,.14)",
      }}
    >
      <Icon
        aria-hidden="true"
        style={{ width: "4.4cqw", height: "4.4cqw" }}
        strokeWidth={1.75}
      />
      <span className="font-semibold leading-none" style={{ fontSize: "2.5cqw" }}>
        {node.code}
      </span>
    </span>
  );

  // Decorative mode: plain node, no link, no hover detail.
  if (!interactive) {
    return (
      <span
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left, top }}
      >
        {circle}
      </span>
    );
  }

  // Tooltip sits beside the node, pushed outward (away from the diagram center)
  // into open space so it never overlaps the node or its neighbours.
  // Right-half nodes get it on their right, left-half nodes on their left.
  // It's also nudged vertically along the node's radial direction so the
  // top/bottom nodes clear their diagonal neighbours.
  const tipGap = SAT_DIAMETER_CQW / 2 + 2.5; // cqw from node center to tooltip edge
  const tipY = `calc(-50% + ${(sin * 9).toFixed(2)}cqw)`;
  const tipTransform =
    cos >= 0
      ? `translate(${tipGap.toFixed(2)}cqw, ${tipY})`
      : `translate(calc(-100% - ${tipGap.toFixed(2)}cqw), ${tipY})`;

  // If node is in development, it's not clickable.
  if (node.inDevelopment) {
    return (
      <div
        className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-not-allowed outline-none"
        style={{ left, top }}
      >
        {circle}
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[140px] rounded-lg border border-white/10 bg-navy-900/95 px-3 py-2 text-center opacity-0 shadow-xl backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100"
          style={{ transform: tipTransform }}
        >
          <span className="block text-[12px] font-bold text-brand-300">
            {node.label}
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-white/60">
            En desarrollo
          </span>
        </span>
      </div>
    );
  }

  // Determine link href and tooltip contents
  let href = `/nodo-${node.slug}`;
  let tooltipTitle = node.label;
  let tooltipDesc = node.description;

  if (isLoginPage) {
    // On login page, switch portals using new dynamic routing
    const loginSlug = node.slug === "salud" ? "nodo-clinica" : `nodo-${node.slug}`;
    href = `/${loginSlug}/login`;
    tooltipDesc = `Ir a ${node.label.toLowerCase()}`;
  }

  return (
    <Link
      href={href}
      aria-label={`${node.label}: ${node.description}`}
      prefetch
      className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 outline-none"
      style={{ left, top }}
    >
      {circle}

      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[170px] rounded-lg border border-white/10 bg-navy-900/95 px-3 py-2 text-left opacity-0 shadow-xl backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
        style={{ transform: tipTransform }}
      >
        <span className="block text-[12px] font-bold text-brand-300">
          {tooltipTitle}
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-white/80">
          {tooltipDesc}
        </span>
      </span>
    </Link>
  );
}
