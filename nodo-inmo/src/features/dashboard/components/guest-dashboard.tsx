import { Building2 } from "lucide-react";
import { useAuth } from "@nodocore/shared-components";
import { useMyOrgs } from "@nodocore/nodo-modules";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";

function greetingName(user: ReturnType<typeof useAuth>["user"]): string {
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  if (fullName) return fullName.split(" ")[0];
  const email = user?.email ?? "";
  return email.split("@")[0] || "Usuario";
}

export function GuestDashboard() {
  const { user, orgId } = useAuth();
  const { orgs } = useMyOrgs();
  const { data: profile } = useOrgProfile();

  const theme = profile?.theme_settings as Record<string, string> | null;
  const primaryColor = theme?.primaryColor ?? "#da5a0e";
  const secondaryColor = theme?.secondaryColor ?? "#121e2f";
  const currentOrg = orgs.find((o) => o.org_id === orgId);
  const orgName = currentOrg?.org_name || "la inmobiliaria";

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-16">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-2xl"
        style={{ backgroundColor: primaryColor }}
      >
        <Building2 className="h-10 w-10 text-white" />
      </div>

      <div className="max-w-md text-center">
        <h1
          className="text-2xl font-bold"
          style={{ color: secondaryColor }}
        >
          Hola, {greetingName(user)}
        </h1>
        <p className="mt-3 text-base text-slate2">
          Estás trabajando en la inmobiliaria de{" "}
          <span className="font-semibold" style={{ color: primaryColor }}>
            {orgName}
          </span>
        </p>
      </div>

      <div
        className="h-1 w-16 rounded-full"
        style={{ backgroundColor: primaryColor, opacity: 0.3 }}
      />

      <p className="max-w-sm text-center text-sm text-slate2">
        Usá el menú lateral para acceder a las secciones que te fueron asignadas.
      </p>
    </div>
  );
}
