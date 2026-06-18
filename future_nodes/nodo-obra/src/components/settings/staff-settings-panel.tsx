"use client";

import { useEffect, useState } from "react";
import { Loader2, Palette, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeSettingsPanel } from "@/components/settings/theme-settings-panel";
import { useThemeSettings } from "@/hooks/use-theme-settings";
import { obraApi } from "@/lib/obra/client-api";

export function StaffSettingsPanel() {
  const { settings, setSettings, resetSettings } = useThemeSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    obraApi
      .getStaffProfile()
      .then((data) => {
        setFullName(String(data.user.fullName ?? ""));
        setEmail(String(data.user.email ?? ""));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    if (newPassword && newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden");
      setSaving(false);
      return;
    }

    try {
      await obraApi.updateStaffProfile({
        fullName,
        email,
        currentPassword: newPassword ? currentPassword : undefined,
        newPassword: newPassword || undefined,
      });
      setMessage("Perfil actualizado correctamente.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-navy">
          Configuración
        </h2>
        <p className="mt-1 text-sm text-slate2">
          Tu cuenta y la apariencia del panel.
        </p>
      </div>

      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="perfil" className="gap-2 text-xs sm:text-sm">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="apariencia" className="gap-2 text-xs sm:text-sm">
            <Palette className="h-4 w-4" />
            Apariencia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="mt-4">
          <form
            onSubmit={handleSaveProfile}
            className="space-y-4 rounded-md border border-mist bg-white p-6 shadow-sm"
          >
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email de acceso</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="border-t border-mist pt-4">
              <p className="mb-3 text-sm font-semibold text-navy">
                Cambiar contraseña
              </p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Contraseña actual</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nueva contraseña</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar nueva</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-slate2">
                Dejá en blanco si no querés cambiar la contraseña.
              </p>
            </div>

            {message && <p className="text-sm text-green-700">{message}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar perfil"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="apariencia" className="mt-4">
          <div className="rounded-md border border-mist bg-white p-6 shadow-sm">
            <ThemeSettingsPanel
              settings={settings}
              onChange={setSettings}
              onReset={resetSettings}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
