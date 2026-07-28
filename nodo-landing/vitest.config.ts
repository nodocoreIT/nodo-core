import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["lib/**/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      // Next.js resolves "server-only" via its own webpack config; vitest
      // (plain Vite) has no such package installed. See test/stubs/server-only.ts.
      "server-only": path.resolve(__dirname, "./test/stubs/server-only.ts"),
    },
  },
});
