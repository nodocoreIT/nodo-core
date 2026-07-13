"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { DoctorThemeSettings } from "@/lib/clinic/theme-settings";
import { DEFAULT_THEME_SETTINGS } from "@/lib/clinic/theme-settings";

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

interface ThemeSettingsPanelProps {
  settings: DoctorThemeSettings;
  onChange: (patch: Partial<DoctorThemeSettings>) => void;
  onReset?: () => void;
  compact?: boolean;
}

export function ThemeSettingsPanel({
  settings,
  onChange,
  onReset,
  compact = false,
}: ThemeSettingsPanelProps) {
  return (
    <div className={compact ? "space-y-2" : "space-y-2 py-2"}>
      <ColorField
        label="Color primario"
        description="Botones, enlaces activos y acentos de marca."
        value={settings.primaryColor}
        placeholder="#DA5A0E"
        resetLabel="Restablecer naranja Nodo"
        resetValue={DEFAULT_THEME_SETTINGS.primaryColor}
        onChange={(v) => onChange({ primaryColor: v })}
        onReset={() => onChange({ primaryColor: DEFAULT_THEME_SETTINGS.primaryColor })}
      />

      <ColorField
        label="Color del menú lateral"
        description="Fondo de la barra de navegación."
        value={settings.secondaryColor}
        placeholder="#121E2F"
        resetLabel="Restablecer azul marino"
        resetValue={DEFAULT_THEME_SETTINGS.secondaryColor}
        onChange={(v) => onChange({ secondaryColor: v })}
        onReset={() => onChange({ secondaryColor: DEFAULT_THEME_SETTINGS.secondaryColor })}
      />

      <ColorField
        label="Texto del menú"
        description="Ítems del menú sin seleccionar."
        value={settings.sidebarTextColor}
        placeholder="#9DACBE"
        resetLabel="Restablecer gris azulado"
        resetValue={DEFAULT_THEME_SETTINGS.sidebarTextColor}
        onChange={(v) => onChange({ sidebarTextColor: v })}
        onReset={() => onChange({ sidebarTextColor: DEFAULT_THEME_SETTINGS.sidebarTextColor })}
      />

      <ColorField
        label="Color de textos"
        description="Títulos y contenido del panel."
        value={settings.fontColor}
        placeholder="#16202E"
        resetLabel="Restablecer color de texto"
        resetValue={DEFAULT_THEME_SETTINGS.fontColor}
        onChange={(v) => onChange({ fontColor: v })}
        onReset={() => onChange({ fontColor: DEFAULT_THEME_SETTINGS.fontColor })}
      />

      <div className="space-y-2 border-t border-border pt-6">
        <Label className="text-base font-bold text-navy">Estilo de bordes</Label>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              { id: "none" as const, label: "Rectos" },
              { id: "md" as const, label: "Redondeados" },
              { id: "full" as const, label: "Muy redondeados" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange({ borderRadius: option.id })}
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
              onClick={() => onChange({ fontFamily: font })}
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
        <Label className="text-base font-bold text-navy">Marca del panel</Label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: "default" as const, label: "Nodo Salud" },
              { id: "text" as const, label: "Texto personalizado" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange({ logoType: option.id })}
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
            <Label htmlFor="brandText">Texto de la marca</Label>
            <Input
              id="brandText"
              placeholder="Ej. Consultorio Dr. García"
              value={settings.brandText}
              onChange={(e) => onChange({ brandText: e.target.value })}
            />
          </div>
        )}
      </div>

      {onReset && (
        <div className="pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={onReset}>
            Restablecer apariencia por defecto
          </Button>
        </div>
      )}
    </div>
  );
}
