// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button, Input } from "@nodocore/shared-components";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@nodocore/shared-components";
import { useCreateContact } from "@/features/contacts/hooks/use-create-contact";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  phone: z.string().optional(),
  email: z
    .string()
    .email("Email inválido")
    .optional()
    .or(z.literal("")),
  address: z.string().optional(),
  guarantee_info: z.string().optional(),
});

export type GuarantorFormValues = z.infer<typeof schema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPayload(values: GuarantorFormValues) {
  return {
    name: values.name,
    phone: values.phone || null,
    email: values.email || null,
    address: values.address || null,
    guarantee_info: values.guarantee_info || null,
    roles: ["guarantor"],
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface GuarantorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (guarantorId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GuarantorFormDialog({
  open,
  onOpenChange,
  onSuccess,
}: GuarantorFormDialogProps) {
  const { mutateAsync, isPending } = useCreateContact();

  const form = useForm<GuarantorFormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
      guarantee_info: "",
    },
  });

  async function handleSubmit(values: GuarantorFormValues) {
    try {
      const created = await mutateAsync(buildPayload(values));
      form.reset();
      onOpenChange(false);
      onSuccess?.(created.id);
    } catch (error) {
      // Error is handled by mutation error state, but form should show error
      console.error("Failed to create guarantor:", error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo garante</DialogTitle>
          <DialogDescription>
            Completá los datos del nuevo garante. Se agregará automáticamente
            a este contrato.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit as any)}
            className="flex flex-col gap-4"
          >
            {/* Name */}
            <FormField
              control={form.control as any}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="guarantor-name-input">
                    Nombre completo
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="guarantor-name-input"
                      aria-label="Nombre completo"
                      placeholder="María García"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone + Email */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="guarantor-phone-input">
                      Teléfono
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="guarantor-phone-input"
                        aria-label="Teléfono"
                        placeholder="11 5555-0001"
                        {...field}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="guarantor-email-input">
                      Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="guarantor-email-input"
                        aria-label="Email"
                        type="email"
                        placeholder="maria@mail.com"
                        {...field}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Address */}
            <FormField
              control={form.control as any}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="guarantor-address-input">
                    Dirección
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="guarantor-address-input"
                      aria-label="Dirección"
                      placeholder="Calle Falsa 123"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Guarantee Info */}
            <FormField
              control={form.control as any}
              name="guarantee_info"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="guarantor-guarantee-info-input">
                    Garantía ofrecida
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="guarantor-guarantee-info-input"
                      aria-label="Garantía ofrecida"
                      placeholder="Ej: Recibo de sueldo, título de inmueble"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
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
                Crear garante
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
