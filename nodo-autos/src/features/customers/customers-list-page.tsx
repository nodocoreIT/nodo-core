import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search, Trash2, Users, X } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
} from "@nodocore/shared-components";
import { useVehicleStore } from "@/store/vehicle-store";

const customerSchema = z.object({
  firstName: z.string().min(1, "Nombre requerido"),
  lastName: z.string().min(1, "Apellido requerido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  address: z.string().optional(),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

export function CustomersListPage() {
  const { customers, addCustomer, deleteCustomer, loadInitialData, loading } =
    useVehicleStore();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
  });

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(s) ||
      c.lastName.toLowerCase().includes(s) ||
      (c.email ?? "").toLowerCase().includes(s) ||
      (c.phone ?? "").includes(s)
    );
  });

  async function onSubmit(values: CustomerFormValues) {
    try {
      await addCustomer({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email || undefined,
        phone: values.phone || undefined,
        city: values.city || undefined,
        state: values.state || undefined,
        address: values.address || undefined,
        documentType: values.documentType || undefined,
        documentNumber: values.documentNumber || undefined,
      });
      toast.success("Cliente agregado");
      reset();
      setShowForm(false);
    } catch {
      toast.error("Error al agregar el cliente");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCustomer(id);
      toast.success("Cliente eliminado");
      setConfirmDelete(null);
    } catch {
      toast.error("Error al eliminar el cliente");
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-navy">Clientes</h2>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-brand hover:bg-brand-600 text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate2" />
        <Input
          placeholder="Buscar por nombre, email, teléfono…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-slate2">Cargando…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Users className="h-10 w-10 text-slate2-300" />
          <p className="text-slate2">Sin clientes aún.</p>
        </div>
      ) : (
        <Card className="border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="divide-y divide-mist">
              {filtered.map((c) => (
                <div key={c.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-mist text-xs font-semibold text-navy">
                    {c.firstName[0]}{c.lastName[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="text-xs text-slate2 truncate">
                      {[c.email, c.phone, c.city].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(c.id)}
                    className="rounded-md p-1.5 text-slate2 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add customer dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-navy">Nuevo cliente</h3>
              <button
                type="button"
                onClick={() => { setShowForm(false); reset(); }}
                className="text-slate2 hover:text-navy"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Nombre *</Label>
                  <Input {...register("firstName")} />
                  {errors.firstName && <p className="text-xs text-red-600">{errors.firstName.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Apellido *</Label>
                  <Input {...register("lastName")} />
                  {errors.lastName && <p className="text-xs text-red-600">{errors.lastName.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" {...register("email")} />
                  {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Teléfono</Label>
                  <Input {...register("phone")} />
                </div>
                <div className="space-y-1">
                  <Label>Ciudad</Label>
                  <Input {...register("city")} />
                </div>
                <div className="space-y-1">
                  <Label>Provincia</Label>
                  <Input {...register("state")} />
                </div>
                <div className="space-y-1">
                  <Label>Tipo documento</Label>
                  <select
                    {...register("documentType")}
                    className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="">Seleccionar</option>
                    <option value="DNI">DNI</option>
                    <option value="CUIT">CUIT</option>
                    <option value="CUIL">CUIL</option>
                    <option value="Pasaporte">Pasaporte</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Número documento</Label>
                  <Input {...register("documentNumber")} />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); reset(); }}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-brand hover:bg-brand-600 text-white"
                >
                  {isSubmitting ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-base font-semibold text-navy mb-2">¿Eliminar cliente?</h3>
            <p className="text-sm text-slate2 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => handleDelete(confirmDelete)}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
