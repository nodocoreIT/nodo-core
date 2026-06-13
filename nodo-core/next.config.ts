import type { NextConfig } from "next";

// Multi-Zone URLs — each remote app has its own deployment
// Set NODO_INMO_URL in .env.local for dev, and in Vercel env vars for prod
const NODO_INMO_URL = process.env.NODO_INMO_URL ?? "http://localhost:5174";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.1.37"],
  turbopack: {
    root: "/Users/ramirotule/Documents/1.Proyectos/nodocore/nodo-core",
  },
  async rewrites() {
    return [
      // ── nodo-inmo (Multi-Zone) ────────────────────────────────────────────
      // All /inmo/* routes are proxied to nodo-inmo's deployment.
      // nodo-inmo uses basename="/inmo" in its BrowserRouter.
      {
        source: "/inmo",
        destination: `${NODO_INMO_URL}/inmo`,
      },
      {
        source: "/inmo/:path*",
        destination: `${NODO_INMO_URL}/inmo/:path*`,
      },
      // nodo-inmo Vite dev assets (only needed in development)
      {
        source: "/@vite/:path*",
        destination: `${NODO_INMO_URL}/@vite/:path*`,
      },
      {
        source: "/@id/:path*",
        destination: `${NODO_INMO_URL}/@id/:path*`,
      },
      {
        source: "/@react-refresh",
        destination: `${NODO_INMO_URL}/@react-refresh`,
      },
      // ── (legacy) nodo-clinica ─────────────────────────────────────────────
      // Kept for reference — nodo-clinica is out of active scope (demo only).
      // Remove these once nodo-clinica is fully decommissioned.
      {
        source: "/paciente/:path*",
        destination: "http://localhost:5173/paciente/:path*",
      },
      {
        source: "/medico/:path*",
        destination: "http://localhost:5173/medico/:path*",
      },
      {
        source: "/admin/:path*",
        destination: "http://localhost:5173/admin/:path*",
      },
    ];
  },
};

export default nextConfig;
