"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { NODES, getLoginHrefForNode, type NodeDef } from "@/lib/nodes";

interface EcosystemDiagramProps {
  dark?: boolean;
  units?: { code: string }[];
  interactive?: boolean;
  className?: string;
  activeNodeSlug?: string;
  isLoginPage?: boolean;
}

const W = 600;
const H = 600;
const CX = W / 2;
const CY = H / 2;
const R = 190;
const SUB_ORBIT_R = 145;
const CORE_R = 46;
const HALO_R = CORE_R + 14;
const SAT_DIAMETER_CQW = 15.5;
const SUB_SAT_DIAMETER_CQW = 12.5;
/** Angular spread (degrees) between siblings sharing the same parent. */
const SIBLING_SPREAD_DEG = 75;
/** Node radii in SVG units — used to trim lines to circle edges. */
const SAT_R_SVG     = (SAT_DIAMETER_CQW     / 200) * W; // ~40
const SUB_SAT_R_SVG = (SUB_SAT_DIAMETER_CQW / 200) * W; // ~32.5
/** Travel speed for pulse dots (SVG units/s). Core→orbit ≈ 1s. */
const TRAVEL_SPEED = 190;

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function travelDur(from: { x: number; y: number }, to: { x: number; y: number }) {
  return dist(from, to) / TRAVEL_SPEED;
}

/** Build keyTimes string for SMIL values aligned to a repeating cycle. */
function kt(t: number, cycleDur: number) {
  return (t / cycleDur).toFixed(4);
}

const ACTIVE_TWO_LEG_DUR = 2.4;
const ACTIVE_ONE_LEG_DUR = 1.8;

