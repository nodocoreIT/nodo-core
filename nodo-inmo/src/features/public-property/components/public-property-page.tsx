import { useParams } from "react-router-dom";
import { PublicPropertyView } from "./public-property-view";
import { usePublicProperty } from "../hooks/use-public-property";

export function PublicPropertyPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError } = usePublicProperty(token);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-slate2">Cargando propiedad…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-4 text-center">
        <p className="text-lg font-semibold text-foreground">Propiedad no disponible</p>
        <p className="text-sm text-slate2">El enlace puede haber expirado o la publicación ya no está activa.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicPropertyView property={data} />
    </div>
  );
}
