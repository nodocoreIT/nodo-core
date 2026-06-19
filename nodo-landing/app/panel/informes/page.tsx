"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  CreditCard,
  Lightbulb,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react";
import Topbar from "@/components/panel/Topbar";
import { createClient } from "@/lib/supabase/client";
import { NODES } from "@/lib/nodes";

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  created_at: string;
};

type Client = {
  id: string;
  name: string;
  email: string | null;
  created_at: string;
};

type ClientUnit = {
  id: string;
  client_id: string;
  unit_code: string;
  plan: string | null;
  status: string;
  progress: number | null;
  created_at: string;
  provisioned_at: string | null;
};

type Expense = {
  id: string;
  concept: string;
  amount: number;
  payment_method: string;
  expense_date: string;
  created_at: string;
};

type ExpenseSplit = {
  id: string;
  expense_id: string;
  share_amount: number;
  settled: boolean;
};

type Task = {
  id: string;
  title: string;
  unit_code: string;
  status: "backlog" | "doing" | "review" | "done";
  priority: "alta" | "media" | "baja";
  type: "task" | "bug" | "idea";
};

type Idea = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  date: string;
  kind: "client" | "unit" | "user" | "idea" | "expense";
};

const STATUS_LABELS: Record<string, string> = {
  activo: "Activo",
  onboarding: "Onboarding",
  pausado: "Pausado",
  pending_review: "Pendiente revisión",
  pending_onboarding: "Onboarding pendiente",
};

const TASK_STATUS_LABELS: Record<Task["status"], string> = {
  backlog: "Por hacer",
  doing: "En progreso",
  review: "En revisión",
  done: "Hecho",
};

const moneyFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const numberFmt = new Intl.NumberFormat("es-AR");

