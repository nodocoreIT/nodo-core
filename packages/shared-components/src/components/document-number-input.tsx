import * as React from "react";
import { cn } from "../lib/utils";
import {
  formatDocumentNumberInput,
  resolveDocumentFormat,
  type DocumentNumberFormat,
} from "../lib/document-number";
import { Input, type InputProps } from "./ui/input";

export interface DocumentNumberInputProps extends Omit<InputProps, "type" | "inputMode"> {
  documentType?: string | null;
  format?: DocumentNumberFormat;
}

export const DocumentNumberInput = React.forwardRef<HTMLInputElement, DocumentNumberInputProps>(
  ({ documentType, format, className, onChange, value, placeholder, ...props }, ref) => {
    const resolved = resolveDocumentFormat(documentType, format);
    const displayValue =
      typeof value === "string" && value
        ? formatDocumentNumberInput(value, documentType, format)
        : (value ?? "");

    const defaultPlaceholder =
      resolved === "cuit"
        ? "20-12345678-9"
        : resolved === "free"
          ? "Número de documento"
          : "12.345.678";

    return (
      <Input
        ref={ref}
        type="text"
        inputMode={resolved === "free" ? "text" : "numeric"}
        className={cn(className)}
        placeholder={placeholder ?? defaultPlaceholder}
        value={displayValue}
        onChange={(event) => {
          const formatted = formatDocumentNumberInput(
            event.target.value,
            documentType,
            format,
          );
          onChange?.({
            ...event,
            target: { ...event.target, value: formatted },
            currentTarget: { ...event.currentTarget, value: formatted },
          });
        }}
        {...props}
      />
    );
  },
);

DocumentNumberInput.displayName = "DocumentNumberInput";
