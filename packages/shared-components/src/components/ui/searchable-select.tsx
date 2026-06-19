"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../../lib/utils";
import type { FormSelectOption } from "./form-select";

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly FormSelectOption[] | readonly string[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  id?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
}

function normalizeOptions(
  options: readonly FormSelectOption[] | readonly string[],
): FormSelectOption[] {
  if (options.length === 0) return [];
  if (typeof options[0] === "string") {
    return (options as readonly string[]).map((option) => ({
      value: option,
      label: option,
    }));
  }
  return options as FormSelectOption[];
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccioná...",
  searchPlaceholder = "Buscar...",
  disabled,
  id,
  allowEmpty = false,
  emptyLabel = "—",
  className,
  triggerClassName,
  "aria-label": ariaLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const normalized = useMemo(() => normalizeOptions(options), [options]);

  const filtered =
    search.trim() === ""
      ? normalized
      : normalized.filter((option) =>
          option.label.toLowerCase().includes(search.toLowerCase()),
        );

  const selectedLabel =
    normalized.find((option) => option.value === value)?.label ??
    (allowEmpty && !value ? emptyLabel : "");

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  function handleSelect(optionValue: string) {
    onChange(optionValue);
    close();
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !selectedLabel && "text-muted-foreground",
          triggerClassName,
        )}
      >
        <span className="truncate">{selectedLabel || placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-md"
        >
          <div className="border-b border-border px-2 py-1.5">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
              }}
            />
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {allowEmpty && (
              <button
                type="button"
                role="option"
                aria-selected={!value}
                onClick={() => handleSelect("")}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                  "hover:bg-accent hover:text-accent-foreground",
                  !value && "bg-accent/40",
                )}
              >
                <Check
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    !value ? "opacity-100" : "opacity-0",
                  )}
                />
                {emptyLabel}
              </button>
            )}

            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin resultados
              </p>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={value === option.value}
                  disabled={option.disabled}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                    "hover:bg-accent hover:text-accent-foreground",
                    value === option.value && "bg-accent/40",
                    option.disabled && "pointer-events-none opacity-50",
                  )}
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
