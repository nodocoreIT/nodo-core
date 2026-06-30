/** Plan Pro del JWT de plataforma o subscriptionPlan local (starter | pro | trial | profesional). */
export function isProPlan(plan?: string | null): boolean {
  if (!plan) return false;
  const normalized = plan.toLowerCase();
  return (
    normalized === "pro" ||
    normalized === "profesional" ||
    normalized.includes("pro")
  );
}
