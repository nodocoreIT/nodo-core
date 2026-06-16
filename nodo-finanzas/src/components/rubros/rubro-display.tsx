import type { Rubro } from '@/types';
import { normalizarCodigoRubro } from '@/utils/rubro-formatters';

interface RubroDisplayProps {
  rubro?: Rubro | null;
  fallback?: string;
  showDescription?: boolean;
}

export function RubroDisplay({ rubro, fallback = 'Sin rubro', showDescription = true }: RubroDisplayProps) {
  if (!rubro) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-mist text-slate2">
        {fallback}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-mist text-ink"
      title={showDescription && rubro.descripcion ? rubro.descripcion : undefined}
    >
      <span>{rubro.emoji}</span>
      <span>{normalizarCodigoRubro(rubro.nombre)}</span>
    </span>
  );
}
