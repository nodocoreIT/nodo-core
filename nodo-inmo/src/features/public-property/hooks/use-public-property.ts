import { useQuery } from "@tanstack/react-query";

export type PublicPropertyAgency = {
  legal_name: string | null;
  phone: string | null;
  email: string | null;
};

export type PublicProperty = {
  address: string;
  operation: string;
  property_type: string;
  status: string;
  sale_price: number | null;
  currency: string;
  total_sqm: number | null;
  rooms: number | null;
  bathrooms: number | null;
  description: string | null;
  localidad: string | null;
  provincia: string | null;
  has_pool: boolean;
  pets_allowed: boolean;
  has_garage: boolean;
  has_garden: boolean;
  has_laundry: boolean;
  has_bbq: boolean;
  has_elevator: boolean;
  has_parking: boolean;
  photo_urls: string[];
  agency: PublicPropertyAgency | null;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export function usePublicProperty(shareToken: string | undefined) {
  return useQuery<PublicProperty>({
    queryKey: ["public-property", shareToken],
    enabled: !!shareToken,
    retry: false,
    queryFn: async () => {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/public-property?token=${encodeURIComponent(shareToken!)}`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        },
      );
      if (!res.ok) {
        throw new Error("not_found");
      }
      return (await res.json()) as PublicProperty;
    },
  });
}
