import { forwardRef } from 'react';
import type { SalesContractData } from '@/types/contract';
import type { Vehicle } from '@/types';
import { calculateContractFinancials, formatCurrency } from '@/utils/contract-calculations';

interface Props {
  contract: SalesContractData;
  vehicle: Vehicle;
  companyName?: string;
  companyAddress?: string;
}

const mapPaymentType = (type: string): string => {
  const types: Record<string, string> = {
    cash: 'Efectivo',
    transfer: 'Transferencia Bancaria',
    check: 'Cheque',
    promissory_note: 'Pagaré',
  };
  return types[type] || type;
};

export const SalesContractTemplate = forwardRef<HTMLDivElement, Props>(
  ({ contract, vehicle, companyName = 'Nuestra Agencia', companyAddress = 'Domicilio de la Agencia' }, ref) => {
    const financials = calculateContractFinancials(contract);

    return (
      <div
        ref={ref}
        className="bg-white text-gray-900 p-10 shadow-lg max-w-[210mm] min-h-[297mm] mx-auto text-sm font-serif leading-relaxed print:shadow-none print:p-12 print:w-full print:max-w-none"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold uppercase underline">
            Boleto de Compraventa Automotor
          </h1>
          <p className="text-gray-900 text-sm mt-2 text-right">
            Fecha: {new Date(contract.date).toLocaleDateString('es-AR')}
          </p>
        </div>

        <div className="space-y-6 text-justify">
          <p>
            Entre <strong>{contract.sellerName || companyName}</strong>, con domicilio comercial en{' '}
            {companyAddress}
            {contract.sellerDocument && `, DNI/CUIT: ${contract.sellerDocument}`}, en adelante
            denominado el <strong>"VENDEDOR"</strong>, por una parte; y por la otra,{' '}
            <strong>{contract.buyer.fullName}</strong>, con {contract.buyer.documentType} N°{' '}
            <strong>{contract.buyer.documentNumber}</strong>, domiciliado/a en{' '}
            {contract.buyer.address}, {contract.buyer.city}, {contract.buyer.state}, en adelante
            denominado el <strong>"COMPRADOR"</strong>, convienen en celebrar el presente Boleto de
            Compraventa sujeto a las siguientes cláusulas:
          </p>

          <div>
            <h2 className="font-bold mb-1">PRIMERA: El Objeto.</h2>
            <p>
              El VENDEDOR vende y transfiere al COMPRADOR, y éste adquiere, un vehículo automotor
              usado con las siguientes características:
            </p>
            <ul className="list-disc pl-6 mt-2 mb-2 font-mono text-xs">
              <li>
                <strong>Marca y Modelo:</strong> {vehicle.brand} {vehicle.model} {vehicle.version}
              </li>
              <li>
                <strong>Año:</strong> {vehicle.year}
              </li>
              <li>
                <strong>Dominio (Patente):</strong> {vehicle.licensePlate || 'A confirmar'}
              </li>
              <li>
                <strong>Motor N°:</strong> {vehicle.engineNumber || 'A confirmar'} /{' '}
                <strong>Chasis (VIN):</strong> {vehicle.vin || 'A confirmar'}
              </li>
              <li>
                <strong>Kilometraje:</strong> {vehicle.kilometers.toLocaleString('es-AR')} km
              </li>
            </ul>
            <p>
              El vehículo se entrega en el estado en que se encuentra, habiendo sido inspeccionado y
              probado a entera satisfacción del COMPRADOR.
            </p>
          </div>

          <div>
            <h2 className="font-bold mb-1">SEGUNDA: Precio y Forma de Pago.</h2>
            <p>
              El precio total y definitivo de esta venta se fija en la suma de{' '}
              <strong>{formatCurrency(financials.salePrice, contract.currency)}</strong>. El pago se
              realiza de la siguiente manera:
            </p>

            <div className="mt-4 border border-gray-300 rounded p-4 bg-gray-50 print:border-black print:bg-transparent">
              {contract.tradeInVehicle && (
                <div className="mb-4">
                  <p className="font-semibold underline">1. Vehículo en Parte de Pago:</p>
                  <p>
                    El COMPRADOR entrega en este acto, como parte de pago, un vehículo marca{' '}
                    {contract.tradeInVehicle.brand} modelo {contract.tradeInVehicle.model}{' '}
                    {contract.tradeInVehicle.version}, año {contract.tradeInVehicle.year}, dominio{' '}
                    {contract.tradeInVehicle.licensePlate}, valorizado por las partes en la suma de{' '}
                    <strong>{formatCurrency(financials.tradeInValue, contract.currency)}</strong>.
                  </p>
                </div>
              )}

              {contract.payments && contract.payments.length > 0 && (
                <div>
                  <p className="font-semibold underline">
                    {contract.tradeInVehicle ? '2.' : '1.'} Saldo a Pagar:
                  </p>
                  <p className="mb-2">
                    El saldo restante de{' '}
                    <strong>{formatCurrency(financials.balanceToPay, contract.currency)}</strong> se
                    abona mediante:
                  </p>
                  <ul className="list-disc pl-6">
                    {contract.payments.map((p, index) => (
                      <li key={p.id || index}>
                        <strong>{mapPaymentType(p.type)}</strong> por{' '}
                        <strong>{formatCurrency(p.amount, p.currency)}</strong>
                        {p.details && ` — Detalles: ${p.details}`}
                        {p.dueDate &&
                          ` — Vencimiento: ${new Date(p.dueDate).toLocaleDateString('es-AR')}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="font-bold mb-1">TERCERA: Transferencia y Responsabilidad.</h2>
            <p>
              El COMPRADOR asume a partir de este momento la responsabilidad civil, penal y
              tributaria que pudiera derivar de la guarda y/o uso del vehículo, comprometiéndose a
              realizar la transferencia de dominio por ante el Registro Nacional de la Propiedad
              Automotor dentro de los próximos 30 (treinta) días.
            </p>
          </div>

          {contract.notes && (
            <div>
              <h2 className="font-bold mb-1">CUARTA: Observaciones.</h2>
              <p className="italic">{contract.notes}</p>
            </div>
          )}

          <div className="mt-8">
            <p>
              En prueba de conformidad, se firman dos ejemplares de un mismo tenor y a un solo
              efecto en _______________ a los {new Date(contract.date).getDate()} días del mes de{' '}
              {new Date(contract.date).toLocaleString('es-AR', { month: 'long' })} de{' '}
              {new Date(contract.date).getFullYear()}.
            </p>
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-32 flex justify-between px-10 print:mt-40">
          <div className="text-center w-1/3">
            <div className="border-t border-black pt-2">
              <p className="font-bold">Firma VENDEDOR</p>
              <p className="text-xs mt-1">Aclaración:</p>
              <p className="text-xs">DNI / CUIT:</p>
            </div>
          </div>
          <div className="text-center w-1/3">
            <div className="border-t border-black pt-2">
              <p className="font-bold">Firma COMPRADOR</p>
              <p className="text-xs mt-1">Aclaración:</p>
              <p className="text-xs">DNI / CUIT:</p>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

SalesContractTemplate.displayName = 'SalesContractTemplate';
