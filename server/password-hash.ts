const enc = new TextEncoder();
const PASSWORD_HASH_ITERATIONS = 600_000;
const DUMMY_PASSWORD_HASH = "pbkdf2_sha256$600000$chroniplay-dummy-salt-v1$QmIS9EPMvsR2dQ1PXZB18iYExn2LTzqJ9IijznzI2DM";
const bytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const b64 = (v: Uint8Array) => btoa(String.fromCharCode(...v)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function hashPassword(password: string, salt = b64(bytes(16))) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: PASSWORD_HASH_ITERATIONS, hash: "SHA-256" }, key, 256);
  return `pbkdf2_sha256$${PASSWORD_HASH_ITERATIONS}$${salt}$${b64(new Uint8Array(bits))}`;
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
