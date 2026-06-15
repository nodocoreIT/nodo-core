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
import { Clock } from "lucide-react";
import { toast } from "sonner";

const DAYS = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
] as const;

const scheduleSchema = z.object({
  slotDurationMinutes: z.coerce.number().min(10).max(120),
  monday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }),
  tuesday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }),
  wednesday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }),
  thursday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }),
  friday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }),
  saturday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }),
  sunday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }),
});

type ScheduleForm = z.infer<typeof scheduleSchema>;

const DEFAULT_VALUES: ScheduleForm = {
  slotDurationMinutes: 30,
  monday: { enabled: true, start: "09:00", end: "17:00" },
  tuesday: { enabled: true, start: "09:00", end: "17:00" },
  wednesday: { enabled: true, start: "09:00", end: "17:00" },
  thursday: { enabled: true, start: "09:00", end: "17:00" },
  friday: { enabled: true, start: "09:00", end: "17:00" },
  saturday: { enabled: false, start: "09:00", end: "13:00" },
  sunday: { enabled: false, start: "09:00", end: "13:00" },
};

export function DoctorSchedulePanel() {
  const form = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const onSubmit = (_data: ScheduleForm) => {
    // TODO: persist to Supabase profiles table
    toast.success("Disponibilidad guardada");
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
          <Clock className="h-4 w-4 text-brand" />
          Disponibilidad horaria
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-4">
            <div>
              <Label className="text-xs">Duración del turno (minutos)</Label>
              <Input
                type="number"
                {...form.register("slotDurationMinutes")}
                className="h-8 text-sm w-24"
              />
            </div>

            <div className="space-y-2">
              {DAYS.map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center gap-3 p-2 rounded-lg border border-slate-100"
                >
                  <input
                    type="checkbox"
                    id={`${key}-enabled`}
                    {...form.register(`${key}.enabled` as const)}
                    className="accent-brand"
                  />
                  <label
                    htmlFor={`${key}-enabled`}
                    className="text-sm font-medium text-slate-700 w-24"
                  >
                    {label}
                  </label>

                  <FormField
                    control={form.control}
                    name={`${key}.start` as const}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="sr-only">Inicio</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            className="h-7 text-xs"
                            disabled={!form.watch(`${key}.enabled` as const)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <span className="text-slate-400 text-xs">a</span>
                  <FormField
                    control={form.control}
                    name={`${key}.end` as const}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="sr-only">Fin</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            className="h-7 text-xs"
                            disabled={!form.watch(`${key}.enabled` as const)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </div>

            <Button type="submit" className="bg-brand hover:bg-brand-600">
              Guardar disponibilidad
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
