import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";

export type SectionType =
  | "hero"
  | "featured_products"
  | "categories"
  | "banner"
  | "text"
  | "custom";

export type StoreSectionRow = {
  id: string;
  org_id: string;
  type: SectionType;
  title: string | null;
  config: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export const SECTIONS_QK = ["nodo_tienda", "store_sections"] as const;

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  hero: "Banner principal",
  featured_products: "Productos destacados",
  categories: "Categorías",
  banner: "Banner secundario",
  text: "Bloque de texto",
  custom: "Bloque personalizado",
};

export function useStoreSections() {
  const { orgId } = useAuth();
  return useQuery<StoreSectionRow[]>({
    queryKey: [...SECTIONS_QK, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("store_sections")
        .select("*")
        .eq("org_id", orgId!)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as StoreSectionRow[];
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

export function useCreateSection() {
  const qc = useQueryClient();
  const { orgId } = useAuth();
  return useMutation({
    mutationFn: async (values: {
      type: SectionType;
      title?: string | null;
      config?: Record<string, unknown>;
      sort_order?: number;
    }) => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("store_sections")
        .insert({ org_id: orgId!, config: {}, is_active: true, ...values })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SECTIONS_QK }),
  });
}

export function useUpdateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...values
    }: Partial<StoreSectionRow> & { id: string }) => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("store_sections")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SECTIONS_QK }),
  });
}

export function useDeleteSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .schema("nodo_tienda")
        .from("store_sections")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SECTIONS_QK }),
  });
}

export function useReorderSections() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) => {
      await Promise.all(
        items.map(({ id, sort_order }) =>
          supabase
            .schema("nodo_tienda")
            .from("store_sections")
            .update({ sort_order })
            .eq("id", id),
        ),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SECTIONS_QK }),
  });
}
