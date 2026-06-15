import { NextRequest, NextResponse } from "next/server";
import { sendPrescriptionEmail } from "@/lib/email/resend";

export async function POST(request: NextRequest) {
  try {
    const { patientEmail, patientName, doctorName, pdfBase64 } =
      await request.json();

    if (!patientEmail || !pdfBase64) {
      return NextResponse.json(
        { error: "Email y PDF requeridos" },
        { status: 400 }
      );
    }

    const result = await sendPrescriptionEmail({
      patientEmail,
      patientName,
      doctorName,
      pdfBase64,
    });

    return NextResponse.json({ success: true, result });
  } catch {
    return NextResponse.json({ error: "Error al enviar email" }, { status: 500 });
  }
}
