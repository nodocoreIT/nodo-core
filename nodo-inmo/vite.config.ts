/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

const monorepoRoot = resolve(__dirname, "..");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/inmo",
  build: {
    outDir: "../nodo-landing/public/inmo",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    origin: "http://localhost:3000",
  },
  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
    alias: {
      "@": resolve(__dirname, "./src"),
      react: resolve(__dirname, "node_modules/react"),
      "react-dom": resolve(__dirname, "node_modules/react-dom"),
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
    // Vitest owns the unit/component tests under src only. Database (pgTAP)
    // and Storage integration tests live under supabase/ and run via their
    // own runners (`supabase test db` / `npm run test:integration`).
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
