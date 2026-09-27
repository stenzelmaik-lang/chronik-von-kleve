import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const enc = new TextEncoder();
const PASSWORD_HASH_ITERATIONS = 600_000;
const DUMMY_PASSWORD_HASH = "pbkdf2_sha256$600000$chroniplay-dummy-salt-v1$QmIS9EPMvsR2dQ1PXZB18iYExn2LTzqJ9IijznzI2DM";
const bytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const b64 = (v: Uint8Array) => btoa(String.fromCharCode(...v)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function hashPassword(password: string, salt = b64(bytes(16))) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  let digest: Uint8Array;
  try {
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: PASSWORD_HASH_ITERATIONS, hash: "SHA-256" }, key, 256);
    digest = new Uint8Array(bits);
  } catch (error) {
    // Cloudflare's deployed WebCrypto still caps PBKDF2 at 100k, although
    // local workerd does not. Preserve the exact 600k algorithm and stored
    // hash format; do not reduce iterations or reset existing passwords.
    if (!(error instanceof Error) || error.name !== "NotSupportedError" ||
        !error.message.includes("iteration counts above 100000 are not supported")) throw error;
    digest = await pbkdf2Async(sha256, enc.encode(password), enc.encode(salt), {
      c: PASSWORD_HASH_ITERATIONS, dkLen: 32, asyncTick: 10,
    });
  }
  return `pbkdf2_sha256$${PASSWORD_HASH_ITERATIONS}$${salt}$${b64(digest)}`;
}

export async function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256" || parts[1] !== String(PASSWORD_HASH_ITERATIONS) || !parts[2] || !/^[A-Za-z0-9_-]{43}$/.test(parts[3])) return false;
  const actual = await hashPassword(password, parts[2]);
  const actualDigest = actual.slice(actual.lastIndexOf("$") + 1);
  let diff = actualDigest.length ^ parts[3].length;
  for (let i = 0; i < 43; i++) diff |= actualDigest.charCodeAt(i) ^ parts[3].charCodeAt(i);
  return diff === 0;
}

export { DUMMY_PASSWORD_HASH };
