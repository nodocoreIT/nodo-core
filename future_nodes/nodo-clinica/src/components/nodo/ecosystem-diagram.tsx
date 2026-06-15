"use client";

import { NODES, type NodeDef } from "@/lib/nodes";

interface EcosystemDiagramProps {
  dark?: boolean;
  units?: { code: string }[];
  interactive?: boolean;
  className?: string;
  activeNodeSlug?: string;
}

const W = 520;
const H = 520;
const CX = W / 2;
const CY = H / 2;
const R = 190;
const CORE_R = 46;
const HALO_R = CORE_R + 14;
const SAT_DIAMETER_CQW = 15.5;

export function EcosystemDiagram({
  dark = false,
  units,
  interactive = false,
  className = "",
  activeNodeSlug,
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
            stroke={
              p.node.slug === activeNodeSlug ? "var(--color-brand)" : stroke
            }
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
            <circle
              r="7"
              fill="var(--color-brand)"
              style={{ filter: "drop-shadow(0 2px 4px rgba(218,90,14,0.4))" }}
            >
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

      {points.map((p) => (
        <Satellite
          key={p.node.code}
          point={p}
          dark={dark}
          interactive={interactive}
          isActive={p.node.slug === activeNodeSlug}
        />
      ))}
    </div>
  );
}

interface SatellitePoint {
  node: NodeDef;
  left: string;
  top: string;
}

function Satellite({
  point,
  dark,
  interactive,
  isActive,
}: {
  point: SatellitePoint & { cos: number; sin: number };
  dark: boolean;
  interactive: boolean;
  isActive: boolean;
}) {
  const { node, left, top } = point;
  const { Icon } = node;

  const circleClasses = [
    "flex flex-col items-center justify-center gap-[1.2cqw] rounded-full text-center",
    "border transition-all duration-200 ease-out",
    isActive
      ? "bg-navy-700 border-brand text-white shadow-[0_0_12px_rgba(218,90,14,0.4)]"
      : dark
        ? "bg-navy-700 border-[rgba(222,231,241,.55)] text-[#DEE7F1]"
        : "bg-white border-[#C6D3E2] text-navy",
    interactive && !node.inDevelopment
      ? "group-hover:scale-[1.18] group-focus-visible:scale-[1.18]"
      : "",
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

  return (
    <span
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left, top }}
    >
      {circle}
    </span>
  );
}
