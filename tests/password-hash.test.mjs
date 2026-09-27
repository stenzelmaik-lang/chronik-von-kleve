import assert from "node:assert/strict";
import test from "node:test";
import { pbkdf2Sync } from "node:crypto";
import { hashPassword, verifyPassword } from "../server/password-hash.ts";

test("password hashes use 600,000 PBKDF2-SHA256 iterations", async () => {
  const stored = await hashPassword("synthetic-alpha-password", "unit-test-salt");
  assert.match(stored, /^pbkdf2_sha256\$600000\$unit-test-salt\$/);
  assert.equal(await verifyPassword("synthetic-alpha-password", stored), true);
  assert.equal(await verifyPassword("wrong-password", stored), false);
});

test("unsupported and malformed password hashes fail closed", async () => {
  assert.equal(await verifyPassword("synthetic-alpha-password", "pbkdf2_sha256$120000$salt$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"), false);
  assert.equal(await verifyPassword("synthetic-alpha-password", "pbkdf2_sha256$600000$salt$bad"), false);
  assert.equal(await verifyPassword("synthetic-alpha-password", null), false);
});


test("deployed Cloudflare iteration cap uses the same 600k digest as independent Node crypto", async (t) => {
  const password = "synthetic-unicode-password-\u00e4-\u{1f319}";
  const salt = "synthetic-edge-salt";
  const expected = `pbkdf2_sha256$600000$${salt}$${pbkdf2Sync(password, salt, 600000, 32, "sha256").toString("base64url")}`;
  t.mock.method(crypto.subtle, "deriveBits", async () => {
    throw new DOMException("Pbkdf2 failed: iteration counts above 100000 are not supported (requested 600000).", "NotSupportedError");
  });
  assert.equal(await hashPassword(password, salt), expected);
  assert.equal(await verifyPassword(password, expected), true);
  assert.equal(await verifyPassword("wrong-password", expected), false);
});

test("unrelated crypto errors are not silently converted to another verification path", async (t) => {
  t.mock.method(crypto.subtle, "deriveBits", async () => { throw new DOMException("unrelated failure", "OperationError"); });
  await assert.rejects(hashPassword("synthetic-password", "synthetic-salt"), { name: "OperationError" });
});
