import { supabase } from "./src/shared/lib/supabase";

async function run() {
  const { data, error } = await supabase.schema("shared").rpc("upsert_index_value", {
    p_kind: "IPC",
    p_period: "2026-05-01",
    p_value: 2.1,
    p_source: "manual"
  });
  console.log("Data:", data, "Error:", error);
}

run();
