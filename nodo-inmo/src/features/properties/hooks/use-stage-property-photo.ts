import { useState } from "react";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@nodocore/shared-components";

interface StagingState {
  isPending: boolean;
  error: string | null;
}

export function useStagedPropertyPhotos() {
  const { orgId } = useAuth();
  const [state, setState] = useState<StagingState>({ isPending: false, error: null });

  async function uploadPhoto(file: File, currentPaths: string[]): Promise<string[]> {
    if (!orgId) throw new Error("No org_id");
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${orgId}/draft-${Date.now()}.${ext}`;

    setState({ isPending: true, error: null });
    try {
      const { error } = await supabase.storage
        .from("property-photos")
        .upload(path, file, { upsert: false });
      if (error) throw error;
      setState({ isPending: false, error: null });
      return [...currentPaths, path];
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setState({ isPending: false, error: msg });
      throw err;
    }
  }

  async function removePhoto(path: string, currentPaths: string[]): Promise<string[]> {
    setState({ isPending: true, error: null });
    try {
      await supabase.storage.from("property-photos").remove([path]);
      setState({ isPending: false, error: null });
      return currentPaths.filter((p) => p !== path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      setState({ isPending: false, error: msg });
      throw err;
    }
  }

  return { uploadPhoto, removePhoto, ...state };
}
