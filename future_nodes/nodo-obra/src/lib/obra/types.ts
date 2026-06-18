export type ProyectoEstado = "PLAN" | "CURSO" | "FINALIZADO" | "SUSPENDIDO";

export type TareaTipo = "propietario" | "operativa" | "agenda" | "logistica" | "caja";

export interface LocalStaff {
  id: string;
  fullName: string;
  email: string;
  password: string;
  role: "staff" | "admin";
  createdAt: string;
}

export interface LocalCliente {
  id: string;
  nombre: string;
  dni: string;
  telefono: string;
  email: string;
  domicilio: string;
  puedeVerPortal: boolean;
  portalEmail: string;
  portalPassword: string;
  createdAt: string;
}

export type PresupuestoEstado =
  | "BORRADOR"
  | "ENVIADO"
  | "APROBADO"
  | "RECHAZADO"
  | "CONVERTIDO";

export interface PresupuestoRubroLine {
  id: string;
  rubroNombre: string;
  manoObra: number;
  materiales: number;
  notas: string;
}

export interface LocalPresupuesto {
  id: string;
  titulo: string;
  clienteId: string | null;
  direccionObra: string;
  tipoInmueble: string;
  plazoMeses: number;
  encargado: string;
  porcentajeContingencia: number;
  notas: string;
  estado: PresupuestoEstado;
  proyectoId: string | null;
  inmoPropertyId: string | null;
  inmoPropertyLabel: string | null;
  createdAt: string;
  updatedAt: string;
  aprobadoAt: string | null;
  rubros: PresupuestoRubroLine[];
}

export interface PresupuestoResumen {
  id: string;
  titulo: string;
  clienteNombre: string;
  direccionObra: string;
  estado: PresupuestoEstado;
  estadoLabel: string;
  subtotal: number;
  contingencia: number;
  total: number;
  rubrosCount: number;
  proyectoId: string | null;
  updatedAt: string;
}

export interface LocalProyecto {
  id: string;
  nombre: string;
  clienteId: string | null;
  direccionObra: string;
  tipoInmueble: string;
  fechaInicio: string;
  plazoMeses: number;
  encargado: string;
  porcentajeContingencia: number;
  presupuestoEstimado: number;
  porcentajeComisionDireccion: number;
  tipoHonorario: "PORCENTAJE" | "FIJO_TICKET" | "FIJO_TOTAL" | "SEMANAL";
  valorHonorario: number;
  estado: ProyectoEstado;
  notas: string;
  avanceProgreso: number;
  origenPresupuestoId: string | null;
  inmoPropertyId: string | null;
  inmoPropertyLabel: string | null;
  createdAt: string;
}

export interface LocalFotoAvance {
  id: string;
  proyectoId: string;
  fechaAvance: string;
  descripcion: string;
  fileName: string;
  createdAt: string;
}

export interface InmoPropertyOption {
  id: string;
  address: string;
  propertyType: string;
  ownerName: string;
  status: string;
}

export interface LocalProyectoRubro {
  id: string;
  proyectoId: string;
  nombre: string;
  porcentajeAvance: number;
}

export interface LocalTarea {
  id: string;
  proyectoId: string;
  titulo: string;
  contenido: string;
  completada: boolean;
  fechaCreacion: string;
  fechaLimite: string | null;
  tipo: TareaTipo;
  presupuestoManoObra: number;
  presupuestoMateriales: number;
}

export interface LocalRubro {
  id: string;
  nombre: string;
}

export interface LocalGasto {
  id: string;
  proyectoId: string;
  rubroId: string | null;
  fecha: string;
  detalle: string;
  montoTicket: number;
  tipoComponente: "MATERIALES" | "MANO_OBRA";
}

export interface ObraDatabase {
  version: number;
  staff: LocalStaff[];
  clientes: LocalCliente[];
  rubros: LocalRubro[];
  proyectos: LocalProyecto[];
  rubrosProgreso: LocalProyectoRubro[];
  presupuestos: LocalPresupuesto[];
  fotosAvance: LocalFotoAvance[];
  tareas: LocalTarea[];
  gastos: LocalGasto[];
}

export interface RubroProgresoView {
  id: string;
  nombre: string;
  porcentajeAvance: number;
  montoGasto: number;
}

export interface ProyectoDashboard {
  id: string;
  nombre: string;
  propiedadVinculada: string;
  estado: ProyectoEstado;
  estadoLabel: string;
  presupuestoEstimado: number;
  gastoReal: number;
  porcentajeGasto: number;
  porcentajeAvance: number;
  alertaDesvio: boolean;
  encargado: string;
}

export interface DashboardTarea extends LocalTarea {
  proyectoNombre: string;
}

export interface DashboardPayload {
  obras: ProyectoDashboard[];
  totales: {
    presupuestoTotal: number;
    gastoTotal: number;
    porcentajeGlobal: number;
  };
  obrasConDesvio: number;
  tareasAgenda: DashboardTarea[];
  tareasLogistica: DashboardTarea[];
  tareasCaja: DashboardTarea[];
}
