import path from "path";
import type { NextConfig } from "next";

// Multi-Zone URLs — each remote app has its own deployment.
// Set NODO_INMO_URL in nodo-landing/.env.local for dev,
// and in Vercel environment variables for production.
const NODO_INMO_URL = process.env.NODO_INMO_URL ?? "http://localhost:5173";
const NODO_CLINICA_URL = process.env.NODO_CLINICA_URL ?? "http://localhost:5174";
const NODO_AUTOS_URL = process.env.NODO_AUTOS_URL ?? "http://localhost:5175";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.1.37"],
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  async rewrites() {
    if (isDev) {
      // In development, proxy to local Vite dev servers.
      return [
        // ── nodo-inmo ───────────────────────────────────────────────────────
        { source: "/inmo", destination: `${NODO_INMO_URL}/inmo` },
        { source: "/inmo/:path*", destination: `${NODO_INMO_URL}/inmo/:path*` },
        { source: "/brand/:path*", destination: `${NODO_INMO_URL}/brand/:path*` },
        { source: "/assets/:path*", destination: `${NODO_INMO_URL}/assets/:path*` },
        // Vite dev server internals
        { source: "/@vite/:path*", destination: `${NODO_INMO_URL}/@vite/:path*` },
        { source: "/@id/:path*", destination: `${NODO_INMO_URL}/@id/:path*` },
        { source: "/@react-refresh", destination: `${NODO_INMO_URL}/@react-refresh` },
        { source: "/@fs/:path*", destination: `${NODO_INMO_URL}/@fs/:path*` },
        { source: "/src/:path*", destination: `${NODO_INMO_URL}/src/:path*` },
        { source: "/node_modules/.vite/:path*", destination: `${NODO_INMO_URL}/node_modules/.vite/:path*` },
        // ── nodo-clinica ─────────────────────────────────────────────────────
        { source: "/clinica", destination: `${NODO_CLINICA_URL}/clinica` },
        { source: "/clinica/:path*", destination: `${NODO_CLINICA_URL}/clinica/:path*` },
        // ── nodo-autos ───────────────────────────────────────────────────────
        { source: "/autos", destination: `${NODO_AUTOS_URL}/autos` },
        { source: "/autos/:path*", destination: `${NODO_AUTOS_URL}/autos/:path*` },
      ];
    }

    // In production, Vite SPAs are pre-built into public/inmo/ and public/autos/.
    // afterFiles runs after static file checks: assets are served directly from
    // public/, and only real SPA routes (no matching file) fall through to index.html.
    return {
      afterFiles: [
        { source: "/inmo", destination: "/inmo/index.html" },
        { source: "/inmo/:path*", destination: "/inmo/index.html" },
        { source: "/autos", destination: "/autos/index.html" },
        { source: "/autos/:path*", destination: "/autos/index.html" },
        // nodo-clinica: add here once it's built into public/clinica/
      ],
    };
  },
};

export default nextConfig;
