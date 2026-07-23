"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react"

import { cn } from "@/lib/utils"

interface Specialty {
  id: string
  name: string
}

interface SpecialtyComboboxProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

const triggerClassName = cn(
  "flex h-auto w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-navy shadow-sm transition-colors outline-none",
  "focus-visible:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-500/25",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
)

async function fetchSpecialties(): Promise<Specialty[]> {
  const res = await fetch("/api/clinic/specialties")
  if (!res.ok) throw new Error("Error al cargar especialidades")
  const data = await res.json()
  return (data.specialties ?? []) as Specialty[]
}

export function SpecialtyCombobox({
  value,
  onChange,
  disabled = false,
  placeholder = "Seleccioná o buscá especialidad…",
  className,
}: SpecialtyComboboxProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [specialties, setSpecialties] = React.useState<Specialty[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(false)

    fetchSpecialties()
      .then((items) => {
        if (!cancelled) setSpecialties(items)
      })
      .catch(() => {
        if (!cancelled) {
          setSpecialties([])
          setLoadError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [open])

  React.useEffect(() => {
    if (open) {
      window.setTimeout(() => searchRef.current?.focus(), 0)
    }
  }, [open])

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return specialties
    return specialties.filter((item) => item.name.toLowerCase().includes(query))
  }, [specialties, search])

  function selectSpecialty(name: string) {
    onChange(name)
    setOpen(false)
    setSearch("")
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={triggerClassName}
      >
        <span className={cn("truncate text-left", !value && "text-slate-400")}>
          {loading ? "Cargando especialidades…" : value || placeholder}
        </span>
        {loading ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-slate-400" />
        ) : (
          <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
        )}
      </button>

      {open && (
        <div
          className="absolute z-[120] mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          role="listbox"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar especialidad…"
              className="w-full bg-transparent text-sm text-navy placeholder:text-slate-400 outline-none"
            />
          </div>

          <div className="max-h-56 overflow-y-auto p-1">
            {loadError && (
              <p className="px-3 py-2 text-sm text-red-600">
                No se pudieron cargar las especialidades.
              </p>
            )}

            {!loadError && filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-slate-500">Sin resultados</p>
            )}

            {!loadError &&
              filtered.map((item) => {
                const selected = value === item.name
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => selectSpecialty(item.name)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-navy transition-colors",
                      selected ? "bg-teal-50 text-teal-800" : "hover:bg-slate-50",
                    )}
                  >
                    <Check
                      className={cn("size-4 shrink-0", selected ? "opacity-100" : "opacity-0")}
                    />
                    <span>{item.name}</span>
                  </button>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
