import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/lib/node-default-theme.ts", "src/lib/create-nodo-auth-client.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "@supabase/supabase-js", "zustand"],
});
