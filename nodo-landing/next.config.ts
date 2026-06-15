import type { NextConfig } from "next";

// Multi-Zone URLs — each remote app has its own deployment.
// Set NODO_INMO_URL in nodo-landing/.env.local for dev,
// and in Vercel environment variables for production.
const NODO_INMO_URL = process.env.NODO_INMO_URL ?? "http://localhost:5173";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.1.37"],
  turbopack: {
    root: "/Users/ramirotule/Documents/1.Proyectos/nodocore",
  },
  async rewrites() {
    return [
      // ── nodo-inmo (Multi-Zone) ──────────────────────────────────────────
      // /inmo/* is proxied transparently to nodo-inmo's deployment.
      // nodo-inmo uses basename="/inmo" in its BrowserRouter.
      {
        source: "/inmo",
        destination: `${NODO_INMO_URL}/inmo`,
      },
      {
        source: "/inmo/:path*",
        destination: `${NODO_INMO_URL}/inmo/:path*`,
      },
      // Vite dev assets — only active in development
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
      {
        source: "/@fs/:path*",
        destination: `${NODO_INMO_URL}/@fs/:path*`,
      },
      {
        source: "/src/:path*",
        destination: `${NODO_INMO_URL}/src/:path*`,
      },
      {
        source: "/node_modules/.vite/:path*",
        destination: `${NODO_INMO_URL}/node_modules/.vite/:path*`,
      },
      // nodo-inmo static assets (public/)
      {
        source: "/brand/:path*",
        destination: `${NODO_INMO_URL}/brand/:path*`,
      },
      {
        source: "/assets/:path*",
        destination: `${NODO_INMO_URL}/assets/:path*`,
      },
    ];
  },
};

export default nextConfig;
