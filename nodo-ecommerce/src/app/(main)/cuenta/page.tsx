import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./LogoutButton";

export default async function CuentaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const displayName = user.user_metadata?.full_name || user.email || "";

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <span className="text-gold font-serif text-2xl tracking-[0.15em] font-bold">
            MI CUENTA
          </span>
        </div>

        <div className="bg-luxury-black border border-luxury-gray p-8 space-y-6">
          <div>
            <p className="text-luxury-gray-light text-xs tracking-widest uppercase mb-1">Nombre</p>
            <p className="text-white text-sm">{displayName}</p>
          </div>

          <div>
            <p className="text-luxury-gray-light text-xs tracking-widest uppercase mb-1">Email</p>
            <p className="text-white text-sm">{user.email}</p>
          </div>

          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
