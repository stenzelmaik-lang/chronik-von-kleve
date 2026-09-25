import assert from "node:assert/strict";
import test from "node:test";
import {
  activatePlayerDataScope,
  clearPlayerDataScope,
  invalidatePlayerData,
  readPlayerData,
  requestPlayerData,
  storePlayerData,
} from "../app/spielbereich/modules/player-data-cache.ts";

test("player cache is isolated by identity and campaign scope", () => {
  const first = "campaign:player-a:player";
  const second = "campaign:player-b:player";
  storePlayerData(first, "/api/private", { marker: "A" });
  assert.equal(readPlayerData(first, "/api/private").value.marker, "A");
  activatePlayerDataScope(second);
  assert.equal(readPlayerData(first, "/api/private"), undefined);
  assert.equal(readPlayerData(second, "/api/private"), undefined);
  clearPlayerDataScope(second);
});

test("identical in-flight requests are combined and cached", async () => {
  const scope = "campaign:dedupe:player";
  activatePlayerDataScope(scope);
  let calls = 0;
  let release;
  const loader = () => {
    calls += 1;
    return new Promise((resolve) => { release = () => resolve({ result: 7 }); });
  };
  const first = requestPlayerData(scope, "/api/records?kind=charaktere", loader);
  const second = requestPlayerData(scope, "/api/records?kind=charaktere", loader);
  assert.equal(calls, 1);
  release();
  assert.deepEqual(await Promise.all([first, second]), [{ result: 7 }, { result: 7 }]);
  assert.deepEqual(readPlayerData(scope, "/api/records?kind=charaktere").value, { result: 7 });
  clearPlayerDataScope(scope);
});

test("expired entries remain readable but are marked stale", () => {
  const scope = "campaign:expiry:gm";
  const originalNow = Date.now;
  let now = 1_000;
  Date.now = () => now;
  try {
    storePlayerData(scope, "/api/dashboard", { safe: true });
    assert.equal(readPlayerData(scope, "/api/dashboard").fresh, true);
    now += 30_001;
    assert.equal(readPlayerData(scope, "/api/dashboard").fresh, false);
  } finally {
    Date.now = originalNow;
    clearPlayerDataScope(scope);
  }
});

test("invalidation prevents an older response from repopulating cache", async () => {
  const scope = "campaign:race:player";
  activatePlayerDataScope(scope);
  let release;
  const pending = requestPlayerData(scope, "/api/inventory?characterId=c1", () =>
    new Promise((resolve) => { release = () => resolve({ old: true }); }),
  );
  invalidatePlayerData(scope, "/api/inventory");
  release();
  await pending;
  assert.equal(readPlayerData(scope, "/api/inventory?characterId=c1"), undefined);
  clearPlayerDataScope(scope);
});

test("permission failures purge protected cached data", async () => {
  const scope = "campaign:permission:player";
  storePlayerData(scope, "/api/character-detail?id=c1", { private: true });
  await assert.rejects(
    requestPlayerData(scope, "/api/inventory", async () => {
      throw Object.assign(new Error("denied"), { status: 403 });
    }),
    /denied/,
  );
  assert.equal(readPlayerData(scope, "/api/character-detail?id=c1"), undefined);
});
