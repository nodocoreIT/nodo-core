import { useState, useEffect } from "react";
import { Button } from "@nodocore/shared-components";
import { cn } from "@/shared/lib/utils";
import { useOrgProfile } from "@/features/store-profile/hooks/use-org-profile";
import { useUpdateTheme } from "@/features/store-builder/hooks/use-update-theme";
import { DEFAULT_SETTINGS, type ThemeSettings } from "@/shared/hooks/use-theme-settings";

const FONTS = ["Inter", "Roboto", "Montserrat"] as const;
type Font = (typeof FONTS)[number];

const BORDER_RADIUS_OPTIONS = [
  { value: "none", label: "Ninguno" },
  { value: "md", label: "Redondeado" },
  { value: "full", label: "Pill" },
] as const;

export function ThemeTab() {
  const { data: profile } = useOrgProfile();
  const updateTheme = useUpdateTheme();
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (profile?.theme_settings && typeof profile.theme_settings === "object") {
      setTheme({
        ...DEFAULT_SETTINGS,
        ...(profile.theme_settings as Partial<ThemeSettings>),
      });
    }
  }, [profile]);

  function setField<K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) {
    setTheme((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!profile?.id) return;
    await updateTheme.mutateAsync({ profileId: profile.id, theme });
  }

  const previewRadius =
    theme.borderRadius === "none"
      ? "rounded-none"
      : theme.borderRadius === "full"
        ? "rounded-full"
        : "rounded-lg";

  return (
    <div className="space-y-8 max-w-lg">
      {/* Colors */}
      <section className="space-y-4">
        <h3 className="font-semibold text-navy">Colores</h3>
        <div className="grid gap-4">
          <ColorField
            label="Color primario"
            value={theme.primaryColor}
            onChange={(v) => setField("primaryColor", v)}
          />
          <ColorField
            label="Color de sidebar"
            value={theme.secondaryColor}
            onChange={(v) => setField("secondaryColor", v)}
          />
        </div>
      </section>

      {/* Typography */}
      <section className="space-y-4">
        <h3 className="font-semibold text-navy">Tipografía</h3>
        <div className="flex gap-2 flex-wrap">
          {FONTS.map((font) => (
            <button
              key={font}
              onClick={() => setField("fontFamily", font as Font)}
              className={cn(
                "px-4 py-2 rounded-lg border text-sm font-medium transition",
                theme.fontFamily === font
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:border-brand/50",
              )}
              style={{ fontFamily: font }}
            >
              {font}
            </button>
          ))}
        </div>
      </section>

      {/* Border radius */}
      <section className="space-y-4">
        <h3 className="font-semibold text-navy">Bordes</h3>
        <div className="flex gap-2">
          {BORDER_RADIUS_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setField("borderRadius", value)}
              className={cn(
                "px-4 py-2 border text-sm font-medium transition",
                value === "none"
                  ? "rounded-none"
                  : value === "md"
                    ? "rounded-lg"
                    : "rounded-full",
                theme.borderRadius === value
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:border-brand/50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Preview */}
      <section className="space-y-4">
        <h3 className="font-semibold text-navy">Vista previa</h3>
        <div
          className="border border-border rounded-xl p-6 bg-white space-y-3"
          style={{ fontFamily: theme.fontFamily }}
        >
          <div
            className={cn(
              "h-10 flex items-center justify-center text-white text-sm font-semibold",
              previewRadius,
            )}
            style={{ backgroundColor: theme.primaryColor }}
          >
            Agregar al carrito
          </div>
          <p className="text-sm text-slate-600">
            Ejemplo de texto con la tipografía seleccionada.
          </p>
        </div>
      </section>

      <Button
        onClick={handleSave}
        disabled={updateTheme.isPending || !profile?.id}
        className="w-full sm:w-auto"
      >
        {updateTheme.isPending ? "Guardando..." : "Guardar apariencia"}
      </Button>
    </div>
  );
}

// ── Color field ────────────────────────────────────────────────────────────────

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-10 cursor-pointer rounded-lg border border-border p-0.5"
      />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-0.5 block w-32 rounded border border-border px-2 py-1 text-sm font-mono text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>
    </div>
  );
}
