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
const R = 190;           // main orbit radius
const SUB_ORBIT_R = 115; // how far a sub-node sits from its parent
const CORE_R = 46;
const HALO_R = CORE_R + 14;
// Satellite diameter as a fraction of the container width → drives `cqw` sizing
// so the HTML overlay scales exactly like the SVG backdrop.
const SAT_DIAMETER_CQW = 15.5;
const SUB_SAT_DIAMETER_CQW = 12.5; // sub-nodes are slightly smaller

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

  const stroke = dark ? "rgba(222,231,241,.34)" : "rgba(100,120,144,.55)";
  const shadowOpacity = dark ? 0.45 : 0.14;

  // Split into main-orbit nodes and sub-nodes (children of a parent node).
  const mainNodeDefs = resolved.filter((n) => !n.parentSlug);
  const subNodeDefs = resolved.filter((n) => n.parentSlug);
  const mainCount = mainNodeDefs.length;

  const mainPoints = mainNodeDefs.map((node, i) => {
    const angle = ((-90 + (i * 360) / mainCount) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      node,
      cos,
      sin,
      x: CX + R * cos,
      y: CY + R * sin,
      left: `${((CX + R * cos) / W) * 100}%`,
      top: `${((CY + R * sin) / H) * 100}%`,
      isSubNode: false as const,
    };
  });

  // Sub-nodes are placed further along their parent's radial vector.
  const subPoints = subNodeDefs
    .map((node) => {
      const parent = mainPoints.find((p) => p.node.slug === node.parentSlug);
      if (!parent) return null;
      const x = parent.x + parent.cos * SUB_ORBIT_R;
      const y = parent.y + parent.sin * SUB_ORBIT_R;
      return {
        node,
        cos: parent.cos,
        sin: parent.sin,
        x,
        y,
        left: `${(x / W) * 100}%`,
        top: `${(y / H) * 100}%`,
        parent,
        isSubNode: true as const,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  // Slugs of main-orbit nodes that have at least one child.
  const parentSlugs = new Set(subNodeDefs.map((n) => n.parentSlug));

  const activePoint =
    activeNodeSlug
      ? ([...mainPoints, ...subPoints].find((p) => p.node.slug === activeNodeSlug) ?? null)
      : null;

  // Two-hop support: when active is a sub-node, resolve its parent too.
  const activeSubPoint = isLoginPage
    ? (subPoints.find((p) => p.node.slug === activeNodeSlug) ?? null)
    : null;
  const activeParentPoint = activeSubPoint
    ? (mainPoints.find((p) => p.node.slug === activeSubPoint.node.parentSlug) ?? null)
    : null;
  const activeParentSlug = activeParentPoint?.node.slug ?? null;

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

        {/* Lines from Core to main-orbit nodes */}
        {mainPoints.map((p, i) => {
          const isActiveLine =
            p.node.slug === activeNodeSlug || p.node.slug === activeParentSlug;
          return (
            <line
              key={`line-${i}`}
              x1={CX}
              y1={CY}
              x2={p.x}
              y2={p.y}
              stroke={isActiveLine ? "var(--color-brand)" : stroke}
              strokeWidth={isActiveLine ? "2" : "1.5"}
              opacity={p.node.inDevelopment ? 0.35 : 1}
            />
          );
        })}

        {/* Small dashed ring around parent nodes that have children */}
        {mainPoints
          .filter((p) => parentSlugs.has(p.node.slug))
          .map((p) => (
            <circle
              key={`parent-ring-${p.node.code}`}
              cx={p.x}
              cy={p.y}
              r={40}
              fill="none"
              stroke={stroke}
              strokeWidth="1"
              strokeDasharray="2 5"
              opacity={0.5}
            />
          ))}

        {/* Lines from parent to sub-nodes */}
        {subPoints.map((p, i) => (
          <line
            key={`subline-${i}`}
            x1={p.parent.x}
            y1={p.parent.y}
            x2={p.x}
            y2={p.y}
            stroke={p.node.slug === activeNodeSlug ? "var(--color-brand)" : stroke}
            strokeWidth="1.5"
            strokeDasharray="2 5"
            opacity={p.node.inDevelopment ? 0.35 : 0.8}
          />
        ))}

        {activePoint && (
          <>
            {/* Pulse on the active destination node */}
            <circle
              className="ecosystem-core-pulse"
              cx={activePoint.x}
              cy={activePoint.y}
              r={58}
              fill="#DA5A0E"
            />
            {/* Also pulse on parent when active is a sub-node */}
            {activeParentPoint && (
              <circle
                className="ecosystem-core-pulse"
                cx={activeParentPoint.x}
                cy={activeParentPoint.y}
                r={58}
                fill="#DA5A0E"
              />
            )}
            {/* Traveling dot */}
            <circle r="7" fill="var(--color-brand)" style={{ filter: "drop-shadow(0 2px 4px rgba(218,90,14,0.4))" }}>
              {activeParentPoint ? (
                // Two-hop: Core → Parent → Child
                <>
                  <animate
                    attributeName="cx"
                    values={`${CX};${activeParentPoint.x};${activePoint.x}`}
                    keyTimes="0;0.5;1"
                    dur="2.4s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="cy"
                    values={`${CY};${activeParentPoint.y};${activePoint.y}`}
                    keyTimes="0;0.5;1"
                    dur="2.4s"
                    repeatCount="indefinite"
                  />
                </>
              ) : (
                // Direct hop: Core → Node
                <>
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
                </>
              )}
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

      {/* Interactive satellite overlay — main orbit */}
      {mainPoints.map((p) => (
        <Satellite
          key={p.node.code}
          point={p}
          dark={dark}
          interactive={interactive}
          isActive={p.node.slug === activeNodeSlug || p.node.slug === activeParentSlug}
          isLoginPage={isLoginPage}
          diameterCqw={SAT_DIAMETER_CQW}
        />
      ))}

      {/* Sub-nodes (children of a parent node) */}
      {subPoints.map((p) => (
        <Satellite
          key={p.node.code}
          point={p}
          dark={dark}
          interactive={interactive}
          isActive={p.node.slug === activeNodeSlug}
          isLoginPage={isLoginPage}
          diameterCqw={SUB_SAT_DIAMETER_CQW}
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
  /** SVG x coordinate — used to determine tooltip direction. */
  x: number;
  left: string;
  top: string;
}

function Satellite({
  point,
  dark,
  interactive,
  isActive,
  isLoginPage,
  diameterCqw = SAT_DIAMETER_CQW,
}: {
  point: SatellitePoint;
  dark: boolean;
  interactive: boolean;
  isActive: boolean;
  isLoginPage: boolean;
  diameterCqw?: number;
}) {
  const { node, cos, sin, x, left, top } = point;
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
        width: `${diameterCqw}cqw`,
        height: `${diameterCqw}cqw`,
        boxShadow: dark
          ? "0 4px 12px rgba(0,0,0,.35)"
          : "0 4px 12px rgba(27,42,65,.14)",
      }}
    >
      <Icon
        aria-hidden="true"
        style={{ width: `${(diameterCqw / SAT_DIAMETER_CQW) * 4.4}cqw`, height: `${(diameterCqw / SAT_DIAMETER_CQW) * 4.4}cqw` }}
        strokeWidth={1.75}
      />
      <span className="font-semibold leading-none" style={{ fontSize: `${(diameterCqw / SAT_DIAMETER_CQW) * 2.5}cqw` }}>
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

  // Tooltip sits beside the node, pushed into open space.
  // Direction is based on the node's actual x position relative to the SVG
  // centre (CX). Sub-nodes on the left edge would clip if we sent the tooltip
  // further left, so we always push toward the spacious side.
  const tipGap = diameterCqw / 2 + 2.5; // cqw from node center to tooltip edge
  const tipY = `calc(-50% + ${(sin * 9).toFixed(2)}cqw)`;
  const tipOnRight = x >= CX; // right half → tooltip to the right
  const tipTransform = tipOnRight
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
