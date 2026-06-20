/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Globe } from "lucide-react";
import {
  Button,
  Input,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nodocore/shared-components";
import { useOrgProfile } from "@/features/store-profile/hooks/use-org-profile";
import { useUpdateOrgProfile } from "@/features/store-profile/hooks/use-update-org-profile";

// ── Schemas ───────────────────────────────────────────────────────────────────

const storeInfoSchema = z.object({
  store_name: z.string().min(1, "Requerido"),
  tagline: z.string().optional(),
  contact_email: z
    .string()
    .email("Email inválido")
    .optional()
    .or(z.literal("")),
  contact_phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
});

const fiscalSchema = z.object({
  currency: z.string().min(1, "Requerido"),
  country: z.string().min(1, "Requerido"),
  timezone: z.string().min(1, "Requerido"),
});

type StoreInfoValues = z.infer<typeof storeInfoSchema>;
type FiscalValues = z.infer<typeof fiscalSchema>;

// ── Section card wrapper ──────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Store Info Section ────────────────────────────────────────────────────────

function StoreInfoSection() {
  const { data: profile } = useOrgProfile();
  const updateProfile = useUpdateOrgProfile();

  const form = useForm<StoreInfoValues>({
    resolver: zodResolver(storeInfoSchema) as any,
    defaultValues: {
      store_name: profile?.store_name ?? "",
      tagline: profile?.tagline ?? "",
      contact_email: profile?.contact_email ?? "",
      contact_phone: profile?.contact_phone ?? "",
      address: profile?.address ?? "",
      city: profile?.city ?? "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        store_name: profile.store_name ?? "",
        tagline: profile.tagline ?? "",
        contact_email: profile.contact_email ?? "",
        contact_phone: profile.contact_phone ?? "",
        address: profile.address ?? "",
        city: profile.city ?? "",
      });
    }
  }, [profile, form]);

  async function handleSubmit(values: StoreInfoValues) {
    await updateProfile.mutateAsync({
      store_name: values.store_name,
      tagline: values.tagline || null,
      contact_email: values.contact_email || null,
      contact_phone: values.contact_phone || null,
      address: values.address || null,
      city: values.city || null,
    });
  }

  return (
    <SectionCard
      title="Información de la tienda"
      description="Nombre, descripción y datos de contacto que verán tus clientes."
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit as any)}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control as any}
              name="store_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la tienda *</FormLabel>
                  <FormControl>
                    <Input placeholder="Mi Tienda" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control as any}
              name="tagline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slogan</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="La mejor tienda online"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control as any}
              name="contact_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email de contacto</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="hola@mitienda.com"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control as any}
              name="contact_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono de contacto</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="+54 9 11 0000-0000"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control as any}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Av. Corrientes 1234"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control as any}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ciudad</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Buenos Aires"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Guardar cambios
            </Button>
          </div>
        </form>
      </Form>
    </SectionCard>
  );
}

// ── Fiscal / Currency Section ─────────────────────────────────────────────────

function FiscalSection() {
  const { data: profile } = useOrgProfile();
  const updateProfile = useUpdateOrgProfile();

  const form = useForm<FiscalValues>({
    resolver: zodResolver(fiscalSchema) as any,
    defaultValues: {
      currency: profile?.currency ?? "ARS",
      country: profile?.country ?? "AR",
      timezone: profile?.timezone ?? "America/Argentina/Buenos_Aires",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        currency: profile.currency ?? "ARS",
        country: profile.country ?? "AR",
        timezone: profile.timezone ?? "America/Argentina/Buenos_Aires",
      });
    }
  }, [profile, form]);

  async function handleSubmit(values: FiscalValues) {
    await updateProfile.mutateAsync({
      currency: values.currency,
      country: values.country,
      timezone: values.timezone,
    });
  }

  return (
    <SectionCard
      title="Datos fiscales y moneda"
      description="Configurá la moneda, el país y la zona horaria de tu tienda."
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit as any)}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control as any}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar moneda" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ARS">ARS — Peso argentino</SelectItem>
                      <SelectItem value="USD">USD — Dólar estadounidense</SelectItem>
                      <SelectItem value="UYU">UYU — Peso uruguayo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control as any}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>País *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar país" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="AR">Argentina</SelectItem>
                      <SelectItem value="UY">Uruguay</SelectItem>
                      <SelectItem value="CL">Chile</SelectItem>
                      <SelectItem value="MX">México</SelectItem>
                      <SelectItem value="CO">Colombia</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control as any}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zona horaria *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar zona" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="America/Argentina/Buenos_Aires">
                        Buenos Aires (UTC-3)
                      </SelectItem>
                      <SelectItem value="America/Montevideo">
                        Montevideo (UTC-3)
                      </SelectItem>
                      <SelectItem value="America/Santiago">
                        Santiago (UTC-4)
                      </SelectItem>
                      <SelectItem value="America/Mexico_City">
                        Ciudad de México (UTC-6)
                      </SelectItem>
                      <SelectItem value="America/Bogota">
                        Bogotá (UTC-5)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Guardar cambios
            </Button>
          </div>
        </form>
      </Form>
    </SectionCard>
  );
}

// ── Domain Section ────────────────────────────────────────────────────────────

function DomainSection() {
  const { data: profile } = useOrgProfile();

  // domain lives on the `stores` table; org_profiles doesn't have custom_domain.
  // We show a read-only info card pointing users to support.
  return (
    <SectionCard
      title="Dominio personalizado"
      description="Configurá un dominio propio para tu tienda online."
    >
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
        <Globe className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {profile === undefined
              ? "Cargando..."
              : "Sin dominio personalizado configurado"}
          </p>
          <p className="text-sm text-muted-foreground">
            Para vincular un dominio propio, contactá a soporte. Una vez
            verificado, tu tienda será accesible desde tu propio dominio.
          </p>
          <a
            href="mailto:soporte@nodocore.com"
            className="inline-block text-sm text-primary hover:underline"
          >
            Contactar soporte
          </a>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function StoreProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">
          Configuración de tienda
        </h1>
        <p className="mt-1 text-sm text-slate2">
          Administrá los datos de tu tienda, contacto y configuración general.
        </p>
      </div>

      <StoreInfoSection />
      <FiscalSection />
      <DomainSection />
    </div>
  );
}
