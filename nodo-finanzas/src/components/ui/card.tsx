import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CardProps {
  className?: string;
  children: React.ReactNode;
  title?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function Card({
  className = '',
  children,
  title,
  collapsible = false,
  defaultOpen = true,
}: CardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-mist p-5 ${className}`}>
      {title &&
        (collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className={`flex w-full items-center justify-between gap-3 text-left ${open ? 'mb-6' : ''}`}
            aria-expanded={open}
          >
            <h3 className="text-base font-bold text-ink">{title}</h3>
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
