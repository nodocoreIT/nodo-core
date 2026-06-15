import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Save } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nodocore/shared-components";
import { useVehicleStore } from "@/store/vehicle-store";
import type { ClienteUpdate } from "@/store/vehicle-store";

type EmpresaFormValues = {
  nombre: string;
  telefono: string;
  whatsappNumero: string;
  direccion: string;
  sitioWeb: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  descripcionPublica: string;
  horarios: string;
};

type Tab = "empresa" | "perfil";

export function ConfigPage() {
  const { currentCliente, updateCliente, loadInitialData } = useVehicleStore();
  const [activeTab, setActiveTab] = useState<Tab>("empresa");

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<EmpresaFormValues>();

  useEffect(() => {
    if (currentCliente) {
      reset({
        nombre: currentCliente.nombre ?? "",
        telefono: currentCliente.telefono ?? "",
        whatsappNumero: currentCliente.whatsappNumero ?? "",
        direccion: currentCliente.direccion ?? "",
        sitioWeb: currentCliente.sitioWeb ?? "",
        instagramUrl: currentCliente.instagramUrl ?? "",
        facebookUrl: currentCliente.facebookUrl ?? "",
        tiktokUrl: currentCliente.tiktokUrl ?? "",
        descripcionPublica: currentCliente.descripcionPublica ?? "",
        horarios: currentCliente.horarios ?? "",
      });
    }
  }, [currentCliente, reset]);

  async function onSubmit(values: EmpresaFormValues) {
    if (!currentCliente) return;
    try {
      const updates: ClienteUpdate = {
        nombre: values.nombre,
        telefono: values.telefono,
        whatsappNumero: values.whatsappNumero,
        direccion: values.direccion || null,
        sitioWeb: values.sitioWeb || null,
        instagramUrl: values.instagramUrl || null,
        facebookUrl: values.facebookUrl || null,
        tiktokUrl: values.tiktokUrl || null,
        descripcionPublica: values.descripcionPublica || null,
        horarios: values.horarios || null,
      };
      await updateCliente(currentCliente.id, updates);
      toast.success("Configuración guardada");
    } catch {
      toast.error("Error al guardar la configuración");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold text-navy">Configuración</h2>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-mist">
        {(["empresa", "perfil"] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px capitalize ${
              activeTab === tab
                ? "border-brand text-brand"
                : "border-transparent text-slate2 hover:text-navy"
            }`}
          >
            {tab === "empresa" ? "Empresa" : "Perfil"}
          </button>
        ))}
      </div>

      {/* Empresa tab */}
      {activeTab === "empresa" && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Card className="border-slate-200 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm text-slate2 uppercase tracking-wide">Datos de la empresa</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre">
                <Input {...register("nombre")} placeholder="Mi Concesionaria S.A." />
              </Field>
              <Field label="Teléfono">
                <Input {...register("telefono")} placeholder="+54 9 11 1234 5678" />
              </Field>
              <Field label="WhatsApp">
                <Input {...register("whatsappNumero")} placeholder="+54 9 11 1234 5678" />
              </Field>
              <Field label="Dirección">
                <Input {...register("direccion")} placeholder="Av. Rivadavia 1234, CABA" />
              </Field>
              <Field label="Sitio web" className="sm:col-span-2">
                <Input {...register("sitioWeb")} placeholder="https://miconcesionaria.com" />
              </Field>
            </CardContent>
          </Card>

          <Card className="border-slate-200 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm text-slate2 uppercase tracking-wide">Redes sociales</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Instagram">
                <Input {...register("instagramUrl")} placeholder="https://instagram.com/mitienda" />
              </Field>
              <Field label="Facebook">
                <Input {...register("facebookUrl")} placeholder="https://facebook.com/mitienda" />
              </Field>
              <Field label="TikTok">
                <Input {...register("tiktokUrl")} placeholder="https://tiktok.com/@mitienda" />
              </Field>
            </CardContent>
          </Card>

          <Card className="border-slate-200 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm text-slate2 uppercase tracking-wide">Descripción y horarios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Descripción pública">
                <textarea
                  {...register("descripcionPublica")}
                  rows={3}
                  className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink placeholder:text-slate2-300 focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                  placeholder="Contá brevemente quiénes son…"
                />
              </Field>
              <Field label="Horarios de atención">
                <textarea
                  {...register("horarios")}
                  rows={3}
                  className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink placeholder:text-slate2-300 focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                  placeholder="Lun a Vie 9:00 – 18:00 / Sáb 9:00 – 13:00"
                />
              </Field>
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand hover:bg-brand-600 text-white gap-2"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? "Guardando…" : "Guardar cambios"}
          </Button>
        </form>
      )}

      {/* Perfil tab */}
      {activeTab === "perfil" && (
        <Card className="border-slate-200 rounded-xl shadow-sm">
          <CardContent className="py-8 flex flex-col items-center gap-3 text-center">
            <p className="text-slate2 text-sm">
              La gestión de usuarios se realiza desde Supabase Auth.
            </p>
            <p className="text-xs text-slate2-300">
              Accedé al panel de Supabase para invitar nuevos usuarios y asignar roles.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-sm font-medium text-ink">{label}</Label>
      {children}
    </div>
  );
}
