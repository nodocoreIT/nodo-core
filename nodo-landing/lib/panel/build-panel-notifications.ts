import type { AppNotification } from "@nodocore/nodo-modules/notifications";
import { NODES } from "@/lib/nodes";

export type PanelClientUnit = {
  id: string;
  client_id: string;
  unit_code: string;
  plan: string | null;
  status: string;
  created_at: string;
};

export type PanelClient = {
  id: string;
  name: string;
  email: string | null;
};

export type PanelTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  unit_code: string;
};

export type PanelIdea = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

export type PanelOnboardingProfile = {
  client_unit_id: string;
  plan_choice: string | null;
  demo_days: number | null;
};

export type PanelFeedbackNotification = {
  id: string;
  kind: string;
  category: string | null;
  content: string | null;
  source_node: string;
  created_at: string;
};

export type PanelNotificationInput = {
  units: PanelClientUnit[];
  clients: PanelClient[];
  tasks: PanelTask[];
  ideas: PanelIdea[];
  profiles: PanelOnboardingProfile[];
  unsettledCajaCount: number;
  unsettledCajaTotal: number;
  feedbackNotifications?: PanelFeedbackNotification[];
  today?: Date;
};

function getNodeLabel(unitCode: string): string {
  const normalized = unitCode.trim().toLowerCase();
  return (
    NODES.find(
      (node) =>
        node.code.toLowerCase() === normalized ||
        node.slug.toLowerCase() === normalized,
    )?.label ?? unitCode
  );
}

