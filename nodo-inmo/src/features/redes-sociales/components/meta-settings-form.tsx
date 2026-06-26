import { useState } from "react";
import { Button, Input, Label } from "@nodocore/shared-components";
import { useUpsertOrgProfile } from "@/features/agency-profile/hooks/use-upsert-org-profile";
import { useMetaSettings } from "../hooks/use-meta-settings";

export function MetaSettingsForm() {
  const existing = useMetaSettings();
  const upsert = useUpsertOrgProfile();

  const [instagramAccountId, setInstagramAccountId] = useState(
    existing?.instagram_account_id ?? "",
  );
  const [facebookPageId, setFacebookPageId] = useState(
    existing?.facebook_page_id ?? "",
  );
  const [accessToken, setAccessToken] = useState(
    existing?.access_token ?? "",
  );
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setSaveError(null);
    try {
      await upsert.mutateAsync({
        meta_settings: {
          instagram_account_id: instagramAccountId.trim(),
          facebook_page_id: facebookPageId.trim(),
          access_token: accessToken.trim(),
        },
      });
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h3 className="text-base font-bold text-navy">Credenciales de Meta</h3>
        <p className="text-xs text-slate2">
          Configurá las credenciales para publicar propiedades en Instagram y Facebook.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="instagram-account-id">Instagram Business Account ID</Label>
          <Input
            id="instagram-account-id"
            placeholder="Ej. 17841400000000000"
            value={instagramAccountId}
            onChange={(e) => setInstagramAccountId(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="facebook-page-id">Facebook Page ID</Label>
          <Input
            id="facebook-page-id"
            placeholder="Ej. 100000000000000"
            value={facebookPageId}
            onChange={(e) => setFacebookPageId(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="access-token">Page Access Token</Label>
          <Input
            id="access-token"
            type="password"
            placeholder="EAAxxxxxxxxxx..."
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
          />
          <p className="text-xs text-amber-600">
            El token expira en 60 días. Renovalo manualmente desde la consola de Meta.
          </p>
        </div>

        {saved && (
          <p className="text-sm text-green-600 font-medium">
            Credenciales guardadas correctamente.
          </p>
        )}

        {saveError && (
          <p className="text-sm text-destructive">{saveError}</p>
        )}

        <Button type="submit" disabled={upsert.isPending}>
          {upsert.isPending ? "Guardando..." : "Guardar"}
        </Button>
      </form>
    </div>
  );
}
