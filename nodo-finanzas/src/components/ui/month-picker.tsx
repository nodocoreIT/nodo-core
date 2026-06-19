import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@nodocore/shared-components';

interface MonthPickerProps {
  value: string; // YYYY-MM
  onChange: (v: string) => void;
  className?: string;
}

function addMonths(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('es-AR', { year: 'numeric', month: 'long' });
}

export function MonthPicker({ value, onChange, className }: MonthPickerProps) {
  return (
    <div
      className={cn(
        'inline-flex w-fit max-w-full items-center gap-1.5 sm:gap-2 bg-white border border-mist rounded-xl px-2.5 sm:px-3 py-2 shadow-sm',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(addMonths(value, -1))}
        className="p-1 rounded hover:bg-mist transition-colors text-slate2 hover:text-brand shrink-0"
        aria-label="Mes anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-xs sm:text-sm font-semibold text-ink whitespace-nowrap capitalize">
        {formatLabel(value)}
      </span>
      <button
        type="button"
        onClick={() => onChange(addMonths(value, 1))}
        className="p-1 rounded hover:bg-mist transition-colors text-slate2 hover:text-brand shrink-0"
        aria-label="Mes siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
