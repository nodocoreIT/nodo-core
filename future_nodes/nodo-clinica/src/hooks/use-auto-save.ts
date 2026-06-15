"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export function useAutoSave(
  value: string,
  onSave: (value: string) => Promise<void>,
  delay = 2000
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef(value);

  const save = useCallback(async () => {
    if (value !== lastSavedRef.current) {
      await onSave(value);
      lastSavedRef.current = value;
    }
  }, [value, onSave]);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(save, delay);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, delay, save]);
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
