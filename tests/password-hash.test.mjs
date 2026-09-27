import assert from "node:assert/strict";
import test from "node:test";
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
