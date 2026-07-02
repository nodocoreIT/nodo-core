import { NextRequest, NextResponse } from "next/server";
import {
  readDb,
  writeDb,
  newId,
  type InterconsultMessage,
} from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { ECOSYSTEM_PRO_CONTACTS } from "@/lib/nodo-chat/ecosystem-directory";
import { isProPlan } from "@/lib/nodo-chat/is-pro-plan";

function filterMessages(
  messages: InterconsultMessage[],
  doctorId: string,
  peerId: string | null,
) {
  if (peerId) {
    return messages.filter(
      (m) =>
        (m.fromDoctorId === doctorId && m.toDoctorId === peerId) ||
        (m.fromDoctorId === peerId && m.toDoctorId === doctorId),
    );
  }
  return messages.filter((m) => m.toDoctorId === null);
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = await readDb();
  const me = db.doctors.find((d) => d.id === session.userId);
  if (!me || !isProPlan(me.subscriptionPlan)) {
    return NextResponse.json({ error: "Plan Pro requerido" }, { status: 403 });
  }

  const peerId = new URL(request.url).searchParams.get("peerId");
  const messages = filterMessages(
    db.interconsultMessages ?? [],
    session.userId,
    peerId,
  ).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const content = String(body.content ?? "").trim();
  const toDoctorId =
    body.toDoctorId === null || body.toDoctorId === undefined
      ? null
      : String(body.toDoctorId);

  if (!content) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  const dbCheck = await readDb();
  const mePost = dbCheck.doctors.find((d) => d.id === session.userId);
  if (!mePost || !isProPlan(mePost.subscriptionPlan)) {
    return NextResponse.json({ error: "Plan Pro requerido" }, { status: 403 });
  }

  if (toDoctorId) {
    const localPeer = dbCheck.doctors.find((d) => d.id === toDoctorId);
    const externalPeer = ECOSYSTEM_PRO_CONTACTS.find((c) => c.id === toDoctorId);
    if (!localPeer && !externalPeer) {
      return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
    }
  }

  const message: InterconsultMessage = {
    id: newId("ic"),
    fromDoctorId: session.userId,
    fromDoctorName: session.fullName,
    toDoctorId,
    content,
    createdAt: new Date().toISOString(),
  };

  await writeDb((db) => {
    if (!db.interconsultMessages) db.interconsultMessages = [];
    db.interconsultMessages.push(message);
    if (!db.doctorPresence) db.doctorPresence = {};
    db.doctorPresence[session.userId] = {
      doctorId: session.userId,
      lastSeen: new Date().toISOString(),
    };
  });

  return NextResponse.json({ message });
}
