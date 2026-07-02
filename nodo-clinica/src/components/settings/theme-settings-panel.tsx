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
  primaryColor,
  onChange,
  onReset,
}: {
  label: string;
  description: string;
  value: string;
  placeholder: string;
  resetLabel: string;
  resetValue: string;
  primaryColor: string;
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
            className="text-left text-xs hover:underline font-semibold"
            style={{ color: primaryColor }}
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
        label="Color Primario"
        description="Elegí el color de marca que representa el panel (botones, enlaces activos y acentos). Podés elegirlo con el selector o ingresar su código hexadecimal."
        value={settings.primaryColor}
        placeholder="#DA5A0E"
        resetLabel="Restablecer Naranja Nodo Original"
        resetValue={DEFAULT_THEME_SETTINGS.primaryColor}
        primaryColor={settings.primaryColor}
        onChange={(v) => onChange({ primaryColor: v })}
        onReset={() => onChange({ primaryColor: DEFAULT_THEME_SETTINGS.primaryColor })}
      />

      <ColorField
        label="Color Secundario (Menú Lateral)"
        description="Elegí el color de fondo para la barra de navegación lateral. Podés elegirlo con el selector o ingresar su código hexadecimal."
        value={settings.secondaryColor}
        placeholder="#121E2F"
        resetLabel="Restablecer Azul Marino Original"
        resetValue={DEFAULT_THEME_SETTINGS.secondaryColor}
        primaryColor={settings.primaryColor}
        onChange={(v) => onChange({ secondaryColor: v })}
        onReset={() => onChange({ secondaryColor: DEFAULT_THEME_SETTINGS.secondaryColor })}
      />

      <ColorField
        label="Color del Texto del Menú Lateral (Sin Seleccionar)"
        description="Elegí el color de fuente para los elementos del menú que no estén seleccionados."
        value={settings.sidebarTextColor}
        placeholder="#9DACBE"
        resetLabel="Restablecer Gris Azulado Original"
        resetValue={DEFAULT_THEME_SETTINGS.sidebarTextColor}
        primaryColor={settings.primaryColor}
        onChange={(v) => onChange({ sidebarTextColor: v })}
        onReset={() => onChange({ sidebarTextColor: DEFAULT_THEME_SETTINGS.sidebarTextColor })}
      />

      <ColorField
        label="Color de Fuente (Textos)"
        description="Elegí el color para los textos y títulos del panel."
        value={settings.fontColor}
        placeholder="#16202E"
        resetLabel="Restablecer Color de Texto Original"
        resetValue={DEFAULT_THEME_SETTINGS.fontColor}
        primaryColor={settings.primaryColor}
        onChange={(v) => onChange({ fontColor: v })}
        onReset={() => onChange({ fontColor: DEFAULT_THEME_SETTINGS.fontColor })}
      />

      <div className="space-y-3 border-t border-border pt-6">
        <div>
          <Label className="text-base font-bold text-navy">Estilo de Bordes</Label>
          <p className="text-xs text-slate2 mt-0.5">Ajustá la redondez de los botones, inputs y tarjetas.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              { id: "none" as const, label: "Rectos / Cuadrados", cardRadius: "0px",  previewRadius: "0px"   },
              { id: "md"   as const, label: "Redondeados",         cardRadius: "10px", previewRadius: "10px"  },
              { id: "full" as const, label: "Curvos / Orgánicos",  cardRadius: "18px", previewRadius: "999px" },
            ] as const
          ).map((option) => {
            const isActive = settings.borderRadius === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange({ borderRadius: option.id })}
                className="p-4 border text-left transition-all hover:shadow-sm"
                style={{
                  borderRadius: option.cardRadius,
                  ...(isActive
                    ? { borderColor: settings.primaryColor, borderWidth: "2px" }
                    : { borderColor: "var(--color-border)" }),
                }}
              >
                <p
                  className="text-sm font-bold mb-4"
                  style={{ color: isActive ? settings.primaryColor : "var(--color-navy)" }}
                >
                  {option.label}
                </p>
                <div
                  className="w-full py-3 bg-slate-100 text-center text-xs text-slate-400"
                  style={{ borderRadius: option.previewRadius }}
                >
                  Vista previa
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-6">
        <div>
          <Label className="text-base font-bold text-navy">Tipografía del Sistema</Label>
          <p className="text-xs text-slate2 mt-0.5">Seleccioná una tipografía segura para maximizar la legibilidad.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(["Inter", "Roboto", "Montserrat"] as const).map((font) => {
            const isActive = settings.fontFamily === font;
            return (
              <button
                key={font}
                type="button"
                onClick={() => onChange({ fontFamily: font })}
                className="p-3 border text-left transition-all rounded-md hover:shadow-sm"
                style={
                  isActive
                    ? { borderColor: settings.primaryColor, borderWidth: "2px" }
                    : { borderColor: "var(--color-border)" }
                }
              >
                <p
                  className="text-sm font-bold mb-2"
                  style={{
                    fontFamily: font,
                    color: isActive ? settings.primaryColor : "var(--color-navy)",
                  }}
                >
                  {font}
                </p>
                <p
                  className="text-xs text-slate2 leading-relaxed"
                  style={{ fontFamily: font }}
                >
                  El veloz murciélago hindú comía feliz cardillo y kiwi.
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-6">
        <Label className="text-base font-bold text-navy">Marca del panel</Label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: "default" as const, label: "Nodo Clínica" },
              { id: "text" as const, label: "Texto personalizado" },
            ] as const
          ).map((option) => {
            const isActive = settings.logoType === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange({ logoType: option.id })}
                className={`p-3 border text-center text-sm font-semibold rounded-md transition-all ${
                  isActive ? "" : "border-border hover:bg-paper text-slate2"
                }`}
                style={
                  isActive
                    ? {
                        borderColor: settings.primaryColor,
                        backgroundColor: settings.primaryColor + "14",
                        color: settings.primaryColor,
                      }
                    : undefined
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {settings.logoType === "text" && (
          <div className="space-y-2 bg-paper p-4 rounded-md border border-border mt-3">
            <Label htmlFor="brandText">Texto de la marca</Label>
            <Input
              id="brandText"
              placeholder="Ej. Juan Mendía"
              value={settings.brandText}
              onChange={(e) => onChange({ brandText: e.target.value })}
            />
            <p className="text-[11px] text-slate2">
              La última palabra se muestra con el color primario (como &quot;clínica&quot; en Nodo Clínica).
            </p>
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
