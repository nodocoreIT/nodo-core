import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Multi-zone: nodo-landing proxies /ecommerce/* to this app.
  // All internal Next.js routes are automatically prefixed with /ecommerce.
  basePath: "/ecommerce",
  experimental: {
    useCache: true,
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
      },
      {
        protocol: "https",
        hostname: "www.bagues.com.ar",
      },
      {
        protocol: "https",
        hostname: "**.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
