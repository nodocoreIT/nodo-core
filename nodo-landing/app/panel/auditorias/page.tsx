"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import Topbar from "@/components/panel/Topbar";

type AuditDoc = { id: string; title: string; html: string };
type AuditGroup = { title: string; docs: AuditDoc[] };

// Scoped styles for the rendered markdown HTML (trusted, build-generated).
const AUDIT_CSS = `
.audit-doc{color:var(--color-ink,#1a1f27);font-size:14.5px;line-height:1.6}
.audit-doc h1{font-size:24px;font-weight:700;margin:.2em 0 .5em;line-height:1.2}
.audit-doc h2{font-size:19px;font-weight:700;margin:1.4em 0 .5em;padding-bottom:.3em;border-bottom:1px solid var(--color-border,#e2e6ec)}
.audit-doc h3{font-size:16px;font-weight:700;margin:1.1em 0 .4em}
.audit-doc p{margin:.6em 0}
.audit-doc a{color:var(--color-brand,#2d63e0);text-decoration:underline}
.audit-doc code{background:var(--color-mist,#f0f2f5);padding:.12em .4em;border-radius:5px;font-size:.86em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.audit-doc pre.code{background:#0b0e13;color:#e6e9ef;border-radius:10px;padding:14px 16px;overflow-x:auto;font-size:12.5px;line-height:1.5;margin:1em 0}
.audit-doc pre.code code{background:none;padding:0;color:inherit}
.audit-doc .table-wrap{overflow-x:auto;margin:1em 0;border:1px solid var(--color-border,#e2e6ec);border-radius:10px}
.audit-doc table{border-collapse:collapse;width:100%;font-size:13px}
.audit-doc th,.audit-doc td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--color-border,#e2e6ec);vertical-align:top}
.audit-doc th{background:var(--color-mist,#f0f2f5);font-weight:700;white-space:nowrap}
.audit-doc tr:last-child td{border-bottom:none}
.audit-doc blockquote{margin:1em 0;padding:10px 16px;border-left:3px solid var(--color-brand,#2d63e0);background:var(--color-mist,#f0f2f5);border-radius:0 8px 8px 0}
.audit-doc hr{border:none;border-top:1px solid var(--color-border,#e2e6ec);margin:1.6em 0}
.audit-doc ul,.audit-doc ol{padding-left:22px;margin:.5em 0}
.audit-doc li{margin:.25em 0}
`;

export default function AuditoriasPage() {
  const [groups, setGroups] = useState<AuditGroup[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/auditorias");
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.ok) {
          setError(json.error ?? "No se pudo cargar la auditoría.");
          setLoading(false);
          return;
        }
        const loaded = (json.groups ?? []) as AuditGroup[];
        setGroups(loaded);
        setGeneratedAt(json.generatedAt ?? "");
        setActiveId(loaded[0]?.docs[0]?.id ?? "");
        setLoading(false);
      } catch {
        if (!active) return;
        setError("Error de red al cargar la auditoría.");
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const allDocs = useMemo(() => groups.flatMap((g) => g.docs), [groups]);
  const activeDoc = useMemo(
    () => allDocs.find((d) => d.id === activeId) ?? null,
    [allDocs, activeId],
  );

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        docs: g.docs.filter(
          (d) => d.title.toLowerCase().includes(q) || d.html.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.docs.length > 0);
  }, [groups, query]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar title="Auditorías" breadcrumb="Nodo Core · Herramientas" />
      <style>{AUDIT_CSS}</style>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-slate2">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Cargando auditoría…
        </div>
      ) : error ? (
        <div className="p-6">
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <aside className="hidden w-72 flex-shrink-0 flex-col border-r border-border bg-surface md:flex">
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate2" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar en la auditoría…"
                  className="w-full rounded-lg border border-border bg-paper py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-brand"
                />
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto p-2">
              {filteredGroups.length === 0 ? (
                <p className="px-2 py-3 text-sm text-slate2">Sin resultados.</p>
              ) : (
                filteredGroups.map((g) => (
                  <div key={g.title} className="mb-3">
                    <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate2">
                      {g.title}
                    </p>
                    {g.docs.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setActiveId(d.id)}
                        className={
                          "block w-full rounded-md px-2 py-2 text-left text-sm transition-colors " +
                          (d.id === activeId
                            ? "bg-brand text-white"
                            : "text-ink hover:bg-brand/10 hover:text-brand")
                        }
                      >
                        {d.title}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </nav>
            {generatedAt && (
              <p className="border-t border-border p-3 text-xs text-slate2">
                Generado: {generatedAt} · read-only
              </p>
            )}
          </aside>

          <div className="flex-1 overflow-y-auto">
            <div className="border-b border-border bg-surface p-3 md:hidden">
              <select
                value={activeId}
                onChange={(e) => setActiveId(e.target.value)}
                className="w-full rounded-lg border border-border bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              >
                {groups.map((g) => (
                  <optgroup key={g.title} label={g.title}>
                    {g.docs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
              {activeDoc ? (
                <article
                  className="audit-doc"
                  dangerouslySetInnerHTML={{ __html: activeDoc.html }}
                />
              ) : (
                <p className="text-slate2">Seleccioná un documento.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
