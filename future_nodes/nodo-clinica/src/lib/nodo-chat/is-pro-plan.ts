/** Plan Pro habilita chat transversal del ecosistema Nodo. */
export function isProPlan(plan?: string | null): boolean {
  if (!plan) return false;
  const p = plan.toLowerCase();
  return p === "pro" || p === "profesional" || p.includes("pro");
}
