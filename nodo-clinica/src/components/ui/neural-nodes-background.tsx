"use client";

import { useEffect, useRef } from "react";

const NODE_COUNT = 60;
const CONNECT_DIST = 150;

export function NeuralNodesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext("2d");
    if (!context) return;

    const canvas = canvasEl;
    const ctx = context;

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
      ctx.fillStyle = "#0B1D2A";
      ctx.fillRect(0, 0, w, h);

      // Teal radial glow (top-left)
      const grad = ctx.createRadialGradient(w * 0.2, h * 0.15, 0, w * 0.2, h * 0.15, w * 0.8);
      grad.addColorStop(0, "rgba(13,148,136,0.18)");
      grad.addColorStop(0.5, "rgba(11,29,42,0.4)");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Subtle second glow (bottom-right)
      const grad2 = ctx.createRadialGradient(w * 0.85, h * 0.8, 0, w * 0.85, h * 0.8, w * 0.5);
      grad2.addColorStop(0, "rgba(45,212,191,0.06)");
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
            const alpha = (1 - dist / CONNECT_DIST) * 0.35;
            ctx.strokeStyle = `rgba(200,228,228,${alpha})`;
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
        ctx.fillStyle = "rgba(13,148,136,0.07)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(204,236,234,0.75)";
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    const onResize = () => { resize(); init(); };
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
