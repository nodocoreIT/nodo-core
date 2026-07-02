/** Configuración JaaS (8x8) — evita el límite de 5 min de meet.jit.si embebido. */

import fs from "fs";
import path from "path";

export function isJaasConfigured(): boolean {
  return !!(
    process.env.JAAS_APP_ID?.trim() &&
    process.env.JAAS_API_KEY_ID?.trim() &&
    getJaasPrivateKeyPem()
  );
}

export function getJaasAppId(): string | undefined {
  return process.env.JAAS_APP_ID?.trim() || process.env.NEXT_PUBLIC_JAAS_APP_ID?.trim();
}

function normalizeJaasPrivateKeyPem(raw: string): string {
  let pem = raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
  pem = pem.trim();
  if (!pem.includes("\n") && pem.includes("-----BEGIN")) {
    pem = pem
      .replace(/(-----BEGIN [^-]+-----)\s*/, "$1\n")
      .replace(/\s*(-----END [^-]+-----)/, "\n$1");
    const m = pem.match(/-----BEGIN [^-]+-----\n?([\s\S]+?)\n?-----END/);
    if (m?.[1]) {
      const body = m[1].replace(/\s+/g, "");
      const lines = body.match(/.{1,64}/g) ?? [body];
      pem = pem.replace(m[1], lines.join("\n"));
    }
  }
  return pem;
}

export function getJaasPrivateKeyPem(): string | undefined {
  const raw = process.env.JAAS_PRIVATE_KEY?.trim();
  if (raw) {
    return normalizeJaasPrivateKeyPem(raw);
  }
  const b64 = process.env.JAAS_PRIVATE_KEY_BASE64?.trim();
  if (b64) {
    return Buffer.from(b64, "base64").toString("utf8");
  }
  const keyPath = process.env.JAAS_PRIVATE_KEY_PATH?.trim();
  if (keyPath) {
    try {
      const resolved = path.isAbsolute(keyPath)
        ? keyPath
        : path.join(process.cwd(), keyPath);
      return fs.readFileSync(resolved, "utf8");
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function jaasRoomName(appId: string, room: string): string {
  const cleanRoom = room.replace(/^\/+/, "");
  if (cleanRoom.startsWith(`${appId}/`)) return cleanRoom;
  return `${appId}/${cleanRoom}`;
}

export function jaasExternalApiScriptUrl(appId: string): string {
  return `https://8x8.vc/${appId}/external_api.js`;
}

export const JITSI_PUBLIC_DOMAIN =
  process.env.NEXT_PUBLIC_JITSI_DOMAIN?.trim() || "meet.jit.si";

/** meet.jit.si corta iframes no autorizados a los 5 minutos (política 8x8 → JaaS). */
export function usesMeetJitSiFreeEmbed(): boolean {
  const domain = JITSI_PUBLIC_DOMAIN.replace(/^https?:\/\//, "");
  return domain === "meet.jit.si" && !isJaasConfigured();
}
