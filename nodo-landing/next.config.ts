import path from "path";
import type { NextConfig } from "next";

// Multi-Zone URLs — each remote app has its own deployment.
// Set app URLs in .env.local for dev,
// and in Vercel environment variables for production.
const NODO_INMO_URL = process.env.NODO_INMO_URL ?? "http://localhost:5173";
const NODO_CLINICA_URL = process.env.NODO_CLINICA_URL ?? "http://localhost:3002";
/** En el deploy nuevo la app usa basePath /nodo-clinica. */
const NODO_CLINICA_REMOTE_PREFIX =
  process.env.NODO_CLINICA_REMOTE_PREFIX === ""
    ? ""
    : (process.env.NODO_CLINICA_REMOTE_PREFIX ?? "/nodo-clinica").replace(/\/$/, "");
const NODO_AUTOS_URL = process.env.NODO_AUTOS_URL ?? "http://localhost:5175";
const NODO_FINANZAS_URL = process.env.NODO_FINANZAS_URL ?? "http://localhost:5176";
const NODO_ECOMMERCE_URL = process.env.NODO_ECOMMERCE_URL ?? "http://localhost:3001";

const isDev = process.env.NODE_ENV !== "production";

// nodo-clinica is served via its own domain (clinica.nodocore.com.ar).
// No rewrites needed — the marketing page links directly to the app domain.
const clinicaProxy: { source: string; destination: string }[] = [];

const nextConfig: NextConfig = {
  transpilePackages: ["@nodocore/shared-components", "@nodocore/nodo-modules"],
  allowedDevOrigins: ["127.0.0.1", "192.168.1.37"],
  // Bundle the SPA index.html files into the Lambda so Route Handlers
  // can serve them via readFileSync. On Vercel, public/ is on the CDN
  // and not accessible from serverless functions unless explicitly traced.
  // Note: moved out of `experimental` in Next.js 15+.
  // Set turbopack root to the monorepo root so that pnpm symlinks
  // (which resolve to node_modules/.pnpm/ under the workspace root)
  // are reachable. Without this, Turbopack rejects the resolved path
  // of next/package.json as being outside the project root.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  outputFileTracingIncludes: {
    "/inmo/[[...slug]]": [path.join(__dirname, "public/inmo/index.html")],
    "/autos/[[...slug]]": [path.join(__dirname, "public/autos/index.html")],
    "/finanzas/[[...slug]]": [path.join(__dirname, "public/finanzas/index.html")],
  },
  async rewrites() {
    if (isDev) {
      // In development, proxy to local Vite dev servers.
      // Must use beforeFiles so these rewrites run BEFORE the SPA catch-all
      // Route Handlers (app/inmo/[[...slug]]/route.ts etc.) are evaluated.
      return {
        beforeFiles: [
          { source: "/favicon.ico", destination: "/favicon.png" },
          // ── nodo-inmo ─────────────────────────────────────────────────────
          { source: "/inmo", destination: `${NODO_INMO_URL}/inmo` },
          { source: "/inmo/:path*", destination: `${NODO_INMO_URL}/inmo/:path*` },
          { source: "/brand/:path*", destination: `${NODO_INMO_URL}/brand/:path*` },
          { source: "/assets/:path*", destination: `${NODO_INMO_URL}/assets/:path*` },
          // ── nodo-clinica ───────────────────────────────────────────────────
          // Landing: /nodo-clinica (marketing). App: /clinica → deploy nodo-clinica
          ...clinicaProxy,
          // ── nodo-autos ─────────────────────────────────────────────────────
          { source: "/autos", destination: `${NODO_AUTOS_URL}/autos` },
          { source: "/autos/:path*", destination: `${NODO_AUTOS_URL}/autos/:path*` },
          // ── nodo-finanzas ──────────────────────────────────────────────────
          { source: "/finanzas", destination: `${NODO_FINANZAS_URL}/finanzas` },
          { source: "/finanzas/:path*", destination: `${NODO_FINANZAS_URL}/finanzas/:path*` },
          // ── nodo-ecommerce ─────────────────────────────────────────────────
          { source: "/ecommerce", destination: `${NODO_ECOMMERCE_URL}/ecommerce` },
          { source: "/ecommerce/:path*", destination: `${NODO_ECOMMERCE_URL}/ecommerce/:path*` },
        ],
      };
    }

    // In production, SPA routes are handled by catch-all Route Handlers
    // (app/inmo/[[...slug]]/route.ts, app/autos/[[...slug]]/route.ts).
    // Static assets in public/inmo/ and public/autos/ are served directly
    // by Next.js before the Route Handlers are ever reached.
    return {
      beforeFiles: [
        { source: "/favicon.ico", destination: "/favicon.png" },
        ...clinicaProxy,
      ],
    };
  },
};

export default nextConfig;
