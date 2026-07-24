import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { ALLOWED_MIME, MAX_FILE_BYTES } from "@/lib/clinic/storage";
import { markTransferReceiptPendingReview } from "@/lib/clinic/transfer-receipt-pending";
import { createPatientDocument } from "@/lib/clinic/db/clinical-records";
import { isLocalMode } from "@/lib/clinic/config";
import {
  handleDocumentsDeleteLocal,
  handleDocumentsGetLocal,
  handleDocumentsPostLocal,
} from "@/lib/clinic/documents-local";

const STORAGE_BUCKET = "patient-documents";

function mapDocument(doc: {
  id: string;
  patient_id: string;
  appointment_id: string;
  file_name: string;
  mime_type: string;
  uploaded_at: string;
  file_path: string;
  extra?: { doctorName?: string; scheduledAt?: string };
}) {
  return {
    id: doc.id,
    patientId: doc.patient_id,
    appointmentId: doc.appointment_id,
    fileName: doc.file_name,
    mimeType: doc.mime_type,
    uploadedAt: doc.uploaded_at,
    downloadUrl: `/api/clinic/documents?id=${doc.id}&download=1`,
    ...(doc.extra ?? {}),
  };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (isLocalMode()) {
    return handleDocumentsGetLocal(request);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const download = searchParams.get("download") === "1";
  const patientId = searchParams.get("patientId");
  const appointmentId = searchParams.get("appointmentId");
  const accessToken = searchParams.get("token");

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  // Download a single file by id
  if (id && download) {
    const { data: doc } = await supabase
      .from("patient_documents")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!doc) {
      return NextResponse.json(
        { error: "Archivo no encontrado" },
        { status: 404 },
      );
    }

    // Auth check: doctor must own appointment, patient must own document
    if (user.role === "admin" || user.role === "super_admin") {
      const { data: apt } = await supabase
        .from("appointments")
        .select("doctor_id")
        .eq("id", doc.appointment_id)
        .maybeSingle();
      const { data: professional } = await supabase
        .from("professionals")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!apt || !professional || apt.doctor_id !== professional.id) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    } else if (user.role === "patient") {
      const { data: patientRow } = await supabase
        .from("patients")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();
      if (!patientRow || patientRow.id !== doc.patient_id) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    // Generate signed URL from Supabase Storage (server-side)
    const serviceClient = await createServiceClient();
    const { data: signedUrl, error: signError } =
      await serviceClient.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(doc.file_path, 3600);

    if (signError || !signedUrl?.signedUrl) {
      return NextResponse.json(
        { error: "Archivo no disponible" },
        { status: 404 },
      );
    }

    // Redirect to signed URL
    return NextResponse.redirect(signedUrl.signedUrl);
  }

  // List documents
  let docsQuery = supabase
    .from("patient_documents")
    .select("*, appointments(scheduled_at, professionals!appointments_doctor_id_fkey(full_name))")
    .order("uploaded_at", { ascending: false });

  if (accessToken) {
    const { data: apt } = await supabase
      .from("appointments")
      .select("id")
      .eq("access_token", accessToken)
      .maybeSingle();
    if (!apt) {
      return NextResponse.json(
        { error: "Turno no encontrado" },
        { status: 404 },
      );
    }
    docsQuery = docsQuery.eq("appointment_id", apt.id);
  } else if (appointmentId) {
    docsQuery = docsQuery.eq("appointment_id", appointmentId);
  } else if (patientId) {
    docsQuery = docsQuery.eq("patient_id", patientId);
  } else {
    return NextResponse.json(
      { error: "Parámetro requerido" },
      { status: 400 },
    );
  }

  const { data: docs } = await docsQuery;

  const mapped = (docs ?? []).map((doc) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apt = (doc as any).appointments;
    return mapDocument({
      ...doc,
      extra: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        doctorName: apt?.professionals?.full_name,
        scheduledAt: apt?.scheduled_at,
      },
    });
  });

  return NextResponse.json(mapped);
}

