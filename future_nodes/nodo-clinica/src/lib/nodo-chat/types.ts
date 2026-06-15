export type NodoSlug = "salud" | "inmo" | "legal" | "contable" | "obra";

export interface NodoChatContact {
  id: string;
  fullName: string;
  role: string;
  nodeSlug: NodoSlug;
  nodeLabel: string;
  plan: "pro";
  specialty?: string;
  online: boolean;
  lastSeen?: string | null;
}

export interface NodoChatMessage {
  id: string;
  fromDoctorId: string;
  fromDoctorName: string;
  toDoctorId: string | null;
  content: string;
  createdAt: string;
}
