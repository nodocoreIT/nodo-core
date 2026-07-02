import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const PREFIX = "scrypt$";
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 64, SCRYPT_OPTS).toString("hex");
  return `${PREFIX}${salt}$${hash}`;
}

export function isPasswordHashed(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!stored) return false;
  if (isPasswordHashed(stored)) {
    const parts = stored.split("$");
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const expectedHex = parts[2];
    const computed = scryptSync(plain, salt, 64, SCRYPT_OPTS);
    const expected = Buffer.from(expectedHex, "hex");
    if (computed.length !== expected.length) return false;
    return timingSafeEqual(computed, expected);
  }
  return stored === plain;
}
