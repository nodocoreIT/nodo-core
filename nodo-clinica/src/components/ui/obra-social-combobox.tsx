"use client"

import * as React from "react"
import { Combobox } from "@base-ui/react/combobox"
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

interface ObraSocial {
  id: string
  name: string
}

interface ObraSocialComboboxProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

export function ObraSocialCombobox({
  value,
  onChange,
  disabled = false,
  placeholder = "Buscar obra social...",
}: ObraSocialComboboxProps) {
  const [results, setResults] = React.useState<ObraSocial[]>([])
  const [loading, setLoading] = React.useState(false)
  const [adding, setAdding] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const params = inputValue ? `?q=${encodeURIComponent(inputValue)}` : ""
        const res = await fetch(`/api/clinic/obras-sociales${params}`)
        if (!res.ok) throw new Error("Error al buscar obras sociales")
        const data = await res.json()
        setResults(data.obrasSociales ?? [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [inputValue])

  async function handleAddNew() {
    const newName = inputValue.trim()
    if (!newName || adding) return
    setAdding(true)
    try {
      const res = await fetch("/api/clinic/obras-sociales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) throw new Error("Error al agregar obra social")
      const data = await res.json()
      const savedName: string = (data.obraSocial?.name ?? newName).toUpperCase()
      onChange(savedName)
      setInputValue("")
    } catch {
      // keep state so user can retry
    } finally {
      setAdding(false)
    }
  }

  const showAddOption =
    inputValue.trim().length > 0 &&
    !loading &&
    results.length === 0

  return (
    <Combobox.Root
      value={value || null}
      onValueChange={(val) => onChange(val ?? "")}
      onInputValueChange={setInputValue}
      disabled={disabled}
      data-slot="obra-social-combobox"
    >
      <Combobox.InputGroup className="relative">
        <Combobox.Input
          placeholder={placeholder}
          className={cn(
            "h-auto w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm text-navy shadow-sm transition-colors outline-none",
            "placeholder:text-slate-400",
            "focus-visible:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-500/25",
            "[&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_#ffffff] [&:-webkit-autofill]:[-webkit-text-fill-color:#1e293b]",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
          )}
        />
        <Combobox.Icon className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
          <ChevronsUpDown className="size-3.5" />
        </Combobox.Icon>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="isolate z-50 outline-none">
          <Combobox.Popup
            className={cn(
              "max-h-(--available-height) w-(--anchor-width) overflow-y-auto rounded-lg p-1",
              "bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10",
              "origin-(--transform-origin)",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
            )}
          >
            {loading && (
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Buscando...</span>
              </div>
            )}

            {!loading && results.map((os) => (
              <Combobox.Item
                key={os.id}
                value={os.name.toUpperCase()}
                className={cn(
                  "relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none",
                  "focus:bg-accent focus:text-accent-foreground",
                  "data-disabled:pointer-events-none data-disabled:opacity-50",
                  "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                )}
              >
                <Combobox.ItemIndicator className="flex items-center">
                  <Check className="size-3.5" />
                </Combobox.ItemIndicator>
                {os.name.toUpperCase()}
              </Combobox.Item>
            ))}

            {showAddOption && (
              <div
                role="option"
                aria-selected={false}
                onClick={handleAddNew}
                onKeyDown={(e) => e.key === "Enter" && handleAddNew()}
                tabIndex={0}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-primary outline-hidden select-none",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus:bg-accent focus:text-accent-foreground",
                  adding && "pointer-events-none opacity-50"
                )}
              >
                {adding ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin" />
                ) : (
                  <Plus className="size-3.5 shrink-0" />
                )}
                <span>
                  Agregar: <span className="font-medium">{inputValue.trim().toUpperCase()}</span>
                </span>
              </div>
            )}

            {!loading && !showAddOption && results.length === 0 && (
              <Combobox.Empty className="px-2 py-1.5 text-sm text-muted-foreground">
                Sin resultados
              </Combobox.Empty>
            )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
