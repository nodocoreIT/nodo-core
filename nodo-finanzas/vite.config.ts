/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

const monorepoRoot = resolve(__dirname, "..");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/finanzas",
  build: {
    outDir: "../nodo-landing/public/finanzas",
    emptyOutDir: true,
  },
  server: {
    port: 5176,
    strictPort: true,
    origin: "http://localhost:3000",
  },
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "zustand",
      "@tanstack/react-query",
    ],
    alias: {
      "@": resolve(__dirname, "./src"),
      react: resolve(__dirname, "node_modules/react"),
      "react-dom": resolve(__dirname, "node_modules/react-dom"),
      "@tanstack/react-query": resolve(
        __dirname,
        "node_modules/@tanstack/react-query",
      ),
      "@nodocore/shared-components/styles": resolve(
        monorepoRoot,
        "packages/shared-components/src/styles",
      ),
      // Subpaths before package root (otherwise /notifications resolves inside index.ts).
      "@nodocore/nodo-modules/notifications": resolve(
        monorepoRoot,
        "packages/nodo-modules/src/notifications/index.ts",
      ),
      "@nodocore/nodo-modules": resolve(monorepoRoot, "packages/nodo-modules/src/index.ts"),
      "@nodocore/shared-components": resolve(
        monorepoRoot,
        "packages/shared-components/src/index.ts",
      ),
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "sonner",
    ],
    exclude: ["@nodocore/shared-components", "@nodocore/nodo-modules", "zustand"],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
