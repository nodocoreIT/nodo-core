import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Plus,
  ArrowLeft,
  Car,
  User,
  DollarSign,
  Printer,
  Save,
  Trash2,
  Search,
  Eye,
  Download,
  FileSearch,
} from 'lucide-react';
import { DocumentPreviewer } from '@/components/document-previewer';
import { useVehicleStore } from '@/store/vehicle-store';
import type { SalesContractData, Buyer, TradeInVehicle, PaymentMethod, DocumentType, PaymentType } from '@/types/contract';
import { SalesContractTemplate } from '@/components/sales-contract-template';
import {
  calculateContractFinancials,
  formatCurrency,
  formatCurrencyInput,
  parseDigitsToNumber,
  formatThousands,
} from '@/utils/contract-calculations';
import { matchesVehicleSearch } from '@/shared/lib/utils';

function DocumentationHub({
  contracts,
  vehicles,
  onNew,
  onView,
}: {
  contracts: SalesContractData[];
  vehicles: { id: string; brand: string; model: string; year: number; licensePlate?: string; documents?: { name: string; label?: string; url: string }[] }[];
  onNew: () => void;
  onView: (contract: SalesContractData) => void;
}) {
  const [activeTab, setActiveTab] = useState<"boletos" | "vehiculos">("boletos");
  const [searchTerm, setSearchTerm] = useState("");
  const [previewDoc, setPreviewDoc] = useState<{ name: string; label?: string; url: string; type: string; creadoEn: string } | null>(null);

  const filteredContracts = contracts.filter(
    (c) =>
      c.buyer.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.vehicleId.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const vehiclesWithDocs = vehicles.filter(
    (v) => (v.documents?.length ?? 0) > 0 && matchesVehicleSearch(v, searchTerm),
  );

  const getVehicleInfo = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    if (!v) return "Vehículo no encontrado";
    return `${v.brand} ${v.model} (${v.year})`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-navy">Documentación</h1>
          <p className="text-sm text-slate2 mt-0.5">
            Gestioná boletos de compraventa y documentación de vehículos.
          </p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
        >
          <Plus size={16} /> Nuevo Boleto
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-mist bg-white shadow-sm">
        <div className="border-b border-mist">
          <nav className="flex px-2" aria-label="Documentación">
            <button
              type="button"
              onClick={() => { setActiveTab("boletos"); setSearchTerm(""); }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "boletos"
                  ? "border-brand text-brand"
                  : "border-transparent text-slate2 hover:text-navy"
              }`}
            >
              <FileText size={16} />
              Boletos de Compraventa
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab("vehiculos"); setSearchTerm(""); }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "vehiculos"
                  ? "border-brand text-brand"
                  : "border-transparent text-slate2 hover:text-navy"
              }`}
            >
              <Car size={16} />
              Documentación de Vehículos
            </button>
          </nav>
        </div>

        <div className="p-4 border-b border-mist bg-paper/60">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate2" />
            <input
              type="text"
              placeholder={
                activeTab === "boletos"
                  ? "Buscar por comprador…"
                  : "Buscar por marca, modelo o patente…"
              }
              className="w-full pl-9 pr-4 py-2 border border-mist rounded-lg text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {activeTab === "boletos" ? (
          filteredContracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
              <FileText size={40} className="text-mist" />
              <p className="text-slate2 text-sm">No se encontraron boletos.</p>
              <button
                onClick={onNew}
                className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
              >
                <Plus size={16} /> Generar primer boleto
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper text-xs uppercase text-slate2">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium">Comprador</th>
                    <th className="px-4 py-3 text-left font-medium">Vehículo</th>
                    <th className="px-4 py-3 text-right font-medium">Monto</th>
                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mist">
                  {filteredContracts.map((c) => (
                    <tr key={c.id} className="hover:bg-paper/60 transition-colors">
                      <td className="px-4 py-3 text-slate2">
                        {new Date(c.date).toLocaleDateString("es-AR")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-navy">{c.buyer.fullName}</span>
                          <span className="text-xs text-slate2">{c.buyer.documentNumber}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate2">{getVehicleInfo(c.vehicleId)}</td>
                      <td className="px-4 py-3 text-right font-medium text-navy">
                        {formatCurrency(c.agreedSalePrice, c.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onView(c)}
                          className="rounded px-3 py-1 text-xs font-medium text-brand hover:bg-brand/10 transition-colors"
                        >
                          Ver boleto
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : vehiclesWithDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <FileSearch size={40} className="text-mist" />
            <p className="text-slate2 text-sm">No se encontraron vehículos con documentación.</p>
          </div>
        ) : (
          <div className="divide-y divide-mist">
            {vehiclesWithDocs.map((vehicle) => (
              <div key={vehicle.id} className="p-4 hover:bg-paper/60 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand/10 text-brand rounded-lg">
                      <Car size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-navy">
                        {vehicle.brand} {vehicle.model} ({vehicle.year})
                      </h3>
                      <p className="text-xs text-slate2">
                        Patente: {vehicle.licensePlate || "S/N"}
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/admin/vehiculos/${vehicle.id}`}
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    Ver vehículo
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ml-11">
                  {(vehicle.documents ?? []).map((doc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-white border border-mist"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={14} className="text-brand shrink-0" />
                        <span className="text-xs font-medium text-navy truncate">
                          {doc.label || doc.name}
                        </span>
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewDoc({
                              name: doc.name,
                              label: doc.label,
                              url: doc.url,
                              type: "application/pdf",
                              creadoEn: new Date().toISOString(),
                            })
                          }
                          className="p-1 text-slate2 hover:text-brand"
                          title="Vista previa"
                        >
                          <Eye size={14} />
                        </button>
                        <a href={doc.url} download={doc.name} className="p-1 text-slate2 hover:text-navy">
                          <Download size={14} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewDoc && (
        <DocumentPreviewer document={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
    </div>
  );
}

// ─── Contract Viewer (Print Mode) ────────────────────────────────────────────

function ContractViewer({
  contract,
  vehicle,
  companyName,
  companyAddress,
  onBack,
}: {
  contract: SalesContractData;
  vehicle: { brand: string; model: string; version?: string; year: number; licensePlate?: string; vin?: string; engineNumber?: string; kilometers: number };
  companyName?: string;
  companyAddress?: string;
  onBack: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `Boleto_${contract.buyer.fullName.replace(/\s+/g, '_')}`;
    window.print();
    document.title = originalTitle;
  };

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: `@media print { .no-print { display: none !important; } }` }} />
      <div className="no-print flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate2 hover:text-navy transition-colors"
        >
          <ArrowLeft size={18} /> Volver a contratos
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
        >
          <Printer size={16} /> Imprimir boleto
        </button>
      </div>
      <SalesContractTemplate
        ref={printRef}
        contract={contract}
        vehicle={vehicle as never}
        companyName={companyName}
        companyAddress={companyAddress}
      />
    </div>
  );
}

// ─── Contract Generator Form ─────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full rounded-lg border border-mist bg-white px-3 py-2 text-sm text-navy placeholder:text-slate2/60 outline-none focus:border-brand focus:ring-1 focus:ring-brand transition';

const SELECT_CLASS =
  'w-full rounded-lg border border-mist bg-white px-3 py-2 text-sm text-navy outline-none focus:border-brand focus:ring-1 focus:ring-brand transition';

const LABEL_CLASS = 'block text-xs font-medium text-slate2 mb-1';

function ContractGenerator({
  vehicles,
  customers,
  currentCliente,
  addContract,
  onSaved,
  onBack,
}: {
  vehicles: { id: string; brand: string; model: string; version?: string; year: number; licensePlate?: string; vin?: string; engineNumber?: string; kilometers: number; cashPrice?: number; listPrice: number; currency: 'ARS' | 'USD'; status: string }[];
  customers: { id: string; firstName: string; lastName: string; documentType?: string; documentNumber?: string; address?: string; city?: string; state?: string; phone?: string; email?: string }[];
  currentCliente?: { nombre: string; identificador: string; direccion?: string } | null;
  addContract: (data: Omit<SalesContractData, 'id'>) => Promise<void>;
  onSaved: (contract: SalesContractData) => void;
  onBack: () => void;
}) {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [buyer, setBuyer] = useState<Buyer>({
    fullName: '',
    documentType: 'DNI',
    documentNumber: '',
    address: '',
    city: '',
    state: '',
    phone: '',
    email: '',
  });
  const [hasTradeIn, setHasTradeIn] = useState(false);
  const [tradeIn, setTradeIn] = useState<TradeInVehicle>({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    licensePlate: '',
    agreedValue: 0,
  });
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [notes, setNotes] = useState('');
  const [salePrice, setSalePriceRaw] = useState(0);
  const [salePriceInput, setSalePriceInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;

  useEffect(() => {
    if (selectedVehicle) {
      const price = selectedVehicle.cashPrice || selectedVehicle.listPrice || 0;
      setSalePriceRaw(price);
      setSalePriceInput(formatCurrencyInput(price, selectedVehicle.currency));
    }
  }, [selectedVehicleId]);

  const handleSalePriceChange = (val: string) => {
    const num = parseDigitsToNumber(val);
    setSalePriceRaw(num);
    setSalePriceInput(formatCurrencyInput(num, selectedVehicle?.currency || 'ARS'));
  };

  const handleCustomerSelect = (customerId: string) => {
    const c = customers.find((x) => x.id === customerId);
    if (!c) {
      setBuyer({ fullName: '', documentType: 'DNI', documentNumber: '', address: '', city: '', state: '', phone: '', email: '' });
      return;
    }
    setBuyer({
      fullName: `${c.firstName} ${c.lastName}`,
      documentType: (c.documentType as DocumentType) || 'DNI',
      documentNumber: c.documentNumber || '',
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      phone: c.phone || '',
      email: c.email || '',
    });
  };

  const addPayment = () =>
    setPayments([...payments, { id: crypto.randomUUID(), type: 'cash', amount: 0, currency: selectedVehicle?.currency || 'ARS' }]);

  const removePayment = (id: string) => setPayments(payments.filter((p) => p.id !== id));

  const updatePayment = (id: string, field: keyof PaymentMethod, value: unknown) =>
    setPayments(payments.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

  const updatePaymentAmount = (id: string, raw: string) => {
    const num = parseDigitsToNumber(raw);
    setPayments(payments.map((p) => (p.id === id ? { ...p, amount: num } : p)));
  };

  const contractData: SalesContractData = {
    date: new Date().toISOString(),
    vehicleId: selectedVehicleId,
    sellerName: currentCliente?.nombre,
    sellerDocument: currentCliente?.identificador,
    buyer,
    tradeInVehicle: hasTradeIn ? tradeIn : undefined,
    agreedSalePrice: salePrice,
    currency: selectedVehicle?.currency || 'ARS',
    payments,
    notes,
  };

  const financials = calculateContractFinancials(contractData);

  const canSave = !!selectedVehicle && !!buyer.fullName;
  const canPrint = canSave && financials.isBalanced;

  const handleSave = async () => {
    if (!canSave) return;
    setError(null);
    setIsSaving(true);
    try {
      await addContract(contractData);
      // Contract saved — go back to list
      onSaved(contractData as SalesContractData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el contrato');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `Boleto_${buyer.fullName.replace(/\s+/g, '_') || 'Compraventa'}`;
    window.print();
    document.title = originalTitle;
  };

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: `@media print { .no-print { display: none !important; } }` }} />

      {/* Header */}
      <div className="no-print flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-slate2 hover:text-navy transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-navy">Nuevo Boleto de Compraventa</h1>
            <p className="text-sm text-slate2 mt-0.5">Completá los datos para generar el contrato.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="flex items-center gap-2 rounded-lg border border-mist bg-white px-4 py-2 text-sm font-medium text-navy hover:bg-paper disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={16} /> {isSaving ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            disabled={!selectedVehicle}
            className="flex items-center gap-2 rounded-lg border border-mist bg-white px-4 py-2 text-sm font-medium text-navy hover:bg-paper disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Vista previa
          </button>
          <button
            onClick={handlePrint}
            disabled={!canPrint}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </div>

      {error && (
        <div className="no-print rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
        {/* Left: Form */}
        <div className="space-y-5">
          {/* Vehicle */}
          <section className="rounded-xl border border-mist bg-white p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-navy mb-4">
              <Car size={16} className="text-brand" /> Vehículo a Vender
            </h2>
            <div className="space-y-3">
              <div>
                <label className={LABEL_CLASS}>Seleccioná el vehículo</label>
                <select
                  className={SELECT_CLASS}
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                >
                  <option value="">— Seleccionar —</option>
                  {vehicles
                    .filter((v) => v.status === 'disponible')
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.brand} {v.model} {v.year} {v.licensePlate ? `· ${v.licensePlate}` : ''}
                      </option>
                    ))}
                </select>
              </div>
              {selectedVehicle && (
                <div>
                  <label className={LABEL_CLASS}>Precio de venta acordado</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={INPUT_CLASS}
                    value={salePriceInput}
                    onChange={(e) => handleSalePriceChange(e.target.value)}
                  />
                </div>
              )}
            </div>
          </section>

          {/* Buyer */}
          <section className="rounded-xl border border-mist bg-white p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-navy mb-4">
              <User size={16} className="text-brand" /> Datos del Comprador
            </h2>
            <div className="space-y-3">
              <div>
                <label className={LABEL_CLASS}>Cargar desde clientes existentes</label>
                <select
                  className={SELECT_CLASS}
                  value=""
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                >
                  <option value="">— Buscar en clientes —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} {c.documentNumber ? `(${c.documentNumber})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={LABEL_CLASS}>Nombre completo / Razón social</label>
                <input
                  type="text"
                  className={INPUT_CLASS}
                  placeholder="Juan Pérez"
                  value={buyer.fullName}
                  onChange={(e) => setBuyer({ ...buyer, fullName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Tipo de documento</label>
                  <select
                    className={SELECT_CLASS}
                    value={buyer.documentType}
                    onChange={(e) => setBuyer({ ...buyer, documentType: e.target.value as DocumentType })}
                  >
                    {(['DNI', 'CUIT', 'CUIL', 'Pasaporte'] as DocumentType[]).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Número</label>
                  <input
                    type="text"
                    inputMode={buyer.documentType === 'DNI' ? 'numeric' : 'text'}
                    className={INPUT_CLASS}
                    placeholder="00.000.000"
                    value={buyer.documentNumber}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (buyer.documentType === 'DNI') {
                        const digits = val.replace(/\D/g, '');
                        val = digits ? formatThousands(Number(digits)) : '';
                      }
                      setBuyer({ ...buyer, documentNumber: val });
                    }}
                  />
                </div>
              </div>

              <div>
                <label className={LABEL_CLASS}>Domicilio</label>
                <input
                  type="text"
                  className={INPUT_CLASS}
                  placeholder="Av. Rivadavia 1234"
                  value={buyer.address}
                  onChange={(e) => setBuyer({ ...buyer, address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Ciudad</label>
                  <input
                    type="text"
                    className={INPUT_CLASS}
                    value={buyer.city}
                    onChange={(e) => setBuyer({ ...buyer, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Provincia</label>
                  <input
                    type="text"
                    className={INPUT_CLASS}
                    value={buyer.state}
                    onChange={(e) => setBuyer({ ...buyer, state: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Trade-in */}
          <section className="rounded-xl border border-mist bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
                <Car size={16} className="text-brand" /> Vehículo en Parte de Pago
              </h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasTradeIn}
                  onChange={(e) => setHasTradeIn(e.target.checked)}
                  className="rounded accent-brand"
                />
                <span className="text-xs font-medium text-slate2">Recibe permuta</span>
              </label>
            </div>
            {hasTradeIn && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Marca</label>
                  <input type="text" className={INPUT_CLASS} value={tradeIn.brand} onChange={(e) => setTradeIn({ ...tradeIn, brand: e.target.value })} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Modelo / Versión</label>
                  <input type="text" className={INPUT_CLASS} value={tradeIn.model} onChange={(e) => setTradeIn({ ...tradeIn, model: e.target.value })} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Año</label>
                  <input type="number" className={INPUT_CLASS} value={tradeIn.year} onChange={(e) => setTradeIn({ ...tradeIn, year: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Dominio</label>
                  <input type="text" className={INPUT_CLASS} placeholder="AB 123 CD" value={tradeIn.licensePlate} onChange={(e) => setTradeIn({ ...tradeIn, licensePlate: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className={LABEL_CLASS}>Valor acordado para permuta</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={INPUT_CLASS}
                    value={formatCurrencyInput(tradeIn.agreedValue, selectedVehicle?.currency || 'ARS')}
                    onChange={(e) => setTradeIn({ ...tradeIn, agreedValue: parseDigitsToNumber(e.target.value) })}
                  />
                </div>
              </div>
            )}
            {!hasTradeIn && (
              <p className="text-xs text-slate2">Activá si el comprador entrega un vehículo como parte del pago.</p>
            )}
          </section>

          {/* Payments */}
          <section className="rounded-xl border border-mist bg-white p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-navy mb-4">
              <DollarSign size={16} className="text-brand" /> Forma de Pago
            </h2>

            {/* Financial summary */}
            <div className="rounded-lg bg-paper px-4 py-3 text-sm mb-4 space-y-1">
              <div className="flex justify-between text-slate2">
                <span>Valor del vehículo</span>
                <span>{formatCurrency(financials.salePrice, selectedVehicle?.currency)}</span>
              </div>
              {hasTradeIn && financials.tradeInValue > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Permuta</span>
                  <span>− {formatCurrency(financials.tradeInValue, selectedVehicle?.currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-navy border-t border-mist pt-1 mt-1">
                <span>Saldo a cubrir</span>
                <span>{formatCurrency(financials.balanceToPay, selectedVehicle?.currency)}</span>
              </div>
            </div>

            <div className="space-y-3 mb-3">
              {payments.map((p) => (
                <div key={p.id} className="flex gap-2 items-start rounded-lg border border-mist bg-paper p-3">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    <select
                      className={SELECT_CLASS}
                      value={p.type}
                      onChange={(e) => updatePayment(p.id, 'type', e.target.value as PaymentType)}
                    >
                      <option value="cash">Efectivo</option>
                      <option value="transfer">Transferencia</option>
                      <option value="check">Cheque</option>
                      <option value="promissory_note">Pagaré</option>
                    </select>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Monto"
                      className={INPUT_CLASS}
                      value={formatCurrencyInput(p.amount, p.currency)}
                      onChange={(e) => updatePaymentAmount(p.id, e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Detalles (banco, número de cheque…)"
                      className={`${INPUT_CLASS} col-span-2`}
                      value={p.details || ''}
                      onChange={(e) => updatePayment(p.id, 'details', e.target.value)}
                    />
                  </div>
                  <button
                    onClick={() => removePayment(p.id)}
                    className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addPayment}
              className="flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              <Plus size={15} /> Agregar pago
            </button>

            <div
              className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium ${
                financials.isBalanced
                  ? 'bg-green-50 text-green-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              Restante por cubrir: {formatCurrency(financials.remainingBalance, selectedVehicle?.currency)}
              {!financials.isBalanced && payments.length > 0 && (
                <span className="block text-xs font-normal mt-0.5">
                  El total de pagos no coincide con el saldo.
                </span>
              )}
            </div>
          </section>

          {/* Notes */}
          <section className="rounded-xl border border-mist bg-white p-5">
            <label className={LABEL_CLASS}>Notas u observaciones (cláusula adicional)</label>
            <textarea
              className={`${INPUT_CLASS} h-24 resize-none`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Condiciones especiales, acuerdos adicionales…"
            />
          </section>
        </div>

        {/* Right: Preview */}
        <div className="hidden lg:block">
          {selectedVehicle ? (
            <div className="sticky top-4">
              <p className="text-xs font-medium text-slate2 mb-2">Vista previa del boleto</p>
              <div className="scale-[0.55] origin-top-left w-[181%]">
                <SalesContractTemplate
                  ref={printRef}
                  contract={contractData}
                  vehicle={selectedVehicle as never}
                  companyName={currentCliente?.nombre}
                  companyAddress={currentCliente?.direccion}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-mist h-64 text-center">
              <FileText size={32} className="text-mist" />
              <p className="text-xs text-slate2">Seleccioná un vehículo para ver la previsualización.</p>
            </div>
          )}
        </div>
      </div>

      {/* Print area — only visible when printing */}
      {selectedVehicle && (
        <div className="hidden print:block">
          <SalesContractTemplate
            contract={contractData}
            vehicle={selectedVehicle as never}
            companyName={currentCliente?.nombre}
            companyAddress={currentCliente?.direccion}
          />
        </div>
      )}
    </div>
  );
}

// ─── Page Root ────────────────────────────────────────────────────────────────

type View = 'list' | 'new' | 'view';

export function ContractsPage() {
  const contracts = useVehicleStore((s) => s.contracts);
  const vehicles = useVehicleStore((s) => s.vehicles);
  const customers = useVehicleStore((s) => s.customers);
  const currentCliente = useVehicleStore((s) => s.currentCliente);
  const addContract = useVehicleStore((s) => s.addContract);

  const [view, setView] = useState<View>('list');
  const [viewingContract, setViewingContract] = useState<SalesContractData | null>(null);

  const handleView = (contract: SalesContractData) => {
    setViewingContract(contract);
    setView('view');
  };

  const handleSaved = () => {
    setView('list');
  };

  if (view === 'new') {
    return (
      <ContractGenerator
        vehicles={vehicles as never}
        customers={customers}
        currentCliente={currentCliente}
        addContract={addContract}
        onSaved={handleSaved}
        onBack={() => setView('list')}
      />
    );
  }

  if (view === 'view' && viewingContract) {
    const vehicle = vehicles.find((v) => v.id === viewingContract.vehicleId);
    return (
      <ContractViewer
        contract={viewingContract}
        vehicle={(vehicle ?? { brand: 'Vehículo', model: 'eliminado', year: 0, kilometers: 0 }) as never}
        companyName={currentCliente?.nombre}
        companyAddress={currentCliente?.direccion}
        onBack={() => setView('list')}
      />
    );
  }

  return (
    <DocumentationHub
      contracts={contracts}
      vehicles={vehicles}
      onNew={() => setView('new')}
      onView={handleView}
    />
  );
}
