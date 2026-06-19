import { supabase } from "@/shared/lib/supabase";
import type { Cliente, FuelType, VehicleCondition, Currency } from "@/types";

export interface PublicVehicleContact {
  id: string;
  name: string;
  whatsappNumero?: string;
  profilePhotoUrl?: string;
}

export interface PublicVehiclePayload {
  id: string;
  brand: string;
  model: string;
  version?: string;
  year: number;
  kilometers: number;
  fuelType: FuelType;
  transmission?: string;
  condition: VehicleCondition;
  currency: Currency;
  listPrice: number;
  cashPrice?: number;
  showPrice: boolean;
  description: string;
  features: string[];
  photos: string[];
  publicSlug: string;
  socialTitle?: string;
  socialDescription?: string;
}

export interface PublicVehicleView {
  vehicle: PublicVehiclePayload;
  cliente: Pick<
    Cliente,
    | "id"
    | "nombre"
    | "identificador"
    | "logoUrl"
    | "telefono"
    | "whatsappNumero"
    | "direccion"
    | "sitioWeb"
    | "instagramUrl"
    | "facebookUrl"
  >;
  contacts: PublicVehicleContact[];
}

type RpcRow = {
  vehicle: {
    id: string;
    brand: string;
    model: string;
    version: string | null;
    year: number;
    kilometers: number;
    fuel_type: FuelType;
    transmission: string | null;
    condition: VehicleCondition;
    currency: Currency;
    list_price: number;
    cash_price: number | null;
    show_price: boolean;
    description: string;
    features: string[] | null;
    photos: string[] | null;
    public_slug: string;
    social_title: string | null;
    social_description: string | null;
  };
  cliente: {
    id: string;
    nombre: string;
    identificador: string;
    logo_url: string | null;
    telefono: string;
    whatsapp_numero: string;
    direccion: string | null;
    sitio_web: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
  } | null;
  contacts: Array<{
    id: string;
    name: string;
    whatsapp_numero: string | null;
    profile_photo_url: string | null;
  }> | null;
};

function mapRpcRow(row: RpcRow): PublicVehicleView {
  const v = row.vehicle;
  const c = row.cliente;

  if (!c) {
    throw new Error("Cliente no encontrado");
  }

  return {
    vehicle: {
      id: v.id,
      brand: v.brand,
      model: v.model,
      version: v.version ?? undefined,
      year: v.year,
      kilometers: v.kilometers,
      fuelType: v.fuel_type,
      transmission: v.transmission ?? undefined,
      condition: v.condition,
      currency: v.currency,
      listPrice: Number(v.list_price),
      cashPrice: v.cash_price != null ? Number(v.cash_price) : undefined,
      showPrice: v.show_price,
      description: v.description,
      features: v.features ?? [],
      photos: v.photos ?? [],
      publicSlug: v.public_slug,
      socialTitle: v.social_title ?? undefined,
      socialDescription: v.social_description ?? undefined,
    },
    cliente: {
      id: c.id,
      nombre: c.nombre,
      identificador: c.identificador,
      logoUrl: c.logo_url ?? undefined,
      telefono: c.telefono,
      whatsappNumero: c.whatsapp_numero,
      direccion: c.direccion ?? undefined,
      sitioWeb: c.sitio_web ?? undefined,
      instagramUrl: c.instagram_url ?? undefined,
      facebookUrl: c.facebook_url ?? undefined,
    },
    contacts: (row.contacts ?? []).map((user) => ({
      id: user.id,
      name: user.name,
      whatsappNumero: user.whatsapp_numero ?? undefined,
      profilePhotoUrl: user.profile_photo_url ?? undefined,
    })),
  };
}

export async function fetchPublicVehicle(
  slug: string,
  clienteIdentificador?: string,
): Promise<PublicVehicleView | null> {
  const { data, error } = await supabase.rpc("get_public_vehicle", {
    p_slug: slug,
    p_cliente_identificador: clienteIdentificador?.trim() || null,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapRpcRow(data as RpcRow);
}
