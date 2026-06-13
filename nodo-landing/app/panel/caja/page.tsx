"use client";

import { useState, useEffect } from "react";
import Topbar from "@/components/panel/Topbar";
import { createClient } from "@/lib/supabase/client";

type Member = {
  id: string;
  full_name: string;
  initials: string;
  color: string;
};

type Expense = {
  id: string;
  concept: string;
  amount: number;
  payment_method: string;
  paid_by: string;
  expense_date: string;
  created_at: string;
};

type Split = {
  id: string;
  expense_id: string;
  profile_id: string;
  share_amount: number;
  settled: boolean;
};

const PAYMENT_METHODS = [
  "Tarjeta de crédito",
  "Tarjeta de débito",
  "Efectivo",
  "Transferencia",
  "Mercado Pago",
  "Otro",
];

const moneyFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

function formatMoney(n: number): string {
  return moneyFmt.format(n);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const months = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// Split an amount equally across n participants in whole cents, giving any
// rounding remainder to the first participant so the parts sum to the total.
function equalShares(amount: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor((amount / n) * 100) / 100;
  const shares = Array(n).fill(base);
  const remainder = Math.round((amount - base * n) * 100) / 100;
  shares[0] = Math.round((shares[0] + remainder) * 100) / 100;
  return shares;
}

export default function CajaPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<Split[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const [formConcept, setFormConcept] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formMethod, setFormMethod] = useState(PAYMENT_METHODS[0]);
  const [formPaidBy, setFormPaidBy] = useState("");
  const [formDate, setFormDate] = useState(today);
  const [formParticipants, setFormParticipants] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const supabase = createClient();
    const [{ data: profs }, { data: exp }, { data: spl }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, initials, color").order("created_at"),
      supabase.from("expenses").select("*").order("expense_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("expense_splits").select("*"),
    ]);
    setMembers((profs ?? []) as Member[]);
    setExpenses((exp ?? []) as Expense[]);
    setSplits((spl ?? []) as Split[]);
    setLoading(false);
  }

  const memberById = new Map(members.map((m) => [m.id, m]));
  const splitsByExpense = new Map<string, Split[]>();
  for (const s of splits) {
    const arr = splitsByExpense.get(s.expense_id) ?? [];
    arr.push(s);
    splitsByExpense.set(s.expense_id, arr);
  }

  // Net balance per member: money others owe them (as payer, unsettled) minus
  // money they owe others (as debtor, unsettled). Self-shares are ignored.
  const expenseById = new Map(expenses.map((e) => [e.id, e]));
  const balances = new Map<string, number>();
  for (const m of members) balances.set(m.id, 0);
  for (const s of splits) {
    if (s.settled) continue;
    const exp = expenseById.get(s.expense_id);
    if (!exp || s.profile_id === exp.paid_by) continue;
    // debtor owes their share, payer is owed it
    balances.set(s.profile_id, (balances.get(s.profile_id) ?? 0) - s.share_amount);
    balances.set(exp.paid_by, (balances.get(exp.paid_by) ?? 0) + s.share_amount);
  }

  // Stats
  const totalSpent = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
  const pending = splits.reduce((acc, s) => {
    if (s.settled) return acc;
    const exp = expenseById.get(s.expense_id);
    if (!exp || s.profile_id === exp.paid_by) return acc;
    return acc + Number(s.share_amount);
  }, 0);
  const now = new Date();
  const monthSpent = expenses.reduce((acc, e) => {
    const d = new Date(e.expense_date + "T00:00:00");
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      ? acc + Number(e.amount)
      : acc;
  }, 0);

  const filtered = searchTerm
    ? expenses.filter((e) => {
        const payer = memberById.get(e.paid_by)?.full_name ?? "";
        const term = searchTerm.toLowerCase();
        return (
          e.concept.toLowerCase().includes(term) ||
          e.payment_method.toLowerCase().includes(term) ||
          payer.toLowerCase().includes(term)
        );
      })
    : expenses;

  function openForm() {
    setEditingExpense(null);
    setFormConcept("");
    setFormAmount("");
    setFormMethod(PAYMENT_METHODS[0]);
    setFormPaidBy(members[0]?.id ?? "");
    setFormDate(today);
    setFormParticipants(new Set(members.map((m) => m.id)));
    setError("");
    setShowForm(true);
  }

  function openEditForm(exp: Expense) {
    setEditingExpense(exp);
    setFormConcept(exp.concept);
    setFormAmount(String(exp.amount));
    setFormMethod(exp.payment_method);
    setFormPaidBy(exp.paid_by);
    setFormDate(exp.expense_date);
    const current = (splitsByExpense.get(exp.id) ?? []).map((s) => s.profile_id);
    setFormParticipants(new Set(current.length > 0 ? current : members.map((m) => m.id)));
    setError("");
    setShowForm(true);
  }

  function toggleParticipant(id: string) {
    setFormParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    const amount = Number(formAmount);
    if (!formConcept.trim()) {
      setError("El concepto es obligatorio.");
      return;
    }
    if (!amount || amount <= 0) {
      setError("El monto debe ser mayor a cero.");
      return;
    }
    if (!formPaidBy) {
      setError("Elegí quién pagó el gasto.");
      return;
    }
    const participants = [...formParticipants];
    if (participants.length === 0) {
      setError("Seleccioná al menos un participante.");
      return;
    }

    setSaving(true);
    setError("");
    const supabase = createClient();

    const payload = {
      concept: formConcept.trim(),
      amount,
      payment_method: formMethod,
      paid_by: formPaidBy,
      expense_date: formDate,
    };

    // Remember which participants had already settled, so editing the amount or
    // the participant list doesn't silently wipe that out.
    const prevSettled = new Map(
      (splitsByExpense.get(editingExpense?.id ?? "") ?? []).map((s) => [s.profile_id, s.settled])
    );

    let expenseId: string;

    if (editingExpense) {
      const { error: updErr } = await supabase
        .from("expenses")
        .update(payload)
        .eq("id", editingExpense.id);
      if (updErr) {
        setError("Error al actualizar el gasto: " + updErr.message);
        setSaving(false);
        return;
      }
      expenseId = editingExpense.id;
      // Rebuild the splits from scratch — amount/participants may have changed.
      await supabase.from("expense_splits").delete().eq("expense_id", expenseId);
    } else {
      const { data: inserted, error: expErr } = await supabase
        .from("expenses")
        .insert(payload)
        .select()
        .single();
      if (expErr || !inserted) {
        setError("Error al registrar el gasto: " + (expErr?.message ?? ""));
        setSaving(false);
        return;
      }
      expenseId = inserted.id;
    }

    const shares = equalShares(amount, participants.length);
    const rows = participants.map((profile_id, i) => ({
      expense_id: expenseId,
      profile_id,
      share_amount: shares[i],
      // payer's own share is auto-settled; others keep their prior settled state
      settled: profile_id === formPaidBy ? true : (prevSettled.get(profile_id) ?? false),
    }));

    const { error: splitErr } = await supabase.from("expense_splits").insert(rows);
    if (splitErr) {
      setError("Gasto guardado pero error al dividir: " + splitErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowForm(false);
    loadAll();
  }

  async function toggleSettled(split: Split) {
    const supabase = createClient();
    const next = !split.settled;
    setSplits((prev) =>
      prev.map((s) => (s.id === split.id ? { ...s, settled: next } : s))
    );
    await supabase.from("expense_splits").update({ settled: next }).eq("id", split.id);
  }

  async function deleteExpense(id: string) {
    const supabase = createClient();
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setSplits((prev) => prev.filter((s) => s.expense_id !== id));
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--color-mist)",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13.5,
    fontFamily: "var(--font-sans)",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--color-slate2)",
    marginBottom: 4,
    display: "block",
  };

  const amountNum = Number(formAmount) || 0;
  const perPerson =
    formParticipants.size > 0 ? amountNum / formParticipants.size : 0;

  return (
    <>
      <Topbar
        breadcrumb="Nodo Core · Gestión"
        title="Caja"
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar gastos..."
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 30px" }}>
        {/* Stats */}
        <div
          className="panel-stats"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
            marginBottom: 24,
          }}
        >
          {[
            { label: "Total gastado", value: formatMoney(totalSpent) },
            { label: "Este mes", value: formatMoney(monthSpent) },
            { label: "Pendiente de saldar", value: formatMoney(pending) },
            { label: "Gastos registrados", value: String(expenses.length) },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "white",
                border: "1px solid var(--color-mist)",
                borderRadius: 10,
                padding: "18px 20px",
              }}
            >
              <p style={{ margin: 0, fontSize: 13, color: "var(--color-slate2)", fontWeight: 500, marginBottom: 6 }}>
                {stat.label}
              </p>
              <p style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, color: "var(--color-navy)" }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Balances */}
        {members.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-slate2)" }}>
              Saldos del equipo
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {members.map((m) => {
                const bal = balances.get(m.id) ?? 0;
                const positive = bal > 0.005;
                const negative = bal < -0.005;
                const color = positive ? "#1F8A5B" : negative ? "#C0392B" : "var(--color-slate2)";
                const note = positive ? "le deben" : negative ? "debe" : "al día";
                return (
                  <div
                    key={m.id}
                    style={{
                      background: "white",
                      border: "1px solid var(--color-mist)",
                      borderRadius: 10,
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minWidth: 200,
                    }}
                  >
                    <div
                      style={{
                        width: 34, height: 34, borderRadius: "50%",
                        background: m.color, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, color: "white",
                      }}
                    >
                      {m.initials}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--color-ink)" }}>
                        {m.full_name}
                      </p>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color }}>
                        {note} {formatMoney(Math.abs(bal))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Header + Add */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-slate2)" }}>
            {filtered.length} {filtered.length === 1 ? "gasto" : "gastos"}
          </p>
          <button
            onClick={openForm}
            style={{
              background: "var(--color-brand)",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "9px 18px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}
          >
            + Registrar gasto
          </button>
        </div>

        {/* Expense list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--color-slate2)", fontSize: 14 }}>
            Cargando gastos...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--color-slate2)", fontSize: 14 }}>
            No hay gastos registrados todavía.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((exp) => {
              const payer = memberById.get(exp.paid_by);
              const expSplits = splitsByExpense.get(exp.id) ?? [];
              return (
                <div
                  key={exp.id}
                  style={{
                    background: "white",
                    border: "1px solid var(--color-mist)",
                    borderRadius: 12,
                    padding: 18,
                  }}
                >
                  {/* Header row */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "var(--color-navy)", fontFamily: "var(--font-display)" }}>
                        {exp.concept}
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-slate2)" }}>
                        Pagó <strong style={{ color: "var(--color-ink)" }}>{payer?.full_name ?? "—"}</strong>
                        {" · "}{exp.payment_method}{" · "}{formatDate(exp.expense_date)}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      <span style={{ fontSize: 17, fontWeight: 700, color: "var(--color-navy)", fontFamily: "var(--font-display)", whiteSpace: "nowrap" }}>
                        {formatMoney(Number(exp.amount))}
                      </span>
                      <button
                        onClick={() => openEditForm(exp)}
                        aria-label="Editar gasto"
                        title="Editar"
                        style={{
                          background: "transparent",
                          color: "var(--color-brand)",
                          border: "1px solid var(--color-brand)",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "var(--font-sans)",
                        }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => deleteExpense(exp.id)}
                        aria-label="Eliminar gasto"
                        title="Eliminar"
                        style={{
                          background: "transparent",
                          color: "#C0392B",
                          border: "1px solid #F5C6C2",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "var(--font-sans)",
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {/* Splits */}
                  {expSplits.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--color-mist)" }}>
                      {expSplits.map((s) => {
                        const m = memberById.get(s.profile_id);
                        const isPayer = s.profile_id === exp.paid_by;
                        return (
                          <div
                            key={s.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              border: "1px solid var(--color-mist)",
                              borderRadius: 999,
                              padding: "4px 6px 4px 10px",
                              background: s.settled ? "#E1F0E8" : "var(--color-paper)",
                            }}
                          >
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-ink)" }}>
                              {m?.full_name ?? "—"}
                            </span>
                            <span style={{ fontSize: 12.5, color: "var(--color-slate2)" }}>
                              {formatMoney(Number(s.share_amount))}
                            </span>
                            {isPayer ? (
                              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#1F8A5B", padding: "2px 8px" }}>
                                pagó
                              </span>
                            ) : (
                              <button
                                onClick={() => toggleSettled(s)}
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  border: "none",
                                  borderRadius: 999,
                                  padding: "3px 10px",
                                  cursor: "pointer",
                                  fontFamily: "var(--font-sans)",
                                  background: s.settled ? "#1F8A5B" : "var(--color-mist)",
                                  color: s.settled ? "white" : "var(--color-slate2)",
                                }}
                              >
                                {s.settled ? "Saldado" : "Pendiente"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal */}
        {showForm && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(18,30,47,.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              padding: 16,
            }}
          >
            <div
              style={{
                background: "white",
                borderRadius: 12,
                width: "min(460px, 96vw)",
                maxHeight: "92vh",
                overflowY: "auto",
                boxShadow: "0 12px 40px rgba(18,30,47,.18)",
              }}
            >
              <div
                style={{
                  padding: "16px 24px",
                  borderBottom: "1px solid var(--color-mist)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  position: "sticky",
                  top: 0,
                  background: "white",
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--color-navy)", fontFamily: "var(--font-display)" }}>
                  {editingExpense ? "Editar gasto" : "Nuevo gasto"}
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--color-slate2)", fontSize: 20, lineHeight: 1, padding: "2px 4px" }}
                >
                  ×
                </button>
              </div>

              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Concepto</label>
                  <input
                    type="text"
                    value={formConcept}
                    onChange={(e) => setFormConcept(e.target.value)}
                    style={inputStyle}
                    placeholder="Ej: Hosting, dominio, Figma..."
                  />
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Monto</label>
                    <input
                      type="number"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      style={inputStyle}
                      placeholder="8500"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Fecha</label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Cómo se abonó</label>
                  <select value={formMethod} onChange={(e) => setFormMethod(e.target.value)} style={inputStyle}>
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>{pm}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Pagado por</label>
                  <select value={formPaidBy} onChange={(e) => setFormPaidBy(e.target.value)} style={inputStyle}>
                    {members.length === 0 && <option value="">No hay miembros</option>}
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Dividir entre</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {members.map((m) => {
                      const checked = formParticipants.has(m.id);
                      return (
                        <label
                          key={m.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 9,
                            padding: "7px 10px",
                            border: "1px solid var(--color-mist)",
                            borderRadius: 8,
                            cursor: "pointer",
                            background: checked ? "var(--color-paper)" : "white",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleParticipant(m.id)}
                            style={{ accentColor: "var(--color-brand)" }}
                          />
                          <span style={{ fontSize: 13.5, color: "var(--color-ink)" }}>{m.full_name}</span>
                        </label>
                      );
                    })}
                  </div>
                  {formParticipants.size > 0 && amountNum > 0 && (
                    <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--color-slate2)" }}>
                      Cada uno: <strong style={{ color: "var(--color-navy)" }}>{formatMoney(perPerson)}</strong>
                      {" "}({formParticipants.size} {formParticipants.size === 1 ? "persona" : "personas"})
                    </p>
                  )}
                </div>

                {error && <p style={{ margin: 0, fontSize: 12.5, color: "#C0392B" }}>{error}</p>}

                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      flex: 1,
                      background: "var(--color-brand)",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 16px",
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: saving ? "not-allowed" : "pointer",
                      fontFamily: "var(--font-sans)",
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? "Guardando..." : editingExpense ? "Guardar cambios" : "Registrar gasto"}
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    style={{
                      flex: 1,
                      background: "transparent",
                      color: "var(--color-slate2)",
                      border: "1px solid var(--color-mist)",
                      borderRadius: 8,
                      padding: "10px 16px",
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