function formatMoney(value: number): string {
  return moneyFmt.format(value);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function isWithinDays(dateStr: string, days: number): boolean {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

function normalizePlan(plan: string | null): string {
  if (!plan) return "Sin plan";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function getNodeLabel(unitCode: string): string {
  const normalized = unitCode.trim().toLowerCase();
  return (
    NODES.find((node) => {
      return (
        node.code.toLowerCase() === normalized ||
        node.slug.toLowerCase() === normalized
      );
    })?.label ?? unitCode
  );
}

function countBy<T>(items: T[], getKey: (item: T) => string): Map<string, number> {
  const result = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

function sortedEntries(map: Map<string, number>): [string, number][] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function MetricCard({
  label,
  value,
  help,
  icon: Icon,
}: {
  label: string;
  value: string;
  help: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate2">{label}</p>
        <span className="rounded-full bg-brand/10 p-2 text-brand">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="font-display text-3xl font-bold text-ink">{value}</p>
      <p className="mt-2 text-sm text-slate2">{help}</p>
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: [string, number][];
  emptyLabel: string;
}) {
  const max = Math.max(...rows.map(([, value]) => value), 1);

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
      <div className="mt-4 space-y-4">
        {rows.length === 0 ? (
          <p className="text-sm text-slate2">{emptyLabel}</p>
        ) : (
          rows.map(([label, value]) => (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-ink">{label}</span>
                <span className="text-slate2">{numberFmt.format(value)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-mist">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${Math.max(8, (value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default function InformesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [units, setUnits] = useState<ClientUnit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    void Promise.all([
      supabase.from("profiles").select("id, full_name, role, created_at").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name, email, created_at").order("created_at", { ascending: false }),
      supabase.from("client_units").select("id, client_id, unit_code, plan, status, progress, created_at, provisioned_at").order("created_at", { ascending: false }),
      supabase.from("expenses").select("id, concept, amount, payment_method, expense_date, created_at").order("expense_date", { ascending: false }),
      supabase.from("expense_splits").select("id, expense_id, share_amount, settled"),
      supabase.from("tasks").select("id, title, unit_code, status, priority, type"),
      supabase.from("ideas").select("id, title, status, created_at").order("created_at", { ascending: false }),
    ]).then(([
      profilesRes,
      clientsRes,
      unitsRes,
      expensesRes,
      splitsRes,
      tasksRes,
      ideasRes,
    ]) => {
      if (!active) return;

      const firstError =
        profilesRes.error ??
        clientsRes.error ??
        unitsRes.error ??
        expensesRes.error ??
        splitsRes.error ??
        tasksRes.error ??
        ideasRes.error;

      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setProfiles((profilesRes.data ?? []) as Profile[]);
      setClients((clientsRes.data ?? []) as Client[]);
      setUnits((unitsRes.data ?? []) as ClientUnit[]);
      setExpenses((expensesRes.data ?? []) as Expense[]);
      setSplits((splitsRes.data ?? []) as ExpenseSplit[]);
      setTasks((tasksRes.data ?? []) as Task[]);
      setIdeas((ideasRes.data ?? []) as Idea[]);
      setLoading(false);
    }).catch((loadError: unknown) => {
      if (!active) return;
      setError(loadError instanceof Error ? loadError.message : "Error inesperado");
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const reports = useMemo(() => {
    const clientById = new Map(clients.map((client) => [client.id, client]));
    const activeUnits = units.filter((unit) => unit.status === "activo");
    const pendingUnits = units.filter((unit) => {
      return unit.status === "pending_review" || unit.status === "pending_onboarding";
    });
    const onboardingUnits = units.filter((unit) => unit.status === "onboarding");
    const openTasks = tasks.filter((task) => task.status !== "done");
    const highPriorityOpenTasks = openTasks.filter((task) => task.priority === "alta");
    const pendingCollection = splits.reduce((total, split) => {
      if (split.settled) return total;
      return total + Number(split.share_amount);
    }, 0);
    const totalExpenses = expenses.reduce((total, expense) => total + Number(expense.amount), 0);
    const monthExpenses = expenses.reduce((total, expense) => {
      const expenseDate = new Date(`${expense.expense_date}T00:00:00`);
      const now = new Date();
      if (
        expenseDate.getMonth() === now.getMonth() &&
        expenseDate.getFullYear() === now.getFullYear()
      ) {
        return total + Number(expense.amount);
      }
      return total;
    }, 0);
    const recentClients = clients.filter((client) => isWithinDays(client.created_at, 30));
    const recentUsers = profiles.filter((profile) => isWithinDays(profile.created_at, 30));
    const provisionedUnits = units.filter((unit) => unit.provisioned_at);
    const avgProgress = units.length > 0
      ? Math.round(units.reduce((total, unit) => total + (unit.progress ?? 0), 0) / units.length)
      : 0;

    const byNode = sortedEntries(countBy(units, (unit) => getNodeLabel(unit.unit_code)));
    const byPlan = sortedEntries(countBy(units, (unit) => normalizePlan(unit.plan)));
    const byStatus = sortedEntries(countBy(units, (unit) => STATUS_LABELS[unit.status] ?? unit.status));
    const tasksByStatus = sortedEntries(countBy(tasks, (task) => TASK_STATUS_LABELS[task.status] ?? task.status));
    const expensesByMethod = sortedEntries(countBy(expenses, (expense) => expense.payment_method || "Sin método"));

    const unitActivities: ActivityItem[] = units.slice(0, 8).map((unit) => {
      const client = clientById.get(unit.client_id);
      return {
        id: `unit-${unit.id}`,
        title: `${client?.name ?? "Cliente"} contrató ${getNodeLabel(unit.unit_code)}`,
        detail: `${normalizePlan(unit.plan)} · ${STATUS_LABELS[unit.status] ?? unit.status}`,
        date: unit.created_at,
        kind: "unit",
      };
    });

    const clientActivities: ActivityItem[] = clients.slice(0, 6).map((client) => ({
      id: `client-${client.id}`,
      title: `Nuevo cliente: ${client.name}`,
      detail: client.email ?? "Sin email registrado",
      date: client.created_at,
      kind: "client",
    }));

    const userActivities: ActivityItem[] = profiles.slice(0, 6).map((profile) => ({
      id: `profile-${profile.id}`,
      title: `Nuevo usuario: ${profile.full_name ?? "Usuario sin nombre"}`,
      detail: profile.role ?? "Sin rol",
      date: profile.created_at,
      kind: "user",
    }));

    const ideaActivities: ActivityItem[] = ideas.slice(0, 6).map((idea) => ({
      id: `idea-${idea.id}`,
      title: `Idea registrada: ${idea.title}`,
      detail: idea.status,
      date: idea.created_at,
      kind: "idea",
    }));

    const expenseActivities: ActivityItem[] = expenses.slice(0, 6).map((expense) => ({
      id: `expense-${expense.id}`,
      title: `Movimiento de caja: ${expense.concept}`,
      detail: `${formatMoney(Number(expense.amount))} · ${expense.payment_method}`,
      date: expense.created_at,
      kind: "expense",
    }));

    const activity = [
      ...unitActivities,
      ...clientActivities,
      ...userActivities,
      ...ideaActivities,
      ...expenseActivities,
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 12);

    const criticalSignals = [
      {
        label: "Solicitudes pendientes de revisión",
        value: pendingUnits.filter((unit) => unit.status === "pending_review").length,
      },
      {
        label: "Onboardings pendientes",
        value: pendingUnits.filter((unit) => unit.status === "pending_onboarding").length,
      },
      {
        label: "Tareas abiertas de prioridad alta",
        value: highPriorityOpenTasks.length,
      },
      {
        label: "Pendiente de rendición en caja",
        value: pendingCollection,
        money: true,
      },
    ];

    return {
      activeUnits,
      pendingUnits,
      onboardingUnits,
      openTasks,
      highPriorityOpenTasks,
      pendingCollection,
      totalExpenses,
      monthExpenses,
      recentClients,
      recentUsers,
      provisionedUnits,
      avgProgress,
      byNode,
      byPlan,
      byStatus,
      tasksByStatus,
      expensesByMethod,
      activity,
      criticalSignals,
    };
  }, [clients, expenses, ideas, profiles, splits, tasks, units]);

  const settledSplits = splits.filter((split) => split.settled).length;
  const totalSplits = splits.length;
  const settledRate = totalSplits > 0 ? Math.round((settledSplits / totalSplits) * 100) : 0;

  return (
    <>
      <Topbar
        breadcrumb="Nodo Core · Ecosistema"
        title="Informes"
      />
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 max-w-4xl">
          <p className="text-sm leading-6 text-slate2">
            Vista ejecutiva para entender qué está pasando en todo el ecosistema:
            altas, nodos contratados, planes, onboarding, caja y pendientes críticos.
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-80 items-center justify-center rounded-xl border border-border bg-surface text-slate2">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Generando informes...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            No se pudieron cargar los informes: {error}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Clientes"
                value={numberFmt.format(clients.length)}
                help={`${numberFmt.format(reports.recentClients.length)} nuevos en 30 días`}
                icon={Users}
              />
              <MetricCard
                label="Nodos contratados"
                value={numberFmt.format(units.length)}
                help={`${numberFmt.format(reports.activeUnits.length)} activos · ${numberFmt.format(reports.onboardingUnits.length)} en onboarding`}
                icon={BarChart3}
              />
              <MetricCard
                label="Usuarios del equipo"
                value={numberFmt.format(profiles.length)}
                help={`${numberFmt.format(reports.recentUsers.length)} altas recientes`}
                icon={CheckCircle2}
              />
              <MetricCard
                label="Caja del mes"
                value={formatMoney(reports.monthExpenses)}
                help={`${formatMoney(reports.pendingCollection)} pendiente de rendición`}
                icon={CreditCard}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {reports.criticalSignals.map((signal) => (
                <div key={signal.label} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 text-brand">
                    <AlertTriangle className="h-4 w-4" />
                    <p className="text-xs font-semibold uppercase tracking-wide">Atención</p>
                  </div>
                  <p className="font-display text-2xl font-bold text-ink">
                    {signal.money ? formatMoney(signal.value) : numberFmt.format(signal.value)}
                  </p>
                  <p className="mt-1 text-sm text-slate2">{signal.label}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <BreakdownCard
                title="Contrataciones por nodo"
                rows={reports.byNode}
                emptyLabel="Todavía no hay nodos contratados."
              />
              <BreakdownCard
                title="Planes contratados"
                rows={reports.byPlan}
                emptyLabel="Todavía no hay planes registrados."
              />
              <BreakdownCard
                title="Estado operativo"
                rows={reports.byStatus}
                emptyLabel="Todavía no hay estados para informar."
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <h2 className="font-display text-lg font-bold text-ink">Pulso de gestión</h2>
                <div className="mt-4 grid gap-3">
                  <div className="flex items-center justify-between rounded-lg bg-paper px-4 py-3">
                    <span className="text-sm text-slate2">Progreso promedio de onboarding</span>
                    <strong className="text-ink">{reports.avgProgress}%</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-paper px-4 py-3">
                    <span className="text-sm text-slate2">Nodos provisionados</span>
                    <strong className="text-ink">{numberFmt.format(reports.provisionedUnits.length)}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-paper px-4 py-3">
                    <span className="text-sm text-slate2">Tareas abiertas</span>
                    <strong className="text-ink">{numberFmt.format(reports.openTasks.length)}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-paper px-4 py-3">
                    <span className="text-sm text-slate2">Rendiciones cerradas</span>
                    <strong className="text-ink">{settledRate}%</strong>
                  </div>
                </div>
              </section>

              <BreakdownCard
                title="Tareas por estado"
                rows={reports.tasksByStatus}
                emptyLabel="Todavía no hay tareas registradas."
              />
              <BreakdownCard
                title="Caja por método de pago"
                rows={reports.expensesByMethod}
                emptyLabel="Todavía no hay movimientos de caja."
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
              <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Clock3 className="h-5 w-5 text-brand" />
                  <h2 className="font-display text-lg font-bold text-ink">Últimos movimientos del ecosistema</h2>
                </div>
                <div className="divide-y divide-border">
                  {reports.activity.length === 0 ? (
                    <p className="py-4 text-sm text-slate2">Todavía no hay actividad para mostrar.</p>
                  ) : (
                    reports.activity.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{item.title}</p>
                          <p className="mt-1 text-xs text-slate2">{item.detail}</p>
                        </div>
                        <span className="shrink-0 text-xs text-slate2">{formatDate(item.date)}</span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-brand" />
                  <h2 className="font-display text-lg font-bold text-ink">Indicadores recomendados</h2>
                </div>
                <div className="space-y-3 text-sm text-slate2">
                  <p>
                    Próximo paso sugerido: sumar MRR/ARR por plan cuando exista la tabla
                    de pagos o suscripciones.
                  </p>
                  <p>
                    Para operación diaria conviene seguir altas por nodo, conversión de
                    onboarding a activo, mora/pagos pendientes y tareas críticas abiertas.
                  </p>
                  <p className="flex items-start gap-2 rounded-lg bg-brand/10 p-3 text-brand">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                    Este informe ya queda preparado para crecer con métricas financieras
                    reales cuando se conecten pagos y facturación.
                  </p>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
