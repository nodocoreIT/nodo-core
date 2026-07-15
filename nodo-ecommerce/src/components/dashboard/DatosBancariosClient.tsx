"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Building2, Save, CheckCircle, Plus, Trash2, ChevronDown, ChevronUp, Share2 } from "lucide-react";

interface Cuenta {
  id: string;
  titular: string;
  banco: string;
  cbu: string;
  alias: string;
}

interface Props {
  config: Record<string, string>;
}

function seedCuentas(config: Record<string, string>): Cuenta[] {
  // New format
  if (config.cuentas_bancarias) {
    try { return JSON.parse(config.cuentas_bancarias); } catch { /* fall through */ }
  }
  // Migrate legacy single-account keys
  if (config.cbu || config.titular) {
    return [{
      id: "legacy",
      titular: config.titular || "",
      banco: config.banco || "",
      cbu: config.cbu || "",
      alias: config.alias_cbu || "",
    }];
  }
  return [];
}

const EMPTY_FORM = { titular: "", banco: "", cbu: "", alias: "" };

const inputClass = "w-full bg-[#111111] border border-luxury-gray-mid text-white px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors placeholder-[#444444]";
const labelClass = "block text-luxury-gray-light text-xs uppercase tracking-wider mb-1.5";

export default function DatosBancariosClient({ config: initial }: Props) {
  const [cuentas, setCuentas] = useState<Cuenta[]>(() => seedCuentas(initial));
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, Omit<Cuenta, "id">>>({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  async function persist(list: Cuenta[]) {
    setLoading(true);
    setError("");
    const { error: err } = await supabase
      .from("configuracion")
      .upsert(
        [{ clave: "cuentas_bancarias", valor: JSON.stringify(list), updated_at: new Date().toISOString() }],
        { onConflict: "clave" }
      );
    setLoading(false);
    if (err) { setError(err.message); return false; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    return true;
  }

  async function handleAdd() {
    if (!newForm.titular && !newForm.banco) return;
    const next: Cuenta[] = [
      ...cuentas,
      { id: Date.now().toString(), ...newForm },
    ];
    const ok = await persist(next);
    if (ok) { setCuentas(next); setNewForm(EMPTY_FORM); setAdding(false); }
  }

  async function handleDelete(id: string) {
    const next = cuentas.filter((c) => c.id !== id);
    const ok = await persist(next);
    if (ok) setCuentas(next);
  }

  async function handleEdit(id: string) {
    const data = editForms[id];
    if (!data) return;
    const next = cuentas.map((c) => c.id === id ? { id, ...data } : c);
    const ok = await persist(next);
    if (ok) { setCuentas(next); setExpandedId(null); }
  }

  function startEdit(cuenta: Cuenta) {
    setEditForms((prev) => ({
      ...prev,
      [cuenta.id]: { titular: cuenta.titular, banco: cuenta.banco, cbu: cuenta.cbu, alias: cuenta.alias },
    }));
    setExpandedId(cuenta.id);
  }

  return (
    <>
      {/* Snackbar */}
      <div
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-luxury-gray border border-gold/40 text-white px-4 py-3 text-sm shadow-xl transition-all duration-300 ${
          saved ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <CheckCircle size={15} className="text-gold shrink-0" />
        Datos guardados correctamente
      </div>

      <div className="mb-8">
        <p className="text-gold text-xs tracking-[0.3em] uppercase mb-1">Dashboard</p>
        <h1 className="text-white text-2xl font-serif">Datos Bancarios</h1>
        <p className="text-[#555555] text-sm mt-1">
          Estos datos se muestran al cliente cuando elige pagar por transferencia.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-3xl">

        {/* Lista de cuentas */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 mb-1">
            <Building2 size={16} className="text-gold" />
            <h2 className="text-white text-xs font-bold tracking-[0.2em] uppercase">Cuentas</h2>
          </div>

          {cuentas.length === 0 && (
            <p className="text-[#444] text-sm py-4">No hay cuentas cargadas todavía.</p>
          )}

          {cuentas.map((cuenta) => {
            const isExpanded = expandedId === cuenta.id;
            const ef = editForms[cuenta.id] ?? { titular: cuenta.titular, banco: cuenta.banco, cbu: cuenta.cbu, alias: cuenta.alias };

            return (
              <div key={cuenta.id} className="bg-luxury-black border border-luxury-gray">
                {/* Header de la card */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-white text-sm font-medium">{cuenta.banco || "Sin nombre"}</p>
                    <p className="text-luxury-gray-light text-xs mt-0.5">{cuenta.titular}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => isExpanded ? setExpandedId(null) : startEdit(cuenta)}
                      className="p-2 text-[#555] hover:text-gold transition-colors"
                      aria-label="Editar"
                    >
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cuenta.id)}
                      className="p-2 text-[#555] hover:text-red-400 transition-colors"
                      aria-label="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Formulario de edición inline */}
                {isExpanded && (
                  <div className="border-t border-luxury-gray px-4 py-4 space-y-3">
                    {(["titular", "banco", "cbu", "alias"] as const).map((key) => (
                      <div key={key}>
                        <label className={labelClass}>{key === "alias" ? "Alias CBU" : key.charAt(0).toUpperCase() + key.slice(1)}</label>
                        <input
                          value={ef[key]}
                          onChange={(e) => setEditForms((prev) => ({ ...prev, [cuenta.id]: { ...ef, [key]: e.target.value } }))}
                          className={inputClass}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleEdit(cuenta.id)}
                      disabled={loading}
                      className="flex items-center gap-2 bg-gold text-black font-bold px-4 py-2 text-xs tracking-wider hover:bg-gold-light transition-colors disabled:opacity-50"
                    >
                      <Save size={13} /> Guardar cambios
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Formulario nueva cuenta */}
          {adding && (
            <div className="bg-luxury-black border border-gold/30 p-4 space-y-3">
              <p className="text-gold text-xs uppercase tracking-wider font-bold">Nueva cuenta</p>
              {([
                ["titular", "Titular", "Nombre completo o razón social"],
                ["banco", "Banco / Billetera", "Ej: Mercado Pago, Uala, Brubank..."],
                ["cbu", "CBU / CVU", "22 dígitos"],
                ["alias", "Alias", "Ej: MITIENDA.MP"],
              ] as const).map(([key, label, placeholder]) => (
                <div key={key}>
                  <label className={labelClass}>{label}</label>
                  <input
                    value={newForm[key]}
                    onChange={(e) => setNewForm({ ...newForm, [key]: e.target.value })}
                    className={inputClass}
                    placeholder={placeholder}
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={loading}
                  className="flex items-center gap-2 bg-gold text-black font-bold px-4 py-2 text-xs tracking-wider hover:bg-gold-light transition-colors disabled:opacity-50"
                >
                  <Save size={13} /> Agregar
                </button>
                <button
                  type="button"
                  onClick={() => { setAdding(false); setNewForm(EMPTY_FORM); }}
                  className="px-4 py-2 text-xs text-[#555] hover:text-white transition-colors border border-luxury-gray-mid"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 border border-dashed border-luxury-gray-mid text-[#555] hover:text-gold hover:border-gold/40 text-xs uppercase tracking-wider px-4 py-3 w-full transition-colors"
            >
              <Plus size={14} /> Agregar cuenta
            </button>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>

        {/* Vista previa */}
        <div className="space-y-3">
          <p className="text-[#555555] text-xs uppercase tracking-wider mb-1">Vista previa — Confirmación de pedido</p>
          {cuentas.length === 0 && (
            <p className="text-[#333] text-xs italic">Sin cuentas cargadas.</p>
          )}
          {cuentas.map((c) => {
            const waText = [
              `💳 *Datos para transferencia*`,
              c.banco    && `🏦 Banco: ${c.banco}`,
              c.titular  && `👤 Titular: ${c.titular}`,
              c.cbu      && `📋 CBU/CVU: ${c.cbu}`,
              c.alias    && `🔑 Alias: ${c.alias}`,
            ].filter(Boolean).join("\n");

            return (
              <div key={c.id} className="bg-luxury-black border border-luxury-gray p-4 space-y-2 text-sm">
                {[
                  ["Banco", c.banco],
                  ["Titular", c.titular],
                  ["CBU/CVU", c.cbu],
                  ["Alias", c.alias],
                ].map(([k, v]) => v ? (
                  <div key={k} className="flex justify-between border-b border-[#111] pb-1.5">
                    <span className="text-luxury-gray-light">{k}</span>
                    <span className="text-white font-mono text-xs">{v}</span>
                  </div>
                ) : null)}

                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 mt-3 text-green-400 hover:text-green-300 text-xs transition-colors"
                >
                  <Share2 size={13} />
                  Compartir por WhatsApp
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
