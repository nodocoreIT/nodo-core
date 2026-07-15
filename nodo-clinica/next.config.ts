import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ["@nodocore/shared-components", "@nodocore/nodo-modules", "@base-ui/react"],
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.0.50",
    "192.168.1.1",
    "10.0.0.1",
  ],
};

export default nextConfig;

