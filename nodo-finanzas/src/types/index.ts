// Tipos para rubros dinámicos
export interface Rubro {
  id: string;
  codigo: string;
  nombre: string;
  emoji: string;
  color: string;
  descripcion?: string;
  activo: boolean;
  esSistema: boolean;
  orden: number;
  createdAt?: string;
  updatedAt?: string;
}

// Tipos para monedas
export type Moneda = 'ARS' | 'USD';

// Tipos para cuentas/saldos
export type TipoCuenta = 'EFECTIVO' | 'CAJA_AHORRO' | 'CUENTA_CORRIENTE' | 'VIRTUAL';

export interface Cuenta {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  saldoActual: number;
  moneda: Moneda;
  activa: boolean;
  fechaActualizacion: string;
}

// Tipos para gastos fijos
export type CategoriaGasto = string; // Dinámico - se obtiene de la base de datos

// Categorías por defecto (para fallback)
export const CATEGORIAS_DEFAULT = [
  'ESCUELA',
  'ACTIVIDAD_FISICA',
  'SERVICIOS',
  'RESTAURACION_AUTOS',
  'CREDITOS',
  'ALIMENTACION',
  'TRANSPORTE',
  'ENTRETENIMIENTO',
  'SALUD',
  'OTROS'
] as const;

export type FormaDePago = 'EFECTIVO' | 'DEBITO' | 'TARJETA' | 'TRANSFERENCIA BANCO' | 'MERCADO_PAGO';

// Configuraciones del sistema
export interface CuentaBancaria {
  id: string;
  nombre: string;
  banco: string;
  titular: string;
  tipo: 'CAJA_AHORRO' | 'CUENTA_CORRIENTE' | 'VIRTUAL';
  activa: boolean;
  cuentaSaldoId?: string; // ID de la cuenta en la tabla 'cuentas' (saldos/dashboard)
}

export interface Subcategoria {
  id: string;
  nombre: string;
  activa: boolean;
}

export interface ConfiguracionCategoria {
  id: string;
  nombre: string;
  codigo: string;
  activa: boolean;
  subcategorias?: Subcategoria[];
}

// Subcategorías predefinidas para categorías comunes
export const SUBCATEGORIAS_PREDEFINIDAS = {
  SERVICIOS: [
    'Luz',
    'Gas',
    'Internet',
    'Celulares',
    'Agua',
    'Cable/TV',
    'Teléfono fijo',
    'Seguridad',
    'Mantenimiento'
  ],
  ALIMENTACION: [
    'Supermercado',
    'Carnicería',
    'Verdulería',
    'Panadería',
    'Bebidas',
    'Comida preparada',
    'Delivery'
  ],
  TRANSPORTE: [
    'Combustible',
    'Transporte público',
    'Taxi/Uber',
    'Peajes',
    'Estacionamiento',
    'Mantenimiento vehículo',
    'Seguro automotor'
  ],
  ENTRETENIMIENTO: [
    'Streaming',
    'Cine',
    'Restaurantes',
    'Deportes',
    'Viajes',
    'Libros',
    'Juegos'
  ],
  SALUD: [
    'Medicamentos',
    'Consultas médicas',
    'Odontología',
    'Estudios',
    'Kinesiología',
    'Seguro médico',
    'Óptica'
  ]
};

export interface ConfiguracionFormaPago {
  id: string;
  nombre: string;
  codigo: FormaDePago;
  activa: boolean;
  cuentaSaldoId?: string; // ID de la cuenta en la tabla 'cuentas' (saldos/dashboard)
}

export interface GastoFijo {
  id: string;
  rubroId: string;
  etiqueta?: string; // Label personalizado para el rubro
  descripcion: string;
  monto: number;
  moneda: Moneda;
  formaDePago: FormaDePago;
  tarjetaId?: string; // Si forma de pago es tarjeta
  cuentaBancariaId?: string; // Si forma de pago es débito automático
  activo: boolean;
  fechaCreacion: string;
  planId?: string;
  prestamoId?: string;
  pagoTarjetaId?: string;
}

// Tipos para tarjetas de crédito
export type TipoTarjeta = 'VISA' | 'MASTERCARD' | 'AMERICAN_EXPRESS';

export interface Tarjeta {
  id: string;
  nombre: string;
  banco: string;
  tipo: TipoTarjeta;
  titular: string;
  activa: boolean;
  fechaVencimiento?: string;
  limiteCredito?: number;
  limiteRecomendado?: number; // Límite para mostrar en barra de progreso
  diaCierre?: number; // Día del mes en que cierra la tarjeta (1-31)
  diaVencimiento?: number; // Día del mes en que vence el resumen (1-31)
  pagada?: boolean;
  ultimoPagoMes?: string; // Formato YYYY-MM
}

export type RubroConsumo =
  | 'ALIMENTACION'
  | 'COMBUSTIBLE'
  | 'ENTRETENIMIENTO'
  | 'SALUD'
  | 'SERVICIOS'
  | 'TRANSPORTE'
  | 'VESTIMENTA'
  | 'TECNOLOGIA'
  | 'HOGAR'
  | 'RESTAURACION_AUTOS'
  | 'OTROS';

export interface ConsumoTarjeta {
  id: string;
  tarjetaId: string;
  fecha: string;
  lugar: string;
  rubro?: RubroConsumo; // Opcional por compatibilidad temporal
  rubroId?: string; // Nueva referencia a tabla rubros
  rubroInfo?: Rubro; // Información completa del rubro
  detalle: string | null;
  importeARS: number;
  importeUSD?: number;
  cuotas?: string; // "2 de 3", "1 de 1", etc.
  cuotaActual?: number;
  totalCuotas?: number;
  gastoFijo?: boolean;
  codigoOperacion?: string;
  fechaCompra?: string; // Fecha exacta en que se realizó el gasto
}

