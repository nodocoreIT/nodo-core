import { describe, it, expect } from "vitest";
import { buildNotifications } from "../lib/build-notifications";
import type { TaskRow } from "@/features/agenda/hooks/use-tasks";
import type { DashboardMetrics } from "../hooks/use-dashboard-metrics";

const TODAY = new Date("2026-06-13T12:00:00");

function emptyMetrics(): DashboardMetrics {
  return {
    overduePayments: { count: 0, totalByCurrency: {}, items: [] },
    pendingSettlements: { count: 0, totalByCurrency: {}, items: [] },
    recentSealed: { count: 0, totalByCurrency: {} },
    activeContracts: 0,
    pastMonthDebts: [],
    currentMonthCollections: [],
    recentReceipts: [],
    loading: false,
    error: null,
  };
}

function task(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: "t1",
    org_id: "org",
    title: "Llamar inquilino",
    description: null,
    category: "cobro",
    priority: "alta",
    status: "pendiente",
    due_date: "2026-06-13",
    assigned_to: null,
    property_id: null,
    contact_id: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("buildNotifications", () => {
  it("includes overdue payments and pending collections", () => {
    const metrics = emptyMetrics();
    metrics.overduePayments.items = [
      {
        id: "p1",
        tenantName: "Juan",
        propertyAddress: "Calle 1",
        amount: 1000,
        currency: "ARS",
        dueDate: "2026-06-01",
      },
    ];
    metrics.currentMonthCollections = [
      {
        key: "g1",
        tenantName: "Ana",
        propertyAddress: "Calle 2",
        status: "sin_cobrar",
        balance: 2000,
        currency: "ARS",
        payments: [{ id: "p2", remaining: 2000 }],
      },
    ];

    const items = buildNotifications([], metrics, { today: TODAY });

    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe("overdue_payment");
    expect(items[0].href).toBe("/admin/payments?collect=p1");
    expect(items[1].kind).toBe("pending_collection");
    expect(items[1].href).toBe("/admin/payments?collect=p2");
  });

  it("includes overdue and today tasks", () => {
    const items = buildNotifications(
      [
        task({ id: "t-overdue", due_date: "2026-06-10" }),
        task({ id: "t-today", due_date: "2026-06-13", title: "Firma contrato" }),
      ],
      emptyMetrics(),
      { today: TODAY },
    );

    expect(items.some((n) => n.kind === "overdue_task" && n.href.includes("t-overdue"))).toBe(
      true,
    );
    expect(items.some((n) => n.kind === "today_task" && n.href.includes("t-today"))).toBe(true);
  });

  it("shows only tasks assigned to currentUserName when provided", () => {
    const items = buildNotifications(
      [
        task({ id: "t-mine", due_date: "2026-06-13", assigned_to: "María" }),
        task({ id: "t-other", due_date: "2026-06-13", assigned_to: "Carlos" }),
        task({ id: "t-unassigned", due_date: "2026-06-13", assigned_to: null }),
      ],
      emptyMetrics(),
      { today: TODAY, currentUserName: "María" },
    );

    expect(items.some((n) => n.href.includes("t-mine"))).toBe(true);
    expect(items.some((n) => n.href.includes("t-other"))).toBe(false);
    expect(items.some((n) => n.href.includes("t-unassigned"))).toBe(true);
  });

  it("shows tasks assigned to 'todos' for any user", () => {
    const items = buildNotifications(
      [
        task({ id: "t-all", due_date: "2026-06-13", assigned_to: "todos" }),
        task({ id: "t-other", due_date: "2026-06-13", assigned_to: "Carlos" }),
      ],
      emptyMetrics(),
      { today: TODAY, currentUserName: "María" },
    );

    expect(items.some((n) => n.href.includes("t-all"))).toBe(true);
    expect(items.some((n) => n.href.includes("t-other"))).toBe(false);
  });

  it("shows all tasks when currentUserName is null", () => {
    const items = buildNotifications(
      [
        task({ id: "t-a", due_date: "2026-06-13", assigned_to: "María" }),
        task({ id: "t-b", due_date: "2026-06-13", assigned_to: "Carlos" }),
      ],
      emptyMetrics(),
      { today: TODAY, currentUserName: null },
    );

    expect(items).toHaveLength(2);
  });

  it("skips completed tasks and settlements for non-admin", () => {
    const metrics = emptyMetrics();
    metrics.pendingSettlements.items = [
      { ownerId: "o1", ownerName: "Owner", total: 5000, currency: "ARS" },
    ];

    const items = buildNotifications(
      [task({ status: "completada" })],
      metrics,
      { isAdmin: false, today: TODAY },
    );

    expect(items).toHaveLength(0);
  });
});
