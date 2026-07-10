import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CardProps {
  className?: string;
  children: React.ReactNode;
  title?: string;
  titleClassName?: string;
  titleIcon?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  storageKey?: string;
}

export function Card({
  className = '',
  children,
  title,
  titleClassName = 'text-base',
  titleIcon,
  collapsible = false,
  defaultOpen = true,
  storageKey,
}: CardProps) {
  const [open, setOpen] = useState(() => {
    if (storageKey) {
      const stored = sessionStorage.getItem(`card-open:${storageKey}`);
      if (stored !== null) return stored === 'true';
    }
    return defaultOpen;
  });

  function handleToggle() {
    setOpen((prev) => {
      const next = !prev;
      if (storageKey) sessionStorage.setItem(`card-open:${storageKey}`, String(next));
      return next;
    });
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-mist p-5 ${className}`}>
      {title &&
        (collapsible ? (
          <button
            type="button"
            onClick={handleToggle}
            className={`flex w-full items-center justify-between gap-3 text-left ${open ? 'mb-6' : ''}`}
            aria-expanded={open}
          >
            <span className="flex items-center gap-2">
              {titleIcon}
              <h3 className={`${titleClassName} font-bold text-ink`}>{title}</h3>
            </span>
            {open ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-slate2" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate2" aria-hidden />
            )}
          </button>
        ) : (
          <h3 className="text-base font-bold text-ink mb-6">{title}</h3>
        ))}
      {(!collapsible || open) && children}
    </div>
  );
}
