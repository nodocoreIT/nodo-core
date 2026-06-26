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

    if (errorKeys.length > 0) {
      // Always focus the first error field
      const firstErrorKey = errorKeys[0];
      form.setFocus(firstErrorKey as any);

      // Scroll to it
      setTimeout(() => {
        const input = document.querySelector(
          `[name="${firstErrorKey}"]`
        ) as HTMLElement | null;
        if (input) {
          input.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 50);
    }
  }, [Object.keys(form.formState.errors).join(","), form]);
