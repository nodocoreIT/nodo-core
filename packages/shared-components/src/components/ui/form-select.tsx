"use client";

import { useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { cn } from "../../lib/utils";

export const EMPTY_SELECT_VALUE = "__empty__";

function resolveRadixValue(
  value: string | undefined,
  options: readonly FormSelectOption[],
  allowEmpty: boolean,
): string {
  const safe = value ?? "";

  if (safe !== "" && options.some((option) => option.value === safe)) {
    return safe;
  }

  if (allowEmpty) return EMPTY_SELECT_VALUE;

  return options[0]?.value ?? EMPTY_SELECT_VALUE;
}

export type FormSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export interface FormSelectProps {
  value?: string;
  onChange: (value: string) => void;
  options: readonly FormSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  triggerClassName?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  /** Raise above modals/dialogs (e.g. z-[200]). */
  contentClassName?: string;
  "aria-label"?: string;
}

export function FormSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccioná...",
  disabled,
  id,
  className,
  triggerClassName,
  allowEmpty = false,
  emptyLabel = "—",
  contentClassName,
  "aria-label": ariaLabel,
}: FormSelectProps) {
  const emptyOption = options.find((option) => option.value === "");
  const safeOptions = options.filter((option) => option.value !== "");
  const resolvedAllowEmpty = allowEmpty || emptyOption !== undefined;
  const resolvedEmptyLabel = emptyLabel ?? emptyOption?.label ?? "—";

  const radixValue = resolveRadixValue(value, safeOptions, resolvedAllowEmpty);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const safe = value ?? "";
    const isValidOption =
      safe !== "" && safeOptions.some((option) => option.value === safe);
    if (isValidOption || safe === "") return;

    onChangeRef.current(resolvedAllowEmpty ? "" : safeOptions[0]?.value ?? "");
  }, [value, safeOptions, resolvedAllowEmpty]);

  return (
    <div className={cn("relative", className)}>
      <Select
        value={radixValue}
        onValueChange={(next) => onChange(next === EMPTY_SELECT_VALUE ? "" : next)}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          aria-label={ariaLabel}
          className={cn("rounded-md", triggerClassName)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className={cn("z-[200]", contentClassName)}>
          {resolvedAllowEmpty && (
            <SelectItem value={EMPTY_SELECT_VALUE}>{resolvedEmptyLabel}</SelectItem>
          )}
          {safeOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
