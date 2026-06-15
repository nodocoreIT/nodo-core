"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useThemeSettings } from "@/hooks/use-theme-settings";

interface ThemeSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ColorField({
  label,
  description,
  value,
  placeholder,
  resetLabel,
  resetValue,
  onChange,
  onReset,
}: {
  label: string;
  description: string;
  value: string;
  placeholder: string;
  resetLabel: string;
  resetValue: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const safeColor = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : placeholder;

  return (
    <div className="space-y-2 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <Label className="text-base font-bold text-navy">{label}</Label>
      <p className="text-xs text-slate2">{description}</p>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={safeColor}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded border border-border p-1 bg-white flex-shrink-0"
        />
        <div className="flex flex-col gap-1">
          <Input
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              let val = e.target.value;
              if (val && !val.startsWith("#") && /^[0-9A-Fa-f]/.test(val)) {
                val = "#" + val;
              }
              onChange(val);
            }}
            className="h-9 w-28 text-xs font-mono uppercase"
            maxLength={7}
          />
          <button
            type="button"
            onClick={onReset}
            className="text-left text-xs text-brand hover:underline font-semibold"
          >
            {resetLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ThemeSettingsDialog({
  open,
  onOpenChange,
}: ThemeSettingsDialogProps) {
  const { settings, setSettings, resetSettings } = useThemeSettings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-navy">
            Personalización del Panel
          </DialogTitle>
          <DialogDescription>
            Ajustá colores, tipografía y estilo visual de tu consultorio digital.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <ColorField
            label="Color Primario"
            description="Color de marca para botones y detalles activos."
            value={settings.primaryColor}
            placeholder="#DA5A0E"
            resetLabel="Restablecer Naranja Nodo"
            resetValue="#da5a0e"
            onChange={(v) => setSettings({ primaryColor: v })}
            onReset={() => setSettings({ primaryColor: "#da5a0e" })}
          />

          <ColorField
            label="Color Secundario (Menú Lateral)"
            description="Color de fondo de la barra de navegación."
            value={settings.secondaryColor}
            placeholder="#121E2F"
            resetLabel="Restablecer Azul Marino Original"
            resetValue="#121e2f"
            onChange={(v) => setSettings({ secondaryColor: v })}
            onReset={() => setSettings({ secondaryColor: "#121e2f" })}
          />

          <ColorField
            label="Texto del Menú (Sin Seleccionar)"
            description="Color de los ítems del menú que no están activos."
            value={settings.sidebarTextColor}
            placeholder="#9DACBE"
            resetLabel="Restablecer Gris Azulado Original"
            resetValue="#9dacbe"
            onChange={(v) => setSettings({ sidebarTextColor: v })}
            onReset={() => setSettings({ sidebarTextColor: "#9dacbe" })}
          />

          <ColorField
            label="Color de Fuente (Textos)"
            description="Color para títulos y textos del panel."
            value={settings.fontColor}
            placeholder="#16202E"
            resetLabel="Restablecer Color de Texto Original"
            resetValue="#16202e"
            onChange={(v) => setSettings({ fontColor: v })}
            onReset={() => setSettings({ fontColor: "#16202e" })}
          />

          <div className="space-y-2 border-t border-border pt-6">
            <Label className="text-base font-bold text-navy">Estilo de Bordes</Label>
            <p className="text-xs text-slate2">
              Ajustá la redondez de botones, inputs y tarjetas.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "none" as const, label: "Rectos" },
                { id: "md" as const, label: "Redondeados" },
                { id: "full" as const, label: "Muy redondeados" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSettings({ borderRadius: option.id })}
                  className={`p-3 border text-center text-sm font-semibold rounded-md transition-all ${
                    settings.borderRadius === option.id
                      ? "border-brand bg-brand/5 text-brand"
                      : "border-border hover:bg-paper text-slate2"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-6">
            <Label className="text-base font-bold text-navy">Tipografía</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["Inter", "Roboto", "Montserrat"] as const).map((font) => (
                <button
                  key={font}
                  type="button"
                  onClick={() => setSettings({ fontFamily: font })}
                  className={`p-2 border text-sm font-semibold rounded-md transition-all ${
                    settings.fontFamily === font
                      ? "border-brand bg-brand/5 text-brand"
                      : "border-border hover:bg-paper text-slate2"
                  }`}
                  style={{ fontFamily: font }}
                >
                  {font}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-6">
            <Label className="text-base font-bold text-navy">Marca del Panel</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "default" as const, label: "Nodo Salud" },
                { id: "text" as const, label: "Texto personalizado" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSettings({ logoType: option.id })}
                  className={`p-3 border text-center text-sm font-semibold rounded-md transition-all ${
                    settings.logoType === option.id
                      ? "border-brand bg-brand/5 text-brand"
                      : "border-border hover:bg-paper text-slate2"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {settings.logoType === "text" && (
              <div className="space-y-2 bg-paper p-4 rounded-md border border-border mt-3">
                <Label htmlFor="brandText">Texto de la Marca</Label>
                <Input
                  id="brandText"
                  placeholder="Ej. Consultorio Dr. García"
                  value={settings.brandText}
                  onChange={(e) => setSettings({ brandText: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => resetSettings()}
            >
              Restablecer todo
            </Button>
            <Button
              type="button"
              className="flex-1 bg-brand hover:bg-brand-600 text-white"
              onClick={() => onOpenChange(false)}
            >
              Guardar y cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
