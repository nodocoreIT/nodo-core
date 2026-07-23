import type { NextConfig } from "next";
import path from "path";

const monorepoRoot = path.resolve(__dirname, "..");

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ["@nodocore/shared-components", "@nodocore/nodo-modules", "@base-ui/react"],
  serverExternalPackages: ["pdf-parse", "tesseract.js"],
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.0.50",
    "192.168.1.1",
    "10.0.0.1",
  ],
  webpack: (config) => {
    // Single React context instance for SupabaseProvider / useSupabase across
    // app code and @nodocore/nodo-modules (NodoSwitcher).
    config.resolve.alias = {
      ...config.resolve.alias,
      "@nodocore/shared-components/lib/verify-node-access": path.resolve(
        monorepoRoot,
        "packages/shared-components/src/lib/verify-node-access.ts",
      ),
      "@nodocore/shared-components": path.resolve(
        monorepoRoot,
        "packages/shared-components/src/index.ts",
      ),
    };
    return config;
  },
};

export default nextConfig;