// ── POST (upload) ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (isLocalMode()) {
    return handleDocumentsPostLocal(request);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const accessToken = formData.get("accessToken")?.toString();
  const appointmentIdParam = formData.get("appointmentId")?.toString();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return NextResponse.json(
      { error: "Formato no permitido (PDF, JPG, PNG)" },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "Archivo excede 10 MB" },
      { status: 400 },
    );
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  // Resolve the appointment
  let appointment: {
    id: string;
    patient_id: string;
    org_id: string;
    status: string;
    payment_status: string | null;
  } | null = null;

  if (accessToken) {
    const { data } = await supabase
      .from("appointments")
      .select("id, patient_id, org_id, status, payment_status")
      .eq("access_token", accessToken)
      .maybeSingle();
    appointment = data;
    if (!appointment) {
      return NextResponse.json(
        { error: "Turno no encontrado" },
        { status: 404 },
      );
    }
  } else if (appointmentIdParam) {
    const { data } = await supabase
      .from("appointments")
      .select("id, patient_id, org_id, status, payment_status")
      .eq("id", appointmentIdParam)
      .maybeSingle();

    if (data) {
      // Patient uploads: verify ownership
      if (user.role === "patient") {
        const { data: patientRow } = await supabase
          .from("patients")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();
        if (!patientRow || patientRow.id !== data.patient_id) {
          return NextResponse.json(
            { error: "No autorizado" },
            { status: 401 },
          );
        }
      }
      appointment = data;
    }
  }

  if (!appointment) {
    return NextResponse.json(
      { error: "Turno no encontrado" },
      { status: 404 },
    );
  }

  if (
    !["scheduled", "waiting", "in_consultation"].includes(appointment.status)
  ) {
    return NextResponse.json(
      { error: "No se pueden subir archivos a este turno" },
      { status: 400 },
    );
  }

  // Upload to Supabase Storage via service role (bypasses storage RLS for server-side uploads)
  const serviceClient = await createServiceClient();
  const storagePath = `${appointment.org_id}/${appointment.patient_id}/${Date.now()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await serviceClient.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Error al subir archivo: ${uploadError.message}` },
      { status: 500 },
    );
  }

  // Insert metadata row using the user's session client (RLS scoped)
  const { data: doc, error: insertError } = await createPatientDocument(
    supabase,
    {
      org_id: appointment.org_id,
      patient_id: appointment.patient_id,
      appointment_id: appointment.id,
      file_name: file.name,
      file_path: storagePath,
      mime_type: file.type,
    },
  );

  if (insertError || !doc) {
    // Attempt to clean up uploaded file
    await serviceClient.storage.from(STORAGE_BUCKET).remove([storagePath]);
    return NextResponse.json(
      { error: "Error al registrar documento" },
      { status: 500 },
    );
  }

  if (appointment.payment_status === "pending") {
    await markTransferReceiptPendingReview(appointment as never, {
      fileName: file.name,
    });
  }

  return NextResponse.json(
    mapDocument({
      id: doc.id,
      patient_id: doc.patient_id,
      appointment_id: doc.appointment_id,
      file_name: doc.file_name,
      mime_type: doc.mime_type,
      uploaded_at: doc.uploaded_at,
      file_path: doc.file_path,
    }),
  );
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  if (isLocalMode()) {
    return handleDocumentsDeleteLocal(request);
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  const { data: doc } = await supabase
    .from("patient_documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  if (user.role === "patient") {
    const { data: patientRow } = await supabase
      .from("patients")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!patientRow || patientRow.id !== doc.patient_id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  } else if (user.role === "admin" || user.role === "super_admin" || user.role === "doctor") {
    const { data: apt } = await supabase
      .from("appointments")
      .select("doctor_id")
      .eq("id", doc.appointment_id)
      .maybeSingle();
    const { data: professional } = await supabase
      .from("professionals")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!apt || !professional || apt.doctor_id !== professional.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const serviceClient = await createServiceClient();
  if (doc.file_path) {
    await serviceClient.storage.from(STORAGE_BUCKET).remove([doc.file_path]);
  }
  await supabase.from("patient_documents").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
