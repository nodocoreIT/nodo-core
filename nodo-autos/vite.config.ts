/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

const monorepoRoot = resolve(__dirname, "..");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/autos",
  build: {
    outDir: "../nodo-landing/public/autos",
    emptyOutDir: true,
  },
  server: {
    port: 5175,
    strictPort: true,
    // Required when the app is accessed via nodo-landing proxy (localhost:3000/autos).
    origin: "http://localhost:3000",
  },
  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
    alias: {
      "@": resolve(__dirname, "./src"),
      react: resolve(__dirname, "node_modules/react"),
      "react-dom": resolve(__dirname, "node_modules/react-dom"),
      // Compile from source so Vite shares one React instance (dist bundle breaks hooks).
      "@nodocore/shared-components": resolve(
        monorepoRoot,
        "packages/shared-components/src/index.ts",
      ),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime"],
    exclude: ["@nodocore/shared-components"],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
