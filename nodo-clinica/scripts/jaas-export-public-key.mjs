/**
 * Exporta la clave pública PEM para subir en jaas.8x8.vc → API keys.
 * Uso: node scripts/jaas-export-public-key.mjs [ruta-a-jaasauth.key]
 */
import fs from "fs";
import path from "path";
import { createPrivateKey, createPublicKey } from "crypto";

const keyPath = path.resolve(
  process.cwd(),
  process.argv[2] ?? "jaasauth.key",
);

if (!fs.existsSync(keyPath)) {
  console.error(`No existe: ${keyPath}`);
  console.error("Generá una con: ssh-keygen -t rsa -b 4096 -m PEM -f jaasauth.key");
  process.exit(1);
}

const priv = fs.readFileSync(keyPath, "utf8");
const pub = createPublicKey(createPrivateKey(priv)).export({
  type: "spki",
  format: "pem",
});

const outPath = path.join(path.dirname(keyPath), "jaas-public-upload.pem");
fs.writeFileSync(outPath, pub);
console.log(`Clave pública guardada en: ${outPath}`);
console.log("Subí ese archivo en https://jaas.8x8.vc → API keys → Add API Key");
console.log("Luego copiá el Key ID (kid) completo a JAAS_API_KEY_ID en .env.local");
