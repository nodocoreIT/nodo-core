import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.0.50",
    "192.168.1.1",
    "10.0.0.1",
  ],
};

export default nextConfig;
