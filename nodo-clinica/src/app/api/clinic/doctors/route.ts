import { NextRequest, NextResponse } from "next/server";
import { readDb, publicDoctor, publicDoctorSummary } from "@/lib/clinic/local-db";

export const dynamic = "force-dynamic";

function isActiveDoctor(d: { subscriptionStatus?: string }) {
  return (
    !d.subscriptionStatus ||
    d.subscriptionStatus === "active" ||
    d.subscriptionStatus === "trial"
  );
}

export async function GET(request: NextRequest) {
  const doctorId = request.nextUrl.searchParams.get("doctorId");
  const db = await readDb();

  if (doctorId) {
    const doctor = db.doctors.find((d) => d.id === doctorId);
    if (!doctor || !isActiveDoctor(doctor)) {
      return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
    }
    return NextResponse.json(publicDoctorSummary(doctor));
  }

  const doctors = db.doctors
    .filter(isActiveDoctor)
    .map(publicDoctor);

  return NextResponse.json(doctors);
}
