import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Trash2,
  Users,
  X,
  Pencil,
  Mail,
  Phone,
  MapPin,
  User,
} from "lucide-react";
import {
  Button,
  Input,
  DocumentNumberInput,
  Label,
  Card,
  CardContent,
  CardHeader,
  FormSelect,
} from "@nodocore/shared-components";
import { cn } from "@/shared/lib/utils";
import { useVehicleStore } from "@/store/vehicle-store";
import type { Customer } from "@/types";

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

const DOCUMENT_TYPE_OPTIONS = [
  { value: "DNI", label: "DNI" },
  { value: "CUIT", label: "CUIT" },
  { value: "CUIL", label: "CUIL" },
  { value: "Pasaporte", label: "Pasaporte" },
];

const TABLE_COLUMNS =
  "grid grid-cols-[minmax(220px,1.4fr)_minmax(180px,1.2fr)_minmax(160px,1fr)_minmax(140px,0.9fr)_72px] gap-4 items-center";

function formatLocation(customer: Customer): string {
  const parts = [customer.city, customer.state].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "No especificada";
}

function formatDocument(customer: Customer): string {
  if (!customer.documentNumber) return "—";
  const type = customer.documentType || "DNI";
  return `${type}: ${customer.documentNumber}`;
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

export function CustomersListPage() {
  const {
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    loadInitialData,
    loading,
  } = useVehicleStore();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
  });

  const documentType = watch("documentType") ?? "";

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(s) ||
      c.lastName.toLowerCase().includes(s) ||
      (c.email ?? "").toLowerCase().includes(s) ||
      (c.phone ?? "").includes(s) ||
      (c.documentNumber ?? "").includes(s)
    );
  });

  function openCreateForm() {
    setEditingCustomer(null);
    reset({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      city: "",
      state: "",
      address: "",
      documentType: "",
      documentNumber: "",
    });
    setShowForm(true);
  }

  function openEditForm(customer: Customer) {
    setEditingCustomer(customer);
    reset({
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
      address: customer.address ?? "",
      documentType: customer.documentType ?? "",
      documentNumber: customer.documentNumber ?? "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingCustomer(null);
    reset();
  }

  async function onSubmit(values: CustomerFormValues) {
    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email || undefined,
      phone: values.phone || undefined,
      city: values.city || undefined,
      state: values.state || undefined,
      address: values.address || undefined,
      documentType: values.documentType || undefined,
      documentNumber: values.documentNumber || undefined,
    };

    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, payload);
        toast.success("Cliente actualizado");
      } else {
        await addCustomer(payload);
        toast.success("Cliente agregado");
      }
      closeForm();
    } catch {
      toast.error(editingCustomer ? "Error al actualizar el cliente" : "Error al agregar el cliente");
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
      <div className="flex items-center justify-end gap-4">
        <Button
          onClick={openCreateForm}
          className="bg-brand hover:bg-brand-600 text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate2" />
        <Input
          placeholder="Buscar por nombre, email, teléfono…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-slate2">Cargando…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Users className="h-10 w-10 text-slate2-300" />
          <p className="text-slate2">Sin clientes aún.</p>
        </div>
      ) : (
        <Card className="border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <CardHeader className="border-b border-mist bg-paper/60 px-5 py-3">
            <div className={cn(TABLE_COLUMNS, "text-xs font-semibold uppercase tracking-wide text-slate2")}>
              <span>Nombre y Apellido</span>
              <span>Contacto</span>
              <span>Ubicación</span>
              <span>Documento</span>
              <span className="text-center">Acciones</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-mist">
              {filtered.map((customer) => (
                <div key={customer.id} className={cn(TABLE_COLUMNS, "px-5 py-4")}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy">
                        {customer.firstName} {customer.lastName}
                      </p>
                      <p className="text-xs text-slate2">ID: {shortId(customer.id)}</p>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-1">
                    {customer.email ? (
                      <div className="flex items-center gap-2 min-w-0 text-sm text-slate2">
                        <Mail className="h-3.5 w-3.5 flex-shrink-0 text-slate2-300" />
                        <span className="truncate">{customer.email}</span>
                      </div>
                    ) : null}
                    {customer.phone ? (
                      <div className="flex items-center gap-2 text-sm text-slate2">
                        <Phone className="h-3.5 w-3.5 flex-shrink-0 text-slate2-300" />
                        <span>{customer.phone}</span>
                      </div>
                    ) : null}
                    {!customer.email && !customer.phone && (
                      <span className="text-sm text-slate2-300">—</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 min-w-0 text-sm text-slate2">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-slate2-300" />
                    <span className="truncate">{formatLocation(customer)}</span>
                  </div>

                  <p className="text-sm text-slate2 truncate">{formatDocument(customer)}</p>

                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditForm(customer)}
                      className="rounded-md p-2 text-slate2 hover:text-brand hover:bg-brand/10 transition-colors"
                      title="Editar cliente"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(customer.id)}
                      className="rounded-md p-2 text-slate2 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Eliminar cliente"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-navy">
                {editingCustomer ? "Editar cliente" : "Nuevo cliente"}
              </h3>
              <button type="button" onClick={closeForm} className="text-slate2 hover:text-navy">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Nombre *</Label>
                  <Input {...register("firstName")} />
                  {errors.firstName && (
                    <p className="text-xs text-red-600">{errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Apellido *</Label>
                  <Input {...register("lastName")} />
                  {errors.lastName && (
                    <p className="text-xs text-red-600">{errors.lastName.message}</p>
                  )}
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
                  <FormSelect
                    value={documentType}
                    onChange={(value) => setValue("documentType", value)}
                    options={DOCUMENT_TYPE_OPTIONS}
                    allowEmpty
                    emptyLabel="Seleccionar"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Número documento</Label>
                  <Controller
                    name="documentNumber"
                    control={control}
                    render={({ field }) => (
                      <DocumentNumberInput
                        documentType={documentType || "DNI"}
                        {...field}
                        value={field.value ?? ""}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="outline" onClick={closeForm}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-brand hover:bg-brand-600 text-white"
                >
                  {isSubmitting ? "Guardando…" : editingCustomer ? "Guardar cambios" : "Guardar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-base font-semibold text-navy mb-2">¿Eliminar cliente?</h3>
            <p className="text-sm text-slate2 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </Button>
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
