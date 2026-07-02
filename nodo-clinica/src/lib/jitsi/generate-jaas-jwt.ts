import { createPrivateKey } from "crypto";
import { SignJWT } from "jose";
import { randomUUID } from "crypto";
import {
  getJaasAppId,
  getJaasPrivateKeyPem,
  jaasRoomName,
} from "@/lib/jitsi/jaas-config";

export async function generateJaasJwt(opts: {
  room: string;
  displayName: string;
  email?: string;
  userId?: string;
  moderator?: boolean;
}): Promise<{ jwt: string; roomName: string; domain: string }> {
  const appId = getJaasAppId();
  const kid = process.env.JAAS_API_KEY_ID?.trim();
  const privateKeyPem = getJaasPrivateKeyPem();

  if (!appId || !kid || !privateKeyPem) {
    throw new Error("JaaS no configurado (JAAS_APP_ID, JAAS_API_KEY_ID, JAAS_PRIVATE_KEY)");
  }

  const privateKey = createPrivateKey({ key: privateKeyPem, format: "pem" });
  const now = Math.floor(Date.now() / 1000);
  const roomName = jaasRoomName(appId, opts.room);
  const userId = opts.userId ?? randomUUID();

  const jwt = await new SignJWT({
    aud: "jitsi",
    iss: "chat",
    sub: appId,
    room: opts.room,
    context: {
      user: {
        id: userId,
        name: opts.displayName,
        email: opts.email ?? "",
        avatar: "",
        moderator: opts.moderator ? "true" : "false",
      },
      features: {
        livestreaming: "false",
        recording: "false",
        transcription: "false",
        "outbound-call": "false",
      },
    },
  })
    .setProtectedHeader({ alg: "RS256", kid, typ: "JWT" })
    .setIssuedAt(now)
    .setNotBefore(now - 10)
    .setExpirationTime(now + 60 * 60 * 3)
    .sign(privateKey);

  return { jwt, roomName, domain: "8x8.vc" };
}
