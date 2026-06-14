import { NextResponse } from "next/server";
import { readDb, publicDoctor } from "@/lib/clinic/local-db";

export async function GET() {
  const db = await readDb();
  const doctors = db.doctors
    .filter((d) => d.subscriptionStatus === "active" || d.subscriptionStatus === "trial")
    .map(publicDoctor);

  return NextResponse.json(doctors);
}
