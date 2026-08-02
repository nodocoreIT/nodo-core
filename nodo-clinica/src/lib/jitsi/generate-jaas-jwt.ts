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
  const rawKeyId = process.env.JAAS_API_KEY_ID?.trim();
  const privateKeyPem = getJaasPrivateKeyPem();

  if (!appId || !rawKeyId || !privateKeyPem) {
    throw new Error("JaaS no configurado (JAAS_APP_ID, JAAS_API_KEY_ID, JAAS_PRIVATE_KEY)");
  }

  // JaaS valida que el prefijo del "kid" del header coincida con el "sub"
  // del payload (el appId) — el kid tiene que ser "{appId}/{apiKeyId}", no
  // el apiKeyId solo. Si la env var ya viene con el prefijo (como lo copia
  // el dashboard de 8x8), no lo duplicamos.
  const kid = rawKeyId.includes("/") ? rawKeyId : `${appId}/${rawKeyId}`;

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
    .setNotBefore(now - 60)
    .setExpirationTime(now + 60 * 60 * 3)
    .sign(privateKey);

  return { jwt, roomName, domain: "8x8.vc" };
}
