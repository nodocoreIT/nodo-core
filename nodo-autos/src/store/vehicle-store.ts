import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Vehicle,
  VehicleFilters,
  User,
  Cliente,
  Publication,
  AuditLog,
  Customer,
} from '@/types';
import type { SalesContractData } from '@/types/contract';
import { autosDb } from '@/shared/lib/supabase';
import { matchesVehicleSearch } from '@/shared/lib/utils';
import { generateVehicleSlug } from '@/shared/lib/utils';
import {
  type ImportVehicleRow,
  importRowToVehiclePayload,
} from '@/features/vehicles/lib/vehicle-import';
import { parseDigitsToNumber } from '@/utils/contract-calculations';

// ─── Row types (DB shape) ─────────────────────────────────────────────────────

type ClienteRow = {
  id: string;
  nombre: string;
  identificador: string;
  logo_url: string | null;
  suscripcion_id: string | null;
  email_contacto: string | null;
  telefono: string;
  whatsapp_numero: string;
  direccion: string | null;
  ubicacion: { lat: number; lng: number } | null;
  sitio_web: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  descripcion_publica: string | null;
  horarios: string | null;
  creado_en: string;
};

export type ClienteUpdate = {
  nombre?: string;
  identificador?: string;
  logoUrl?: string | null;
  emailContacto?: string | null;
  telefono?: string;
  whatsappNumero?: string;
  direccion?: string | null;
  ubicacion?: { lat: number; lng: number } | null;
  sitioWeb?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  tiktokUrl?: string | null;
  descripcionPublica?: string | null;
  horarios?: string | null;
};

type UserRow = {
  id: string;
  cliente_id: string;
  email: string;
  name: string;
  role: User['role'];
  whatsapp_numero: string | null;
  profile_photo_url: string | null;
  is_activo: boolean | null;
  created_at: string;
};

