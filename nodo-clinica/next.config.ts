import type { NextConfig } from "next";

/** En Vercel/producción la app vive bajo /nodo-clinica (proxy desde nodo-landing). */
const basePath =
  process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ||
  (process.env.NODE_ENV === "production" ? "/nodo-clinica" : "");

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  ...(basePath ? { basePath } : {}),
  transpilePackages: ["@nodocore/shared-components", "@base-ui/react"],
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.0.50",
    "192.168.1.1",
    "10.0.0.1",
  ],
};

export default nextConfig;

