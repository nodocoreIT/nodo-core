import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isMailConfigured, sendClinicVerificationEmail } from "@/lib/mail";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email, role } = body as { email?: string; role?: string };

    if (!email || !role) {
      return NextResponse.json(
        { error: "Se requieren email y rol." },
        { status: 400 },
      );
    }

    if (role !== "medico" && role !== "paciente") {
      return NextResponse.json(
        { error: "Rol inválido. Debe ser 'medico' o 'paciente'." },
        { status: 400 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceClient = (await createServiceClient()) as any;

    // Insert pending registration row. The unique partial index on (email, role)
    // WHERE verified_at IS NULL prevents duplicate pending rows.
    const { data: row, error: insertError } = await serviceClient
      .from("pending_clinic_registrations")
      .insert({ email: email.toLowerCase().trim(), role })
      .select("token")
      .single();

    if (insertError) {
      // Postgres unique constraint violation
      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            error:
              "Ya hay una verificación pendiente para este email. Revisá tu correo o esperá 24 horas.",
          },
          { status: 409 },
        );
      }
      console.error("[register] DB insert error", insertError);
      return NextResponse.json(
        { error: "Error al procesar el registro." },
        { status: 500 },
      );
    }

    const token = (row as { token: string }).token;
    const origin =
      request.headers.get("origin") ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      "";

    if (!isMailConfigured()) {
      // Dev mode: log the verification URL so developers can test without SMTP
      const verificationUrl = `${origin}/api/clinic/account/verify?token=${token}&role=${role}`;
      console.warn(
        "[register] SMTP not configured — verification URL (dev only):",
        verificationUrl,
      );
    } else {
      await sendClinicVerificationEmail({
        email: email.toLowerCase().trim(),
        role: role as "medico" | "paciente",
        token,
        origin,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Error al registrar. Reintentá.",
      },
      { status: 500 },
    );
  }
}
