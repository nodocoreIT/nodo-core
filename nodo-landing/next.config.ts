import type { NextConfig } from "next";

// Multi-Zone URLs — each remote app has its own deployment.
// Set NODO_INMO_URL in nodo-landing/.env.local for dev,
// and in Vercel environment variables for production.
const NODO_INMO_URL = process.env.NODO_INMO_URL ?? "http://localhost:5173";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.1.37"],
  turbopack: {
    root: "/Users/ramirotule/Documents/1.Proyectos/nodocore/nodo-landing",
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
    ];
  },
};

export default nextConfig;
