import { useState, useMemo } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Settings,
  CreditCard,
  Building2,
  Tag,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Banknote,
  Mic,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { ModalConfirmacion } from '@/components/ui/modal-confirmacion';
import { RubroGestion } from '@/components/rubros/rubro-gestion';
import { useFinanzas } from '@/hooks/use-finanzas';
import { useAiSettings } from '@/hooks/use-ai-settings';
import type {
  CuentaBancaria,
  Tarjeta,
  ConfiguracionCategoria,
  Sueldo,
} from '@/types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// ─── Schemas ────────────────────────────────────────────────────────────────

const schemaCuenta = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  banco: z.string().min(1, 'El banco es requerido'),
  titular: z.string().min(1, 'El titular es requerido'),
  tipo: z.enum(['CAJA_AHORRO', 'CUENTA_CORRIENTE', 'VIRTUAL']),
  cuentaSaldoId: z.string().optional(),
});

const schemaTarjeta = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  banco: z.string().min(1, 'El banco es requerido'),
  tipo: z.enum(['VISA', 'MASTERCARD', 'AMERICAN_EXPRESS']),
  titular: z.string().min(1, 'El titular es requerido'),
  limiteCredito: z.number().min(0).optional(),
  limiteRecomendado: z.number().min(0).optional(),
  diaCierre: z.number().min(1).max(31).optional(),
  diaVencimiento: z.number().min(1).max(31).optional(),
});

const schemaCategoria = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
});

const schemaSueldo = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  monto: z.number().min(0, 'El monto debe ser mayor o igual a 0'),
  moneda: z.enum(['ARS', 'USD']),
});

const schemaMedio = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  activa: z.boolean(),
  cuentaSaldoId: z.string().optional(),
});

type FormCuenta = z.infer<typeof schemaCuenta>;
type FormTarjeta = z.infer<typeof schemaTarjeta>;
type FormCategoria = z.infer<typeof schemaCategoria>;
type FormSueldo = z.infer<typeof schemaSueldo>;
type FormMedio = z.infer<typeof schemaMedio>;

type Seccion = 'rubros' | 'categorias' | 'cuentas' | 'tarjetas' | 'sueldos' | 'medios' | 'ia';

// ─── Component ──────────────────────────────────────────────────────────────

