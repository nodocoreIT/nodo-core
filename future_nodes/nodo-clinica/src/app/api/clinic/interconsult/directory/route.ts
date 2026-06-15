import { NextRequest, NextResponse } from "next/server";
import {
  readDb,
  ONLINE_THRESHOLD_MS,
  publicDoctorSummary,
} from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { ECOSYSTEM_PRO_CONTACTS } from "@/lib/nodo-chat/ecosystem-directory";
import { isProPlan } from "@/lib/nodo-chat/is-pro-plan";
import type { NodoChatContact } from "@/lib/nodo-chat/types";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = await readDb();
  const me = db.doctors.find((d) => d.id === session.userId);
  if (!me || !isProPlan(me.subscriptionPlan)) {
    return NextResponse.json(
      { error: "Chat interno disponible solo en Plan Pro" },
      { status: 403 },
    );
  }

  const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const now = Date.now();

  const localContacts: NodoChatContact[] = db.doctors
    .filter((d) => d.id !== session.userId && isProPlan(d.subscriptionPlan))
    .map((d) => {
      const presence = db.doctorPresence?.[d.id];
      const lastSeen = presence?.lastSeen
        ? new Date(presence.lastSeen).getTime()
        : 0;
      return {
        id: d.id,
        fullName: d.fullName,
        role: "Médico",
        nodeSlug: "salud" as const,
        nodeLabel: "Nodo Salud",
        plan: "pro" as const,
        specialty: d.specialty,
        online: now - lastSeen < ONLINE_THRESHOLD_MS,
        lastSeen: presence?.lastSeen ?? null,
      };
    });

  const externalContacts: NodoChatContact[] = ECOSYSTEM_PRO_CONTACTS.map(
    (c) => ({
      ...c,
      online: false,
      lastSeen: null,
    }),
  );

  let contacts = [...localContacts, ...externalContacts];

  if (q) {
    contacts = contacts.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        c.nodeLabel.toLowerCase().includes(q) ||
        (c.specialty?.toLowerCase().includes(q) ?? false),
    );
  }

  contacts.sort((a, b) => Number(b.online) - Number(a.online));

  return NextResponse.json({ contacts, currentPlan: me.subscriptionPlan });
}
