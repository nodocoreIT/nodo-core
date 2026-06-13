import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.1.37"],
  turbopack: {
    root: "/Users/ramirotule/Documents/1.Proyectos/nodocore/nodo-core",
  },
  async rewrites() {
    return [
      {
        source: "/paciente/:path*",
        destination: "http://localhost:5173/paciente/:path*",
      },
      {
        source: "/medico/:path*",
        destination: "http://localhost:5173/medico/:path*",
      },
      {
        source: "/admin/:path*",
        destination: "http://localhost:5173/admin/:path*",
      },
      // Vite dev assets and hot reloading
      {
        source: "/src/:path*",
        destination: "http://localhost:5173/src/:path*",
      },
      {
        source: "/@vite/:path*",
        destination: "http://localhost:5173/@vite/:path*",
      },
      {
        source: "/@id/:path*",
        destination: "http://localhost:5173/@id/:path*",
      },
      {
        source: "/@react-refresh",
        destination: "http://localhost:5173/@react-refresh",
      },
      {
        source: "/node_modules/.vite/:path*",
        destination: "http://localhost:5173/node_modules/.vite/:path*",
      },
      // Vite production assets
      {
        source: "/assets/:path*",
        destination: "http://localhost:5173/assets/:path*",
      },
    ];
  },
};

export default nextConfig;
