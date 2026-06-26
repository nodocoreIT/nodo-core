import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  Filter,
  Link2,
  Loader2,
  Plus,
  Square,
  Trash2,
  User,
} from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormSelect,
  Input,
  Label,
  SearchableSelect,
} from "@nodocore/shared-components";
import { useAgendaModule } from "./context";
import type { AgendaLinkField, TaskRow } from "./types";
import { VoiceTaskButton } from "./voice-task-button";
import type { ExtractedTask } from "./use-extract-task-from-voice";
import { cn } from "../lib/cn";

const DEFAULT_ENTITY_LABEL = "Agencia";

type LinkValuesState = Record<string, string>;

function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

function getWeekDates(baseDateStr: string) {
  const base = new Date(`${baseDateStr}T00:00:00`);
  const dayOfWeek = base.getDay();
  const mondayDiff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayDiff);

  const dates: Date[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function AgendaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    categories,
    assigneeOptions,
    linkFields,
    tasks,
    isLoading,
    createTask,
    updateTask,
    deleteTask,
    isSaving,
    entityLabel,
    aiApiKey,
    aiProvider,
  } = useAgendaModule();

  const todayStr = getTodayString();
  const pageEntityLabel = entityLabel ?? DEFAULT_ENTITY_LABEL;

  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("pendiente");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [selectedDateStr, setSelectedDateStr] = useState(todayStr);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState(categories[0]?.value ?? "general");
  const [formPriority, setFormPriority] = useState<"alta" | "media" | "baja">("media");
  const [formDueDate, setFormDueDate] = useState(todayStr);
  const [formAssignedTo, setFormAssignedTo] = useState("");
  const [formLinkValues, setFormLinkValues] = useState<LinkValuesState>({});

  const clearTaskParam = () => {
    if (!searchParams.has("task")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
  };

  const resetLinkValues = () => {
    const initial: LinkValuesState = {};
    for (const linkField of linkFields) {
      initial[String(linkField.field)] = "";
    }
    setFormLinkValues(initial);
  };

  const setLinkValuesFromTask = (task: TaskRow) => {
    const values: LinkValuesState = {};
    for (const linkField of linkFields) {
      const key = String(linkField.field);
      const value = task[linkField.field];
      values[key] = typeof value === "string" ? value : "";
    }
    setFormLinkValues(values);
  };

  const handleOpenCreateDialog = () => {
    setEditingTask(null);
    setFormTitle("");
    setFormDescription("");
    setFormCategory(categories[0]?.value ?? "general");
    setFormPriority("media");
    setFormDueDate(selectedDateStr);
    setFormAssignedTo("");
    resetLinkValues();
    setDialogOpen(true);
    clearTaskParam();
  };

  const handleVoiceExtracted = (values: ExtractedTask) => {
    setEditingTask(null);
    setFormTitle(values.title ?? "");
    setFormDescription(values.description ?? "");
    setFormCategory(values.category ?? categories[0]?.value ?? "general");
    setFormPriority(values.priority ?? "media");
    setFormDueDate(values.due_date ?? selectedDateStr);
    setFormAssignedTo(values.assigned_to ?? "");
    resetLinkValues();
    setDialogOpen(true);
    clearTaskParam();
  };

  const handleOpenEditDialog = (task: TaskRow) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description ?? "");
    setFormCategory(task.category);
    setFormPriority(task.priority);
    setFormDueDate(task.due_date);
    setFormAssignedTo(task.assigned_to ?? "");
    setLinkValuesFromTask(task);
    setDialogOpen(true);
    clearTaskParam();
  };

  useEffect(() => {
    const taskId = searchParams.get("task");
    if (!taskId || isLoading) return;

    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    setSelectedDateStr(task.due_date);
    setFilterStatus("all");
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description ?? "");
    setFormCategory(task.category);
    setFormPriority(task.priority);
    setFormDueDate(task.due_date);
    setFormAssignedTo(task.assigned_to ?? "");
    const values: LinkValuesState = {};
    for (const linkField of linkFields) {
      const key = String(linkField.field);
      const value = task[linkField.field];
      values[key] = typeof value === "string" ? value : "";
    }
    setFormLinkValues(values);
    setDialogOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
  }, [searchParams, tasks, isLoading, linkFields, setSearchParams]);

  const handleSubmitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = formTitle.trim();
    if (!title) return;

    const dynamicLinks: Record<string, string | null> = {};
    for (const linkField of linkFields) {
      const key = String(linkField.field);
      dynamicLinks[key] = formLinkValues[key]?.trim() || null;
    }

    const payload = {
      title,
      description: formDescription.trim() || null,
      category: formCategory,
      priority: formPriority,
      due_date: formDueDate,
      assigned_to: formAssignedTo.trim() || null,
      ...dynamicLinks,
      status: editingTask ? editingTask.status : "pendiente",
    };

    try {
      if (editingTask) {
        await updateTask({ id: editingTask.id, ...payload });
      } else {
        await createTask(payload);
      }
      setDialogOpen(false);
      clearTaskParam();
    } catch (error) {
      console.error("Error saving task:", error);
    }
  };

  const handleToggleStatus = async (task: TaskRow) => {
    const nextStatus = task.status === "completada" ? "pendiente" : "completada";
    try {
      await updateTask({ id: task.id, status: nextStatus });
    } catch (error) {
      console.error("Error toggling task status:", error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm("¿Seguro que querés eliminar esta tarea?")) return;
    try {
      await deleteTask(taskId);
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const navigateWeek = (weeksDiff: number) => {
    const next = new Date(`${selectedDateStr}T00:00:00`);
    next.setDate(next.getDate() + weeksDiff * 7);
    setSelectedDateStr(next.toISOString().split("T")[0]);
  };

  const currentWeekDates = useMemo(() => getWeekDates(selectedDateStr), [selectedDateStr]);

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (filterCategory !== "all" && task.category !== filterCategory) return false;
        if (filterPriority !== "all" && task.priority !== filterPriority) return false;
        if (filterStatus !== "all" && task.status !== filterStatus) return false;
        if (filterAssignee !== "all") {
          if (filterAssignee === "") return !task.assigned_to;
          if (task.assigned_to !== filterAssignee) return false;
        }
        return true;
      }),
    [tasks, filterCategory, filterPriority, filterStatus, filterAssignee],
  );

  const overdueTasks = filteredTasks.filter(
    (task) => task.status !== "completada" && task.due_date < todayStr,
  );
  const selectedDayTasks = filteredTasks.filter((task) => task.due_date === selectedDateStr);
  const futureTasks = filteredTasks.filter(
    (task) => task.due_date > selectedDateStr && task.due_date >= todayStr,
  );

  const categoryBadge = (categoryValue: string) => {
    const category = categories.find((item) => item.value === categoryValue);
    const Icon = category?.icon ?? CheckCircle2;
    const bg = category?.bg ?? "bg-slate-100 text-slate-700 border-slate-200";

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
          bg,
        )}
      >
        <Icon className="h-3 w-3 shrink-0" />
        {category?.label ?? categoryValue}
      </span>
    );
  };

  const priorityBadge = (priority: string) => {
    if (priority === "alta") {
      return (
        <span className="rounded-full border border-rose-200 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600">
          Alta
        </span>
      );
    }
    if (priority === "media") {
      return (
        <span className="rounded-full border border-amber-200 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
          Media
        </span>
      );
    }
    return (
      <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        Baja
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center justify-between rounded-md border border-border bg-card p-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate2">Tareas Pendientes</p>
            <p className="text-2xl font-bold text-navy">
              {tasks.filter((task) => task.status !== "completada").length}
            </p>
          </div>
          <Clock className="h-8 w-8 text-amber-500 opacity-60" />
        </div>

        <div className="flex items-center justify-between rounded-md border border-border bg-card p-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate2">Completadas Hoy</p>
            <p className="text-2xl font-bold text-emerald-600">
              {tasks.filter((task) => task.status === "completada" && task.due_date === todayStr).length}
            </p>
          </div>
          <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-60" />
        </div>

        <div className="flex items-center justify-between rounded-md border border-border bg-card p-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate2">Vencidas / Demoradas</p>
            <p className="text-2xl font-bold text-rose-600">
              {tasks.filter((task) => task.status !== "completada" && task.due_date < todayStr).length}
            </p>
          </div>
          <AlertCircle className="h-8 w-8 text-rose-500 opacity-60" />
        </div>
      </div>

      <div className="flex flex-col items-start gap-6 lg:flex-row">
        <div className="w-full shrink-0 space-y-6 lg:w-80">
          <div className="space-y-4 rounded-md border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-navy">
                <Calendar className="h-4 w-4" />
                Navegador de Agenda
              </h3>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => navigateWeek(-1)}
                  className="rounded p-1 text-slate2 hover:bg-slate-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigateWeek(1)}
                  className="rounded p-1 text-slate2 hover:bg-slate-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {currentWeekDates.map((date) => {
                const dateString = date.toISOString().split("T")[0];
                const isSelected = dateString === selectedDateStr;
                const isToday = dateString === todayStr;
                const weekdayName = date.toLocaleDateString("es-AR", { weekday: "narrow" });
                const dayNumber = date.getDate();

                return (
                  <button
                    type="button"
                    key={dateString}
                    onClick={() => setSelectedDateStr(dateString)}
                    className={cn(
                      "flex flex-col items-center rounded-md border px-1 py-2 text-xs transition-all",
                      isSelected
                        ? "border-brand bg-brand font-bold text-white"
                        : isToday
                          ? "border-brand/20 bg-brand/10 font-semibold text-brand"
                          : "border-border bg-white text-slate2 hover:bg-slate-50",
                    )}
                  >
                    <span className="text-[10px] uppercase opacity-75">{weekdayName}</span>
                    <span className="mt-0.5 text-sm">{dayNumber}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
              <span className="text-slate2">Día seleccionado:</span>
              <span className="font-mono font-bold uppercase text-navy">
                {new Date(`${selectedDateStr}T00:00:00`).toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          <div className="space-y-4 rounded-md border border-border bg-card p-4 shadow-sm">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-navy">
              <Filter className="h-4 w-4" />
              Filtros de Tarea
            </h3>

            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <FormSelect
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { value: "all", label: "Todas" },
                  { value: "pendiente", label: "Pendientes" },
                  { value: "completada", label: "Completadas" },
                  { value: "en_progreso", label: "En Progreso" },
                  { value: "cancelada", label: "Canceladas" },
                ]}
                triggerClassName="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Categoría</Label>
              <FormSelect
                value={filterCategory}
                onChange={setFilterCategory}
                options={[
                  { value: "all", label: "Todas las categorías" },
                  ...categories.map((category) => ({
                    value: category.value,
                    label: category.label,
                  })),
                ]}
                triggerClassName="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Prioridad</Label>
              <FormSelect
                value={filterPriority}
                onChange={setFilterPriority}
                options={[
                  { value: "all", label: "Todas las prioridades" },
                  { value: "alta", label: "Alta" },
                  { value: "media", label: "Media" },
                  { value: "baja", label: "Baja" },
                ]}
                triggerClassName="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Asignado a</Label>
              <SearchableSelect
                value={filterAssignee}
                onChange={setFilterAssignee}
                options={[
                  { value: "all", label: "Cualquiera" },
                  { value: "", label: "Sin asignar / General" },
                  ...assigneeOptions,
                ]}
                searchPlaceholder="Buscar..."
                triggerClassName="h-9 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="w-full flex-1 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-navy">
              {`Tareas organizadas de ${pageEntityLabel}`}
            </h2>
            <div className="flex items-center gap-2">
              <VoiceTaskButton apiKey={aiApiKey} provider={aiProvider} onExtracted={handleVoiceExtracted} />
              <Button onClick={handleOpenCreateDialog} className="gap-2 text-xs">
                <Plus className="h-4 w-4" />
                Nueva Tarea
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <div
                role="status"
                aria-label="Cargando tareas"
                className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent"
              />
            </div>
          ) : (
            <div className="space-y-6">
              {overdueTasks.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-rose-600">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                    Tareas Atrasadas / Demoradas
                  </h3>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {overdueTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        linkFields={linkFields}
                        onToggle={handleToggleStatus}
                        onEdit={handleOpenEditDialog}
                        onDelete={handleDeleteTask}
                        renderCategoryBadge={categoryBadge}
                        renderPriorityBadge={priorityBadge}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-navy">
                  <span className="h-2 w-2 rounded-full bg-brand" />
                  Agenda para el Día Seleccionado
                </h3>
                {selectedDayTasks.length === 0 ? (
                  <div className="mt-4 rounded-md border border-border border-dashed bg-card p-8 text-center text-sm text-slate2">
                    No tenés tareas agendadas para este día.
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {selectedDayTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        linkFields={linkFields}
                        onToggle={handleToggleStatus}
                        onEdit={handleOpenEditDialog}
                        onDelete={handleDeleteTask}
                        renderCategoryBadge={categoryBadge}
                        renderPriorityBadge={priorityBadge}
                      />
                    ))}
                  </div>
                )}
              </div>

              {futureTasks.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate2">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    Próximas Tareas Agendadas
                  </h3>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {futureTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        linkFields={linkFields}
                        onToggle={handleToggleStatus}
                        onEdit={handleOpenEditDialog}
                        onDelete={handleDeleteTask}
                        renderCategoryBadge={categoryBadge}
                        renderPriorityBadge={priorityBadge}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Editar Tarea" : `Nueva Tarea de ${pageEntityLabel}`}</DialogTitle>
            <DialogDescription>
              Completá los campos para organizar las actividades y asignaciones de tu equipo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitForm} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="task-title">Título *</Label>
              <Input
                id="task-title"
                placeholder="Ej. Visita con cliente"
                value={formTitle}
                onChange={(event) => setFormTitle(event.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="task-description">Detalles / Comentarios</Label>
              <Input
                id="task-description"
                placeholder="Notas adicionales..."
                value={formDescription}
                onChange={(event) => setFormDescription(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="task-category">Categoría</Label>
                <FormSelect
                  id="task-category"
                  value={formCategory}
                  onChange={setFormCategory}
                  options={categories.map((category) => ({
                    value: category.value,
                    label: category.label,
                  }))}
                  triggerClassName="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="task-priority">Prioridad</Label>
                <FormSelect
                  id="task-priority"
                  value={formPriority}
                  onChange={(value) => setFormPriority(value as "alta" | "media" | "baja")}
                  options={[
                    { value: "alta", label: "Alta" },
                    { value: "media", label: "Media" },
                    { value: "baja", label: "Baja" },
                  ]}
                  triggerClassName="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="task-due-date">Fecha límite</Label>
                <Input
                  id="task-due-date"
                  type="date"
                  value={formDueDate}
                  onChange={(event) => setFormDueDate(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="task-assignee">Empleado Asignado</Label>
                <SearchableSelect
                  id="task-assignee"
                  value={formAssignedTo}
                  onChange={setFormAssignedTo}
                  options={assigneeOptions}
                  allowEmpty
                  emptyLabel="Sin asignar / General"
                  searchPlaceholder="Buscar..."
                  triggerClassName="h-9 text-xs"
                />
              </div>
            </div>

            {linkFields.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {linkFields.map((linkField) => {
                  const fieldKey = String(linkField.field);
                  return (
                    <div className="space-y-1" key={fieldKey}>
                      <Label htmlFor={`task-link-${fieldKey}`}>{linkField.label}</Label>
                      <SearchableSelect
                        id={`task-link-${fieldKey}`}
                        value={formLinkValues[fieldKey] ?? ""}
                        onChange={(value) =>
                          setFormLinkValues((previous) => ({
                            ...previous,
                            [fieldKey]: value,
                          }))
                        }
                        options={linkField.options}
                        allowEmpty
                        emptyLabel={linkField.emptyLabel ?? "Ninguno"}
                        searchPlaceholder={linkField.searchPlaceholder ?? "Buscar..."}
                        triggerClassName="h-9 text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <DialogFooter className="border-t border-border pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingTask ? "Guardar Cambios" : "Crear Tarea"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TaskCardProps {
  task: TaskRow;
  linkFields: AgendaLinkField[];
  onToggle: (task: TaskRow) => void;
  onEdit: (task: TaskRow) => void;
  onDelete: (id: string) => void;
  renderCategoryBadge: (category: string) => React.ReactNode;
  renderPriorityBadge: (priority: string) => React.ReactNode;
}

function TaskCard({
  task,
  linkFields,
  onToggle,
  onEdit,
  onDelete,
  renderCategoryBadge,
  renderPriorityBadge,
}: TaskCardProps) {
  const isCompleted = task.status === "completada";
  const linkedRows = linkFields
    .map((linkField) => {
      const value = task[linkField.field];
      if (!value || typeof value !== "string") return null;
      const label = linkField.options.find((option) => option.value === value)?.label ?? value;
      return {
        field: String(linkField.field),
        prefix: linkField.cardPrefix,
        label,
      };
    })
    .filter(Boolean) as Array<{ field: string; prefix: string; label: string }>;

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between gap-3 rounded-md border bg-white p-4 shadow-sm transition-shadow hover:shadow",
        isCompleted ? "border-slate-200 opacity-60" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onToggle(task)}
          className="mt-0.5 shrink-0 text-slate2 hover:text-brand"
          aria-label={isCompleted ? "Marcar pendiente" : "Marcar completada"}
        >
          {isCompleted ? <CheckSquare className="h-4.5 w-4.5 text-brand" /> : <Square className="h-4.5 w-4.5" />}
        </button>

        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm font-bold text-navy", isCompleted && "text-slate2 line-through")}>
            {task.title}
          </p>
          {task.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate2">{task.description}</p>}
        </div>

        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="rounded p-1 text-slate2 hover:bg-slate-50 hover:text-brand"
            aria-label="Editar"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="rounded p-1 text-slate2 hover:bg-slate-50 hover:text-destructive"
            aria-label="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {renderCategoryBadge(task.category)}
        {renderPriorityBadge(task.priority)}
        {task.assigned_to && (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            <User className="h-2.5 w-2.5" />
            {task.assigned_to}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 border-t border-slate-100 pt-2.5 text-[11px] text-slate2">
        {linkedRows.map((linkedRow) => (
          <div key={linkedRow.field} className="flex items-center gap-1">
            <Link2 className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {linkedRow.prefix}: {linkedRow.label}
            </span>
          </div>
        ))}
        <div className="mt-0.5 flex items-center gap-1 font-semibold">
          <Clock className="h-3 w-3 shrink-0" />
          <span>
            F. Límite: {new Date(`${task.due_date}T00:00:00`).toLocaleDateString("es-AR")}
          </span>
        </div>
      </div>
    </div>
  );
}
