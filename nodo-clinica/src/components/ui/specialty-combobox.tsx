"use client"

import * as React from "react"
import { Combobox } from "@base-ui/react/combobox"
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react"

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
}

export function SpecialtyCombobox({
  value,
  onChange,
  disabled = false,
  placeholder = "Buscar especialidad...",
}: SpecialtyComboboxProps) {
  const [results, setResults] = React.useState<Specialty[]>([])
  const [loading, setLoading] = React.useState(false)
  const [adding, setAdding] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced fetch when input changes
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const params = inputValue ? `?q=${encodeURIComponent(inputValue)}` : ""
        const res = await fetch(`/api/clinic/specialties${params}`)
        if (!res.ok) throw new Error("Error al buscar especialidades")
        const data = await res.json()
        setResults(data.specialties ?? [])
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
      const res = await fetch("/api/clinic/specialties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) throw new Error("Error al agregar especialidad")
      const data = await res.json()
      const savedName: string = data.specialty?.name ?? newName
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
      data-slot="specialty-combobox"
    >
      <Combobox.InputGroup className="relative">
        <Combobox.Input
          placeholder={placeholder}
          className={cn(
            "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 pr-8 text-sm transition-colors outline-none",
            "placeholder:text-muted-foreground",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
          )}
        />
        <Combobox.Icon className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
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
            {/* Loading state */}
            {loading && (
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Buscando...</span>
              </div>
            )}

            {/* Results */}
            {!loading && results.map((specialty) => (
              <Combobox.Item
                key={specialty.id}
                value={specialty.name}
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
                {specialty.name}
              </Combobox.Item>
            ))}

            {/* Add new option */}
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
                  Agregar: <span className="font-medium">{inputValue.trim()}</span>
                </span>
              </div>
            )}

            {/* Empty state */}
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
