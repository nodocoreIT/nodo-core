import { useQuery } from "@tanstack/react-query";

export type PublicPropertyAgency = {
  legal_name: string | null;
  phone: string | null;
  email: string | null;
  logo_url?: string | null;
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
  theme_settings?: Record<string, unknown> | null;
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
      const boot = (window as Window & { __NODO_PUBLIC_PROPERTY__?: PublicProperty }).__NODO_PUBLIC_PROPERTY__;
      const token = encodeURIComponent(shareToken!);
      const [landingRes, edgeRes] = await Promise.all([
        fetch(`/api/inmo/public-property?token=${token}`),
        fetch(`${supabaseUrl}/functions/v1/public-property?token=${token}`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        }),
      ]);
      const landing = landingRes.ok ? ((await landingRes.json()) as PublicProperty) : null;
      const edge = edgeRes.ok ? ((await edgeRes.json()) as PublicProperty) : null;
      const property = landing ?? edge ?? boot;
      if (!property) throw new Error("not_found");
      return {
        ...property,
        theme_settings: landing?.theme_settings ?? edge?.theme_settings ?? boot?.theme_settings ?? null,
        agency: {
          ...(property.agency ?? { legal_name: null, phone: null, email: null }),
          logo_url: landing?.agency?.logo_url ?? edge?.agency?.logo_url ?? boot?.agency?.logo_url ?? null,
        },
      };
    },
  });
}
