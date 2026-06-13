import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/panel/Sidebar";

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
  // Guard: redirect to login if no Supabase config or no session
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

  const [
    { count: taskCount },
    { count: clientCount },
    { count: teamCount },
    { count: expenseCount },
    { count: ideaCount },
    { data: profile },
  ] = await Promise.all([
    supabase.from("tasks").select("*", { count: "exact", head: true }),
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("expenses").select("*", { count: "exact", head: true }),
    supabase.from("ideas").select("*", { count: "exact", head: true }),
    // select("*") stays column-agnostic so it works before/after the
    // avatar_url column is added (see settings setup SQL).
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
  ]);

  const email = user.email ?? "";
  const fullName =
    profile?.full_name ?? user.user_metadata?.full_name ?? email.split("@")[0] ?? "Usuario";
  const role = profile?.role ?? "dev";
  const avatarUrl = profile?.avatar_url ?? null;
  const initials = getInitials(fullName);
  // Prefer the persisted profile color; fall back to a deterministic one.
  const color = profile?.color ?? getAvatarColor(email);

  return (
    <div
      className="panel-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "256px 1fr",
        height: "100vh",
      }}
    >
      <Sidebar
        userId={user.id}
        userFullName={fullName}
        userEmail={email}
        userInitials={initials}
        userColor={color}
        userRole={role}
        userAvatarUrl={avatarUrl}
        taskCount={taskCount ?? 0}
        clientCount={clientCount ?? 0}
        teamCount={teamCount ?? 0}
        expenseCount={expenseCount ?? 0}
        ideaCount={ideaCount ?? 0}
      />
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {children}
      </main>
    </div>
  );
}
