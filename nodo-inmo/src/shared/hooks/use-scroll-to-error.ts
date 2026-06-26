import { useEffect } from "react";
import type { MutableRefObject } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

/**
 * Auto-scroll to the first form field with a validation error.
 *
 * Pass `fieldRefs` for custom components (e.g. Radix Select) that don't
 * expose a native `name` attribute. Native inputs are handled via fallback.
 */
export function useScrollToError<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldRefs?: MutableRefObject<Record<string, HTMLDivElement | null>>,
) {
  useEffect(() => {
    const errors = form.formState.errors;
    const keys = Object.keys(errors);
    if (keys.length === 0) return;

    const firstKey = keys[0];

    // 1. Try the ref map — direct, works for any field type
    const refEl = fieldRefs?.current?.[firstKey];
    if (refEl) {
      refEl.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // 2. Fallback: native input with name attribute
    const input = document.querySelector(
      `[name="${firstKey}"]`,
    ) as HTMLElement | null;
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [Object.keys(form.formState.errors).join(","), form, fieldRefs]);
}
