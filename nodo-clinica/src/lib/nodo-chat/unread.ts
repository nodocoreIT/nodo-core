import type { InterconsultMessage } from "@/lib/clinic/local-db";

export interface NodoChatUnreadPreview {
  id: string;
  fromDoctorId: string;
  fromDoctorName: string;
  toDoctorId: string | null;
  content: string;
  createdAt: string;
}

/** Mensajes entrantes visibles para el médico (sala general + DM). */
export function isIncomingMessage(
  message: InterconsultMessage,
  doctorId: string,
): boolean {
  if (message.fromDoctorId === doctorId) return false;
  if (message.toDoctorId === null) return true;
  return message.toDoctorId === doctorId;
}

export function getUnreadMessages(
  messages: InterconsultMessage[],
  doctorId: string,
  lastReadAt: string | null | undefined,
): InterconsultMessage[] {
  const since = lastReadAt ? new Date(lastReadAt).getTime() : 0;
  return messages.filter(
    (m) =>
      isIncomingMessage(m, doctorId) &&
      new Date(m.createdAt).getTime() > since,
  );
}

export function countUnreadMessages(
  messages: InterconsultMessage[],
  doctorId: string,
  lastReadAt: string | null | undefined,
): number {
  return getUnreadMessages(messages, doctorId, lastReadAt).length;
}
