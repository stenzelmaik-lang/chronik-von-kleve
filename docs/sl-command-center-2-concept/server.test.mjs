import test from "node:test";
import assert from "node:assert/strict";
// These tests require the concept server already running, not the application.
const origin = "http://127.0.0.1:8797";
test("concept is explicitly labelled and prevents outbound connections", async () => {
  const response = await fetch(origin);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy"), /connect-src 'none'/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(await response.text(), /ausschließlich synthetische Daten/);
});
test("application APIs and arbitrary source files are not available from the concept server", async () => {
  for (const path of ["/api/messages", "/api/character-engine", "/db/schema.ts", "/.env", "/..%2F..%2Fserver%2Faccess.ts"]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 404, path);
  }
});
test("concept has no mutation endpoint", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await fetch(origin, { method });
    assert.equal(response.status, 404, method);
  }
  assert.equal((await fetch(origin, { method: "HEAD" })).status, 200);
});