function todayStr(today: Date): string {
  return today.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

const FEEDBACK_CATEGORY_LABELS: Record<string, string> = {
  bug: "Error reportado",
  idea: "Idea nueva",
  bloat: "Algo que sobra",
};

const FEEDBACK_NODE_LABELS: Record<string, string> = {
  inmo: "NODO | Inmo",
  autos: "NODO | Autos",
  finanzas: "NODO | Finanzas",
  clinica: "NODO | Clínica",
};

export function buildPanelNotifications({
  units,
  clients,
  tasks,
  ideas,
  profiles,
  unsettledCajaCount,
  unsettledCajaTotal,
  feedbackNotifications = [],
  today = new Date(),
}: PanelNotificationInput): AppNotification[] {
  const list: AppNotification[] = [];
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const profileByUnit = new Map(profiles.map((p) => [p.client_unit_id, p]));
  const todayKey = todayStr(today);
  const horizon = addDays(todayKey, 7);

  const pendingReview = units.filter((u) => u.status === "pending_review");
  const pendingOnboarding = units.filter((u) => u.status === "pending_onboarding");
  const onboardingActive = units.filter((u) => u.status === "onboarding");

  for (const unit of pendingReview.slice(0, 8)) {
    const client = clientById.get(unit.client_id);
    list.push({
      id: `registration-${unit.id}`,
      kind: "pending_registration",
      title: "Solicitud de alta pendiente",
      description: `${client?.name ?? "Cliente"} · ${getNodeLabel(unit.unit_code)}${unit.plan ? ` · ${unit.plan}` : ""}`,
      href: "/panel/solicitudes",
      priority: 1,
    });
  }

  if (pendingReview.length > 8) {
    list.push({
      id: "registration-more",
      kind: "pending_registration",
      title: `${pendingReview.length - 8} solicitudes más`,
      description: "Revisá el listado completo de solicitudes pendientes",
      href: "/panel/solicitudes",
      priority: 2,
    });
  }

  for (const unit of pendingOnboarding.slice(0, 5)) {
    const client = clientById.get(unit.client_id);
    list.push({
      id: `onboarding-pending-${unit.id}`,
      kind: "pending_onboarding",
      title: "Onboarding pendiente",
      description: `${client?.name ?? "Cliente"} debe completar el registro en ${getNodeLabel(unit.unit_code)}`,
      href: "/panel/clientes",
      priority: 5,
    });
  }

  for (const unit of onboardingActive) {
    const ageDays = daysBetween(new Date(unit.created_at), today);
    if (ageDays < 2) continue;
    const client = clientById.get(unit.client_id);
    list.push({
      id: `onboarding-stuck-${unit.id}`,
      kind: "onboarding_stuck",
      title: "Onboarding sin finalizar",
      description: `${client?.name ?? "Cliente"} lleva ${ageDays} días en onboarding (${getNodeLabel(unit.unit_code)})`,
      href: "/panel/clientes",
      priority: 8,
    });
  }

  for (const unit of units) {
    const profile = profileByUnit.get(unit.id);
    if (!profile || profile.plan_choice !== "demo" || !profile.demo_days) continue;
    if (unit.status !== "activo" && unit.status !== "onboarding") continue;

    const endKey = addDays(unit.created_at.slice(0, 10), profile.demo_days);
    const daysLeft = daysBetween(today, new Date(`${endKey}T00:00:00`));

    if (daysLeft > 3) continue;

    const client = clientById.get(unit.client_id);
    list.push({
      id: `demo-${unit.id}`,
      kind: "demo_expiring",
      title: daysLeft < 0 ? "Demo vencida" : "Demo por vencer",
      description:
        daysLeft < 0
          ? `${client?.name ?? "Cliente"} · demo de ${getNodeLabel(unit.unit_code)} venció`
          : `${client?.name ?? "Cliente"} · demo vence en ${daysLeft === 0 ? "hoy" : `${daysLeft} día(s)`}`,
      href: "/panel/clientes",
      priority: daysLeft < 0 ? 3 : 12,
    });
  }

  if (unsettledCajaCount > 0) {
    list.push({
      id: "caja-pending",
      kind: "pending_caja",
      title: "Rendiciones pendientes en caja",
      description: `${unsettledCajaCount} saldo${unsettledCajaCount !== 1 ? "s" : ""} por saldar · $${unsettledCajaTotal.toLocaleString("es-AR")}`,
      href: "/panel/caja",
      priority: 10,
    });
  }

  for (const task of tasks) {
    if (task.status === "done" || !task.due_date) continue;

    const baseDesc = `${task.title} · ${getNodeLabel(task.unit_code)}`;

    // Use a stable ID regardless of urgency state so localStorage dismissals
    // survive transitions (upcoming → today → overdue).
    if (task.due_date < todayKey) {
      list.push({
        id: `task-${task.id}`,
        kind: "overdue_task",
        title: "Tarea vencida",
        description: baseDesc,
        href: "/panel/tareas",
        priority: 6,
      });
    } else if (task.due_date === todayKey) {
      list.push({
        id: `task-${task.id}`,
        kind: "today_task",
        title: "Tarea para hoy",
        description: baseDesc,
        href: "/panel/tareas",
        priority: 14,
      });
    } else if (task.due_date <= horizon) {
      list.push({
        id: `task-${task.id}`,
        kind: "upcoming_task",
        title: "Tarea próxima",
        description: `${baseDesc} — vence ${task.due_date}`,
        href: "/panel/tareas",
        priority: 25,
      });
    }
  }

  const newIdeas = ideas.filter((i) => i.status === "nueva");
  for (const idea of newIdeas.slice(0, 5)) {
    list.push({
      id: `idea-${idea.id}`,
      kind: "new_idea",
      title: "Idea nueva",
      description: idea.title,
      href: "/panel/ideas",
      priority: 20,
    });
  }

  if (newIdeas.length > 5) {
    list.push({
      id: "ideas-more",
      kind: "new_idea",
      title: `${newIdeas.length - 5} ideas nuevas más`,
      description: "Revisá el tablero de ideas del equipo",
      href: "/panel/ideas",
      priority: 22,
    });
  }

  for (const fb of feedbackNotifications.slice(0, 10)) {
    const categoryLabel = FEEDBACK_CATEGORY_LABELS[fb.category ?? ""] ?? "Feedback";
    const nodeLabel = FEEDBACK_NODE_LABELS[fb.source_node] ?? `NODO | ${fb.source_node}`;
    const snippet = fb.content ? fb.content.slice(0, 80) + (fb.content.length > 80 ? "…" : "") : "";
    list.push({
      id: `feedback-${fb.id}`,
      kind: "new_feedback",
      title: `${categoryLabel} · ${nodeLabel}`,
      description: snippet || "Sin mensaje",
      href: "/panel",
      priority: 15,
    });
  }

  return list.sort((a, b) => a.priority - b.priority);
}
