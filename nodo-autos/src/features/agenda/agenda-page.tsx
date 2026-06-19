import { useEffect, useMemo } from "react";
import {
  AgendaModuleProvider,
  AgendaPage,
  type AgendaModuleContextValue,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@nodocore/nodo-modules/agenda";
import { useVehicleStore } from "@/store/vehicle-store";
import { autosTasksHooks } from "@/shared/lib/autos-module-hooks";
import { AUTOS_TASK_CATEGORIES } from "./agenda-config";

function AutosAgendaInner() {
  const { currentCliente, vehicles, customers, clienteUsers, loadInitialData } = useVehicleStore();
  const clienteId = currentCliente?.id;

  const { data: tasks = [], isLoading } = autosTasksHooks.useTasks();
  const createMutation = autosTasksHooks.useCreateTask();
  const updateMutation = autosTasksHooks.useUpdateTask();
  const deleteMutation = autosTasksHooks.useDeleteTask();

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const moduleValue = useMemo((): AgendaModuleContextValue => {
    const vehicleOptions = vehicles.map((v) => ({
      value: v.id,
      label: `${v.brand} ${v.model} ${v.year}${v.licensePlate ? ` · ${v.licensePlate}` : ""}`,
    }));
    const customerOptions = customers.map((c) => ({
      value: c.id,
      label: `${c.firstName} ${c.lastName}`,
    }));
    const assigneeOptions = clienteUsers.map((u) => ({ value: u.name, label: u.name }));

    return {
      categories: AUTOS_TASK_CATEGORIES,
      assigneeOptions,
      linkFields: [
        {
          field: "vehicle_id",
          label: "Vehículo vinculado",
          cardPrefix: "Vehículo",
          options: vehicleOptions,
          emptyLabel: "Ninguno",
          searchPlaceholder: "Buscar vehículo…",
        },
        {
          field: "customer_id",
          label: "Cliente vinculado",
          cardPrefix: "Cliente",
          options: customerOptions,
          emptyLabel: "Ninguno",
          searchPlaceholder: "Buscar cliente…",
        },
      ],
      agendaBasePath: "/admin/agenda",
      entityLabel: "la Agencia",
      tasks,
      isLoading: isLoading || !clienteId,
      createTask: (input: CreateTaskInput) => createMutation.mutateAsync(input),
      updateTask: (input: UpdateTaskInput) => updateMutation.mutateAsync(input),
      deleteTask: (id: string) => deleteMutation.mutateAsync(id).then(() => undefined),
      isSaving:
        createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    };
  }, [
    vehicles,
    customers,
    clienteUsers,
    currentCliente?.nombre,
    tasks,
    isLoading,
    clienteId,
    createMutation,
    updateMutation,
    deleteMutation,
  ]);

  return (
    <AgendaModuleProvider value={moduleValue}>
      <AgendaPage />
    </AgendaModuleProvider>
  );
}

export function AutosAgendaPage() {
  return <AutosAgendaInner />;
}
