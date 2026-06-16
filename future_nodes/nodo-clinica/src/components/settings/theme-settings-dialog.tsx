"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ThemeSettingsPanel } from "@/components/settings/theme-settings-panel";
import { useThemeSettings } from "@/hooks/use-theme-settings";

interface ThemeSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** @deprecated Usar /medico/configuracion pestaña Apariencia */
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
            Personalización del panel
          </DialogTitle>
          <DialogDescription>
            Preferí Configuración (⚙) para guardar en tu consultorio.
          </DialogDescription>
        </DialogHeader>
        <ThemeSettingsPanel
          settings={settings}
          onChange={(patch) => setSettings(patch)}
          onReset={resetSettings}
        />
        <Button
          type="button"
          className="w-full bg-brand hover:bg-brand-600 text-white"
          onClick={() => onOpenChange(false)}
        >
          Cerrar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
