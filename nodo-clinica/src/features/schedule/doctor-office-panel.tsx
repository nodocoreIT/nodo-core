import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@nodocore/shared-components";
import { Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@nodocore/shared-components";

const officeSchema = z.object({
  full_name: z.string().min(2, "Nombre requerido"),
  specialty: z.string().min(2, "Especialidad requerida"),
  license_number: z.string().optional(),
  consultationFee: z.coerce.number().optional(),
  currency: z.string().default("ARS"),
  alias: z.string().optional(),
  cbu: z.string().optional(),
  paymentInstructions: z.string().optional(),
});

type OfficeForm = z.infer<typeof officeSchema>;

export function DoctorOfficePanel() {
  const { session } = useAuth();

  const form = useForm<OfficeForm>({
    resolver: zodResolver(officeSchema),
    defaultValues: {
      full_name: "",
      specialty: "",
      license_number: "",
      currency: "ARS",
    },
  });

  const onSubmit = async (data: OfficeForm) => {
    if (!session?.user.id) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: data.full_name,
        specialty: data.specialty,
        license_number: data.license_number,
      })
      .eq("id", session.user.id);

    if (error) {
      toast.error("Error al guardar el perfil");
    } else {
      toast.success("Perfil del consultorio actualizado");
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
          <Stethoscope className="h-4 w-4 text-brand" />
          Datos del consultorio
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Nombre completo</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Dr. Juan Pérez" className="h-9" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="specialty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Especialidad</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Medicina General" className="h-9" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="license_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Matrícula</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="MN 12345" className="h-9" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border-t border-slate-100 pt-4">
              <Label className="text-xs font-semibold text-slate-600 mb-3 block">
                Configuración de pagos
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Honorario</Label>
                  <Input
                    type="number"
                    {...form.register("consultationFee")}
                    placeholder="5000"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Moneda</Label>
                  <Input
                    {...form.register("currency")}
                    defaultValue="ARS"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Alias CBU</Label>
                  <Input
                    {...form.register("alias")}
                    placeholder="mi.alias.mp"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            <Button type="submit" className="bg-brand hover:bg-brand-600">
              Guardar consultorio
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
