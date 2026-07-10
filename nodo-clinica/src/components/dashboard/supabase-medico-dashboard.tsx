import { DoctorDashboard } from "@/components/dashboard/doctor-dashboard";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function SupabaseMedicoDashboard({
  embedded = false,
}: {
  embedded?: boolean;
} = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Use service client to bypass RLS — professionals may lack app_metadata.org_id
    // for clinic-registered doctors (not platform-synced).
    const serviceClient = await createServiceClient();
    const { data: professional } = await serviceClient
      .from("professionals")
      .select("id, full_name, specialty, license_number")
      .eq("user_id", user.id)
      .maybeSingle();

    if (professional) {
      return (
        <DoctorDashboard
          doctorId={professional.id}
          doctorName={professional.full_name}
          doctorSpecialty={professional.specialty ?? undefined}
          doctorLicense={professional.license_number ?? undefined}
          dataSource="supabase"
          embedded={embedded}
        />
      );
    }
  }

  redirect("/login");
}
