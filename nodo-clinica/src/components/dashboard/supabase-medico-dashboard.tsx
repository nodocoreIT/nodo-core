import { DoctorDashboard } from "@/components/dashboard/doctor-dashboard";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/clinic/session";
import { redirect } from "next/navigation";

export async function SupabaseMedicoDashboard({
  embedded = false,
}: {
  embedded?: boolean;
} = {}) {
  const serviceClient = await createServiceClient();

  // Primary: ClinicSession cookie (set by platform-sync or login route via
  // response.cookies.set — more reliable than Supabase auth cookie in SSR).
  const clinicSession = await getSession();
  if (clinicSession?.role === "doctor") {
    // getSession() runs validateSessionUser(), which normalises userId to
    // professionals.id regardless of whether it was platform-sync or clinic login.
    const { data: professional } = await serviceClient
      .from("professionals")
      .select("id, full_name, specialty, license_number")
      .eq("id", clinicSession.userId)
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

  // Fallback: Supabase auth session (available when the browser client sets
  // the auth cookie, e.g. via @supabase/ssr createBrowserClient).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
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
