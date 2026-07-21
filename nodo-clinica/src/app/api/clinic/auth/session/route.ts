import { NextRequest } from "next/server";
import { clearSessionResponse, getSessionFromRequest } from "@/lib/clinic/session";
import { readDb, publicPatient } from "@/lib/clinic/local-db";

export async function POST() {
  return clearSessionResponse();
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return Response.json({ session: null });
  }

  const db = await readDb();

  if (session.role === "doctor") {
    const doctor = db.doctors.find((d) => d.id === session.userId);
    if (!doctor) return Response.json({ session: null });
    // Slim payload: no base64 photos/signatures (they bloated Cobros session loads).
    return Response.json({
      session,
      user: {
        id: doctor.id,
        fullName: doctor.fullName,
        email: doctor.email,
        specialty: doctor.specialty,
        specialties: doctor.specialties,
        licenseNumber: doctor.licenseNumber,
        subscriptionPlan: doctor.subscriptionPlan,
        subscriptionStatus: doctor.subscriptionStatus,
        role: "doctor" as const,
      },
    });
  }

  const patient = db.patients.find((p) => p.id === session.userId);
  if (!patient) return Response.json({ session: null });
  return Response.json({
    session,
    user: publicPatient(patient),
  });
}
