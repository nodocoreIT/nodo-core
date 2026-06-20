import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { Button, Input, useAuth } from "@nodocore/shared-components";
import {
  useStoreMenus,
  useUpsertStoreMenu,
  type MenuItem,
} from "@/features/store-builder/hooks/use-store-menus";

export function NavigationTab() {
  const { orgId } = useAuth();
  const { data: menus } = useStoreMenus();
  const upsertMenu = useUpsertStoreMenu();

  const headerItems = menus?.find((m) => m.location === "header")?.items ?? [];
  const footerItems = menus?.find((m) => m.location === "footer")?.items ?? [];

  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-2xl">
      <MenuEditor
        title="Menú principal"
        items={headerItems}
        onSave={(items) =>
          upsertMenu.mutate({ location: "header", items, orgId: orgId! })
        }
        isPending={upsertMenu.isPending}
      />
      <MenuEditor
        title="Pie de página"
        items={footerItems}
        onSave={(items) =>
          upsertMenu.mutate({ location: "footer", items, orgId: orgId! })
        }
        isPending={upsertMenu.isPending}
      />
    </div>
  );
}

function MenuEditor({
  title,
  items: initialItems,
  onSave,
  isPending,
}: {
  title: string;
  items: MenuItem[];
  onSave: (items: MenuItem[]) => void;
  isPending: boolean;
}) {
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  function addItem() {
    if (!newLabel.trim() || !newUrl.trim()) return;
    setItems((prev) => [
      ...prev,
      { label: newLabel.trim(), url: newUrl.trim() },
    ]);
    setNewLabel("");
    setNewUrl("");
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") addItem();
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-navy">{title}</h3>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.label}</p>
              <p className="text-xs text-muted-foreground truncate">{item.url}</p>
            </div>
            <button
              onClick={() => removeItem(i)}
              className="text-muted-foreground hover:text-red-500 transition shrink-0"
              title="Eliminar item"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
            Sin items
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Label"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Input
          placeholder="URL"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={addItem}
          title="Agregar item"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Button
        onClick={() => onSave(items)}
        disabled={isPending}
        className="w-full"
      >
        {isPending ? "Guardando..." : "Guardar menú"}
      </Button>
    </div>
  );
}
