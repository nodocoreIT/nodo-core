"use client";

import { useEffect, useRef } from "react";

const NODE_COUNT = 60;
const CONNECT_DIST = 150;

export default function NeuralNodesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext("2d");
    if (!context) return;

    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = context;

    let animId = 0;
    let w = 0;
    let h = 0;

    const nodes: { x: number; y: number; vx: number; vy: number; pulse: number }[] = [];

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }

    function init() {
      nodes.length = 0;
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          pulse: Math.random() * Math.PI * 2,
        });
      }
    }

    function draw() {
      ctx.fillStyle = "#121E2F";
      ctx.fillRect(0, 0, w, h);

      const grad = ctx.createRadialGradient(w * 0.25, h * 0.15, 0, w * 0.25, h * 0.15, w * 0.85);
      grad.addColorStop(0, "rgba(218,90,14,0.12)");
      grad.addColorStop(0.45, "rgba(27,42,65,0.4)");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const grad2 = ctx.createRadialGradient(w * 0.85, h * 0.75, 0, w * 0.85, h * 0.75, w * 0.5);
      grad2.addColorStop(0, "rgba(100,120,144,0.08)");
      grad2.addColorStop(1, "transparent");
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        a.x += a.vx;
        a.y += a.vy;
        a.pulse += 0.015;
        if (a.x < 0 || a.x > w) a.vx *= -1;
        if (a.y < 0 || a.y > h) a.vy *= -1;

        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * 0.4;
            ctx.strokeStyle = `rgba(222,231,241,${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        const glow = 4 + Math.sin(n.pulse) * 1.5;
        ctx.beginPath();
        ctx.arc(n.x, n.y, glow + 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(218,90,14,0.05)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(234,240,247,0.7)";
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    const onResize = () => {
      resize();
      init();
    };

    resize();
    init();
    draw();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 h-full w-full pointer-events-none"
      aria-hidden
    />
  );
}
