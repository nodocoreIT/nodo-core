import { useMemo } from "react";
import {
  AgendaModuleProvider,
  AgendaPage as SharedAgendaPage,
  type AgendaModuleContextValue,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@nodocore/nodo-modules/agenda";
import { useAuth } from "@nodocore/shared-components";
import { useSettingsModule } from "@nodocore/nodo-modules/settings";
import { getActiveApiKey } from "@nodocore/nodo-modules/settings";
import { useSettingsTrigger } from "@/shared/hooks/use-settings-trigger";
import { useProperties } from "@/features/properties/hooks/use-properties";
import { useContacts } from "@/features/contacts/hooks/use-contacts";
import { useStaff } from "@/shared/hooks/use-staff";
import { createInmoTasksHooks } from "@/shared/lib/inmo-module-hooks";
import { INMO_TASK_CATEGORIES } from "../agenda-config";

function InmoAgendaInner() {
  const { orgId } = useAuth();
  const { aiSettings } = useSettingsModule();
  const { data: properties = [] } = useProperties();
  const { data: contacts = [] } = useContacts();
  const { users } = useStaff();

  const tasksHooks = useMemo(
    () => createInmoTasksHooks(() => orgId),
    [orgId],
  );

  const { data: tasks = [], isLoading } = tasksHooks.useTasks();
  const createMutation = tasksHooks.useCreateTask();
  const updateMutation = tasksHooks.useUpdateTask();
  const deleteMutation = tasksHooks.useDeleteTask();

  const moduleValue = useMemo((): AgendaModuleContextValue => {
    const propertyOptions = properties.map((property) => ({
      value: property.id,
      label: property.address || property.id,
    }));
    const contactOptions = contacts.map((contact) => ({
      value: contact.id,
      label: contact.name || contact.id,
    }));
    const assigneeOptions = users.map((user) => ({ value: user.name, label: user.name }));

    return {
      categories: INMO_TASK_CATEGORIES,
      assigneeOptions,
      linkFields: [
        {
          field: "property_id",
          label: "Propiedad vinculada",
          cardPrefix: "Propiedad",
          options: propertyOptions,
          emptyLabel: "Ninguna",
          searchPlaceholder: "Buscar propiedad…",
        },
        {
          field: "contact_id",
          label: "Contacto vinculado",
          cardPrefix: "Contacto",
          options: contactOptions,
          emptyLabel: "Ninguno",
          searchPlaceholder: "Buscar contacto…",
        },
      ],
      agendaBasePath: "/admin/agenda",
      entityLabel: "la Agencia",
      aiApiKey: getActiveApiKey(aiSettings),
      aiProvider: aiSettings.provider,
      onAiSettingsClick: () => useSettingsTrigger.getState().requestTab("ai"),
      tasks,
      isLoading: isLoading || !orgId,
      createTask: (input: CreateTaskInput) => createMutation.mutateAsync(input),
      updateTask: (input: UpdateTaskInput) => updateMutation.mutateAsync(input),
      deleteTask: (id: string) => deleteMutation.mutateAsync(id).then(() => undefined),
      isSaving:
        createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    };
  }, [
    properties,
    contacts,
    users,
    tasks,
    isLoading,
    orgId,
    aiSettings,
    createMutation,
    updateMutation,
    deleteMutation,
  ]);

  return (
    <AgendaModuleProvider value={moduleValue}>
      <SharedAgendaPage />
    </AgendaModuleProvider>
  );
}

export function AgendaPage() {
  return <InmoAgendaInner />;
}
