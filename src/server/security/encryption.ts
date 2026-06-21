// Envelope encryption for sensitive data at rest (e.g. TOTP secrets, OAuth
// tokens). AES-256-GCM with a key derived from ENCRYPTION_KEY. Ciphertext is
// stored as a self-describing string so we can rotate formats and decrypt
// mixed data:
//   enc:v1:<iv b64>:<authTag b64>:<ciphertext b64>   (encrypted)
//   plain:<value>                                     (dev fallback, no key set)
//
// In production ENCRYPTION_KEY MUST be set (ideally sourced from a KMS/secrets
// manager). Without it we fall back to a tagged plaintext so local dev and CI
// keep working, and warn once.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";
let warned = false;

function keyOrNull(): Uint8Array | null {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    if (!warned && process.env.NODE_ENV === "production") {
      // eslint-disable-next-line no-console
      console.warn("[security] ENCRYPTION_KEY not set — sensitive data is NOT encrypted at rest.");
      warned = true;
    }
    return null;
  }
  // Derive a stable 32-byte key from whatever string is provided.
  return new Uint8Array(scryptSync(secret, "landland-encryption-v1", 32));
}

/** Encrypt a UTF-8 string for storage. Returns a self-describing token. */
export function encryptSecret(plaintext: string): string {
  const key = keyOrNull();
  if (!key) return `plain:${plaintext}`;
  const iv = new Uint8Array(randomBytes(12));
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    new Uint8Array(cipher.update(plaintext, "utf8")),
    new Uint8Array(cipher.final()),
  ]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${Buffer.from(iv).toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/** Decrypt a value produced by encryptSecret (handles legacy plaintext too). */
export function decryptSecret(stored: string): string {
  if (stored.startsWith("plain:")) return stored.slice("plain:".length);
  if (!stored.startsWith("enc:v1:")) return stored; // legacy unencrypted value

  const key = keyOrNull();
  if (!key) throw new Error("ENCRYPTION_KEY is required to decrypt this value.");

  const [, , ivB64, tagB64, dataB64] = stored.split(":");
  const decipher = createDecipheriv(ALGO, key, new Uint8Array(Buffer.from(ivB64, "base64")));
  decipher.setAuthTag(new Uint8Array(Buffer.from(tagB64, "base64")));
  const out = Buffer.concat([
    new Uint8Array(decipher.update(new Uint8Array(Buffer.from(dataB64, "base64")))),
    new Uint8Array(decipher.final()),
  ]);
  return out.toString("utf8");
}

/** True when a value is stored encrypted (not the dev plaintext fallback). */
export function isEncrypted(stored: string): boolean {
  return stored.startsWith("enc:v1:");
}
