import { useState } from "react";
import { ChevronUp, ChevronDown, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@nodocore/shared-components";
import { cn } from "@/shared/lib/utils";
import {
  useStoreSections,
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  useReorderSections,
  SECTION_TYPE_LABELS,
  type SectionType,
  type StoreSectionRow,
} from "@/features/store-builder/hooks/use-store-sections";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@nodocore/shared-components";

const SECTION_COLORS: Record<SectionType, string> = {
  hero: "bg-violet-100 text-violet-700",
  featured_products: "bg-blue-100 text-blue-700",
  categories: "bg-emerald-100 text-emerald-700",
  banner: "bg-orange-100 text-orange-700",
  text: "bg-slate-100 text-slate-700",
  custom: "bg-pink-100 text-pink-700",
};

const AVAILABLE_TYPES: SectionType[] = [
  "hero",
  "featured_products",
  "categories",
  "banner",
  "text",
];

export function SectionsTab() {
  const { data: sections = [], isLoading } = useStoreSections();
  const createSection = useCreateSection();
  const reorderSections = useReorderSections();
  const [newType, setNewType] = useState<SectionType>("hero");

  async function handleAdd() {
    const maxOrder = sections.reduce((m, s) => Math.max(m, s.sort_order), -1);
    await createSection.mutateAsync({
      type: newType,
      title: null,
      sort_order: maxOrder + 1,
    });
  }

  async function handleMove(index: number, direction: "up" | "down") {
    const next = [...sections];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= next.length) return;

    // Swap sort_order values
    const items = next.map((s, i) => {
      if (i === index) return { id: s.id, sort_order: next[swapIndex].sort_order };
      if (i === swapIndex) return { id: s.id, sort_order: next[index].sort_order };
      return { id: s.id, sort_order: s.sort_order };
    });

    await reorderSections.mutateAsync(items);
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando secciones...</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Section list */}
      <div className="space-y-3">
        {sections.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No hay secciones configuradas. Agregá una abajo.
            </p>
          </div>
        )}
        {sections.map((section, index) => (
          <SectionCard
            key={section.id}
            section={section}
            index={index}
            total={sections.length}
            onMove={handleMove}
          />
        ))}
      </div>

      {/* Add section */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as SectionType)}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        >
          {AVAILABLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {SECTION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <Button
          onClick={handleAdd}
          disabled={createSection.isPending}
          size="sm"
        >
          {createSection.isPending ? "Agregando..." : "Agregar sección"}
        </Button>
      </div>
    </div>
  );
}

// ── Section card ───────────────────────────────────────────────────────────────

function SectionCard({
  section,
  index,
  total,
  onMove,
}: {
  section: StoreSectionRow;
  index: number;
  total: number;
  onMove: (index: number, dir: "up" | "down") => void;
}) {
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const [expanded, setExpanded] = useState(false);

  async function toggleActive() {
    await updateSection.mutateAsync({
      id: section.id,
      is_active: !section.is_active,
    });
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden transition",
        !section.is_active && "opacity-60",
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Type badge */}
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
            SECTION_COLORS[section.type],
          )}
        >
          {SECTION_TYPE_LABELS[section.type]}
        </span>

        {/* Title */}
        <p className="flex-1 text-sm font-medium truncate text-foreground">
          {section.title ?? SECTION_TYPE_LABELS[section.type]}
        </p>

        {/* Active toggle */}
        <button
          onClick={toggleActive}
          disabled={updateSection.isPending}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1",
            section.is_active ? "bg-brand" : "bg-border",
          )}
          title={section.is_active ? "Desactivar" : "Activar"}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
              section.is_active ? "translate-x-4" : "translate-x-0",
            )}
          />
        </button>

        {/* Reorder */}
        <div className="flex gap-0.5">
          <button
            onClick={() => onMove(index, "up")}
            disabled={index === 0}
            className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            onClick={() => onMove(index, "down")}
            disabled={index === total - 1}
            className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* Delete */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="rounded p-1 text-muted-foreground hover:text-red-500 transition">
              <Trash2 className="h-4 w-4" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar sección</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Seguro que querés eliminar &quot;
                {section.title ?? SECTION_TYPE_LABELS[section.type]}&quot;? Esta
                acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteSection.mutate(section.id)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="rounded p-1 text-muted-foreground hover:text-foreground transition"
        >
          <ChevronRight
            className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")}
          />
        </button>
      </div>

      {/* Config panel */}
      {expanded && (
        <div className="border-t border-border px-4 py-4">
          <ConfigPanel section={section} />
        </div>
      )}
    </div>
  );
}

