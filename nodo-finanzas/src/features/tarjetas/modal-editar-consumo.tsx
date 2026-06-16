import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RubroSelector } from '@/components/rubros/rubro-selector';
import type { ConsumoTarjeta, Tarjeta } from '@/types';

interface ModalEditarConsumoProps {
  open: boolean;
  consumo: ConsumoTarjeta | null;
  tarjetas: Tarjeta[];
  onSave: (cambios: Partial<ConsumoTarjeta>) => void;
  onCancel: () => void;
}

export function ModalEditarConsumo({
  open,
  consumo,
  tarjetas,
  onSave,
  onCancel,
}: ModalEditarConsumoProps) {
  const [lugar, setLugar] = useState('');
  const [fecha, setFecha] = useState('');
  const [fechaCompra, setFechaCompra] = useState('');
  const [rubroId, setRubroId] = useState('');
  const [detalle, setDetalle] = useState('');
  const [importeARS, setImporteARS] = useState('');
  const [importeUSD, setImporteUSD] = useState('');

  useEffect(() => {
    if (consumo) {
      setLugar(consumo.lugar);
      setFecha(consumo.fecha.slice(0, 10));
      setFechaCompra(consumo.fechaCompra ? consumo.fechaCompra.slice(0, 10) : consumo.fecha.slice(0, 10));
      setRubroId(consumo.rubroId ?? '');
      setDetalle(consumo.detalle ?? '');
      setImporteARS(consumo.importeARS ? String(consumo.importeARS) : '');
      setImporteUSD(consumo.importeUSD ? String(consumo.importeUSD) : '');
    }
  }, [consumo]);

  if (!open || !consumo) return null;

  const handleSave = () => {
    const cambios: Partial<ConsumoTarjeta> = {
      lugar,
      fecha: new Date(`${fecha}T12:00:00`).toISOString(),
      fechaCompra,
      rubroId: rubroId || undefined,
      detalle,
      importeARS: importeARS ? parseFloat(importeARS) : 0,
      importeUSD: importeUSD ? parseFloat(importeUSD) : undefined,
    };
    onSave(cambios);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-mist">
          <h3 className="text-lg font-bold text-ink">Editar Consumo</h3>
          <button onClick={onCancel} className="p-1 rounded hover:bg-mist transition-colors">
            <X className="w-5 h-5 text-slate2" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-ink">Lugar</label>
            <input
              type="text"
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink">Fecha Compra</label>
              <input
                type="date"
                value={fechaCompra}
                onChange={(e) => setFechaCompra(e.target.value)}
                className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink">Fecha Cobro</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          <RubroSelector
            rubroId={rubroId}
            onChange={(rubro) => setRubroId(rubro?.id ?? '')}
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-ink">Detalle</label>
            <input
              type="text"
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink">Importe ARS</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={importeARS}
                onChange={(e) => setImporteARS(e.target.value)}
                className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink">Importe USD</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={importeUSD}
                onChange={(e) => setImporteUSD(e.target.value)}
                className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-mist">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSave} className="flex-1">
            Guardar Cambios
          </Button>
        </div>
      </div>
    </div>
  );
}
