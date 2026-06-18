import { randomUUID } from "crypto";
import type { ObraDatabase, LocalPresupuesto } from "@/lib/obra/types";

export const OBRA_SEED_VERSION = 5;

const RUBRO_NAMES = [
  "Albañilería",
  "Electricidad",
  "Plomería",
  "Pintura",
  "Herrería",
  "Carpintería",
];

export function buildDefaultRubros() {
  return RUBRO_NAMES.map((nombre) => ({
    id: randomUUID(),
    nombre,
  }));
}

export function buildSeedPresupuestos(
  db: Pick<ObraDatabase, "clientes">,
): LocalPresupuesto[] {
  const clienteId = db.clientes[0]?.id ?? null;
  const now = new Date().toISOString();

  return [
    {
      id: randomUUID(),
      titulo: "Ampliación quincho — Belgrano",
      clienteId,
      direccionObra: "Vuelta de Obligado 2100, CABA",
      tipoInmueble: "Casa",
      plazoMeses: 3,
      encargado: "Ing. López",
      porcentajeContingencia: 10,
      notas: "Incluye deck exterior y parrilla.",
      estado: "ENVIADO",
      proyectoId: null,
      inmoPropertyId: "inmo-prop-obligado-2100",
      inmoPropertyLabel: "Vuelta de Obligado 2100, Belgrano, CABA (Casa)",
      createdAt: now,
      updatedAt: now,
      aprobadoAt: null,
      rubros: [
        {
          id: randomUUID(),
          rubroNombre: "Albañilería",
          manoObra: 1800000,
          materiales: 950000,
          notas: "Base y contrapiso",
        },
        {
          id: randomUUID(),
          rubroNombre: "Electricidad",
          manoObra: 420000,
          materiales: 280000,
          notas: "Iluminación perimetral",
        },
        {
          id: randomUUID(),
          rubroNombre: "Carpintería",
          manoObra: 890000,
          materiales: 1200000,
          notas: "Deck y cerramiento",
        },
      ],
    },
    {
      id: randomUUID(),
      titulo: "Remodelación cocina — Recoleta",
      clienteId,
      direccionObra: "Ayacucho 1200, CABA",
      tipoInmueble: "Departamento",
      plazoMeses: 2,
      encargado: "Arq. Martínez",
      porcentajeContingencia: 8,
      notas: "Cliente pidió cotización alternativa sin muebles.",
      estado: "BORRADOR",
      proyectoId: null,
      inmoPropertyId: "inmo-prop-ayacucho-1200",
      inmoPropertyLabel: "Ayacucho 1200, Recoleta, CABA (Departamento)",
      createdAt: now,
      updatedAt: now,
      aprobadoAt: null,
      rubros: [
        {
          id: randomUUID(),
          rubroNombre: "Plomería",
          manoObra: 350000,
          materiales: 180000,
          notas: "",
        },
        {
          id: randomUUID(),
          rubroNombre: "Electricidad",
          manoObra: 280000,
          materiales: 150000,
          notas: "",
        },
        {
          id: randomUUID(),
          rubroNombre: "Pintura",
          manoObra: 220000,
          materiales: 90000,
          notas: "",
        },
      ],
    },
  ];
}

