import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Trust the X-Forwarded-Host from Vercel/proxies for custom domain routing
  async headers() {
    return [];
  },
};

export default nextConfig;