// ── Config panel ───────────────────────────────────────────────────────────────

function ConfigPanel({ section }: { section: StoreSectionRow }) {
  const updateSection = useUpdateSection();
  const [title, setTitle] = useState(section.title ?? "");
  const [config, setConfig] = useState<Record<string, unknown>>(section.config ?? {});

  function setConfigField(key: string, value: unknown) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function handleApply() {
    await updateSection.mutateAsync({
      id: section.id,
      title: title || null,
      config,
    });
  }

  return (
    <div className="space-y-4">
      {/* Common: title */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Título de la sección
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Opcional"
          className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      {/* Type-specific fields */}
      {section.type === "hero" && (
        <HeroConfig config={config} onChange={setConfigField} />
      )}
      {section.type === "featured_products" && (
        <FeaturedProductsConfig config={config} onChange={setConfigField} />
      )}
      {section.type === "categories" && (
        <CategoriesConfig config={config} onChange={setConfigField} />
      )}
      {section.type === "banner" && (
        <BannerConfig config={config} onChange={setConfigField} />
      )}
      {section.type === "text" && (
        <TextConfig config={config} onChange={setConfigField} />
      )}

      <Button
        size="sm"
        onClick={handleApply}
        disabled={updateSection.isPending}
      >
        {updateSection.isPending ? "Aplicando..." : "Aplicar"}
      </Button>
    </div>
  );
}

// ── Field helpers ──────────────────────────────────────────────────────────────

function TextField({
  label,
  fieldKey,
  config,
  onChange,
  placeholder,
}: {
  label: string;
  fieldKey: string;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      <input
        type="text"
        value={(config[fieldKey] as string) ?? ""}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
    </div>
  );
}

// ── Type-specific config components ───────────────────────────────────────────

function HeroConfig({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-3">
      <TextField label="Subtítulo" fieldKey="subtitle" config={config} onChange={onChange} />
      <TextField label="Texto del botón" fieldKey="cta_label" config={config} onChange={onChange} placeholder="Ver productos" />
      <TextField label="URL del botón" fieldKey="cta_url" config={config} onChange={onChange} placeholder="/productos" />
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Color de fondo
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={(config["bg_color"] as string) ?? "#121e2f"}
            onChange={(e) => onChange("bg_color", e.target.value)}
            className="h-8 w-8 cursor-pointer rounded border border-border p-0.5"
          />
          <span className="text-sm font-mono text-muted-foreground">
            {(config["bg_color"] as string) ?? "#121e2f"}
          </span>
        </div>
      </div>
    </div>
  );
}

function FeaturedProductsConfig({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Cantidad de productos
        </label>
        <input
          type="number"
          min={2}
          max={24}
          value={(config["limit"] as number) ?? 8}
          onChange={(e) => onChange("limit", Number(e.target.value))}
          className="block w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>
    </div>
  );
}

function CategoriesConfig({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={(config["show_images"] as boolean) ?? true}
          onChange={(e) => onChange("show_images", e.target.checked)}
          className="rounded border-border"
        />
        <span className="text-sm text-foreground">Mostrar imágenes de categoría</span>
      </label>
    </div>
  );
}

function BannerConfig({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-3">
      <TextField label="Subtítulo" fieldKey="subtitle" config={config} onChange={onChange} />
      <TextField label="URL de imagen" fieldKey="image_url" config={config} onChange={onChange} placeholder="https://..." />
      <TextField label="Texto del botón" fieldKey="cta_label" config={config} onChange={onChange} placeholder="Ver más" />
      <TextField label="URL del botón" fieldKey="cta_url" config={config} onChange={onChange} placeholder="/productos" />
    </div>
  );
}

function TextConfig({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Contenido
      </label>
      <textarea
        value={(config["content"] as string) ?? ""}
        onChange={(e) => onChange("content", e.target.value)}
        rows={4}
        placeholder="Escribí el contenido del bloque..."
        className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
      />
    </div>
  );
}
