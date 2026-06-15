// Types
export type UserRole = 'administrador' | 'vendedor' | 'marketing';

export type VehicleCondition = 'nuevo' | 'usado';

export type VehicleStatus = 'disponible' | 'reservado' | 'vendido' | 'en_preparacion';

export type PublicationChannel = 'instagram' | 'facebook' | 'website' | 'mercadolibre';

export type PublicationStatus = 'borrador' | 'pendiente' | 'publicado' | 'fallido';

export type Currency = 'ARS' | 'USD';

export type FuelType = 'Diésel' | 'Eléctrico' | 'Nafta' | 'Nafta/GNC' | 'GNC' | 'Híbrido';

// Entities
export interface Cliente {
  id: string;
  nombre: string;
  identificador: string;
  logoUrl?: string;
  suscripcionId?: string;
  emailContacto?: string;
  telefono: string;
  whatsappNumero: string;
  direccion?: string;
  sitioWeb?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
  descripcionPublica?: string;
  horarios?: string;
  ubicacion?: {
    lat: number;
    lng: number;
  };
  creadoEn: string;
}

export interface User {
  id: string;
  clienteId: string;
  email: string;
  name: string;
  role: UserRole;
  whatsappNumero?: string;
  profilePhotoUrl?: string;
  isActivo?: boolean;
  createdAt: string;
}

export interface VehicleDocument {
  name: string;
  url: string;
  type: string;
  label?: string;
  creadoEn: string;
}

export interface Vehicle {
  id: string;
  clienteId: string;

  // Identity
  brand: string;
  model: string;
  version?: string;
  year: number;
  licensePlate?: string;
  vin?: string;
  fuelType: FuelType;
  transmission?: 'manual' | 'automatica';
  doors?: 3 | 4 | 5;
  engine?: string;
  engineNumber?: string;
  color?: string;
  singleOwner?: boolean;

  // Usage/Status
  kilometers: number;
  condition: VehicleCondition;
  status: VehicleStatus;

  // Price
  currency: Currency;
  listPrice: number;
  cashPrice?: number;
  showPrice: boolean;
  priceObservations?: string;

  // Commercial data
  entryDate: string;
  ownerType: 'own' | 'consignment';
  margin?: number;
  expenses?: number;

  // Content
  description: string;
  features: string[];
  photos: string[];
  documents: VehicleDocument[];

  // Publication
  isPublished: boolean;
  publicSlug: string;

  // Internal
  internalNotes?: string;
  responsibleUserId?: string;
  tags: string[];

  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface Publication {
  id: string;
  vehicleId: string;
  channel: PublicationChannel;
  status: PublicationStatus;
  postLink?: string;
  postText?: string;
  hashtags?: string[];
  lastPublishedAt?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  clienteId: string;
  userId?: string;
  userName: string;
  entityType: 'vehicle' | 'publication' | 'user';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'archive';
  changes?: Record<string, { old: unknown; new: unknown }>;
  timestamp: string;
}

// Filters
export interface VehicleFilters {
  brand?: string;
  model?: string;
  yearFrom?: number;
  yearTo?: number;
  status?: VehicleStatus;
  condition?: VehicleCondition;
  fuelType?: FuelType;
  transmission?: Vehicle['transmission'];
  priceFrom?: number;
  priceTo?: number;
  kilometersFrom?: number;
  kilometersTo?: number;
  isPublished?: boolean;
  tags?: string[];
  search?: string;
}

// Dealer customers (buyers)
export interface Customer {
  id: string;
  clienteId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  documentType?: string;
  documentNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerFilters {
  search?: string;
  city?: string;
  state?: string;
}
