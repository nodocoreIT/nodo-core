import { useEffect } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

/**
 * Auto-scroll and focus to the first form field with a validation error.
 * Call this in any form using react-hook-form.
 */
export function useScrollToError<T extends FieldValues>(form: UseFormReturn<T>) {
  useEffect(() => {
    const errors = form.formState.errors;
    const errorKeys = Object.keys(errors);

    if (errorKeys.length === 0) return;

    const firstErrorKey = errorKeys[0];
    form.setFocus(firstErrorKey as any);

    setTimeout(() => {
      // Native inputs expose [name]; custom components (Select, etc.) get aria-invalid
      const el =
        (document.querySelector(`[name="${firstErrorKey}"]`) as HTMLElement | null) ??
        (document.querySelector('[aria-invalid="true"]') as HTMLElement | null);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);
  }, [Object.keys(form.formState.errors).join(","), form]);
}
