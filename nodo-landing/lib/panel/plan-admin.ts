import type { createClient } from "@/lib/supabase/client";
import { annualMonthlyFromMonthly, type NodePlan } from "@/lib/panel/planes";

type AppSupabase = ReturnType<typeof createClient>;

export type PlanFeatureGroup = {
  id: string;
  unit_code: string;
  label: string;
  sort_order: number;
};

export type PlanFeature = {
  id: string;
  group_id: string;
  label: string;
  sort_order: number;
  included_plan_ids: string[];
};

export type UnitPlanConfig = {
  planes: NodePlan[];
  groups: PlanFeatureGroup[];
  features: PlanFeature[];
};

export type EditablePlan = NodePlan & { isNew?: boolean };
export type EditableGroup = PlanFeatureGroup & { isNew?: boolean };
export type EditableFeature = PlanFeature & { isNew?: boolean };

export async function loadUnitPlanConfig(
  supabase: AppSupabase,
  unitCode: string,
): Promise<UnitPlanConfig> {
  const [{ data: planes }, { data: groups }, { data: inclusions }] = await Promise.all([
      supabase
        .from("planes")
        .select("id, unit_code, code, label, price_monthly, price_annual_monthly, currency, sort_order, is_active")
        .eq("unit_code", unitCode)
        .order("sort_order"),
      supabase
        .from("plan_feature_groups")
        .select("id, unit_code, label, sort_order")
        .eq("unit_code", unitCode)
        .order("sort_order"),
      supabase.from("plan_feature_inclusions").select("feature_id, plan_id"),
    ]);

  const groupList = (groups ?? []) as PlanFeatureGroup[];
  const groupIds = groupList.map((group) => group.id);

  let featureRows: Array<{ id: string; group_id: string; label: string; sort_order: number }> = [];
  if (groupIds.length > 0) {
    const { data } = await supabase
      .from("plan_features")
      .select("id, group_id, label, sort_order")
      .in("group_id", groupIds)
      .order("sort_order");
    featureRows = data ?? [];
  }

  const inclusionMap = new Map<string, string[]>();
  for (const row of inclusions ?? []) {
    const list = inclusionMap.get(row.feature_id) ?? [];
    list.push(row.plan_id);
    inclusionMap.set(row.feature_id, list);
  }

  return {
    planes: (planes ?? []) as NodePlan[],
    groups: groupList,
    features: featureRows.map((feature) => ({
      id: feature.id,
      group_id: feature.group_id,
      label: feature.label,
      sort_order: feature.sort_order,
      included_plan_ids: inclusionMap.get(feature.id) ?? [],
    })),
  };
}

export async function saveUnitPlanConfig(
  supabase: AppSupabase,
  unitCode: string,
  planes: EditablePlan[],
  groups: EditableGroup[],
  features: EditableFeature[],
): Promise<void> {
  const persistedPlanIds = new Map<string, string>();

  for (const plan of planes) {
    const payload = {
      unit_code: unitCode,
      code: plan.code.trim().toLowerCase(),
      label: plan.label.trim(),
      price_monthly: Number(plan.price_monthly) || 0,
      price_annual_monthly:
        Number(plan.price_annual_monthly) || annualMonthlyFromMonthly(Number(plan.price_monthly) || 0),
      currency: plan.currency || "USD",
      sort_order: plan.sort_order,
      is_active: plan.is_active,
    };

    if (plan.isNew) {
        const { data, error } = await supabase.from("planes").insert(payload).select("id").single();
        if (error) throw error;
        persistedPlanIds.set(plan.id, data.id);
      } else {
        const { error } = await supabase.from("planes").update(payload).eq("id", plan.id);
        if (error) throw error;
        persistedPlanIds.set(plan.id, plan.id);
      }
  }

  // Re-map temp plan ids used in feature inclusions.
  const resolvePlanId = (planId: string) => persistedPlanIds.get(planId) ?? planId;

  const persistedGroupIds = new Map<string, string>();

  for (const group of groups) {
    const payload = {
      unit_code: unitCode,
      label: group.label.trim(),
      sort_order: group.sort_order,
    };

    if (group.isNew) {
      const { data, error } = await supabase
        .from("plan_feature_groups")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      persistedGroupIds.set(group.id, data.id);
    } else {
      const { error } = await supabase.from("plan_feature_groups").update(payload).eq("id", group.id);
      if (error) throw error;
      persistedGroupIds.set(group.id, group.id);
    }
  }

  for (const feature of features) {
    const groupId = persistedGroupIds.get(feature.group_id) ?? feature.group_id;
    const payload = {
      group_id: groupId,
      label: feature.label.trim(),
      sort_order: feature.sort_order,
    };

    let featureId = feature.id;

    if (feature.isNew) {
      const { data, error } = await supabase
        .from("plan_features")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      featureId = data.id;
    } else {
      const { error } = await supabase.from("plan_features").update(payload).eq("id", feature.id);
      if (error) throw error;
    }

    await supabase.from("plan_feature_inclusions").delete().eq("feature_id", featureId);

    const inclusionRows = feature.included_plan_ids
      .map((planId) => resolvePlanId(planId))
      .filter(Boolean)
      .map((planId) => ({ feature_id: featureId, plan_id: planId }));

    if (inclusionRows.length > 0) {
      const { error } = await supabase.from("plan_feature_inclusions").insert(inclusionRows);
      if (error) throw error;
    }
  }
}

export async function deletePlan(supabase: AppSupabase, planId: string): Promise<void> {
  const { error } = await supabase.from("planes").delete().eq("id", planId);
  if (error) throw error;
}

export async function deleteFeatureGroup(supabase: AppSupabase, groupId: string): Promise<void> {
  const { error } = await supabase.from("plan_feature_groups").delete().eq("id", groupId);
  if (error) throw error;
}

export async function deleteFeature(supabase: AppSupabase, featureId: string): Promise<void> {
  const { error } = await supabase.from("plan_features").delete().eq("id", featureId);
  if (error) throw error;
}
