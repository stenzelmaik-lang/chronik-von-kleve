import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const edge =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const debugPort = 9231;
const baseUrl = "http://127.0.0.1:8794";
const outputDir = resolve("outputs", "ortssystem-phase-1-screenshots");
mkdirSync(outputDir, { recursive: true });

const profileDir = resolve("work", `edge-location-${Date.now()}`);
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
    await ensurePlayerIsActive();
    const version = await fetch(
      `http://127.0.0.1:${debugPort}/json/version`,
    ).then((response) => response.json());
    const cdp = await Cdp.connect(version.webSocketDebuggerUrl);
    await capture(cdp, {
      fileName: "desktop-sl.png",
      width: 1440,
      height: 1100,
      headers: gmHeaders(),
      expectedText: "SL-Steuerpult",
    });
    await capture(cdp, {
      fileName: "desktop-player.png",
      width: 1440,
      height: 1100,
      headers: playerHeaders(),
      expectedText: "Nicht erschlossener Bereich",
      forbiddenText: ["Keller & Service", "Getränkevorrat", "Büro"],
    });
    await capture(cdp, {
      fileName: "mobile-player.png",
      width: 390,
      height: 900,
      mobile: true,
      headers: playerHeaders(),
      expectedText: "Nicht erschlossener Bereich",
      forbiddenText: ["Keller & Service", "Getränkevorrat", "Büro"],
    });
    cdp.close();
    console.log(`Screenshots saved to ${outputDir}`);
  } finally {
    browser.kill();
    try {
      rmSync(profileDir, { recursive: true, force: true });
    } catch {}
  }
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
    { url: `${baseUrl}/spielbereich?bereich=schauplaetze` },
    sessionId,
  );
  await waitForText(cdp, sessionId, options.expectedText);
  const result = await cdp.send(
    "Runtime.evaluate",
    {
      expression: `(() => {
        const text = document.body.innerText;
        const forbidden = ${JSON.stringify(options.forbiddenText ?? [])};
        return {
          title: document.title,
          hasForbiddenText: forbidden.some((item) => text.includes(item)),
          noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
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
  const screenshot = await cdp.send(
    "Page.captureScreenshot",
    { format: "png", captureBeyondViewport: true },
    sessionId,
  );
  writeFileSync(
    join(outputDir, options.fileName),
    Buffer.from(screenshot.data, "base64"),
  );
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

async function ensurePlayerIsActive() {
  await fetch(`${baseUrl}/api/locations/migrate`, {
    method: "POST",
    headers: { ...gmHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ placeId: "place.electric-taberna" }),
  });
  await fetch(`${baseUrl}/api/members`, { headers: playerHeaders() });
  const response = await fetch(`${baseUrl}/api/members`, {
    method: "POST",
    headers: { ...gmHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ id: "visual-player", status: "active" }),
  });
  if (!response.ok) {
    throw new Error(`Could not activate visual player: ${response.status}`);
  }
}

function gmHeaders() {
  return {
    "oai-authenticated-user-id": "visual-gm",
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
