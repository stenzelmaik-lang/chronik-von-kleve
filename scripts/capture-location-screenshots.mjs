import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const edge =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const debugPort = await findFreePort();
const baseUrl = process.env.CVK_TEST_URL ?? "http://127.0.0.1:8794";
const outputDir = resolve("docs", "pre-alpha-v0.1.036", "screenshots");
mkdirSync(outputDir, { recursive: true });

const profileDir = join(tmpdir(), `cvk-edge-location-${Date.now()}`);
async function main() {
  const browser = spawn(edge, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ], {
    stdio: "ignore",
    windowsHide: true,
  });

  try {
    await waitForHttp(`${baseUrl}/`);
    await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`);
    await ensurePlayerIsReady();
    const version = await fetch(
      `http://127.0.0.1:${debugPort}/json/version`,
    ).then((response) => response.json());
    const cdp = await Cdp.connect(version.webSocketDebuggerUrl);
    await capture(cdp, {
      fileName: "world-hub-desktop.png",
      width: 1440,
      height: 1100,
      headers: playerHeaders(),
      path: "/spielbereich?bereich=schauplaetze",
      expectedText: ["Die Stadt bei Nacht", "Electric Taberna", "Testort Zwei"],
      forbiddenText: ["Keller & Service", "Getränkevorrat", "Büro", "SYNTHETIC_SECRET_ROOM", "SYNTHETIC_UNGRANTED_PLACE", "place.ungranted-secret", "6.22"],
      expectedMarkerCount: 1,
      waitForMap: true,
    });
    await capture(cdp, {
      fileName: "electric-taberna-player.png",
      width: 1440,
      height: 1100,
      headers: playerHeaders(),
      path: "/spielbereich?bereich=schauplaetze&ort=place.electric-taberna",
      expectedText: ["Electric Taberna"],
      forbiddenText: ["Keller & Service", "Getränkevorrat", "Büro"],
    });
    await capture(cdp, {
      fileName: "synthetic-place-player.png",
      width: 1440,
      height: 1100,
      headers: playerHeaders(),
      path: "/spielbereich?bereich=schauplaetze&ort=place.synthetic-night-market",
      expectedText: ["Testort Zwei"],
      forbiddenText: ["SYNTHETIC_SECRET_ROOM"],
    });
    await capture(cdp, {
      fileName: "world-hub-mobile.png",
      width: 390,
      height: 900,
      mobile: true,
      headers: playerHeaders(),
      path: "/spielbereich?bereich=schauplaetze",
      expectedText: ["Die Stadt bei Nacht", "Electric Taberna", "Testort Zwei"],
      forbiddenText: ["Keller & Service", "Getränkevorrat", "Büro", "SYNTHETIC_SECRET_ROOM", "SYNTHETIC_UNGRANTED_PLACE", "place.ungranted-secret", "6.22"],
      expectedMarkerCount: 1,
      waitForMap: true,
    });
    cdp.close();
    console.log(`Screenshots saved to ${outputDir}`);
  } finally {
    if (process.platform === "win32" && browser.pid) {
      spawnSync("taskkill", ["/PID", String(browser.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      browser.kill();
    }
    if (browser.exitCode === null) await once(browser, "exit").catch(() => {});
    try {
      rmSync(profileDir, { recursive: true, force: true });
    } catch {}
  }
}

async function findFreePort() {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a browser-debug port.");
  await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
  return address.port;
}

async function capture(cdp, options) {
  const { targetId } = await cdp.send("Target.createTarget", {
    url: "about:blank",
  });
  const { sessionId } = await cdp.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Network.enable", {}, sessionId);
  await cdp.send(
    "Network.setExtraHTTPHeaders",
    { headers: options.headers },
    sessionId,
  );
  await cdp.send(
    "Emulation.setDeviceMetricsOverride",
    {
      width: options.width,
      height: options.height,
      deviceScaleFactor: 1,
      mobile: options.mobile ?? false,
    },
    sessionId,
  );
  await cdp.send(
    "Page.navigate",
    { url: `${baseUrl}${options.path}` },
    sessionId,
  );
  for (const text of options.expectedText) await waitForText(cdp, sessionId, text);
  if (options.expectedMarkerCount !== undefined) await waitForMarkers(cdp, sessionId, options.expectedMarkerCount);
  const mapState = options.waitForMap ? await waitForMapTerminal(cdp, sessionId) : undefined;
  const result = await cdp.send(
    "Runtime.evaluate",
    {
      expression: `(() => {
        const text = document.body.innerText;
        const forbidden = ${JSON.stringify(options.forbiddenText ?? [])};
        const html = document.documentElement.outerHTML;
        return {
          title: document.title,
          hasForbiddenText: forbidden.some((item) => text.includes(item) || html.includes(item)),
          noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
          markerCount: document.querySelectorAll('.maplibregl-marker').length,
          visibleMarkerCount: [...document.querySelectorAll('.maplibregl-marker')].filter((node) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden').length,
          mapState: document.querySelector('[data-map-state]')?.getAttribute('data-map-state') ?? null
        };
      })()`,
      returnByValue: true,
    },
    sessionId,
  );
  if (result.result.value.hasForbiddenText) {
    throw new Error(`${options.fileName}: forbidden player text is visible`);
  }
  if (!result.result.value.noHorizontalOverflow) {
    throw new Error(`${options.fileName}: horizontal overflow detected`);
  }
  if (options.expectedMarkerCount !== undefined && result.result.value.markerCount !== options.expectedMarkerCount) {
    throw new Error(`${options.fileName}: expected ${options.expectedMarkerCount} marker(s), found ${result.result.value.markerCount}`);
  }
  if (result.result.value.mapState === "ready" && result.result.value.visibleMarkerCount !== options.expectedMarkerCount) {
    throw new Error(`${options.fileName}: the ready map does not visibly render every expected marker.`);
  }
  const screenshot = await cdp.send(
    "Page.captureScreenshot",
    { format: "png", captureBeyondViewport: true },
    sessionId,
  );
  writeFileSync(
    join(outputDir, options.fileName),
    Buffer.from(screenshot.data, "base64"),
  );
  if (mapState) console.log(`${options.fileName}: OpenFreeMap/MapLibre state=${mapState}`);
  await cdp.send("Target.closeTarget", { targetId });
}

async function waitForText(cdp, sessionId, text) {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    const result = await cdp.send(
      "Runtime.evaluate",
      {
        expression: `document.body && document.body.innerText.includes(${JSON.stringify(text)})`,
        returnByValue: true,
      },
      sessionId,
    );
    if (result.result.value) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${text}`);
}

async function waitForMarkers(cdp, sessionId, expectedCount) {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    const result = await cdp.send(
      "Runtime.evaluate",
      {
        expression: "document.querySelectorAll('.maplibregl-marker').length",
        returnByValue: true,
      },
      sessionId,
    );
    if (result.result.value === expectedCount) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for exactly ${expectedCount} visible map marker(s).`);
}

async function waitForMapTerminal(cdp, sessionId) {
  const started = Date.now();
  while (Date.now() - started < 20000) {
    const result = await cdp.send(
      "Runtime.evaluate",
      {
        expression: "document.querySelector('[data-map-state]')?.getAttribute('data-map-state') ?? null",
        returnByValue: true,
      },
      sessionId,
    );
    if (result.result.value === "ready" || result.result.value === "error") return result.result.value;
    await delay(250);
  }
  throw new Error("MapLibre did not reach a ready or fallback state within 20 seconds.");
}

async function ensurePlayerIsReady() {
  const migrated = await fetch(`${baseUrl}/api/locations/migrate`, {
    method: "POST",
    headers: { ...gmHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ placeId: "place.electric-taberna" }),
  });
  if (!migrated.ok) throw new Error(`Could not prepare the isolated Electric Taberna fixture: ${migrated.status}`);
  await fetch(`${baseUrl}/api/members`, { headers: playerHeaders() });
  const response = await fetch(`${baseUrl}/api/members`, {
    method: "POST",
    headers: { ...gmHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ id: "visual-player", status: "active" }),
  });
  if (!response.ok) {
    throw new Error(`Could not activate visual player: ${response.status}`);
  }
  seedVisualPlaces();
  const hub = await fetch(`${baseUrl}/api/locations?view=player&target=player`, { headers: playerHeaders() }).then((r) => r.json());
  if (!hub.places?.some((place) => place.id === "place.electric-taberna") || !hub.places?.some((place) => place.id === "place.synthetic-night-market")) {
    throw new Error(`The isolated visual fixture did not return both released places: ${JSON.stringify(hub)}`);
  }
}

