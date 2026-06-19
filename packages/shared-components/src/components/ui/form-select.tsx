"use client";

import { useEffect } from "react";
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
  "aria-label": ariaLabel,
}: FormSelectProps) {
  const radixValue = resolveRadixValue(value, options, allowEmpty);

  useEffect(() => {
    const safe = value ?? "";
    const isValidOption = safe !== "" && options.some((option) => option.value === safe);
    if (isValidOption || safe === "") return;

    onChange(allowEmpty ? "" : options[0]?.value ?? "");
  }, [value, options, allowEmpty, onChange]);

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
        <SelectContent>
          {allowEmpty && (
            <SelectItem value={EMPTY_SELECT_VALUE}>{emptyLabel}</SelectItem>
          )}
          {options.map((option) => (
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
