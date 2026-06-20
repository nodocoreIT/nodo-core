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
} from "@nodocore/shared-components";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import type { BrandRow } from "@/shared/types/database";
import { useCreateBrand, useUpdateBrand } from "@/features/brands/hooks/use-brands";

// ── Slug helper ───────────────────────────────────────────────────────────────

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Requerido"),
  slug: z.string().min(1, "Requerido"),
  description: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface BrandFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand?: BrandRow | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BrandFormDialog({ open, onOpenChange, brand }: BrandFormDialogProps) {
  const isEdit = !!brand;
  const slugEditedRef = useRef(false);

  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const isPending = createBrand.isPending || updateBrand.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: brand?.name ?? "",
      slug: brand?.slug ?? "",
      description: brand?.description ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      slugEditedRef.current = false;
      form.reset({
        name: brand?.name ?? "",
        slug: brand?.slug ?? "",
        description: brand?.description ?? "",
      });
    }
  }, [open, brand, form]);

  function handleNameChange(value: string) {
    form.setValue("name", value);
    if (!slugEditedRef.current) {
      form.setValue("slug", toSlug(value), { shouldValidate: true });
    }
  }

  async function handleSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      slug: values.slug,
      description: values.description || null,
    };

    if (isEdit && brand) {
      await updateBrand.mutateAsync({ id: brand.id, ...payload });
    } else {
      await createBrand.mutateAsync(payload);
    }

    onOpenChange(false);
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar marca" : "Nueva marca"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modificá los campos y guardá los cambios."
              : "Completá los campos para crear la marca."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit as any)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control as any}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Samsung"
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
                      placeholder="samsung"
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
                      placeholder="Descripción de la marca..."
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