export function buildObraSeed(): ObraDatabase {
  const staffId = randomUUID();
  const clienteId = randomUUID();
  const obra1Id = randomUUID();
  const obra2Id = randomUUID();
  const rubros = buildDefaultRubros();
  const rubroAlbanileria = rubros[0].id;
  const rubroElectricidad = rubros[1].id;
  const now = new Date().toISOString();

  return {
    version: OBRA_SEED_VERSION,
    staff: [
      {
        id: staffId,
        fullName: "Dirección de Obra",
        email: "direccion@nodo.demo",
        password: "demo1234",
        role: "admin",
        createdAt: now,
      },
    ],
    clientes: [
      {
        id: clienteId,
        nombre: "María González",
        dni: "30123456",
        telefono: "11 5555-1234",
        email: "maria@ejemplo.com",
        domicilio: "Av. Libertador 1200, CABA",
        puedeVerPortal: true,
        portalEmail: "maria@ejemplo.com",
        portalPassword: "cliente1234",
        createdAt: now,
      },
    ],
    rubros,
    proyectos: [
      {
        id: obra1Id,
        nombre: "Refacción PH Palermo",
        clienteId,
        direccionObra: "Thames 1450, CABA",
        tipoInmueble: "PH",
        fechaInicio: "2025-03-01",
        plazoMeses: 4,
        encargado: "Ing. López",
        porcentajeContingencia: 10,
        presupuestoEstimado: 8500000,
        porcentajeComisionDireccion: 10,
        tipoHonorario: "PORCENTAJE",
        valorHonorario: 10,
        estado: "CURSO",
        notas: "Obra en ejecución — demolición terminada.",
        avanceProgreso: 33,
        origenPresupuestoId: null,
        inmoPropertyId: "inmo-prop-thames-1450",
        inmoPropertyLabel: "Thames 1450, Palermo, CABA (PH)",
        createdAt: now,
      },
      {
        id: obra2Id,
        nombre: "Casa Nordelta",
        clienteId,
        direccionObra: "Los Castores 320, Nordelta",
        tipoInmueble: "Casa",
        fechaInicio: "2025-06-01",
        plazoMeses: 8,
        encargado: "Arq. Martínez",
        porcentajeContingencia: 12,
        presupuestoEstimado: 22000000,
        porcentajeComisionDireccion: 10,
        tipoHonorario: "PORCENTAJE",
        valorHonorario: 10,
        estado: "PLAN",
        notas: "En planificación — presupuesto preliminar.",
        avanceProgreso: 0,
        origenPresupuestoId: null,
        inmoPropertyId: "inmo-prop-nordelta-320",
        inmoPropertyLabel: "Los Castores 320, Nordelta, Tigre (Casa)",
        createdAt: now,
      },
    ],
    rubrosProgreso: [
      {
        id: randomUUID(),
        proyectoId: obra1Id,
        nombre: "Albañilería",
        porcentajeAvance: 65,
      },
      {
        id: randomUUID(),
        proyectoId: obra1Id,
        nombre: "Electricidad",
        porcentajeAvance: 35,
      },
      {
        id: randomUUID(),
        proyectoId: obra1Id,
        nombre: "Plomería",
        porcentajeAvance: 20,
      },
      {
        id: randomUUID(),
        proyectoId: obra1Id,
        nombre: "Pintura",
        porcentajeAvance: 10,
      },
      {
        id: randomUUID(),
        proyectoId: obra2Id,
        nombre: "Albañilería",
        porcentajeAvance: 0,
      },
      {
        id: randomUUID(),
        proyectoId: obra2Id,
        nombre: "Electricidad",
        porcentajeAvance: 0,
      },
      {
        id: randomUUID(),
        proyectoId: obra2Id,
        nombre: "Plomería",
        porcentajeAvance: 0,
      },
      {
        id: randomUUID(),
        proyectoId: obra2Id,
        nombre: "Pintura",
        porcentajeAvance: 0,
      },
    ],
    tareas: [
      {
        id: randomUUID(),
        proyectoId: obra1Id,
        titulo: "Revisar planos sanitarios",
        contenido: "",
        completada: true,
        fechaCreacion: now,
        fechaLimite: "2025-03-10",
        tipo: "operativa",
        presupuestoManoObra: 0,
        presupuestoMateriales: 0,
      },
      {
        id: randomUUID(),
        proyectoId: obra1Id,
        titulo: "Coordinar visita cliente",
        contenido: "",
        completada: false,
        fechaCreacion: now,
        fechaLimite: "2025-06-20",
        tipo: "agenda",
        presupuestoManoObra: 0,
        presupuestoMateriales: 0,
      },
      {
        id: randomUUID(),
        proyectoId: obra1Id,
        titulo: "Pedido cemento — pendiente",
        contenido: "",
        completada: false,
        fechaCreacion: now,
        fechaLimite: null,
        tipo: "logistica",
        presupuestoManoObra: 0,
        presupuestoMateriales: 0,
      },
      {
        id: randomUUID(),
        proyectoId: obra1Id,
        titulo: "Rendir caja chica semana 24",
        contenido: "",
        completada: false,
        fechaCreacion: now,
        fechaLimite: null,
        tipo: "caja",
        presupuestoManoObra: 0,
        presupuestoMateriales: 0,
      },
      {
        id: randomUUID(),
        proyectoId: obra1Id,
        titulo: "Elegir griferías baño en suite",
        contenido: "",
        completada: false,
        fechaCreacion: now,
        fechaLimite: "2025-08-15",
        tipo: "propietario",
        presupuestoManoObra: 0,
        presupuestoMateriales: 0,
      },
      {
        id: randomUUID(),
        proyectoId: obra2Id,
        titulo: "Definir terminaciones",
        contenido: "",
        completada: false,
        fechaCreacion: now,
        fechaLimite: "2025-07-01",
        tipo: "propietario",
        presupuestoManoObra: 0,
        presupuestoMateriales: 0,
      },
    ],
    presupuestos: buildSeedPresupuestos({
      clientes: [
        {
          id: clienteId,
          nombre: "María González",
          dni: "30123456",
          telefono: "11 5555-1234",
          email: "maria@ejemplo.com",
          domicilio: "Av. Libertador 1200, CABA",
          puedeVerPortal: true,
          portalEmail: "maria@ejemplo.com",
          portalPassword: "cliente1234",
          createdAt: now,
        },
      ],
    }),
    fotosAvance: [],
    gastos: [
      {
        id: randomUUID(),
        proyectoId: obra1Id,
        rubroId: rubroAlbanileria,
        fecha: "2025-05-12",
        detalle: "Corralón — hierro y cemento",
        montoTicket: 420000,
        tipoComponente: "MATERIALES",
      },
      {
        id: randomUUID(),
        proyectoId: obra1Id,
        rubroId: rubroAlbanileria,
        fecha: "2025-05-28",
        detalle: "Albañilería — avance muro",
        montoTicket: 680000,
        tipoComponente: "MANO_OBRA",
      },
      {
        id: randomUUID(),
        proyectoId: obra1Id,
        rubroId: rubroElectricidad,
        fecha: "2025-06-05",
        detalle: "Electricidad — materiales",
        montoTicket: 310000,
        tipoComponente: "MATERIALES",
      },
    ],
  };
}
