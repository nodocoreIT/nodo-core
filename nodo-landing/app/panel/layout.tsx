import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelChrome } from "@/components/panel/PanelChrome";
import { PanelProviders } from "@/components/panel/PanelProviders";

export const metadata = {
  title: "Nodo | Dashboard",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function getAvatarColor(email: string): string {
  const colors = [
    "#2A6FDB", "#1F8A5B", "#DA5A0E", "#7C3AED", "#DB2777", "#0891B2",
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const email = user.email ?? "";
  const fullName =
    profile?.full_name ?? user.user_metadata?.full_name ?? email.split("@")[0] ?? "Usuario";
  const avatarUrl = profile?.avatar_url ?? null;
  const initials = getInitials(fullName);
  const color = profile?.color ?? getAvatarColor(email);

  return (
    <PanelProviders>
      <PanelChrome
        sidebarProps={{
          userFullName: fullName,
          userEmail: email,
          userInitials: initials,
          userColor: color,
          userAvatarUrl: avatarUrl,
        }}
      >
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </PanelChrome>
    </PanelProviders>
  );
}
