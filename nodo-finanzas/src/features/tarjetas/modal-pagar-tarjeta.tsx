import { useState } from 'react';
import { CreditCard, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import { getFechaHoy } from '@/utils/formatters';
import type { Tarjeta } from '@/types';

interface ModalPagarTarjetaProps {
  open: boolean;
  tarjeta: Tarjeta;
  totalARS: number;
  totalUSD: number;
  filtroMes: string;
  onClose: () => void;
  onConfirm: (params: {
    montoARS: number;
    montoUSD: number;
    esParcial: boolean;
  }) => Promise<void>;
}

export function ModalPagarTarjeta({
  open,
  tarjeta,
  totalARS,
  totalUSD,
  filtroMes,
  onClose,
  onConfirm,
}: ModalPagarTarjetaProps) {
  const [montoARS, setMontoARS] = useState(totalARS);
  const [montoUSD, setMontoUSD] = useState(totalUSD);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const esParcial =
    montoARS < totalARS - 0.01 || (totalUSD > 0 && montoUSD < totalUSD - 0.001);

  const pendienteARS = Math.max(0, totalARS - montoARS);
  const pendienteUSD = totalUSD > 0 ? Math.max(0, totalUSD - montoUSD) : 0;

  const [anio, mes] = filtroMes.split('-');
  const mesLabel = new Date(parseInt(anio), parseInt(mes) - 1).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm({ montoARS, montoUSD, esParcial });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-brand/10 p-2 rounded-full">
              <CreditCard className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-ink">Pagar tarjeta</h3>
              <p className="text-sm text-slate2">
                {tarjeta.nombre} — {mesLabel}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-mist transition-colors text-slate2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Totals */}
        <div className="bg-paper rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between text-slate2">
            <span>Total del mes (ARS)</span>
            <span className="font-semibold text-ink">
              ${totalARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          {totalUSD > 0 && (
            <div className="flex justify-between text-slate2">
              <span>Total del mes (USD)</span>
              <span className="font-semibold text-ink">
                USD {totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        {/* Payment inputs */}
        <div className="space-y-4">
          <MoneyInput
            label="Importe abonado en pesos"
            value={montoARS}
            onChange={setMontoARS}
            moneda="ARS"
            required
          />

          {totalUSD > 0 && (
            <MoneyInput
              label="Importe abonado en dólares"
              value={montoUSD}
              onChange={setMontoUSD}
              moneda="USD"
            />
          )}
        </div>

        {/* Status feedback */}
        {esParcial ? (
          <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-orange-800">Pago parcial</p>
              <p className="text-orange-700 mt-0.5">
                {pendienteARS > 0 && (
                  <span>
                    Saldo pendiente ARS:{' '}
                    <strong>
                      ${pendienteARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </strong>
                  </span>
                )}
                {pendienteARS > 0 && pendienteUSD > 0 && <br />}
                {pendienteUSD > 0 && (
                  <span>
                    Saldo pendiente USD:{' '}
                    <strong>
                      USD {pendienteUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </span>
                )}
              </p>
              <p className="text-orange-600 text-xs mt-1">
                El saldo pendiente se agregará al mes siguiente con intereses de financiación.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <p className="font-semibold text-green-800">Pago total — tarjeta quedará saldada</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1"
            disabled={loading || montoARS <= 0}
          >
            {loading ? 'Registrando...' : esParcial ? 'Registrar pago parcial' : 'Confirmar pago'}
          </Button>
        </div>
      </div>
    </div>
  );
}
