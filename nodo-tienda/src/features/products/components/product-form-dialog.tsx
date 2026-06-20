/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import type { CategoryRow, BrandRow } from "@/shared/types/database";
import type { ProductWithRefs } from "@/features/products/hooks/use-products";
import {
  useCreateProduct,
  useUpdateProduct,
} from "@/features/products/hooks/use-products";
import { calcMargin, toSlug } from "@/features/products/lib/product-utils";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Requerido"),
  slug: z.string().min(1, "Requerido"),
  description: z.string().optional().nullable(),
  category_id: z.string().optional().nullable(),
  brand_id: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  price: z.string().min(1, "Requerido"),
  promotional_price: z.string().optional().nullable(),
  cost: z.string().optional().nullable(),
  is_active: z.boolean(),
  is_featured: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductWithRefs | null;
  categories: CategoryRow[];
  brands: BrandRow[];
}

// ── Checkbox ──────────────────────────────────────────────────────────────────

interface CheckboxFieldProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function CheckboxField({ id, label, checked, onChange }: CheckboxFieldProps) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded-sm border border-input accent-brand focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label={label}
      />
      {label}
    </label>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  categories,
  brands,
}: ProductFormDialogProps) {
  const isEdit = !!product;
  const slugEditedRef = useRef(false);

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const isPending = createProduct.isPending || updateProduct.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: product?.name ?? "",
      slug: product?.slug ?? "",
      description: product?.description ?? "",
      category_id: product?.category_id ?? null,
      brand_id: product?.brand_id ?? null,
      sku: product?.sku ?? "",
      price: product?.price != null ? String(product.price) : "",
      promotional_price:
        product?.promotional_price != null
          ? String(product.promotional_price)
          : "",
      cost: product?.cost != null ? String(product.cost) : "",
      is_active: product?.is_active ?? true,
      is_featured: product?.is_featured ?? false,
    },
  });

  useEffect(() => {
    if (open) {
      slugEditedRef.current = false;
      form.reset({
        name: product?.name ?? "",
        slug: product?.slug ?? "",
        description: product?.description ?? "",
        category_id: product?.category_id ?? null,
        brand_id: product?.brand_id ?? null,
        sku: product?.sku ?? "",
        price: product?.price != null ? String(product.price) : "",
        promotional_price:
          product?.promotional_price != null
            ? String(product.promotional_price)
            : "",
        cost: product?.cost != null ? String(product.cost) : "",
        is_active: product?.is_active ?? true,
        is_featured: product?.is_featured ?? false,
      });
    }
  }, [open, product, form]);

  function handleNameChange(value: string) {
    form.setValue("name", value);
    if (!slugEditedRef.current) {
      form.setValue("slug", toSlug(value), { shouldValidate: true });
    }
  }

  // Live margin calculation
  const priceStr = form.watch("price");
  const costStr = form.watch("cost");
  const priceNum = parseFloat(priceStr ?? "") || 0;
  const costNum = parseFloat(costStr ?? "") || 0;
  const margin = calcMargin(priceNum, costNum > 0 ? costNum : null);

  async function handleSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      slug: values.slug,
      description: values.description || null,
      category_id: values.category_id || null,
      brand_id: values.brand_id || null,
      sku: values.sku || null,
      price: parseFloat(values.price),
      promotional_price: values.promotional_price
        ? parseFloat(values.promotional_price)
        : null,
      cost: values.cost ? parseFloat(values.cost) : null,
      is_active: values.is_active,
      is_featured: values.is_featured,
    };

    if (isEdit && product) {
      await updateProduct.mutateAsync({ id: product.id, ...payload });
    } else {
      await createProduct.mutateAsync(payload);
    }

    onOpenChange(false);
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-y-auto max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar producto" : "Nuevo producto"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modificá los campos y guardá los cambios."
              : "Completá los campos para agregar el producto al catálogo."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit as any)}
            className="flex flex-col gap-5"
          >
            {/* ── Información básica ─────────────────────────────────────── */}
            <section className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate2">
                Información básica
              </p>

              <FormField
                control={form.control as any}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Auriculares Bluetooth"
                        {...field}
                        onChange={(e) => handleNameChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="auriculares-bluetooth"
                        {...field}
                        onChange={(e) => {
                          slugEditedRef.current = true;
                          field.onChange(e);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción (opcional)</FormLabel>
                    <FormControl>
                      <textarea
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Descripción del producto..."
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            {/* ── Clasificación ──────────────────────────────────────────── */}
            <section className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate2">
                Clasificación
              </p>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control as any}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <Select
                        value={field.value ?? "none"}
                        onValueChange={(v) =>
                          field.onChange(v === "none" ? null : v)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sin categoría" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin categoría</SelectItem>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="brand_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <Select
                        value={field.value ?? "none"}
                        onValueChange={(v) =>
                          field.onChange(v === "none" ? null : v)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sin marca" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin marca</SelectItem>
                          {brands.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* ── Precios ────────────────────────────────────────────────── */}
            <section className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate2">
                Precios
              </p>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control as any}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="promotional_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio promo</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0"
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
                  name="cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {costNum > 0 && priceNum > 0 && (
                <p className="text-sm text-slate2">
                  Margen:{" "}
                  <span className="font-medium text-foreground">{margin}</span>
                </p>
              )}
            </section>

            {/* ── SKU ────────────────────────────────────────────────────── */}
            <section className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate2">
                SKU
              </p>
              <FormField
                control={form.control as any}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="SKU-001"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            {/* ── Estado ─────────────────────────────────────────────────── */}
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate2">
                Estado
              </p>
              <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                <FormField
                  control={form.control as any}
                  name="is_active"
                  render={({ field }) => (
                    <CheckboxField
                      id="product-is-active"
                      label="Activo (visible en tienda)"
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <FormField
                  control={form.control as any}
                  name="is_featured"
                  render={({ field }) => (
                    <CheckboxField
                      id="product-is-featured"
                      label="Destacado"
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
            </section>

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
