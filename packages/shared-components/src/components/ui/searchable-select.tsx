"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn, foldForSearch } from "../../lib/utils";
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
  /**
   * Shown as an extra row (with a Plus icon) whenever the search box has
   * text — lets the caller offer "create this option" instead of leaving
   * the user stuck at "Sin resultados". Reachable via keyboard (arrow keys
   * + Enter) same as any other row. The select does not create the option
   * itself — it calls this and lets the caller decide what to do (insert,
   * select, close, etc).
   */
  onCreateNew?: (searchTerm: string) => void;
  /** Defaults to `Agregar "{searchTerm}"`. */
  createNewLabel?: (searchTerm: string) => string;
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

type Row =
  | { kind: "empty" }
  | { kind: "option"; option: FormSelectOption }
  | { kind: "create" };

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
  onCreateNew,
  createNewLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const normalized = useMemo(() => normalizeOptions(options), [options]);

  const filtered =
    search.trim() === ""
      ? normalized
      : normalized.filter((option) =>
          foldForSearch(option.label).includes(foldForSearch(search)),
        );

  const trimmedSearch = search.trim();
  const showCreateRow = Boolean(onCreateNew && trimmedSearch !== "");

  const rows: Row[] = useMemo(() => {
    const list: Row[] = [];
    if (allowEmpty) list.push({ kind: "empty" });
    for (const option of filtered) list.push({ kind: "option", option });
    if (showCreateRow) list.push({ kind: "create" });
    return list;
  }, [allowEmpty, filtered, showCreateRow]);

  const selectedLabel =
    normalized.find((option) => option.value === value)?.label ??
    (allowEmpty && !value ? emptyLabel : "");

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
    setHighlighted(0);
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

  // Reset the highlighted row whenever the visible row set changes, so it
  // never points past the end (e.g. after typing narrows the results).
  useEffect(() => {
    setHighlighted(0);
  }, [rows.length]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-row-index="${highlighted}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  function handleSelect(optionValue: string) {
    onChange(optionValue);
    close();
  }

  function activateRow(row: Row) {
    if (row.kind === "empty") {
      handleSelect("");
    } else if (row.kind === "option") {
      handleSelect(row.option.value);
    } else {
      onCreateNew?.(trimmedSearch);
      close();
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rows.length === 0) return;
      setHighlighted((i) => (i + 1) % rows.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rows.length === 0) return;
      setHighlighted((i) => (i - 1 + rows.length) % rows.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[highlighted];
      if (row) activateRow(row);
    }
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
              onKeyDown={handleSearchKeyDown}
            />
          </div>

          <div ref={listRef} className="max-h-56 overflow-y-auto py-1">
            {rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin resultados
              </p>
            ) : (
              rows.map((row, index) => {
                const isHighlighted = index === highlighted;
                if (row.kind === "empty") {
                  return (
                    <button
                      key="__empty"
                      type="button"
                      data-row-index={index}
                      role="option"
                      aria-selected={!value}
                      onClick={() => handleSelect("")}
                      onMouseEnter={() => setHighlighted(index)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                        isHighlighted && "bg-accent text-accent-foreground",
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
                  );
                }
                if (row.kind === "create") {
                  return (
                    <button
                      key="__create"
                      type="button"
                      data-row-index={index}
                      onClick={() => activateRow(row)}
                      onMouseEnter={() => setHighlighted(index)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-brand",
                        isHighlighted && "bg-accent",
                      )}
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0" />
                      {createNewLabel?.(trimmedSearch) ?? `Agregar "${trimmedSearch}"`}
                    </button>
                  );
                }
                const option = row.option;
                return (
                  <button
                    key={option.value}
                    type="button"
                    data-row-index={index}
                    role="option"
                    aria-selected={value === option.value}
                    disabled={option.disabled}
                    onClick={() => handleSelect(option.value)}
                    onMouseEnter={() => setHighlighted(index)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                      isHighlighted && "bg-accent text-accent-foreground",
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
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
