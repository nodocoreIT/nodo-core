import { useEffect } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

/**
 * Auto-scroll and focus to the first form field with a validation error.
 * Call this in any form using react-hook-form.
 */
export function useScrollToError<T extends FieldValues>(form: UseFormReturn<T>) {
  useEffect(() => {
    const errors = form.formState.errors;
    if (Object.keys(errors).length === 0) return;

    setTimeout(() => {
      // FormMessage renders <p id="*-form-item-message"> only when there is an error.
      // Querying by ID suffix finds the first one in DOM order, which works for
      // both native inputs and custom components like Radix Select.
      const firstErrorMsg = document.querySelector(
        '[id$="-form-item-message"]',
      ) as HTMLElement | null;

      if (firstErrorMsg) {
        firstErrorMsg.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      // Fallback: native inputs with a name attribute
      const firstKey = Object.keys(errors)[0];
      const input = document.querySelector(
        `[name="${firstKey}"]`,
      ) as HTMLElement | null;
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, [Object.keys(form.formState.errors).join(","), form]);
}