type VehicleRow = {
  id: string;
  cliente_id: string;
  brand: string;
  model: string;
  version: string | null;
  year: number;
  license_plate: string | null;
  vin: string | null;
  fuel_type: Vehicle['fuelType'];
  transmission: string | null;
  doors: number | null;
  engine: number | null;
  numero_motor: string | null;
  color: string | null;
  single_owner: boolean | null;
  kilometers: number;
  condition: Vehicle['condition'];
  status: Vehicle['status'];
  currency: Vehicle['currency'];
  list_price: number;
  cash_price: number | null;
  show_price: boolean | null;
  price_observations: string | null;
  entry_date: string;
  owner_type: Vehicle['ownerType'];
  margin: number | null;
  expenses: number | null;
  description: string;
  features: string[] | null;
  photos: string[] | null;
  documents: Vehicle['documents'] | null;
  is_published: boolean;
  public_slug: string;
  social_title: string | null;
  social_description: string | null;
  internal_notes: string | null;
  responsible_user_id: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type PublicationRow = {
  id: string;
  vehicle_id: string;
  channel: Publication['channel'];
  status: Publication['status'];
  external_id: string | null;
  post_link: string | null;
  post_text: string | null;
  hashtags: string[] | null;
  last_published_at: string | null;
  error_message: string | null;
  created_at: string;
};

type AuditLogRow = {
  id: string;
  cliente_id: string;
  user_id: string | null;
  user_name: string;
  entity_type: AuditLog['entityType'];
  entity_id: string;
  action: AuditLog['action'];
  changes: Record<string, { old: unknown; new: unknown }> | null;
  timestamp: string;
};

type ContractRow = {
  id: string;
  cliente_id: string;
  date: string;
  vehicle_id: string;
  seller_name: string | null;
  seller_document: string | null;
  buyer: unknown;
  trade_in_vehicle: unknown | null;
  agreed_sale_price: number;
  currency: string;
  payments: unknown[];
  notes: string | null;
  created_at: string;
};

type CustomerRow = {
  id: string;
  cliente_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  document_type: string | null;
  document_number: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Mappers ──────────────────────────────────────────────────────────────────

const mapClienteRow = (row: ClienteRow): Cliente => ({
  id: row.id,
  nombre: row.nombre,
  identificador: row.identificador,
  logoUrl: row.logo_url || undefined,
  suscripcionId: row.suscripcion_id || undefined,
  emailContacto: row.email_contacto || undefined,
  telefono: row.telefono,
  whatsappNumero: row.whatsapp_numero,
  direccion: row.direccion || undefined,
  ubicacion: row.ubicacion || undefined,
  sitioWeb: row.sitio_web || undefined,
  instagramUrl: row.instagram_url || undefined,
  facebookUrl: row.facebook_url || undefined,
  tiktokUrl: row.tiktok_url || undefined,
  descripcionPublica: row.descripcion_publica || undefined,
  horarios: row.horarios || undefined,
  creadoEn: row.creado_en,
});

const toClienteUpdate = (updates: ClienteUpdate): Partial<ClienteRow> => {
  const row: Partial<ClienteRow> = {};
  if (updates.nombre !== undefined) row.nombre = updates.nombre;
  if (updates.identificador !== undefined) row.identificador = updates.identificador;
  if (updates.logoUrl !== undefined) row.logo_url = updates.logoUrl ?? null;
  if (updates.emailContacto !== undefined) row.email_contacto = updates.emailContacto ?? null;
  if (updates.telefono !== undefined) row.telefono = updates.telefono;
  if (updates.whatsappNumero !== undefined) row.whatsapp_numero = updates.whatsappNumero;
  if (updates.direccion !== undefined) row.direccion = updates.direccion ?? null;
  if (updates.ubicacion !== undefined) row.ubicacion = updates.ubicacion ?? null;
  if (updates.sitioWeb !== undefined) row.sitio_web = updates.sitioWeb ?? null;
  if (updates.instagramUrl !== undefined) row.instagram_url = updates.instagramUrl ?? null;
  if (updates.facebookUrl !== undefined) row.facebook_url = updates.facebookUrl ?? null;
  if (updates.tiktokUrl !== undefined) row.tiktok_url = updates.tiktokUrl ?? null;
  if (updates.descripcionPublica !== undefined) row.descripcion_publica = updates.descripcionPublica ?? null;
  if (updates.horarios !== undefined) row.horarios = updates.horarios ?? null;
  return row;
};

const mapUserRow = (row: UserRow): User => ({
  id: row.id,
  clienteId: row.cliente_id,
  email: row.email,
  name: row.name,
  role: row.role,
  whatsappNumero: row.whatsapp_numero || undefined,
  profilePhotoUrl: row.profile_photo_url || undefined,
  isActivo: row.is_activo ?? true,
  createdAt: row.created_at,
});

export const mapVehicleRow = (row: VehicleRow): Vehicle => ({
  id: row.id,
  clienteId: row.cliente_id,
  brand: row.brand,
  model: row.model,
  version: row.version || undefined,
  year: row.year,
  licensePlate: row.license_plate || undefined,
  vin: row.vin || undefined,
  fuelType: row.fuel_type,
  transmission:
    row.transmission === 'manual' || row.transmission === 'automatica'
      ? row.transmission
      : undefined,
  doors: row.doors === 3 || row.doors === 4 || row.doors === 5 ? row.doors : undefined,
  engine: row.engine !== null && row.engine !== undefined ? String(row.engine) : undefined,
  engineNumber: row.numero_motor ?? undefined,
  color: row.color ?? undefined,
  singleOwner: row.single_owner ?? undefined,
  kilometers: row.kilometers,
  condition: row.condition,
  status: row.status,
  currency: row.currency,
  listPrice: row.list_price,
  cashPrice: row.cash_price ?? undefined,
  showPrice: row.show_price ?? true,
  priceObservations: row.price_observations ?? undefined,
  entryDate: row.entry_date,
  ownerType: row.owner_type,
  margin: row.margin ?? undefined,
  expenses: row.expenses ?? undefined,
  description: row.description,
  features: row.features ?? [],
  photos: row.photos ?? [],
  isPublished: row.is_published,
  publicSlug: row.public_slug,
  socialTitle: row.social_title ?? undefined,
  socialDescription: row.social_description ?? undefined,
  internalNotes: row.internal_notes ?? undefined,
  responsibleUserId: row.responsible_user_id ?? undefined,
  tags: row.tags ?? [],
  documents: row.documents ?? [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by || 'unknown',
  updatedBy: row.updated_by || 'unknown',
});

const mapPublicationRow = (row: PublicationRow): Publication => ({
  id: row.id,
  vehicleId: row.vehicle_id,
  channel: row.channel,
  status: row.status,
  externalId: row.external_id ?? undefined,
  postLink: row.post_link ?? undefined,
  postText: row.post_text ?? undefined,
  hashtags: row.hashtags ?? undefined,
  lastPublishedAt: row.last_published_at ?? undefined,
  errorMessage: row.error_message ?? undefined,
  createdAt: row.created_at,
});

const mapAuditLogRow = (row: AuditLogRow): AuditLog => ({
  id: row.id,
  clienteId: row.cliente_id,
  userId: row.user_id ?? undefined,
  userName: row.user_name,
  entityType: row.entity_type,
  entityId: row.entity_id,
  action: row.action,
  changes: row.changes ?? undefined,
  timestamp: row.timestamp,
});

const mapContractRow = (row: ContractRow): SalesContractData => ({
  id: row.id,
  date: row.date,
  vehicleId: row.vehicle_id,
  sellerName: row.seller_name || undefined,
  sellerDocument: row.seller_document || undefined,
  buyer: row.buyer as SalesContractData['buyer'],
  tradeInVehicle: row.trade_in_vehicle as SalesContractData['tradeInVehicle'] || undefined,
  agreedSalePrice: row.agreed_sale_price,
  currency: row.currency as 'ARS' | 'USD',
  payments: row.payments as SalesContractData['payments'],
  notes: row.notes || undefined,
});

const mapCustomerRow = (row: CustomerRow): Customer => ({
  id: row.id,
  clienteId: row.cliente_id,
  firstName: row.first_name,
  lastName: row.last_name,
  email: row.email ?? undefined,
  phone: row.phone ?? undefined,
  address: row.address ?? undefined,
  city: row.city ?? undefined,
  state: row.state ?? undefined,
  documentType: row.document_type ?? undefined,
  documentNumber: row.document_number ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// ─── Insert/Update helpers ────────────────────────────────────────────────────

export const toVehicleInsert = (
  data: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  currentUserId: string | null,
): Partial<VehicleRow> => ({
  cliente_id: data.clienteId,
  brand: data.brand,
  model: data.model,
  version: data.version ?? null,
  year: data.year,
  license_plate: data.licensePlate ?? null,
  vin: data.vin ?? null,
  fuel_type: data.fuelType,
  transmission: data.transmission ?? null,
  doors: data.doors ?? null,
  engine: data.engine ? Number(data.engine) : null,
  numero_motor: data.engineNumber ?? null,
  color: data.color ?? null,
  single_owner: data.singleOwner ?? false,
  kilometers: data.kilometers,
  condition: data.condition,
  status: data.status,
  currency: data.currency,
  list_price: data.listPrice,
  cash_price: data.cashPrice ?? null,
  show_price: data.showPrice ?? true,
  price_observations: data.priceObservations ?? null,
  entry_date: data.entryDate,
  owner_type: data.ownerType,
  margin: data.margin ?? null,
  expenses: data.expenses ?? null,
  description: data.description,
  features: data.features ?? [],
  photos: data.photos ?? [],
  is_published: data.isPublished,
  public_slug: data.publicSlug,
  social_title: data.socialTitle ?? null,
  social_description: data.socialDescription ?? null,
  internal_notes: data.internalNotes ?? null,
  responsible_user_id: data.responsibleUserId ?? null,
  tags: data.tags ?? [],
  documents: data.documents ?? [],
  created_by: currentUserId,
  updated_by: currentUserId,
});

const toVehicleUpdate = (
  updates: Partial<Vehicle>,
  currentUserId: string | null,
): Partial<VehicleRow> => {
  const row: Partial<VehicleRow> = {};
  if (updates.clienteId !== undefined) row.cliente_id = updates.clienteId;
  if (updates.brand !== undefined) row.brand = updates.brand;
  if (updates.model !== undefined) row.model = updates.model;
  if (updates.version !== undefined) row.version = updates.version ?? null;
  if (updates.year !== undefined) row.year = updates.year;
  if (updates.licensePlate !== undefined) row.license_plate = updates.licensePlate ?? null;
  if (updates.vin !== undefined) row.vin = updates.vin ?? null;
  if (updates.fuelType !== undefined) row.fuel_type = updates.fuelType;
  if (updates.transmission !== undefined) row.transmission = updates.transmission ?? null;
  if (updates.doors !== undefined) row.doors = updates.doors ?? null;
  if (updates.engine !== undefined) row.engine = updates.engine ? Number(updates.engine) : null;
  if (updates.engineNumber !== undefined) row.numero_motor = updates.engineNumber ?? null;
  if (updates.color !== undefined) row.color = updates.color ?? null;
  if (updates.singleOwner !== undefined) row.single_owner = updates.singleOwner;
  if (updates.kilometers !== undefined) row.kilometers = updates.kilometers;
  if (updates.condition !== undefined) row.condition = updates.condition;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.currency !== undefined) row.currency = updates.currency;
  if (updates.listPrice !== undefined) row.list_price = updates.listPrice;
  if (updates.cashPrice !== undefined) row.cash_price = updates.cashPrice ?? null;
  if (updates.showPrice !== undefined) row.show_price = updates.showPrice;
  if (updates.priceObservations !== undefined) row.price_observations = updates.priceObservations ?? null;
  if (updates.entryDate !== undefined) row.entry_date = updates.entryDate;
  if (updates.ownerType !== undefined) row.owner_type = updates.ownerType;
  if (updates.margin !== undefined) row.margin = updates.margin ?? null;
  if (updates.expenses !== undefined) row.expenses = updates.expenses ?? null;
  if (updates.description !== undefined) row.description = updates.description;
  if (updates.features !== undefined) row.features = updates.features ?? [];
  if (updates.photos !== undefined) row.photos = updates.photos ?? [];
  if (updates.isPublished !== undefined) row.is_published = updates.isPublished;
  if (updates.publicSlug !== undefined) row.public_slug = updates.publicSlug;
  if (updates.socialTitle !== undefined) row.social_title = updates.socialTitle ?? null;
  if (updates.socialDescription !== undefined) row.social_description = updates.socialDescription ?? null;
  if (updates.internalNotes !== undefined) row.internal_notes = updates.internalNotes ?? null;
  if (updates.responsibleUserId !== undefined) row.responsible_user_id = updates.responsibleUserId ?? null;
  if (updates.tags !== undefined) row.tags = updates.tags ?? [];
  if (updates.documents !== undefined) row.documents = updates.documents ?? [];
  if (currentUserId) row.updated_by = currentUserId;
  return row;
};

const toPublicationInsert = (data: Omit<Publication, 'id' | 'createdAt'>): Partial<PublicationRow> => ({
  vehicle_id: data.vehicleId,
  channel: data.channel,
  status: data.status,
  external_id: data.externalId ?? null,
  post_link: data.postLink ?? null,
  post_text: data.postText ?? null,
  hashtags: data.hashtags ?? null,
  last_published_at: data.lastPublishedAt ?? null,
  error_message: data.errorMessage ?? null,
});

const toPublicationUpdate = (updates: PublicationChannelUpdates): Partial<PublicationRow> => {
  const row: Partial<PublicationRow> = {};
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.externalId !== undefined) row.external_id = updates.externalId ?? null;
  if (updates.postLink !== undefined) row.post_link = updates.postLink ?? null;
  if (updates.postText !== undefined) row.post_text = updates.postText ?? null;
  if (updates.hashtags !== undefined) row.hashtags = updates.hashtags ?? null;
  if (updates.lastPublishedAt !== undefined) row.last_published_at = updates.lastPublishedAt ?? null;
  if (updates.errorMessage !== undefined) row.error_message = updates.errorMessage ?? null;
  return row;
};

const toContractInsert = (
  data: Omit<SalesContractData, 'id'>,
  clienteId: string,
): Partial<ContractRow> => ({
  cliente_id: clienteId,
  date: data.date,
  vehicle_id: data.vehicleId,
  seller_name: data.sellerName ?? null,
  seller_document: data.sellerDocument ?? null,
  buyer: data.buyer,
  trade_in_vehicle: data.tradeInVehicle ?? null,
  agreed_sale_price: data.agreedSalePrice,
  currency: data.currency,
  payments: data.payments,
  notes: data.notes ?? null,
});

const toCustomerInsert = (
  data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'clienteId'>,
  clienteId: string,
): Partial<CustomerRow> => ({
  cliente_id: clienteId,
  first_name: data.firstName,
  last_name: data.lastName,
  email: data.email ?? null,
  phone: data.phone ?? null,
  address: data.address ?? null,
  city: data.city ?? null,
  state: data.state ?? null,
  document_type: data.documentType ?? null,
  document_number: data.documentNumber ?? null,
});

const toCustomerUpdate = (updates: Partial<Customer>): Partial<CustomerRow> => {
  const row: Partial<CustomerRow> = {};
  if (updates.firstName !== undefined) row.first_name = updates.firstName;
  if (updates.lastName !== undefined) row.last_name = updates.lastName;
  if (updates.email !== undefined) row.email = updates.email ?? null;
  if (updates.phone !== undefined) row.phone = updates.phone ?? null;
  if (updates.address !== undefined) row.address = updates.address ?? null;
  if (updates.city !== undefined) row.city = updates.city ?? null;
  if (updates.state !== undefined) row.state = updates.state ?? null;
  if (updates.documentType !== undefined) row.document_type = updates.documentType ?? null;
  if (updates.documentNumber !== undefined) row.document_number = updates.documentNumber ?? null;
  return row;
};

const normalizeError = (error: unknown, fallback: string): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const msg = e.message ?? e.msg ?? e.error_description ?? fallback;
    const code = e.code ?? e.status ?? '';
    return code ? `[${code}] ${msg}` : String(msg);
  }
  return fallback;
};

// ─── Store interface ──────────────────────────────────────────────────────────

const configuredClienteId =
  (import.meta.env.VITE_TEST_CLIENTE_ID as string | undefined)?.trim() ||
  (import.meta.env.VITE_TEST_TENANT_ID as string | undefined)?.trim() ||
  null;

type PublicationChannelUpdates = {
  status?: Publication['status'];
  externalId?: string | null;
  postLink?: string | null;
  postText?: string | null;
  hashtags?: string[];
  lastPublishedAt?: string | null;
  errorMessage?: string | null;
};

interface VehicleStoreState {
  loading: boolean;
  error: string | null;
  hasLoaded: boolean;

  // Auth
  currentUser: User | null;
  currentCliente: Cliente | null;
  clienteUsers: User[];
  setCurrentUser: (user: User | null) => void;
  logout: () => void;
  loadInitialData: (force?: boolean) => Promise<void>;
  updateCliente: (id: string, updates: ClienteUpdate) => Promise<void>;

  // Vehicles
  vehicles: Vehicle[];
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>) => Promise<void>;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  importVehicles: (rows: ImportVehicleRow[]) => Promise<{ successCount: number; errors: string[] }>;
  getVehicleById: (id: string) => Vehicle | undefined;
  filterVehicles: (filters: VehicleFilters) => Vehicle[];

  // Publications
  publications: Publication[];
  addPublication: (publication: Omit<Publication, 'id' | 'createdAt'>) => Promise<void>;
  updatePublication: (id: string, updates: Partial<Publication>) => Promise<void>;
  upsertPublicationForChannel: (
    vehicleId: string,
    channel: Publication['channel'],
    updates: PublicationChannelUpdates,
  ) => Promise<Publication>;
  getPublicationsByVehicle: (vehicleId: string) => Publication[];

  // Audit Logs
  auditLogs: AuditLog[];
  addAuditLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => Promise<void>;

  // Contracts
  contracts: SalesContractData[];
  addContract: (contract: Omit<SalesContractData, 'id'>) => Promise<void>;

  // Customers
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'clienteId'>) => Promise<void>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  getCustomerById: (id: string) => Customer | undefined;
}

