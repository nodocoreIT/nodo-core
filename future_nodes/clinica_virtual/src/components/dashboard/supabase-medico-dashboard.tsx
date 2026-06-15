import { DoctorDashboard } from "@/components/dashboard/doctor-dashboard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function SupabaseMedicoDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profile?.role === "doctor") {
      return (
        <DoctorDashboard
          doctorId={profile.id}
          doctorName={profile.full_name}
          doctorSpecialty={profile.specialty ?? undefined}
          doctorLicense={profile.license_number ?? undefined}
          dataSource="supabase"
        />
      );
    }
  }

  redirect("/login");
}
