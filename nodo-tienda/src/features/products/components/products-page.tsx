import { useMemo, useState } from "react";
import { Pencil, Trash2, Plus, Star, ImageOff } from "lucide-react";
import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  PaginationControls,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nodocore/shared-components";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { cn } from "@/shared/lib/utils";
import type { CategoryRow } from "@/shared/types/database";
import type { ProductWithRefs } from "@/features/products/hooks/use-products";
import {
  useProducts,
  useDeleteProduct,
} from "@/features/products/hooks/use-products";
import { useCategories } from "@/features/categories/hooks/use-categories";
import { useBrands } from "@/features/brands/hooks/use-brands";
import { formatPrice, calcMargin } from "@/features/products/lib/product-utils";
import { ProductFormDialog } from "./product-form-dialog";

const PAGE_SIZE = 20;

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        active
          ? "bg-green-100 text-green-700"
          : "bg-slate-100 text-slate-500",
      )}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

// ── Tiny thumbnail ────────────────────────────────────────────────────────────

function ProductThumb({ url }: { url?: string | null }) {
  if (!url) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-slate-50 text-slate-300">
        <ImageOff className="h-4 w-4" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="h-10 w-10 rounded-md border border-border object-cover"
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ProductsPage() {
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  const deleteProduct = useDeleteProduct();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductWithRefs | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductWithRefs | null>(null);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || p.category_id === categoryFilter;
      const matchesActive =
        activeFilter === "all" ||
        (activeFilter === "active" && p.is_active) ||
        (activeFilter === "inactive" && !p.is_active);
      return matchesSearch && matchesCategory && matchesActive;
    });
  }, [products, search, categoryFilter, activeFilter]);

  // Reset to page 1 when filters change
  // PaginationControls uses 0-indexed page
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPageZero = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(
    currentPageZero * PAGE_SIZE,
    (currentPageZero + 1) * PAGE_SIZE,
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  function openCreate() {
    setEditTarget(null);
    setDialogOpen(true);
  }

  function openEdit(p: ProductWithRefs) {
    setEditTarget(p);
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteProduct.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  // Build category lookup for filter select
  const categoryMap = Object.fromEntries(
    (categories as CategoryRow[]).map((c) => [c.id, c.name]),
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-navy">Productos</h1>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo producto
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />

        <Select
          value={categoryFilter}
          onValueChange={(v) => {
            setCategoryFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {(categories as CategoryRow[]).map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={activeFilter}
          onValueChange={(v) => {
            setActiveFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Img</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Promo</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead className="text-right">Margen</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="py-10 text-center text-slate2"
                >
                  Cargando...
                </TableCell>
              </TableRow>
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="py-10 text-center text-slate2"
                >
                  {search || categoryFilter !== "all" || activeFilter !== "all"
                    ? "No se encontraron productos para esa búsqueda."
                    : "Todavía no hay productos. ¡Creá el primero!"}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <ProductThumb />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {product.is_featured && (
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 flex-shrink-0" />
                      )}
                      <span className="font-medium">{product.name}</span>
                    </div>
                    {product.brand && (
                      <p className="text-xs text-slate2">{product.brand.name}</p>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate2">
                    {product.sku ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-slate2">
                    {product.category?.name ??
                      (product.category_id
                        ? categoryMap[product.category_id]
                        : "—") ??
                      "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatPrice(product.price)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-slate2">
                    {product.promotional_price != null
                      ? formatPrice(product.promotional_price)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm text-slate2">
                    {product.cost != null ? formatPrice(product.cost) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm text-slate2">
                    {calcMargin(product.price, product.cost)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge active={product.is_active} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(product)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(product)}
                        aria-label="Eliminar"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <PaginationControls
          page={currentPageZero}
          totalPages={totalPages}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          itemLabel="productos"
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        />
      )}

      {/* Create / Edit dialog */}
      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editTarget}
        categories={categories as CategoryRow[]}
        brands={brands}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar producto</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Confirmás que querés eliminar{" "}
              <strong>{deleteTarget?.name}</strong>? Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
