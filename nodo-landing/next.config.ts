import path from "path";
import type { NextConfig } from "next";

// Multi-Zone URLs — each remote app has its own deployment.
// Set NODO_INMO_URL in nodo-landing/.env.local for dev,
// and in Vercel environment variables for production.
const NODO_INMO_URL = process.env.NODO_INMO_URL ?? "http://localhost:5173";
const NODO_CLINICA_URL = process.env.NODO_CLINICA_URL ?? "http://localhost:5174";
const NODO_AUTOS_URL = process.env.NODO_AUTOS_URL ?? "http://localhost:5175";
const NODO_FINANZAS_URL = process.env.NODO_FINANZAS_URL ?? "http://localhost:5176";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.1.37"],
  // Bundle the SPA index.html files into the Lambda so Route Handlers
  // can serve them via readFileSync. On Vercel, public/ is on the CDN
  // and not accessible from serverless functions unless explicitly traced.
  // Note: moved out of `experimental` in Next.js 15+.
  outputFileTracingIncludes: {
    "/inmo/[[...slug]]": ["./public/inmo/index.html"],
    "/autos/[[...slug]]": ["./public/autos/index.html"],
  },
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  async rewrites() {
    if (isDev) {
      // In development, proxy to local Vite dev servers.
      // Must use beforeFiles so these rewrites run BEFORE the SPA catch-all
      // Route Handlers (app/inmo/[[...slug]]/route.ts etc.) are evaluated.
      return {
        beforeFiles: [
          // ── nodo-inmo ─────────────────────────────────────────────────────
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
          // ── nodo-clinica ───────────────────────────────────────────────────
          { source: "/clinica", destination: `${NODO_CLINICA_URL}/clinica` },
          { source: "/clinica/:path*", destination: `${NODO_CLINICA_URL}/clinica/:path*` },
          // ── nodo-autos ─────────────────────────────────────────────────────
          { source: "/autos", destination: `${NODO_AUTOS_URL}/autos` },
          { source: "/autos/:path*", destination: `${NODO_AUTOS_URL}/autos/:path*` },
          // ── nodo-finanzas ──────────────────────────────────────────────────
          { source: "/finanzas", destination: `${NODO_FINANZAS_URL}/finanzas` },
          { source: "/finanzas/:path*", destination: `${NODO_FINANZAS_URL}/finanzas/:path*` },
        ],
      };
    }

    // In production, SPA routes are handled by catch-all Route Handlers
    // (app/inmo/[[...slug]]/route.ts, app/autos/[[...slug]]/route.ts).
    // Static assets in public/inmo/ and public/autos/ are served directly
    // by Next.js before the Route Handlers are ever reached.
    return {};
  },
};

export default nextConfig;