// Tipos para gastos diarios
export interface GastoDiario {
  id: string;
  descripcion: string;
  detalle?: string | null;
  monto: number;
  montoUSD?: number;
  fecha: string;
  rubro?: string; // Opcional por compatibilidad temporal
  rubroId?: string; // Nueva referencia a tabla rubros
  rubroInfo?: Rubro; // Información completa del rubro
  formaPago: FormaDePago;
  tarjetaId?: string;
  cuentaId?: string;
  cuotas?: number;
  codigoOperacion?: string;
  gastoFijoId?: string;
  planId?: string;
  prestamoId?: string;
  pagoTarjetaId?: string;
  pagoParcial?: boolean;
  pagoTarjetaMes?: string; // YYYY-MM
  esSilencioso?: boolean;
}

// Constante para intereses de financiación de tarjetas (mensual)
export const TASA_INTERES_TARJETA = 0.0768303;

// Tipos para préstamos
export interface Prestamo {
  id: string;
  concepto: string;
  montoOriginal: number;
  moneda: Moneda;
  saldoPendiente: number;
  tasaInteres?: number;
  fechaInicio: string;
  fechaVencimiento?: string;
  cuotasTotales?: number;
  cuotasPagas?: number;
  importeCuota?: number;
  saldoCancelacion?: number;
  cuotaAbonada?: boolean;
  pagado?: boolean;
  excluirDelResumen?: boolean;
  activo?: boolean;
  prestamista?: string;
  color?: string;
  noCobrarCuota?: boolean;
  notas?: string;
  comprobanteUrl?: string;
  ultimoPagoMes?: string; // Formato YYYY-MM
}

export interface CuotaProgramada {
  id: string;
  prestamoId: string;
  numeroCuota: number;
  fechaVencimiento: string;
  importeTotal: number;
  pagada: boolean;
  fechaPago?: string;
}

// Tipos para planes de ahorro
export interface PlanAhorro {
  id: string;
  detalle: string;
  grupo?: string;
  orden?: number;
  valorMovil?: number;        // Valor actual del bien (ej: auto)
  saldoCancelacion?: number;  // Saldo necesario para cancelar hoy
  fechaInicio: string;        // YYYY-MM-DD
  cuotasTotales: number;
  cuotasPagas: number;
  cuotasAdelantadas?: number;
  importeCuota: number;
  moneda: Moneda;
  fechaVencimiento: string;     // YYYY-MM-DD del próximo vencimiento
  activa: boolean;
  linkPago?: string;            // Link para realizar el pago (ej: MercadoPago)
  modeloReferencia?: string;    // Modelo para scraping de precio (ej: 'maverick', 'territory')
  createdAt?: string;
}

export interface CuotaPlanAhorro {
  id: string;
  planId: string;
  numeroCuota: number;
  fechaVencimiento: string;
  importe: number;
  pagada: boolean;
  fechaPago?: string;
  gastoDiarioId?: string;
}

// Tipos para sueldos
export interface Sueldo {
  id: string;
  nombre: string;
  monto: number;
  moneda: Moneda;
  activo: boolean;
  updatedAt?: string;
}

// Tipos para movimientos de cuenta (libro de entradas/salidas)
export type OrigenMovimiento =
  | 'gasto_diario'
  | 'transferencia_sueldo'
  | 'ajuste_manual'
  | 'gasto_fijo'
  | 'transferencia_entre_cuentas'
  | 'otro';

export interface MovimientoCuenta {
  id: string;
  cuentaId: string;
  fecha: string;           // YYYY-MM-DD
  descripcion: string;
  monto: number;           // positivo = entrada, negativo = salida
  tipo: 'entrada' | 'salida';
  origen: OrigenMovimiento;
  referenciaId?: string;   // ID del gasto_diario / sueldo / etc.
  detalle?: string;
  createdAt?: string;
}

// Tipos para cotización del dólar
export type TipoDolar = 'oficial' | 'blue' | 'tarjeta' | 'mep' | 'ccl';

export interface CotizacionDolar {
  tipo: TipoDolar;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

// Tipos para resúmenes y dashboard
export interface ResumenFinanciero {
  totalSaldos: number;
  totalGastosFijos: number;
  totalTarjetas: number;
  totalPrestamos: number;
  gastosFijosPendientes: number;
  tarjetasPendientes: number;
  prestamosPendientes: number;
  prestamosPendientesUSD: number;
  saldoLibre: number;
  cotizacionDolar: CotizacionDolar | null;
}

export interface ResumenTarjeta {
  tarjetaId: string;
  nombreTarjeta: string;
  totalMes: number;
  totalUSD: number;
  consumosPorRubro: Record<RubroConsumo, number>;
}

// Tipos para el estado global de la aplicación
export interface AppState {
  cuentas: Cuenta[];
  gastosFijos: GastoFijo[];
  gastosDiarios: GastoDiario[];
  tarjetas: Tarjeta[];
  consumosTarjetas: ConsumoTarjeta[];
  prestamos: Prestamo[];
  planesAhorro: PlanAhorro[];
  cotizacionDolar: CotizacionDolar | null;
  configuracion: {
    tipoDolarSeleccionado: TipoDolar;
    cuentasBancarias: CuentaBancaria[];
    categorias: ConfiguracionCategoria[];
    formasDePago: ConfiguracionFormaPago[];
    sueldos: Sueldo[];
  };
}
