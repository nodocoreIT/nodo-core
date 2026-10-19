import type { Tarjeta } from '@/types';

function arteDe(tarjeta: Tarjeta): string | null {
  const texto = `${tarjeta.nombre} ${tarjeta.banco}`.toLowerCase();
  if (texto.includes('mercado')) return '/finanzas/tarjetas/mercadopago.png?v=5';
  if (texto.includes('santander')) return '/finanzas/tarjetas/santander.png?v=5';
  return null;
}

function estiloDe(tarjeta: Tarjeta): string {
  const texto = `${tarjeta.nombre} ${tarjeta.banco}`.toLowerCase();
  if (texto.includes('pampa')) return 'bg-gradient-to-br from-sky-800 via-sky-700 to-sky-950';
  if (tarjeta.tipo === 'MASTERCARD') return 'bg-gradient-to-br from-neutral-800 via-neutral-900 to-black';
  if (tarjeta.tipo === 'AMERICAN_EXPRESS') return 'bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-950';
  return 'bg-gradient-to-br from-blue-700 via-blue-800 to-slate-950';
}

function MarcaRed({ tipo }: { tipo: Tarjeta['tipo'] }) {
  if (tipo === 'MASTERCARD') {
    return (
      <div className="flex -space-x-2" aria-hidden>
        <span className="h-7 w-7 rounded-full bg-[#eb001b]" />
        <span className="h-7 w-7 rounded-full bg-[#f79e1b] mix-blend-screen" />
      </div>
    );
  }
  if (tipo === 'AMERICAN_EXPRESS') {
    return <span className="text-sm font-black tracking-widest text-white">AMEX</span>;
  }
  return <span className="text-xl font-black italic tracking-wider text-white">VISA</span>;
}

export function TarjetaPlastico({ tarjeta }: { tarjeta: Tarjeta }) {
  const arte = arteDe(tarjeta);

  if (arte) {
    return (
      <div className="aspect-[1.586/1] w-full overflow-hidden">
        <img
          src={arte}
          alt={tarjeta.nombre}
          className="h-full w-full object-cover object-center"
        />
      </div>
    );
  }

  return (
    <div className={`aspect-[1.586/1] w-full p-5 text-white ${estiloDe(tarjeta)}`}>
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="h-8 w-10 rounded-md bg-gradient-to-br from-amber-200 to-amber-500 shadow-inner" />
            <span className="text-white/80" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M8 8c2.5 2.2 2.5 5.8 0 8" />
                <path d="M11.5 5.5c4 3.6 4 9.4 0 13" />
                <path d="M15 3c5.5 5 5.5 13 0 18" />
              </svg>
            </span>
          </div>
          <p className="text-right text-sm font-semibold leading-tight">{tarjeta.banco}</p>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[10px] uppercase tracking-[0.2em] text-white/60">Titular</p>
            <p className="truncate text-sm font-semibold tracking-wide">{tarjeta.titular}</p>
          </div>
          <MarcaRed tipo={tarjeta.tipo} />
        </div>
      </div>
    </div>
  );
}
