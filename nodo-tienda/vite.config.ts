/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

const monorepoRoot = resolve(__dirname, "..");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/tienda",
  build: {
    outDir: "../nodo-landing/public/tienda",
    emptyOutDir: true,
  },
  server: {
    port: 5177,
    strictPort: true,
    origin: "http://localhost:3000",
  },
  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query"],
    alias: {
      "@": resolve(__dirname, "./src"),
      react: resolve(__dirname, "node_modules/react"),
      "react-dom": resolve(__dirname, "node_modules/react-dom"),
      "@tanstack/react-query": resolve(
        __dirname,
        "node_modules/@tanstack/react-query",
      ),
      // Subpath must come before the package root alias (otherwise CSS imports
      // resolve to index.ts/styles/... and Vite returns 500).
      "@nodocore/shared-components/styles": resolve(
        monorepoRoot,
        "packages/shared-components/src/styles",
      ),
      "@nodocore/nodo-modules/agenda": resolve(
        monorepoRoot,
        "packages/nodo-modules/src/agenda/index.ts",
      ),
      "@nodocore/nodo-modules/caja": resolve(
        monorepoRoot,
        "packages/nodo-modules/src/caja/index.ts",
      ),
      "@nodocore/nodo-modules/notifications": resolve(
        monorepoRoot,
        "packages/nodo-modules/src/notifications/index.ts",
      ),
      "@nodocore/nodo-modules/settings": resolve(
        monorepoRoot,
        "packages/nodo-modules/src/settings/index.ts",
      ),
      "@nodocore/nodo-modules": resolve(monorepoRoot, "packages/nodo-modules/src/index.ts"),
      // Compile from source so Vite shares one React instance (dist bundle breaks hooks).
      "@nodocore/shared-components": resolve(
        monorepoRoot,
        "packages/shared-components/src/index.ts",
      ),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query"],
    exclude: ["@nodocore/shared-components", "@nodocore/nodo-modules"],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