export default function EcosystemDiagram({
  dark = false,
  units,
  interactive = false,
  className = "",
  activeNodeSlug,
  isLoginPage = false,
}: EcosystemDiagramProps) {
  const [hoveredParentSlug, setHoveredParentSlug] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHoverChange = (hovered: boolean, slug: string) => {
    if (hovered) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setHoveredParentSlug(slug);
    } else {
      hideTimer.current = setTimeout(() => setHoveredParentSlug(null), 2000);
    }
  };

  const resolved: NodeDef[] = units
    ? units.map((u) => NODES.find((n) => n.code === u.code)).filter((n): n is NodeDef => Boolean(n))
    : NODES;

  const stroke = dark ? "rgba(222,231,241,.34)" : "rgba(100,120,144,.55)";
  const shadowOpacity = dark ? 0.45 : 0.14;

  const mainNodeDefs = resolved.filter((n) => !n.parentSlug);
  const subNodeDefs   = resolved.filter((n) =>  n.parentSlug);
  const mainCount = mainNodeDefs.length;

  const mainPoints = mainNodeDefs.map((node, i) => {
    const angle = ((-90 + (i * 360) / mainCount) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      node, cos, sin,
      x: CX + R * cos,
      y: CY + R * sin,
      left: `${((CX + R * cos) / W) * 100}%`,
      top:  `${((CY + R * sin) / H) * 100}%`,
    };
  });

  // Fan sub-nodes so siblings never overlap.
  const subPoints = subNodeDefs
    .map((node) => {
      const parent = mainPoints.find((p) => p.node.slug === node.parentSlug);
      if (!parent) return null;

      const siblings     = subNodeDefs.filter((n) => n.parentSlug === node.parentSlug);
      const siblingCount = siblings.length;
      const siblingIndex = siblings.indexOf(node);

      // Spread symmetrically around the parent's radial angle.
      const parentAngle  = Math.atan2(parent.sin, parent.cos);
      const totalSpread  = SIBLING_SPREAD_DEG * (siblingCount - 1) * (Math.PI / 180);
      const angleOffset  = siblingCount > 1
        ? (siblingIndex / (siblingCount - 1) - 0.5) * totalSpread
        : 0;
      const childAngle = parentAngle + angleOffset;
      const cos = Math.cos(childAngle);
      const sin = Math.sin(childAngle);
      const x = parent.x + cos * SUB_ORBIT_R;
      const y = parent.y + sin * SUB_ORBIT_R;

      return {
        node, cos, sin, x, y,
        left: `${(x / W) * 100}%`,
        top:  `${(y / H) * 100}%`,
        parent,
        siblingIndex,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const parentSlugs = new Set(subNodeDefs.map((n) => n.parentSlug));

  const activePoint = activeNodeSlug
    ? ([...mainPoints, ...subPoints].find((p) => p.node.slug === activeNodeSlug) ?? null)
    : null;

  const activeSubPoint    = isLoginPage ? (subPoints.find((p) => p.node.slug === activeNodeSlug) ?? null) : null;
  const activeParentPoint = activeSubPoint
    ? (mainPoints.find((p) => p.node.slug === activeSubPoint.node.parentSlug) ?? null)
    : null;
  const activeParentSlug  = activeParentPoint?.node.slug ?? null;

  // Sub-nodes visible only on hover (unless login page or decorative).
  const shouldShowSub = (parentSlug: string | undefined) =>
    isLoginPage || !interactive || hoveredParentSlug === parentSlug;

  const hoveredParentPoint = hoveredParentSlug
    ? (mainPoints.find((p) => p.node.slug === hoveredParentSlug) ?? null)
    : null;
  const hoveredChildren = hoveredParentPoint
    ? subPoints.filter((p) => p.node.parentSlug === hoveredParentSlug)
    : [];
  const showPulse = Boolean(hoveredParentPoint && (isLoginPage || interactive));
  const coreFrom = { x: CX, y: CY };
  const coreToParentDur = hoveredParentPoint
    ? travelDur(coreFrom, { x: hoveredParentPoint.x, y: hoveredParentPoint.y })
    : 0;
  const childTravelDurs = hoveredChildren.map((c) =>
    travelDur({ x: hoveredParentPoint!.x, y: hoveredParentPoint!.y }, { x: c.x, y: c.y }),
  );
  const maxChildDur = childTravelDurs.length ? Math.max(...childTravelDurs) : 0;
  const pulseCycleDur = coreToParentDur + maxChildDur;

  return (
    <div className={`relative ${className}`} style={{ containerType: "inline-size" }}>
      {/* ── SVG backdrop ─────────────────────────────────────────────────── */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 h-full w-full"
        style={{ overflow: "visible" }}
        aria-hidden="true"
      >
        <defs>
          <filter id="nodoShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#1B2A41" floodOpacity={shadowOpacity} />
          </filter>
        </defs>

        {/* Orbit ring */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={stroke} strokeDasharray="2 7" strokeWidth="1.5" />

        {/* Core → main-orbit lines */}
        {mainPoints.map((p, i) => {
          const isActiveLine = p.node.slug === activeNodeSlug || p.node.slug === activeParentSlug;
          const isParentHovered = showPulse && hoveredParentSlug === p.node.slug;
          const isHighlighted = isActiveLine || isParentHovered;
          return (
            <line
              key={`line-${i}`}
              x1={CX}
              y1={CY}
              x2={p.x}
              y2={p.y}
              stroke={isHighlighted ? "var(--color-brand)" : stroke}
              strokeWidth={isHighlighted ? "2" : "1.5"}
              opacity={p.node.inDevelopment ? 0.35 : 1}
              style={
                isHighlighted
                  ? { filter: "drop-shadow(0 0 3px var(--brand-glow-strong))" }
                  : undefined
              }
            />
          );
        })}

        {/* Dashed ring hint around parents */}
        {mainPoints.filter((p) => parentSlugs.has(p.node.slug)).map((p) => (
          <circle
            key={`parent-ring-${p.node.code}`}
            cx={p.x} cy={p.y} r={SAT_R_SVG}
            fill="none" stroke={stroke} strokeWidth="1" strokeDasharray="2 5" opacity={0.5}
          />
        ))}

        {/* Parent → sub-node lines */}
        {subPoints.map((p, i) => {
          const visible = shouldShowSub(p.node.parentSlug);
          const isActiveSubLine = p.node.slug === activeNodeSlug;
          const isHoveredSubLine = showPulse && p.node.parentSlug === hoveredParentSlug;
          const isHighlighted = isActiveSubLine || isHoveredSubLine;
          const baseColor = dark ? "rgba(222,231,241,.3)" : "rgba(100,120,144,.4)";
          return (
            <line
              key={`subline-${i}`}
              x1={p.parent.x}
              y1={p.parent.y}
              x2={p.x}
              y2={p.y}
              stroke={isHighlighted ? "var(--color-brand)" : baseColor}
              strokeWidth={isHighlighted ? "2" : "1.5"}
              style={{
                opacity: visible ? (p.node.inDevelopment ? 0.4 : 1) : 0,
                transition: `opacity 0.3s ease ${p.siblingIndex * 80}ms`,
                filter: isHighlighted ? "drop-shadow(0 0 3px var(--brand-glow-strong))" : undefined,
              }}
            />
          );
        })}

        {/* Pulse: Core → parent, then parent → each child (distance-timed) */}
        {showPulse && hoveredParentPoint && pulseCycleDur > 0 && (
          <>
            {hoveredChildren.length > 0 && (
              <circle cx={hoveredParentPoint.x} cy={hoveredParentPoint.y}
                r={SAT_R_SVG} fill="none" stroke="var(--color-brand)" strokeWidth="2" opacity="0"
              >
                <animate attributeName="r"
                  from={SAT_R_SVG} to={SAT_R_SVG + 22}
                  dur="0.45s"
                  begin={`${coreToParentDur}s`}
                  repeatCount="indefinite" />
                <animate attributeName="opacity"
                  values="0;0.75;0" keyTimes="0;0.15;1"
                  dur="0.45s"
                  begin={`${coreToParentDur}s`}
                  repeatCount="indefinite" />
              </circle>
            )}

            <circle r="6" fill="var(--color-brand)"
              style={{ filter: "drop-shadow(0 0 8px var(--brand-glow-strong))" }}
            >
              <animate attributeName="cx"
                values={`${CX};${hoveredParentPoint.x};${hoveredParentPoint.x}`}
                keyTimes={`0;${kt(coreToParentDur, pulseCycleDur)};1`}
                dur={`${pulseCycleDur}s`} repeatCount="indefinite" />
              <animate attributeName="cy"
                values={`${CY};${hoveredParentPoint.y};${hoveredParentPoint.y}`}
                keyTimes={`0;${kt(coreToParentDur, pulseCycleDur)};1`}
                dur={`${pulseCycleDur}s`} repeatCount="indefinite" />
              <animate attributeName="opacity"
                values={`1;1;0;0`}
                keyTimes={`0;${kt(coreToParentDur * 0.88, pulseCycleDur)};${kt(coreToParentDur, pulseCycleDur)};1`}
                dur={`${pulseCycleDur}s`} repeatCount="indefinite" />
            </circle>

            {hoveredChildren.map((child, idx) => {
              const childDur = childTravelDurs[idx];
              const arrive = coreToParentDur + childDur;
              const tDepart = kt(coreToParentDur, pulseCycleDur);
              const tArrive = kt(arrive, pulseCycleDur);
              const tFade   = kt(arrive * 0.88, pulseCycleDur);
              const tShow   = kt(coreToParentDur + 0.001, pulseCycleDur);
              return (
                <circle key={`pulse-${child.node.code}`} r="5" fill="var(--color-brand)"
                  style={{ filter: "drop-shadow(0 0 6px var(--brand-glow-strong))" }}
                >
                  <animate attributeName="cx"
                    values={`${hoveredParentPoint.x};${hoveredParentPoint.x};${child.x};${child.x}`}
                    keyTimes={`0;${tDepart};${tArrive};1`}
                    dur={`${pulseCycleDur}s`} repeatCount="indefinite" />
                  <animate attributeName="cy"
                    values={`${hoveredParentPoint.y};${hoveredParentPoint.y};${child.y};${child.y}`}
                    keyTimes={`0;${tDepart};${tArrive};1`}
                    dur={`${pulseCycleDur}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity"
                    values={`0;0;1;1;0;0`}
                    keyTimes={`0;${tDepart};${tShow};${tFade};${tArrive};1`}
                    dur={`${pulseCycleDur}s`} repeatCount="indefinite" />
                </circle>
              );
            })}
          </>
        )}

        {/* Active node pulse + traveling dot (login page / activeNodeSlug) */}
        {activePoint && (
          <>
            <circle className="ecosystem-core-pulse" cx={activePoint.x} cy={activePoint.y} r={58} fill="var(--color-brand)" />
            {activeParentPoint && (
              <circle className="ecosystem-core-pulse" cx={activeParentPoint.x} cy={activeParentPoint.y} r={58} fill="var(--color-brand)" />
            )}
            <circle r="7" fill="var(--color-brand)" style={{ filter: "drop-shadow(0 2px 4px var(--brand-glow))" }}>
              {activeParentPoint ? (
                <>
                  <animate attributeName="cx" values={`${CX};${activeParentPoint.x};${activePoint.x}`} keyTimes="0;0.5;1" dur={`${ACTIVE_TWO_LEG_DUR}s`} repeatCount="indefinite" />
                  <animate attributeName="cy" values={`${CY};${activeParentPoint.y};${activePoint.y}`} keyTimes="0;0.5;1" dur={`${ACTIVE_TWO_LEG_DUR}s`} repeatCount="indefinite" />
                </>
              ) : (
                <>
                  <animate attributeName="cx" values={`${CX};${activePoint.x};${CX}`} keyTimes="0;0.95;1" dur={`${ACTIVE_ONE_LEG_DUR}s`} repeatCount="indefinite" />
                  <animate attributeName="cy" values={`${CY};${activePoint.y};${CY}`} keyTimes="0;0.95;1" dur={`${ACTIVE_ONE_LEG_DUR}s`} repeatCount="indefinite" />
                </>
              )}
            </circle>
          </>
        )}

        {/* Core */}
        <circle className="ecosystem-core-pulse" cx={CX} cy={CY} r={HALO_R} fill="var(--color-brand)" />
        <circle cx={CX} cy={CY} r={CORE_R} fill="var(--color-brand)" />
        <text x={CX} y={CY + 6} textAnchor="middle" fill="#fff" fontFamily="var(--font-display)" fontSize="19" fontWeight="700">
          Core
        </text>
      </svg>

      {/* ── HTML overlays ─────────────────────────────────────────────────── */}

      {/* Main orbit */}
      {mainPoints.map((p) => (
        <Satellite
          key={p.node.code}
          point={p}
          dark={dark}
          interactive={interactive}
          isActive={p.node.slug === activeNodeSlug || p.node.slug === activeParentSlug}
          isLoginPage={isLoginPage}
          diameterCqw={SAT_DIAMETER_CQW}
          onHoverChange={
            interactive && !isLoginPage && parentSlugs.has(p.node.slug)
              ? (hovered) => handleHoverChange(hovered, p.node.slug)
              : undefined
          }
        />
      ))}

      {/* Sub-nodes: hidden until parent hovered */}
      {subPoints.map((p) => {
        const visible = shouldShowSub(p.node.parentSlug);
        const parentSlug = p.node.parentSlug;
        return (
          <Satellite
            key={p.node.code}
            point={p}
            dark={dark}
            interactive={interactive}
            isActive={p.node.slug === activeNodeSlug}
            isLoginPage={isLoginPage}
            diameterCqw={SUB_SAT_DIAMETER_CQW}
            isVisible={visible}
            subIndex={p.siblingIndex}
            onHoverChange={
              interactive && !isLoginPage && parentSlug
                ? (hovered) => handleHoverChange(hovered, parentSlug)
                : undefined
            }
          />
        );
      })}
    </div>
  );
}

// ─── Satellite ────────────────────────────────────────────────────────────────

interface SatellitePoint {
  node: NodeDef;
  cos: number;
  sin: number;
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
  onHoverChange,
  isVisible,          // undefined = main node (always visible, no animation)
  subIndex = 0,
}: {
  point: SatellitePoint;
  dark: boolean;
  interactive: boolean;
  isActive: boolean;
  isLoginPage: boolean;
  diameterCqw?: number;
  onHoverChange?: (hovered: boolean) => void;
  isVisible?: boolean;  // only passed for sub-nodes
  subIndex?: number;
}) {
  const { node, left, top } = point;
  const visible = isVisible ?? true; // main nodes are always visible
  const { Icon } = node;

  const circleClasses = [
    "flex flex-col items-center justify-center gap-[1.2cqw] rounded-full text-center",
    "border transition-all duration-200 ease-out",
    isActive
      ? "bg-navy-700 border-brand text-white"
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
        boxShadow: isActive
          ? "0 0 12px var(--brand-glow)"
          : dark
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

  // Visibility animation for sub-nodes (centering via Tailwind -translate-x/y-1/2 only).
  const visStyle: React.CSSProperties = {
    left, top,
    opacity: visible ? 1 : 0,
    transform: visible ? "scale(1)" : "scale(0.4)",
    transition: `opacity 0.3s ease ${subIndex * 70}ms, transform 0.35s cubic-bezier(0.34,1.56,0.64,1) ${subIndex * 70}ms`,
    pointerEvents: visible ? undefined : "none",
  };

  const baseStyle: React.CSSProperties = { left, top };

  const hoverProps = onHoverChange
    ? { onMouseEnter: () => onHoverChange(true), onMouseLeave: () => onHoverChange(false) }
    : {};

  if (!interactive) {
    return (
      <span
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
        style={isVisible !== undefined ? visStyle : baseStyle}
      >
        {circle}
      </span>
    );
  }

  if (node.inDevelopment) {
    return (
      <div
        className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-not-allowed outline-none"
        style={isVisible !== undefined ? visStyle : baseStyle}
        {...hoverProps}
      >
        {circle}
      </div>
    );
  }

  let href = `/nodo-${node.slug}`;

  if (isLoginPage) {
    href = getLoginHrefForNode(node.slug);
  }

  return (
    <Link
      href={href}
      aria-label={`${node.label}: ${node.description}`}
      prefetch
      className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 outline-none"
      style={isVisible !== undefined && !isLoginPage ? visStyle : baseStyle}
      {...hoverProps}
    >
      {circle}
    </Link>
  );
}