export function ConfiguracionPage() {
  const finanzas = useFinanzas();
  const { aiSettings, setAiSettings } = useAiSettings();
  const [seccion, setSeccion] = useState<Seccion>('rubros');
  const [mostrarForm, setMostrarForm] = useState(false);

  // editing state
  const [cuentaEditando, setCuentaEditando] = useState<CuentaBancaria | null>(null);
  const [tarjetaEditando, setTarjetaEditando] = useState<Tarjeta | null>(null);
  const [categoriaEditando, setCategoriaEditando] = useState<ConfiguracionCategoria | null>(null);
  const [sueldoEditando, setSueldoEditando] = useState<Sueldo | null>(null);
  const [medioEditando, setMedioEditando] = useState<{ codigo: string; nombre: string; activa: boolean; cuentaSaldoId?: string } | null>(null);

  // delete modal state
  const [modalAbierto, setModalAbierto] = useState(false);
  const [paraEliminar, setParaEliminar] = useState<{ tipo: 'cuenta' | 'tarjeta' | 'categoria' | 'sueldo'; id: string; nombre: string } | null>(null);

  // categories state
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState('');
  const [ordenCat, setOrdenCat] = useState<{ campo: 'nombre' | 'estado'; dir: 'asc' | 'desc' }>({ campo: 'nombre', dir: 'asc' });

  // ─── Forms ────────────────────────────────────────────────────────────────

  const formCuenta = useForm<FormCuenta>({
    resolver: zodResolver(schemaCuenta),
    defaultValues: { nombre: '', banco: '', titular: '', tipo: 'CAJA_AHORRO', cuentaSaldoId: '' },
  });

  const formTarjeta = useForm<FormTarjeta>({
    defaultValues: { nombre: '', banco: '', tipo: 'VISA', titular: '' },
  });

  const formCategoria = useForm<FormCategoria>({
    resolver: zodResolver(schemaCategoria),
    defaultValues: { nombre: '' },
  });

  const formSueldo = useForm<FormSueldo>({
    resolver: zodResolver(schemaSueldo),
    defaultValues: { nombre: '', monto: 0, moneda: 'ARS' },
  });

  const formMedio = useForm<FormMedio>({
    resolver: zodResolver(schemaMedio),
    defaultValues: { nombre: '', activa: true, cuentaSaldoId: '' },
  });

  const watchSueldoMoneda = formSueldo.watch('moneda');
  const watchSueldoMonto = formSueldo.watch('monto');

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function generarCodigo(nombre: string): string {
    return nombre
      .toUpperCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  function cerrarForm() {
    setMostrarForm(false);
    setCuentaEditando(null);
    setTarjetaEditando(null);
    setCategoriaEditando(null);
    setSueldoEditando(null);
    setMedioEditando(null);
    formCuenta.reset();
    formTarjeta.reset();
    formCategoria.reset();
    formSueldo.reset();
    formMedio.reset();
  }

  const categoriasOrdenadas = useMemo(() => {
    const cats = finanzas.configuracion.categorias || [];
    const filtradas = cats.filter((c) =>
      c.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );
    return [...filtradas].sort((a, b) => {
      const valA = ordenCat.campo === 'nombre' ? a.nombre.toLowerCase() : String(a.activa);
      const valB = ordenCat.campo === 'nombre' ? b.nombre.toLowerCase() : String(b.activa);
      if (valA < valB) return ordenCat.dir === 'asc' ? -1 : 1;
      if (valA > valB) return ordenCat.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [finanzas.configuracion.categorias, busqueda, ordenCat]);

  function toggleOrden(campo: 'nombre' | 'estado') {
    setOrdenCat((prev) => ({
      campo,
      dir: prev.campo === campo && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  }

  // ─── Handlers: Cuentas bancarias ──────────────────────────────────────────

  function abrirFormCuenta(cuenta?: CuentaBancaria) {
    setSeccion('cuentas');
    if (cuenta) {
      setCuentaEditando(cuenta);
      formCuenta.setValue('nombre', cuenta.nombre);
      formCuenta.setValue('banco', cuenta.banco);
      formCuenta.setValue('titular', cuenta.titular);
      formCuenta.setValue('tipo', cuenta.tipo);
      formCuenta.setValue('cuentaSaldoId', cuenta.cuentaSaldoId || '');
    } else {
      setCuentaEditando(null);
      formCuenta.reset();
    }
    setMostrarForm(true);
  }

  function onSubmitCuenta(datos: FormCuenta) {
    if (cuentaEditando) {
      finanzas.actualizarCuentaBancaria(cuentaEditando.id, datos);
    } else {
      finanzas.agregarCuentaBancaria({ ...datos, activa: true });
    }
    cerrarForm();
  }

  // ─── Handlers: Tarjetas ───────────────────────────────────────────────────

  function abrirFormTarjeta(tarjeta?: Tarjeta) {
    setSeccion('tarjetas');
    if (tarjeta) {
      setTarjetaEditando(tarjeta);
      formTarjeta.setValue('nombre', tarjeta.nombre);
      formTarjeta.setValue('banco', tarjeta.banco);
      formTarjeta.setValue('tipo', tarjeta.tipo);
      formTarjeta.setValue('titular', tarjeta.titular);
      formTarjeta.setValue('limiteCredito', tarjeta.limiteCredito ? Math.round(Number(tarjeta.limiteCredito)) : undefined);
      formTarjeta.setValue('limiteRecomendado', tarjeta.limiteRecomendado ? Math.round(Number(tarjeta.limiteRecomendado)) : undefined);
      formTarjeta.setValue('diaCierre', tarjeta.diaCierre);
      formTarjeta.setValue('diaVencimiento', tarjeta.diaVencimiento);
    } else {
      setTarjetaEditando(null);
      formTarjeta.reset();
    }
    setMostrarForm(true);
  }

  function onSubmitTarjeta(datos: FormTarjeta) {
    if (tarjetaEditando) {
      finanzas.actualizarTarjeta(tarjetaEditando.id, datos);
    } else {
      finanzas.agregarTarjeta({ ...datos, activa: true });
    }
    cerrarForm();
  }

  // ─── Handlers: Categorías ─────────────────────────────────────────────────

  function abrirFormCategoria(cat?: ConfiguracionCategoria) {
    setSeccion('categorias');
    if (cat) {
      setCategoriaEditando(cat);
      formCategoria.setValue('nombre', cat.nombre);
    } else {
      setCategoriaEditando(null);
      formCategoria.reset();
    }
    setMostrarForm(true);
  }

  function onSubmitCategoria(datos: FormCategoria) {
    const codigo = generarCodigo(datos.nombre);
    if (categoriaEditando) {
      finanzas.actualizarCategoria(categoriaEditando.id, { ...datos, codigo });
    } else {
      finanzas.agregarCategoria({ ...datos, codigo, activa: true });
    }
    cerrarForm();
  }

  // ─── Handlers: Sueldos ────────────────────────────────────────────────────

  function abrirFormSueldo(sueldo?: Sueldo) {
    setSeccion('sueldos');
    if (sueldo) {
      setSueldoEditando(sueldo);
      formSueldo.setValue('nombre', sueldo.nombre);
      formSueldo.setValue('monto', sueldo.monto);
      formSueldo.setValue('moneda', sueldo.moneda);
    } else {
      setSueldoEditando(null);
      formSueldo.reset();
    }
    setMostrarForm(true);
  }

  function onSubmitSueldo(datos: FormSueldo) {
    if (sueldoEditando) {
      finanzas.actualizarSueldo(sueldoEditando.id, datos);
    } else {
      finanzas.agregarSueldo({ ...datos, activo: true });
    }
    cerrarForm();
  }

  // ─── Handlers: Medios de pago ─────────────────────────────────────────────

  function abrirFormMedio(medio: { codigo: string; nombre: string; activa: boolean; cuentaSaldoId?: string }) {
    setSeccion('medios');
    setMedioEditando(medio);
    formMedio.setValue('nombre', medio.nombre);
    formMedio.setValue('activa', medio.activa);
    formMedio.setValue('cuentaSaldoId', medio.cuentaSaldoId || '');
    setMostrarForm(true);
  }

  async function onSubmitMedio(datos: FormMedio) {
    if (medioEditando) {
      await finanzas.actualizarFormaPago(medioEditando.codigo, datos);
    }
    cerrarForm();
  }

  // ─── Handlers: Delete ─────────────────────────────────────────────────────

  function confirmarEliminar(tipo: 'cuenta' | 'tarjeta' | 'categoria' | 'sueldo', id: string, nombre: string) {
    setParaEliminar({ tipo, id, nombre });
    setModalAbierto(true);
  }

  async function handleConfirmar() {
    if (!paraEliminar) return;
    switch (paraEliminar.tipo) {
      case 'cuenta': finanzas.eliminarCuentaBancaria(paraEliminar.id); break;
      case 'tarjeta': finanzas.eliminarTarjeta(paraEliminar.id); break;
      case 'categoria': finanzas.eliminarCategoria(paraEliminar.id); break;
      case 'sueldo': finanzas.eliminarSueldo(paraEliminar.id); break;
    }
    setParaEliminar(null);
    setModalAbierto(false);
  }

  // ─── Tab button helper ────────────────────────────────────────────────────

  function TabBtn({ id, label, icon: Icon }: { id: Seccion; label: string; icon: React.ElementType }) {
    const active = seccion === id;
    return (
      <button
        onClick={() => setSeccion(id)}
        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          active
            ? 'bg-white text-navy shadow-sm'
            : 'text-slate2 hover:text-navy'
        }`}
      >
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </button>
    );
  }

  const cuentasBancarias = finanzas.configuracion.cuentasBancarias || [];
  const tarjetas = finanzas.tarjetas || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="w-8 h-8 text-brand" />
        <div>
          <h2 className="text-3xl font-bold text-navy">Configuración</h2>
          <p className="text-slate2">Gestiona rubros, cuentas, tarjetas y sueldos</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 bg-mist p-1 rounded-lg">
        <TabBtn id="rubros" label="Rubros" icon={Tag} />
        <TabBtn id="categorias" label="Categorías" icon={Tag} />
        <TabBtn id="cuentas" label="Cuentas" icon={Building2} />
        <TabBtn id="tarjetas" label="Tarjetas" icon={CreditCard} />
        <TabBtn id="sueldos" label="Sueldos" icon={Banknote} />
        <TabBtn id="medios" label="Medios" icon={CreditCard} />
        <TabBtn id="ia" label="Integraciones IA" icon={Mic} />
      </div>

      {/* ── Rubros ── */}
      {seccion === 'rubros' && (
        <div className="space-y-4">
          <RubroGestion />
        </div>
      )}

      {/* ── Categorías ── */}
      {seccion === 'categorias' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-navy">Categorías de Gastos</h3>
            <Button onClick={() => abrirFormCategoria()}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar Categoría
            </Button>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate2" />
            <input
              type="text"
              placeholder="Buscar categorías..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="block w-full bg-white pl-10 pr-9 py-2 border border-mist rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate2 hover:text-navy"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {categoriasOrdenadas.length > 0 ? (
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-mist/30 border-b border-mist">
                    <tr>
                      <th
                        className="px-6 py-3 text-left text-xs font-bold text-slate2 uppercase tracking-wider cursor-pointer hover:bg-mist/50"
                        onClick={() => toggleOrden('nombre')}
                      >
                        <div className="flex items-center gap-1">
                          Nombre
                          {ordenCat.campo === 'nombre' ? (
                            ordenCat.dir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          ) : null}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-bold text-slate2 uppercase tracking-wider cursor-pointer hover:bg-mist/50"
                        onClick={() => toggleOrden('estado')}
                      >
                        <div className="flex items-center gap-1">
                          Estado
                          {ordenCat.campo === 'estado' ? (
                            ordenCat.dir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          ) : null}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-slate2 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mist bg-white">
                    {categoriasOrdenadas.map((cat) => (
                      <>
                        <tr key={cat.id} className="hover:bg-mist/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {(cat.subcategorias || []).length > 0 && (
                                <button
                                  onClick={() => setExpandidas((prev) => {
                                    const next = new Set(prev);
                                    next.has(cat.id) ? next.delete(cat.id) : next.add(cat.id);
                                    return next;
                                  })}
                                  className="p-1 rounded hover:bg-mist"
                                >
                                  {expandidas.has(cat.id) ? (
                                    <ChevronDown className="w-3 h-3" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                              <span className="font-medium text-navy">{cat.nombre}</span>
                              <span className="text-xs text-slate2">({(cat.subcategorias || []).length} sub.)</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${cat.activa ? 'bg-mist text-brand' : 'bg-red-50 text-red-600'}`}>
                              {cat.activa ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => finanzas.actualizarCategoria(cat.id, { activa: !cat.activa })}
                              >
                                {cat.activa ? 'Desactivar' : 'Activar'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => abrirFormCategoria(cat)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => confirmarEliminar('categoria', cat.id, cat.nombre)}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {expandidas.has(cat.id) && (cat.subcategorias || []).length > 0 && (
                          <tr key={`${cat.id}-subs`}>
                            <td colSpan={3} className="px-6 py-2 bg-mist/10">
                              <div className="ml-8 space-y-1">
                                {(cat.subcategorias || []).map((sub) => (
                                  <div key={sub.id} className="flex items-center justify-between py-1 px-3 bg-white rounded border border-mist">
                                    <span className="text-sm text-navy">{sub.nombre}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sub.activa ? 'bg-mist text-brand' : 'bg-red-50 text-red-600'}`}>
                                      {sub.activa ? 'Activa' : 'Inactiva'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              {busqueda ? (
                <>
                  <Search className="w-12 h-12 text-slate2 mx-auto mb-2 opacity-30" />
                  <p className="text-slate2">No se encontraron categorías para "{busqueda}"</p>
                  <Button variant="outline" size="sm" onClick={() => setBusqueda('')} className="mt-4">
                    Limpiar búsqueda
                  </Button>
                </>
              ) : (
                <>
                  <Tag className="w-12 h-12 text-slate2 mx-auto mb-2 opacity-30" />
                  <p className="text-slate2">No hay categorías configuradas</p>
                </>
              )}
            </Card>
          )}
        </div>
      )}

      {/* ── Cuentas Bancarias ── */}
      {seccion === 'cuentas' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-navy">Cuentas Bancarias</h3>
            <Button onClick={() => abrirFormCuenta()}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar Cuenta
            </Button>
          </div>

          <div className="grid gap-4">
            {cuentasBancarias.map((cuenta) => (
              <Card key={cuenta.id} className="p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-navy truncate">{cuenta.nombre}</h4>
                    <p className="text-sm text-slate2">{cuenta.banco}</p>
                    <p className="text-sm text-slate2 mt-1">
                      <span className="text-slate2/60">Titular:</span> {cuenta.titular}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-mist text-brand border border-mist">
                        {cuenta.tipo === 'CAJA_AHORRO' ? 'Caja de Ahorro' : cuenta.tipo === 'CUENTA_CORRIENTE' ? 'Cta. Corriente' : 'Virtual'}
                      </span>
                      {cuenta.cuentaSaldoId && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase bg-brand/10 text-brand rounded-md">
                          {finanzas.cuentas.find((c) => c.id === cuenta.cuentaSaldoId)?.nombre || 'Vinculada'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => finanzas.actualizarCuentaBancaria(cuenta.id, { activa: !cuenta.activa })}
                      className={`px-3 py-1 text-xs rounded-full font-bold uppercase ${cuenta.activa ? 'bg-mist text-brand' : 'bg-mist/30 text-slate2'} transition-colors`}
                    >
                      {cuenta.activa ? 'Activa' : 'Inactiva'}
                    </button>
                    <Button variant="outline" size="sm" onClick={() => abrirFormCuenta(cuenta)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => confirmarEliminar('cuenta', cuenta.id, cuenta.nombre)}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {cuentasBancarias.length === 0 && (
              <Card className="p-8 text-center">
                <Building2 className="w-12 h-12 text-slate2 mx-auto mb-4 opacity-30" />
                <p className="text-slate2">No hay cuentas bancarias configuradas</p>
                <Button onClick={() => abrirFormCuenta()} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Primera Cuenta
                </Button>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── Tarjetas ── */}
      {seccion === 'tarjetas' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-navy">Tarjetas de Crédito</h3>
            <Button onClick={() => abrirFormTarjeta()}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar Tarjeta
            </Button>
          </div>

          <div className="grid gap-4">
            {tarjetas.map((tarjeta) => (
              <Card key={tarjeta.id} className="p-4">
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 bg-mist rounded-lg flex-shrink-0">
                      <CreditCard className="w-5 h-5 text-brand" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-navy truncate">{tarjeta.nombre}</h4>
                      <p className="text-sm text-slate2 truncate">{tarjeta.banco}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${tarjeta.tipo === 'VISA' ? 'bg-blue-50 text-blue-700' : tarjeta.tipo === 'MASTERCARD' ? 'bg-orange-50 text-orange-700' : 'bg-mist text-brand'}`}>
                          {tarjeta.tipo}
                        </span>
                        {tarjeta.limiteCredito && (
                          <span className="text-[10px] font-bold text-slate2 bg-mist/50 px-1.5 py-0.5 rounded">
                            Límite: ${tarjeta.limiteCredito.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => finanzas.actualizarTarjeta(tarjeta.id, { activa: !tarjeta.activa })}
                      className={`px-3 py-1 text-xs rounded-full font-bold uppercase ${tarjeta.activa ? 'bg-mist text-brand' : 'bg-mist/30 text-slate2'} transition-colors`}
                    >
                      {tarjeta.activa ? 'Activa' : 'Inactiva'}
                    </button>
                    <Button variant="outline" size="sm" onClick={() => abrirFormTarjeta(tarjeta)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => confirmarEliminar('tarjeta', tarjeta.id, tarjeta.nombre)}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {tarjetas.length === 0 && (
              <Card className="p-8 text-center">
                <CreditCard className="w-12 h-12 text-slate2 mx-auto mb-4 opacity-30" />
                <p className="text-slate2">No hay tarjetas configuradas</p>
                <Button onClick={() => abrirFormTarjeta()} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Primera Tarjeta
                </Button>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── Sueldos ── */}
      {seccion === 'sueldos' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-navy">Sueldos y Remuneraciones</h3>
            <Button onClick={() => abrirFormSueldo()}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar Sueldo
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {finanzas.configuracion.sueldos.map((sueldo) => (
              <Card key={sueldo.id} className="relative overflow-hidden group p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-mist rounded-lg">
                      <Banknote className="w-5 h-5 text-brand" />
                    </div>
                    <div>
                      <h4 className="font-bold text-navy">{sueldo.nombre}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sueldo.moneda === 'USD' ? 'bg-green-50 text-green-700' : 'bg-mist text-brand'}`}>
                        {sueldo.moneda}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="outline" size="sm" onClick={() => abrirFormSueldo(sueldo)} className="p-1">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => confirmarEliminar('sueldo', sueldo.id, sueldo.nombre)} className="p-1 text-red-600 border-red-200">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-2xl font-bold text-navy">
                  {sueldo.moneda === 'USD' ? 'US$' : '$'} {sueldo.monto.toLocaleString()}
                </p>
                {sueldo.moneda === 'USD' && finanzas.cotizacionDolar && (
                  <p className="text-sm text-slate2 mt-1">
                    ≈ ${Math.round(sueldo.monto * finanzas.cotizacionDolar.venta).toLocaleString()} ARS
                  </p>
                )}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${sueldo.moneda === 'USD' ? 'bg-green-500' : 'bg-brand'}`} />
              </Card>
            ))}
          </div>

          {finanzas.configuracion.sueldos.length === 0 && (
            <div className="text-center py-12 bg-mist/20 rounded-xl border-2 border-dashed border-mist">
              <Banknote className="w-12 h-12 text-slate2 mx-auto mb-3 opacity-30" />
              <p className="text-slate2">No hay sueldos cargados todavía</p>
              <Button variant="outline" size="sm" onClick={() => abrirFormSueldo()} className="mt-3">
                Cargar mi primer sueldo
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Medios de Pago ── */}
      {seccion === 'medios' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-navy">Medios de Pago</h3>
            <p className="text-sm text-slate2 max-w-md">
              Configura la cuenta de saldo predeterminada para cada medio de pago.
            </p>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-mist">
                <thead className="bg-mist/20">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate2 uppercase tracking-wider">Medio de Pago</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate2 uppercase tracking-wider">Cuenta Vinculada</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate2 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate2 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-mist">
                  {finanzas.configuracion.formasDePago.map((medio) => {
                    const cuentaVinc = finanzas.cuentas.find((c) => c.id === medio.cuentaSaldoId);
                    return (
                      <tr key={medio.codigo} className="hover:bg-mist/10 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 bg-mist rounded-lg flex items-center justify-center flex-shrink-0">
                              <Banknote className="h-4 w-4 text-brand" />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-navy">{medio.nombre}</div>
                              <div className="text-[10px] text-slate2 font-mono">{medio.codigo}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {cuentaVinc ? (
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-brand" />
                              <span className="text-sm font-medium text-navy">{cuentaVinc.nombre}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-orange-500 italic">Sin vincular</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${medio.activa ? 'bg-mist text-brand' : 'bg-mist/30 text-slate2'}`}>
                            {medio.activa ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => abrirFormMedio(medio)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Editar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── Integraciones IA ── */}
      {seccion === 'ia' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-navy">Integraciones IA</h3>
            <p className="text-sm text-slate2 mt-1">
              Necesaria para dictar transferencias en Saldos (Gemini interpreta origen, destino y monto).
            </p>
          </div>
          <Card className="p-5 space-y-4">
            <Input
              label="API Key de Google Gemini"
              type="password"
              value={aiSettings.geminiApiKey}
              onChange={(e) => setAiSettings({ geminiApiKey: e.target.value })}
              placeholder="AIza…"
            />
            <p className="text-xs text-slate2">
              La clave se guarda solo en este dispositivo. Podés obtenerla en Google AI Studio.
              Comparte la misma clave que uses en Nodo Inmo si ya la configuraste ahí.
            </p>
          </Card>
        </div>
      )}

      {/* ── Modal Form ── */}
      {mostrarForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-navy">
                {seccion === 'categorias' && (categoriaEditando ? 'Editar Categoría' : 'Nueva Categoría')}
                {seccion === 'cuentas' && (cuentaEditando ? 'Editar Cuenta' : 'Nueva Cuenta Bancaria')}
                {seccion === 'tarjetas' && (tarjetaEditando ? 'Editar Tarjeta' : 'Nueva Tarjeta')}
                {seccion === 'sueldos' && (sueldoEditando ? 'Editar Sueldo' : 'Nuevo Sueldo')}
                {seccion === 'medios' && 'Editar Medio de Pago'}
              </h3>
              <button onClick={cerrarForm} className="text-slate2 hover:text-navy">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Categorías form */}
            {seccion === 'categorias' && (
              <form onSubmit={formCategoria.handleSubmit(onSubmitCategoria)} className="space-y-4">
                <Input
                  label="Nombre de la Categoría"
                  {...formCategoria.register('nombre')}
                  error={formCategoria.formState.errors.nombre?.message}
                  placeholder="Ej: Entretenimiento"
                />
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={cerrarForm} className="flex-1">Cancelar</Button>
                  <Button type="submit" className="flex-1">{categoriaEditando ? 'Actualizar' : 'Crear'}</Button>
                </div>
              </form>
            )}

            {/* Cuentas form */}
            {seccion === 'cuentas' && (
              <form onSubmit={formCuenta.handleSubmit(onSubmitCuenta)} className="space-y-4">
                <Input
                  label="Nombre"
                  {...formCuenta.register('nombre')}
                  error={formCuenta.formState.errors.nombre?.message}
                  placeholder="Ej: Cta. Santander Ramiro"
                />
                <Input
                  label="Banco"
                  {...formCuenta.register('banco')}
                  error={formCuenta.formState.errors.banco?.message}
                  placeholder="Ej: Banco Santander"
                />
                <Input
                  label="Titular"
                  {...formCuenta.register('titular')}
                  error={formCuenta.formState.errors.titular?.message}
                  placeholder="Ej: Ramiro"
                />
                <Select
                  label="Tipo de Cuenta"
                  {...formCuenta.register('tipo')}
                  error={formCuenta.formState.errors.tipo?.message}
                  options={[
                    { value: 'CAJA_AHORRO', label: 'Caja de Ahorro' },
                    { value: 'CUENTA_CORRIENTE', label: 'Cuenta Corriente' },
                    { value: 'VIRTUAL', label: 'Virtual / Billetera' },
                  ]}
                />
                <Select
                  label="Vincular con Cuenta de Saldo"
                  {...formCuenta.register('cuentaSaldoId')}
                  options={[
                    { value: '', label: 'Sin vincular' },
                    ...finanzas.cuentas.filter((c) => c.activa).map((c) => ({
                      value: c.id,
                      label: `${c.nombre} (${c.moneda})`,
                    })),
                  ]}
                />
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={cerrarForm} className="flex-1">Cancelar</Button>
                  <Button type="submit" className="flex-1">{cuentaEditando ? 'Actualizar' : 'Crear'}</Button>
                </div>
              </form>
            )}

            {/* Tarjetas form */}
            {seccion === 'tarjetas' && (
              <form onSubmit={formTarjeta.handleSubmit(onSubmitTarjeta)} className="space-y-4">
                <Input
                  label="Nombre"
                  {...formTarjeta.register('nombre')}
                  error={formTarjeta.formState.errors.nombre?.message}
                  placeholder="Ej: SANTANDER VISA"
                />
                <Input
                  label="Banco"
                  {...formTarjeta.register('banco')}
                  error={formTarjeta.formState.errors.banco?.message}
                  placeholder="Ej: Santander"
                />
                <Select
                  label="Tipo"
                  {...formTarjeta.register('tipo')}
                  options={[
                    { value: 'VISA', label: 'Visa' },
                    { value: 'MASTERCARD', label: 'MasterCard' },
                    { value: 'AMERICAN_EXPRESS', label: 'American Express' },
                  ]}
                />
                <Input
                  label="Titular"
                  {...formTarjeta.register('titular')}
                  error={formTarjeta.formState.errors.titular?.message}
                  placeholder="Ej: Ramiro"
                />
                <Controller
                  name="limiteCredito"
                  control={formTarjeta.control}
                  render={({ field }) => (
                    <MoneyInput
                      label="Límite de Crédito (opcional)"
                      value={field.value || 0}
                      onChange={(v) => field.onChange(v)}
                      moneda="ARS"
                    />
                  )}
                />
                <Controller
                  name="limiteRecomendado"
                  control={formTarjeta.control}
                  render={({ field }) => (
                    <MoneyInput
                      label="Límite para Progreso (opcional)"
                      value={field.value || 0}
                      onChange={(v) => field.onChange(v)}
                      moneda="ARS"
                    />
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Día de Cierre"
                    type="number"
                    {...formTarjeta.register('diaCierre', { valueAsNumber: true })}
                    placeholder="Ej: 20"
                  />
                  <Input
                    label="Día de Vencimiento"
                    type="number"
                    {...formTarjeta.register('diaVencimiento', { valueAsNumber: true })}
                    placeholder="Ej: 2"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={cerrarForm} className="flex-1">Cancelar</Button>
                  <Button type="submit" className="flex-1">{tarjetaEditando ? 'Actualizar' : 'Crear'}</Button>
                </div>
              </form>
            )}

            {/* Sueldos form */}
            {seccion === 'sueldos' && (
              <form onSubmit={formSueldo.handleSubmit(onSubmitSueldo)} className="space-y-4">
                <Input
                  label="Persona / Concepto"
                  {...formSueldo.register('nombre')}
                  error={formSueldo.formState.errors.nombre?.message}
                  placeholder="Ej: Sueldo Ramiro"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    name="monto"
                    control={formSueldo.control}
                    render={({ field }) => (
                      <MoneyInput
                        label="Monto"
                        value={field.value}
                        onChange={field.onChange}
                        moneda={watchSueldoMoneda}
                        error={formSueldo.formState.errors.monto?.message}
                      />
                    )}
                  />
                  <Select
                    label="Moneda"
                    {...formSueldo.register('moneda')}
                    options={[
                      { value: 'ARS', label: 'Pesos (ARS)' },
                      { value: 'USD', label: 'Dólares (USD)' },
                    ]}
                  />
                </div>
                {watchSueldoMoneda === 'USD' && finanzas.cotizacionDolar && watchSueldoMonto > 0 && (
                  <div className="p-3 bg-mist rounded-lg border border-mist">
                    <p className="text-xs text-brand font-medium mb-1 uppercase tracking-wider">Conversión estimada</p>
                    <p className="text-lg font-bold text-navy">
                      ARS ${Math.round(watchSueldoMonto * finanzas.cotizacionDolar.venta).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate2 mt-1">
                      Cotiz. Blue: ${finanzas.cotizacionDolar.venta}
                    </p>
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={cerrarForm} className="flex-1">Cancelar</Button>
                  <Button type="submit" className="flex-1">{sueldoEditando ? 'Actualizar' : 'Crear'}</Button>
                </div>
              </form>
            )}

            {/* Medios form */}
            {seccion === 'medios' && (
              <form onSubmit={formMedio.handleSubmit(onSubmitMedio)} className="space-y-4">
                <Input
                  label="Nombre del Medio"
                  {...formMedio.register('nombre')}
                  error={formMedio.formState.errors.nombre?.message}
                />
                <Select
                  label="Vincular con Cuenta de Saldo"
                  {...formMedio.register('cuentaSaldoId')}
                  options={[
                    { value: '', label: 'Búsqueda Automática' },
                    ...finanzas.cuentas.filter((c) => c.activa).map((c) => ({
                      value: c.id,
                      label: `${c.nombre} (${c.moneda})`,
                    })),
                  ]}
                />
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={cerrarForm} className="flex-1">Cancelar</Button>
                  <Button type="submit" className="flex-1">Actualizar</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ModalConfirmacion
        open={modalAbierto}
        title={`Eliminar ${paraEliminar?.tipo || ''}`}
        message={`¿Confirmás que querés eliminar "${paraEliminar?.nombre}"? Esta acción no se puede deshacer.`}
        onConfirm={handleConfirmar}
        onCancel={() => { setParaEliminar(null); setModalAbierto(false); }}
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}
