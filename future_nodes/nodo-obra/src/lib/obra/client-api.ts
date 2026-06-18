export type ObraStaffRole = "staff" | "admin";
export type ObraSessionRole = "staff" | "cliente";

export interface ObraSession {
  userId: string;
  email: string;
  fullName: string;
  role: ObraSessionRole;
}

const SESSION_KEY = "nodo_obra_local_session";

export function saveClientSession(session: ObraSession) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearClientSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const obraApi = {
  async getSession(): Promise<{
    session: ObraSession | null;
    user: Record<string, unknown> | null;
    role?: ObraSessionRole;
  }> {
    try {
      const data = await apiFetch<{
        session: ObraSession | null;
        user: Record<string, unknown> | null;
        role?: ObraSessionRole;
      }>("/api/obra/auth/login", { method: "GET" });
      if (data.session) saveClientSession(data.session);
      return data;
    } catch {
      return { session: null, user: null };
    }
  },

  async login(email: string, password: string, role: ObraSessionRole = "staff") {
    const data = await apiFetch<{
      session: ObraSession;
      user: Record<string, unknown>;
      role: ObraSessionRole;
    }>("/api/obra/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    });
    saveClientSession(data.session);
    return data;
  },

  async logout() {
    clearClientSession();
    await apiFetch("/api/obra/auth/login", { method: "DELETE" });
  },

  async getDashboard() {
    return apiFetch<import("@/lib/obra/types").DashboardPayload>(
      "/api/obra/dashboard",
    );
  },

  async getProyectos() {
    return apiFetch<{
      obras: import("@/lib/obra/types").ProyectoDashboard[];
      proyectos: import("@/lib/obra/types").LocalProyecto[];
      clientes: import("@/lib/obra/types").LocalCliente[];
    }>("/api/obra/proyectos");
  },

  async getProyecto(id: string) {
    return apiFetch<{
      proyecto: import("@/lib/obra/types").LocalProyecto;
      cliente: import("@/lib/obra/types").LocalCliente | null;
      tareas: import("@/lib/obra/types").LocalTarea[];
      gastos: import("@/lib/obra/types").LocalGasto[];
      rubrosProgreso: import("@/lib/obra/types").RubroProgresoView[];
      resumen: import("@/lib/obra/types").ProyectoDashboard;
    }>(`/api/obra/proyectos/${id}`);
  },

  async createProyecto(body: Record<string, unknown>) {
    return apiFetch<{ proyecto: import("@/lib/obra/types").LocalProyecto }>(
      "/api/obra/proyectos",
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  async getClientePortal() {
    return apiFetch<{
      cliente: import("@/lib/obra/types").LocalCliente;
      presupuestos: import("@/lib/obra/types").PresupuestoResumen[];
      proyectos: Array<
        import("@/lib/obra/types").ProyectoDashboard & {
          notas: string;
          tareas: Array<{
            titulo: string;
            completada: boolean;
            fechaLimite: string | null;
          }>;
          fotos: import("@/lib/obra/types").LocalFotoAvance[];
        }
      >;
    }>("/api/obra/cliente/portal");
  },

  async getStaffProfile() {
    return apiFetch<{ user: Record<string, unknown> }>(
      "/api/obra/staff/profile",
    );
  },

  async updateStaffProfile(body: {
    fullName: string;
    email: string;
    currentPassword?: string;
    newPassword?: string;
  }) {
  const data = await apiFetch<{
    user: Record<string, unknown>;
  }>("/api/obra/staff/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const sessionCheck = await apiFetch<{
    session: ObraSession | null;
  }>("/api/obra/auth/login", { method: "GET" });
  if (sessionCheck.session) saveClientSession(sessionCheck.session);
  return data;
  },

  async createTarea(body: {
    proyectoId: string;
    titulo: string;
    tipo: import("@/lib/obra/types").TareaTipo;
    fechaHora?: string;
    fechaLimite?: string;
  }) {
    return apiFetch<{ tarea: import("@/lib/obra/types").LocalTarea }>(
      "/api/obra/tareas",
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  async updateTarea(id: string, body: { completada?: boolean; titulo?: string }) {
    return apiFetch<{ tarea: import("@/lib/obra/types").LocalTarea }>(
      `/api/obra/tareas/${id}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
  },

  async updateAvance(
    proyectoId: string,
    body: { rubroId?: string | null; porcentajeAvance: number },
  ) {
    return apiFetch<{
      ok: boolean;
      nuevoAvanceGeneral: number;
      resumen: import("@/lib/obra/types").ProyectoDashboard;
      rubro: import("@/lib/obra/types").LocalProyectoRubro | null;
    }>(`/api/obra/proyectos/${proyectoId}/avance`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  async getGastos(proyectoId: string) {
    return apiFetch<{
      gastos: import("@/lib/obra/types").LocalGasto[];
      rubros: import("@/lib/obra/types").LocalRubro[];
    }>(`/api/obra/gastos?proyectoId=${encodeURIComponent(proyectoId)}`);
  },

  async createGasto(body: {
    proyectoId: string;
    rubroId: string | null;
    detalle: string;
    montoTicket: number;
    fecha: string;
    tipoComponente: "MATERIALES" | "MANO_OBRA";
  }) {
    return apiFetch<{ gasto: import("@/lib/obra/types").LocalGasto }>(
      "/api/obra/gastos",
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  async deleteGasto(id: string) {
    return apiFetch<{ ok: boolean }>(`/api/obra/gastos/${id}`, {
      method: "DELETE",
    });
  },

  async getPresupuestos() {
    return apiFetch<{
      presupuestos: import("@/lib/obra/types").PresupuestoResumen[];
      items: import("@/lib/obra/types").LocalPresupuesto[];
      clientes: import("@/lib/obra/types").LocalCliente[];
      rubrosCatalogo: string[];
    }>("/api/obra/presupuestos");
  },

  async getPresupuesto(id: string) {
    return apiFetch<{
      presupuesto: import("@/lib/obra/types").LocalPresupuesto;
      resumen: import("@/lib/obra/types").PresupuestoResumen;
      cliente: Record<string, unknown> | null;
      rubrosCatalogo: string[];
    }>(`/api/obra/presupuestos/${id}`);
  },

  async createPresupuesto(body: Record<string, unknown>) {
    return apiFetch<{
      presupuesto: import("@/lib/obra/types").LocalPresupuesto;
      resumen: import("@/lib/obra/types").PresupuestoResumen;
    }>("/api/obra/presupuestos", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async updatePresupuesto(id: string, body: Record<string, unknown>) {
    return apiFetch<{
      presupuesto: import("@/lib/obra/types").LocalPresupuesto;
      resumen: import("@/lib/obra/types").PresupuestoResumen;
    }>(`/api/obra/presupuestos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  async aprobarPresupuesto(id: string) {
    return apiFetch<{
      presupuesto: import("@/lib/obra/types").LocalPresupuesto;
      resumen: import("@/lib/obra/types").PresupuestoResumen;
      proyecto: import("@/lib/obra/types").LocalProyecto;
      obraResumen: import("@/lib/obra/types").ProyectoDashboard;
    }>(`/api/obra/presupuestos/${id}/aprobar`, { method: "POST" });
  },

  presupuestoPdfUrl(id: string) {
    return `/api/obra/presupuestos/${id}/pdf`;
  },

  async getInmoProperties() {
    return apiFetch<{ properties: import("@/lib/obra/types").InmoPropertyOption[] }>(
      "/api/obra/inmo/properties",
    );
  },

  async getFotosAvance(proyectoId: string) {
    return apiFetch<{ fotos: import("@/lib/obra/types").LocalFotoAvance[] }>(
      `/api/obra/proyectos/${proyectoId}/fotos`,
    );
  },

  fotoAvanceUrl(fotoId: string) {
    return `/api/obra/fotos/${fotoId}/image`;
  },

  async uploadFotoAvance(
    proyectoId: string,
    body: { imagen: File; descripcion: string; fecha: string },
  ) {
    const formData = new FormData();
    formData.append("imagen", body.imagen);
    formData.append("descripcion", body.descripcion);
    formData.append("fecha", body.fecha);
    const res = await fetch(`/api/obra/proyectos/${proyectoId}/fotos`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Error ${res.status}`);
    }
    return res.json() as Promise<{ foto: import("@/lib/obra/types").LocalFotoAvance }>;
  },

  async deleteFotoAvance(id: string) {
    return apiFetch<{ ok: boolean }>(`/api/obra/fotos/${id}`, {
      method: "DELETE",
    });
  },

  async responderPresupuestoCliente(id: string, accion: "aprobar" | "rechazar") {
    return apiFetch<{
      presupuesto: import("@/lib/obra/types").LocalPresupuesto;
      resumen: import("@/lib/obra/types").PresupuestoResumen;
    }>(`/api/obra/cliente/presupuestos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ accion }),
    });
  },
};