function seedVisualPlaces() {
  const state = process.env.CVK_TEST_STATE ?? "";
  if (!/^work\/tests\/[a-f0-9-]+$/.test(state)) {
    throw new Error("Visual screenshot fixtures require a disposable local test database.");
  }
  const date = new Date().toISOString().slice(0, 10);
  const sql = `
    INSERT OR IGNORE INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,title,content,gm_body,version,created_at,updated_at) VALUES
      ('place.synthetic-night-market','chronik-von-kleve','PLACE','WORKING','sprint1-gm','sl','Testort Zwei','{}','',1,'${date}','${date}'),
      ('room.synthetic-night-market.secret','chronik-von-kleve','PLACE','GM_SECRET','sprint1-gm','sl','SYNTHETIC_SECRET_ROOM','{}','',1,'${date}','${date}'),
      ('place.ungranted-secret','chronik-von-kleve','PLACE','WORKING','sprint1-gm','sl','SYNTHETIC_UNGRANTED_PLACE','{}','',1,'${date}','${date}')
      ON CONFLICT(id) DO UPDATE SET title=excluded.title;
    INSERT INTO location_nodes(entity_id,campaign_id,location_id,parent_id,level,position,world_state,world_visibility,world_subject_id,markers,attributes,revision,updated_at) VALUES
      ('place.synthetic-night-market','chronik-von-kleve','place.synthetic-night-market',NULL,'location',0,'active','group',NULL,'[]','{"title":"Testort Zwei","subtitle":"Testdaten","district":"Isolierter Bereich","summary":"Synthetischer Ort für den isolierten visuellen Test.","visibility":"group","geography":{"status":"exact","visibility":"group","coordinates":[6.21,51.83],"provenance":{"source":"isolated synthetic fixture; not canon","reviewedAt":"${date}"}}}',1,'${date}'),
      ('room.synthetic-night-market.secret','chronik-von-kleve','place.synthetic-night-market','place.synthetic-night-market','room',1,'active','gm',NULL,'[]','{"title":"SYNTHETIC_SECRET_ROOM"}',1,'${date}'),
      ('place.ungranted-secret','chronik-von-kleve','place.ungranted-secret',NULL,'location',0,'active','group',NULL,'[]','{"title":"SYNTHETIC_UNGRANTED_PLACE","visibility":"group","geography":{"status":"exact","visibility":"group","coordinates":[6.22,51.84],"provenance":{"source":"isolated synthetic fixture; not canon","reviewedAt":"${date}"}}}',1,'${date}')
      ON CONFLICT(entity_id) DO UPDATE SET attributes=excluded.attributes,world_state=excluded.world_state,revision=location_nodes.revision+1,updated_at=excluded.updated_at;
    INSERT INTO knowledge(id,campaign_id,entity_id,audience,subject_id,state,discovery_state,version,granted_by,created_at,updated_at) VALUES
      ('qa.visual.synthetic-night-market','chronik-von-kleve','place.synthetic-night-market','group','chronik-von-kleve','DISCOVERED','known',1,'sprint1-gm','${date}','${date}')
      ON CONFLICT(campaign_id,entity_id,audience,subject_id) DO UPDATE SET state='DISCOVERED',discovery_state='known',version=knowledge.version+1,updated_at='${date}';
  `;
  const result = spawnSync(process.execPath, [
    "node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB", "--local",
    "--persist-to", state, "--config", "dist/server/wrangler.json", "--command", sql,
  ], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`Could not seed isolated visual fixtures: ${result.stderr}`);
}

function gmHeaders() {
  return {
    "oai-authenticated-user-id": "sprint1-gm",
    "oai-authenticated-user-email": "gm@sprint.invalid",
  };
}

function playerHeaders() {
  return {
    "oai-authenticated-user-id": "visual-player",
    "oai-authenticated-user-email": "player@sprint.invalid",
  };
}

async function waitForHttp(url) {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {}
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

class Cdp {
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolveOpen, rejectOpen) => {
      ws.onopen = resolveOpen;
      ws.onerror = rejectOpen;
    });
    return new Cdp(ws);
  }

  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    };
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolveSend, rejectSend) => {
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend });
    });
  }

  close() {
    this.ws.close();
  }
}

await main();