export const useVehicleStore = create<VehicleStoreState>()(
  persist(
    (set, get) => ({
      loading: false,
      error: null,
      hasLoaded: false,

      // Auth
      currentUser: null,
      currentCliente: null,
      clienteUsers: [],
      setCurrentUser: (user) => set({ currentUser: user }),
      logout: () => set({ currentUser: null }),

      loadInitialData: async (force = false) => {
        const { loading, hasLoaded } = get();
        if (loading || (hasLoaded && !force)) return;

        set({ loading: true, error: null });
        try {
          let clienteQuery = autosDb().from('clientes').select('*');
          if (configuredClienteId) {
            clienteQuery = clienteQuery.eq('id', configuredClienteId);
          }

          const { data: clienteRows, error: clienteError } = await clienteQuery
            .order('creado_en', { ascending: true })
            .limit(1);

          if (clienteError) throw clienteError;

          const clienteRow = clienteRows?.[0] ?? null;
          const currentCliente = clienteRow ? mapClienteRow(clienteRow as ClienteRow) : null;

          let currentUser: User | null = null;
          let clienteUsers: User[] = [];

          if (currentCliente) {
            const { data: userRows, error: userError } = await autosDb().from('users')
              .select('*')
              .eq('cliente_id', currentCliente.id)
              .order('created_at', { ascending: true });

            if (userError) throw userError;
            clienteUsers = (userRows || []).map((row) => mapUserRow(row as UserRow));

            const prevUser = get().currentUser;
            if (prevUser && clienteUsers.some((u) => u.id === prevUser.id)) {
              currentUser = clienteUsers.find((u) => u.id === prevUser.id) || null;
            }
          }

          let vehicles: Vehicle[] = [];
          if (currentCliente) {
            const { data: vehicleRows, error: vehicleError } = await autosDb().from('vehicles')
              .select('*')
              .eq('cliente_id', currentCliente.id)
              .order('created_at', { ascending: false });

            if (vehicleError) throw vehicleError;
            vehicles = (vehicleRows || []).map((row) => mapVehicleRow(row as VehicleRow));
          }

          let publications: Publication[] = [];
          if (vehicles.length > 0) {
            const vehicleIds = vehicles.map((v) => v.id);
            const { data: pubRows, error: pubError } = await autosDb().from('publications')
              .select('*')
              .in('vehicle_id', vehicleIds);

            if (pubError) throw pubError;
            publications = (pubRows || []).map((row) => mapPublicationRow(row as PublicationRow));
          }

          let contracts: SalesContractData[] = [];
          if (currentCliente) {
            const { data: contractRows, error: contractError } = await autosDb().from('contracts')
              .select('*')
              .eq('cliente_id', currentCliente.id)
              .order('date', { ascending: false });

            if (!contractError) {
              contracts = (contractRows || []).map((row) => mapContractRow(row as ContractRow));
            }
          }

          let customers: Customer[] = [];
          if (currentCliente) {
            const { data: customerRows, error: customerError } = await autosDb().from('customers')
              .select('*')
              .eq('cliente_id', currentCliente.id)
              .order('last_name', { ascending: true });

            if (!customerError) {
              customers = (customerRows || []).map((row) => mapCustomerRow(row as CustomerRow));
            }
          }

          set({
            currentCliente,
            currentUser,
            clienteUsers,
            vehicles,
            publications,
            contracts,
            customers,
            auditLogs: [],
            hasLoaded: true,
          });
        } catch (error) {
          set({ error: normalizeError(error, 'Error loading data from Supabase'), hasLoaded: true });
        } finally {
          set({ loading: false });
        }
      },

      updateCliente: async (id, updates) => {
        try {
          set({ error: null });
          const payload = toClienteUpdate(updates);
          const { data, error } = await autosDb().from('clientes')
            .update(payload)
            .eq('id', id)
            .select('*')
            .maybeSingle();

          if (error) throw error;
          if (!data) {
            throw new Error(
              'No se pudo actualizar la concesionaria. Verificá permisos o contactá soporte.',
            );
          }
          set({ currentCliente: mapClienteRow(data as ClienteRow) });
        } catch (error) {
          set({ error: normalizeError(error, 'Error al actualizar la concesionaria') });
          throw error;
        }
      },

      // Vehicles
      vehicles: [],

      addVehicle: async (vehicleData) => {
        try {
          set({ error: null });
          if (!vehicleData.clienteId) throw new Error('Cliente requerido para crear vehículo.');

          const payload = toVehicleInsert(vehicleData, get().currentUser?.id ?? null);
          const { data, error } = await autosDb().from('vehicles')
            .insert(payload)
            .select('*')
            .single();

          if (error) throw error;

          const newVehicle = mapVehicleRow(data as VehicleRow);
          set((state) => ({ vehicles: [newVehicle, ...state.vehicles] }));

          try {
            await get().addAuditLog({
              clienteId: newVehicle.clienteId,
              userId: get().currentUser?.id || undefined,
              userName: get().currentUser?.name || 'Unknown',
              entityType: 'vehicle',
              entityId: newVehicle.id,
              action: 'create',
            });
          } catch { /* ignore audit errors */ }
        } catch (error) {
          set({ error: normalizeError(error, 'Error al crear el vehículo') });
          throw error;
        }
      },

      updateVehicle: async (id, updates) => {
        try {
          set({ error: null });
          const previousVehicle = get().getVehicleById(id);
          const payload = toVehicleUpdate(updates, get().currentUser?.id ?? null);
          const { data, error } = await autosDb().from('vehicles')
            .update(payload)
            .eq('id', id)
            .select('*')
            .single();

          if (error) throw error;

          const updatedVehicle = mapVehicleRow(data as VehicleRow);
          set((state) => ({
            vehicles: state.vehicles.map((v) => (v.id === id ? updatedVehicle : v)),
          }));

          if (previousVehicle) {
            try {
              await get().addAuditLog({
                clienteId: previousVehicle.clienteId,
                userId: get().currentUser?.id || undefined,
                userName: get().currentUser?.name || 'Unknown',
                entityType: 'vehicle',
                entityId: id,
                action: 'update',
                changes: Object.entries(updates).reduce(
                  (acc, [key, value]) => {
                    acc[key] = { old: (previousVehicle as unknown as Record<string, unknown>)[key], new: value };
                    return acc;
                  },
                  {} as Record<string, { old: unknown; new: unknown }>,
                ),
              });
            } catch { /* ignore audit errors */ }
          }
        } catch (error) {
          set({ error: normalizeError(error, 'Error al actualizar el vehículo') });
          throw error;
        }
      },

      deleteVehicle: async (id) => {
        try {
          set({ error: null });
          const vehicle = get().getVehicleById(id);
          const { error } = await autosDb().from('vehicles').delete().eq('id', id);
          if (error) throw error;

          set((state) => ({ vehicles: state.vehicles.filter((v) => v.id !== id) }));

          if (vehicle) {
            try {
              await get().addAuditLog({
                clienteId: vehicle.clienteId,
                userId: get().currentUser?.id || undefined,
                userName: get().currentUser?.name || 'Unknown',
                entityType: 'vehicle',
                entityId: id,
                action: 'delete',
              });
            } catch { /* ignore audit errors */ }
          }
        } catch (error) {
          set({ error: normalizeError(error, 'Error al eliminar el vehículo') });
          throw error;
        }
      },

      importVehicles: async (rows) => {
        const clienteId = get().currentCliente?.id;
        if (!clienteId) {
          return { successCount: 0, errors: ['No hay una concesionaria configurada.'] };
        }

        const errors: string[] = [];
        let successCount = 0;
        const usedSlugs = new Set<string>();
        const existingByPlate = new Map<string, { id: string; publicSlug: string }>();

        for (let index = 0; index < rows.length; index += 1) {
          const row = rows[index];
          const brand = row.brand.trim();
          const model = row.model.trim();
          const year = parseDigitsToNumber(row.year);
          const fuelType = row.fuel_type.trim();
          const licensePlate = row.license_plate.trim().toUpperCase();
          const missingFields: string[] = [];

          if (!brand) missingFields.push('marca');
          if (!model) missingFields.push('modelo');
          if (!year) missingFields.push('año');
          if (!fuelType) missingFields.push('combustible');

          if (missingFields.length > 0) {
            errors.push(`Ítem ${index + 1}: faltan datos obligatorios (${missingFields.join(', ')}).`);
            continue;
          }

          const slugSeed = licensePlate || `import-${Date.now()}-${index}`;
          const baseSlug = generateVehicleSlug({ brand, model, licensePlate: slugSeed });
          let publicSlug = baseSlug;
          let suffix = 1;
          while (usedSlugs.has(publicSlug)) {
            publicSlug = `${baseSlug}-${suffix}`;
            suffix += 1;
          }
          usedSlugs.add(publicSlug);

          try {
            const vehiclePayload = importRowToVehiclePayload(row, clienteId, publicSlug);

            if (licensePlate) {
              let existing = existingByPlate.get(licensePlate);
              if (!existing) {
                const stored = get().vehicles.find(
                  (vehicle) =>
                    vehicle.clienteId === clienteId &&
                    vehicle.licensePlate?.toUpperCase() === licensePlate,
                );
                if (stored) {
                  existing = { id: stored.id, publicSlug: stored.publicSlug };
                } else {
                  const { data, error } = await autosDb().from('vehicles')
                    .select('id, public_slug')
                    .eq('cliente_id', clienteId)
                    .eq('license_plate', licensePlate)
                    .maybeSingle();
                  if (error) throw error;
                  if (data?.id) {
                    existing = { id: data.id, publicSlug: data.public_slug };
                  }
                }
                if (existing) existingByPlate.set(licensePlate, existing);
              }

              if (existing) {
                await get().updateVehicle(existing.id, {
                  ...vehiclePayload,
                  publicSlug: existing.publicSlug,
                  clienteId,
                });
              } else {
                await get().addVehicle(vehiclePayload);
              }
            } else {
              await get().addVehicle(vehiclePayload);
            }

            successCount += 1;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Error desconocido.';
            errors.push(`Ítem ${index + 1}: ${message}`);
          }
        }

        return { successCount, errors };
      },

      getVehicleById: (id) => get().vehicles.find((v) => v.id === id),

      filterVehicles: (filters) => {
        let filtered = get().vehicles;
        if (filters.brand) filtered = filtered.filter((v) => v.brand.toLowerCase().includes(filters.brand!.toLowerCase()));
        if (filters.model) filtered = filtered.filter((v) => v.model.toLowerCase().includes(filters.model!.toLowerCase()));
        if (filters.yearFrom) filtered = filtered.filter((v) => v.year >= filters.yearFrom!);
        if (filters.yearTo) filtered = filtered.filter((v) => v.year <= filters.yearTo!);
        if (filters.status) filtered = filtered.filter((v) => v.status === filters.status);
        if (filters.condition) filtered = filtered.filter((v) => v.condition === filters.condition);
        if (filters.fuelType) filtered = filtered.filter((v) => v.fuelType === filters.fuelType);
        if (filters.transmission) filtered = filtered.filter((v) => v.transmission === filters.transmission);
        if (filters.priceFrom !== undefined) filtered = filtered.filter((v) => (v.cashPrice ?? v.listPrice) >= filters.priceFrom!);
        if (filters.priceTo !== undefined) filtered = filtered.filter((v) => (v.cashPrice ?? v.listPrice) <= filters.priceTo!);
        if (filters.kilometersFrom !== undefined) filtered = filtered.filter((v) => v.kilometers >= filters.kilometersFrom!);
        if (filters.kilometersTo !== undefined) filtered = filtered.filter((v) => v.kilometers <= filters.kilometersTo!);
        if (filters.isPublished !== undefined) filtered = filtered.filter((v) => v.isPublished === filters.isPublished);
        if (filters.search) {
          const search = filters.search.trim();
          if (search) {
            const lower = search.toLowerCase();
            filtered = filtered.filter(
              (v) =>
                matchesVehicleSearch(v, search) ||
                v.description.toLowerCase().includes(lower) ||
                v.tags.some((tag) => tag.toLowerCase().includes(lower)),
            );
          }
        }
        return filtered;
      },

      // Publications
      publications: [],

      addPublication: async (publicationData) => {
        try {
          set({ error: null });
          const payload = toPublicationInsert(publicationData);
          const { data, error } = await autosDb().from('publications').insert(payload).select('*').single();
          if (error) throw error;
          set((state) => ({ publications: [...state.publications, mapPublicationRow(data as PublicationRow)] }));
        } catch (error) {
          set({ error: normalizeError(error, 'Error al crear la publicación') });
          throw error;
        }
      },

      updatePublication: async (id, updates) => {
        try {
          set({ error: null });
          const payload = toPublicationUpdate(updates);
          const { data, error } = await autosDb().from('publications').update(payload).eq('id', id).select('*').single();
          if (error) throw error;
          set((state) => ({
            publications: state.publications.map((p) => (p.id === id ? mapPublicationRow(data as PublicationRow) : p)),
          }));
        } catch (error) {
          set({ error: normalizeError(error, 'Error al actualizar la publicación') });
          throw error;
        }
      },

      upsertPublicationForChannel: async (vehicleId, channel, updates) => {
        try {
          set({ error: null });
          const existing = get().publications.find((p) => p.vehicleId === vehicleId && p.channel === channel);
          if (existing) {
            const payload = toPublicationUpdate(updates);
            const { data, error } = await autosDb().from('publications')
              .update(payload)
              .eq('id', existing.id)
              .select('*')
              .single();
            if (error) throw error;
            const mapped = mapPublicationRow(data as PublicationRow);
            set((state) => ({
              publications: state.publications.map((p) => (p.id === existing.id ? mapped : p)),
            }));
            return mapped;
          }

          const payload = toPublicationInsert({
            vehicleId,
            channel,
            status: updates.status ?? 'borrador',
            externalId: updates.externalId ?? undefined,
            postLink: updates.postLink ?? undefined,
            postText: updates.postText ?? undefined,
            hashtags: updates.hashtags,
            lastPublishedAt: updates.lastPublishedAt ?? undefined,
            errorMessage: updates.errorMessage ?? undefined,
          });
          const { data, error } = await autosDb().from('publications').insert(payload).select('*').single();
          if (error) throw error;
          const mapped = mapPublicationRow(data as PublicationRow);
          set((state) => ({ publications: [...state.publications, mapped] }));
          return mapped;
        } catch (error) {
          set({ error: normalizeError(error, 'Error al guardar la publicación') });
          throw error;
        }
      },

      getPublicationsByVehicle: (vehicleId) => get().publications.filter((p) => p.vehicleId === vehicleId),

      // Audit Logs
      auditLogs: [],

      addAuditLog: async (logData) => {
        try {
          const { data, error } = await autosDb().from('audit_logs')
            .insert({
              cliente_id: logData.clienteId,
              user_id: logData.userId ?? null,
              user_name: logData.userName,
              entity_type: logData.entityType,
              entity_id: logData.entityId,
              action: logData.action,
              changes: logData.changes ?? null,
            })
            .select('*')
            .single();

          if (error) throw error;
          set((state) => ({ auditLogs: [...state.auditLogs, mapAuditLogRow(data as AuditLogRow)] }));
        } catch (error) {
          set({ error: normalizeError(error, 'Error al registrar auditoría') });
          throw error;
        }
      },

      // Contracts
      contracts: [],

      addContract: async (contractData) => {
        try {
          set({ error: null });
          const currentCliente = get().currentCliente;
          if (!currentCliente) throw new Error('Cliente no identificado');

          const payload = toContractInsert(contractData, currentCliente.id);
          const { data, error } = await autosDb().from('contracts').insert(payload).select('*').single();
          if (error) throw error;

          set((state) => ({ contracts: [mapContractRow(data as ContractRow), ...state.contracts] }));
        } catch (error) {
          set({ error: normalizeError(error, 'Error al guardar el contrato') });
          throw error;
        }
      },

      // Customers
      customers: [],

      addCustomer: async (customerData) => {
        try {
          set({ loading: true, error: null });
          const currentCliente = get().currentCliente;
          if (!currentCliente) throw new Error('Cliente no identificado');

          const payload = toCustomerInsert(customerData, currentCliente.id);
          const { data, error } = await autosDb().from('customers').insert(payload).select('*').single();
          if (error) throw error;

          set((state) => ({
            customers: [mapCustomerRow(data as CustomerRow), ...state.customers].sort((a, b) =>
              a.lastName.localeCompare(b.lastName),
            ),
          }));
        } catch (error) {
          set({ error: normalizeError(error, 'Error al crear el cliente') });
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      updateCustomer: async (id, updates) => {
        try {
          set({ loading: true, error: null });
          const payload = toCustomerUpdate(updates);
          const { data, error } = await autosDb().from('customers').update(payload).eq('id', id).select('*').single();
          if (error) throw error;

          set((state) => ({
            customers: state.customers
              .map((c) => (c.id === id ? mapCustomerRow(data as CustomerRow) : c))
              .sort((a, b) => a.lastName.localeCompare(b.lastName)),
          }));
        } catch (error) {
          set({ error: normalizeError(error, 'Error al actualizar el cliente') });
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      deleteCustomer: async (id) => {
        try {
          set({ loading: true, error: null });
          const { error } = await autosDb().from('customers').delete().eq('id', id);
          if (error) throw error;
          set((state) => ({ customers: state.customers.filter((c) => c.id !== id) }));
        } catch (error) {
          set({ error: normalizeError(error, 'Error al eliminar el cliente') });
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      getCustomerById: (id) => get().customers.find((c) => c.id === id),
    }),
    {
      name: 'nodo-autos-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ currentUser: state.currentUser }),
    },
  ),
);
