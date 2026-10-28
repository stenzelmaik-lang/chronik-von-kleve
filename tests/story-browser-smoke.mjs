/**
 * Browser UX smoke for the isolated ChroniPlay story-workspace fixture.
 * This script must never point at production or an external hostname.
 * Run with local --story-workspace server and temporary Playwright installation.
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.CVK_TEST_URL || "http://127.0.0.1:8802";
const parsedBase = new URL(base);
assert.equal(parsedBase.hostname, "127.0.0.1", "Browser smoke must stay on 127.0.0.1");
assert.equal(parsedBase.port, "8802", "Browser smoke uses only the isolated SL fixture");
const dir = "artifacts/story-browser-smoke";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "de-DE" });
const page = await context.newPage();
page.setDefaultTimeout(20000);
let phase = "login";
const screenshot = async name => page.screenshot({ path: dir + "/" + name + ".png", fullPage: true });
const api = async (path, method = "GET", data) => {
  const response = await context.request.fetch(base + path, {
    method, ...(data ? { data } : {}), headers: { Origin: base },
  });
  let payload = {};
  try { payload = await response.json(); } catch {}
  return { status: response.status(), body: payload };
};
async function waitForStored(kind, id, predicate) {
  const until = Date.now() + 20000;
  let lastDocument = "";
  const route = kind === "session" ? "preparation" : "scenes";
  while (Date.now() < until) {
    const r = await api("/api/command-center/" + route + "?id=" + encodeURIComponent(id));
    if (r.status === 200 && predicate(r.body[kind])) return r.body[kind];
    lastDocument = JSON.stringify({ status: r.status, document: r.body[kind]?.document }).slice(0, 800);
    await page.waitForTimeout(250);
  }
  throw new Error("Autosave/persistence not confirmed: " + kind + " " + id + " Last: " + lastDocument);
}
async function saveOrAutosave(kind, id, predicate) {
  const button = page.getByRole("button", { name: "Jetzt speichern", exact: true });
  if (await button.isEnabled()) await button.click();
  return waitForStored(kind, id, predicate);
}
async function chooseSession() {
  const nav = page.locator('nav[aria-label="Storynavigation"]');
  await nav.getByRole("button", { name: /Der Hunger bleibt – Sitzung 01/ }).first().click();
  await page.getByRole("button", { name: "+ Szene für diesen Spielabend" }).waitFor();
}
async function addScene(title, placeTitle, html) {
  await page.getByRole("button", { name: "+ Szene für diesen Spielabend" }).click();
  await page.waitForFunction(() => new URLSearchParams(location.search).has("scene"));
  const sceneId = new URL(page.url()).searchParams.get("scene");
  assert.ok(sceneId, "A scene has its own route identity");
  await page.locator("main").getByLabel("Titel", { exact: true }).fill(title);
  await page.getByLabel("Zentraler Schauplatz").selectOption({ label: placeTitle });
  await page.getByRole("button", { name: "HTML-Quelltext", exact: true }).click();
  const source = page.getByRole("textbox", { name: "Erzählung HTML" });
  await source.fill(html);
  await page.getByRole("button", { name: "Vorschau", exact: true }).click();
  await page.getByRole("region", { name: "Erzählung Vorschau" }).getByRole("heading").first().waitFor();
  await page.getByRole("button", { name: "Editor vergrößern" }).click();
  assert.equal(await page.locator('main [aria-pressed="true"]').filter({ hasText: "Vollbild schließen" }).count(), 1);
  await screenshot("szene-" + (title.includes("Kaserne") ? "kaserne" : "taberna") + "-vollbild");
  await page.getByRole("button", { name: "Vollbild schließen" }).click();
  const data = await saveOrAutosave("scene", sceneId, s =>
    s.document.title === title &&
    s.document.narration.includes(title.includes("Kaserne") ? "Versiegelte Order" : "Avis Bar") &&
    s.document.placeId &&
    s.document.sessionIds.length === 1
  );
  assert.deepEqual(data.state.runs, [], "Preparation may not trigger a run");
  assert.deepEqual(data.state.publications, [], "Preparation may not publish player content");
  return sceneId;
}
try {
  const login = await api("/api/auth/login", "POST", {
    email: "command-gm@example.invalid", password: "ChroniPlay-Demo-2036!",
  });
  assert.equal(login.status, 200, "Synthetic GM login must work");

  // Create only synthetic data in isolated test D1; Taberna already exists in fixture.
  phase = "synthetic Kaserne fixture";
  const kaserne = await api("/api/cms/locations", "POST", {
    level: "location", title: "SYNTHETISCH – Kaserne Schwarzholz",
  });
  assert.equal(kaserne.status, 201, JSON.stringify(kaserne.body));

  phase = "create Spielabend from SL UI";
  await page.goto(base + "/sl/command-center", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Spielabend & Story" }).waitFor();
  await page.getByRole("button", { name: "+ Spielabend anlegen" }).click();
  await page.waitForFunction(() => new URLSearchParams(location.search).has("session"));
  const sessionId = new URL(page.url()).searchParams.get("session");
  assert.ok(sessionId);
  await page.locator("main").getByLabel("Titel", { exact: true }).fill("Der Hunger bleibt – Sitzung 01");
  await saveOrAutosave("session", sessionId, s =>
    s.document.title === "Der Hunger bleibt – Sitzung 01");

  phase = "Kaserne scene and HTML";
  await chooseSession();
  const kaserneId = await addScene("Kaserne – Ankunft", "SYNTHETISCH – Kaserne Schwarzholz",
    '<h2>Rückkehr zur Kaserne</h2><p class="cp-intro">Eine stille Nacht in Kleve.</p><p><span style="color:#d6b36f">SL-Hinweis</span>: Die Gruppe entscheidet selbst.</p><table><tr><th>Hinweis</th></tr><tr><td>Versiegelte Order</td></tr></table><details><summary>Optionaler Dialog</summary><p>Schäfer wartet.</p></details>');

  phase = "Taberna scene and HTML";
  await chooseSession();
  const tabernaId = await addScene("Electric Taberna – Besuch", "Electric Taberna",
    '<h2>Electric Taberna</h2><p>Die Spieler betreten Avis Bar.</p><blockquote>Die nächste Entscheidung bleibt offen.</blockquote>');

  phase = "reload and navigate between locations";
  await chooseSession();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Spielabend & Story" }).waitFor();
  await page.locator('nav[aria-label="Storynavigation"]').getByText("SYNTHETISCH – Kaserne Schwarzholz").waitFor();
  await page.locator('nav[aria-label="Storynavigation"]').getByText("Electric Taberna", { exact: true }).waitFor();
  const session = await api("/api/command-center/preparation?id=" + encodeURIComponent(sessionId));
  assert.equal(session.status, 200);
  assert.ok(session.body.session.document.sceneIds.includes(kaserneId));
  assert.ok(session.body.session.document.sceneIds.includes(tabernaId));
  await screenshot("spielabend-desktop-1920");

  const nav = page.locator('nav[aria-label="Storynavigation"]');
  await nav.getByRole("button", { name: /Kaserne – Ankunft/ }).click();
  await page.getByRole("heading", { name: "Spielabend & Story" }).waitFor();
  const first = await api("/api/command-center/scenes?id=" + encodeURIComponent(kaserneId));
  assert.ok(first.body.scene.document.narration.includes("Versiegelte Order"));
  await nav.getByRole("button", { name: /Electric Taberna – Besuch/ }).click();
  const second = await api("/api/command-center/scenes?id=" + encodeURIComponent(tabernaId));
  assert.ok(second.body.scene.document.narration.includes("Avis Bar"));

  phase = "responsive desktop 1440 and approximate 125% CSS zoom";
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { document.documentElement.style.zoom = "125%"; });
  await screenshot("desktop-1440-zoom-css125");
  const geometry = await page.evaluate(() => ({ viewport: window.innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(geometry.scroll <= geometry.viewport + 20, "Page should not overflow horizontally at approximate CSS zoom");

  phase = "mobile navigation";
  await page.evaluate(() => { document.documentElement.style.zoom = ""; });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Akten auswählen" }).click();
  await nav.getByRole("button", { name: /Kaserne – Ankunft/ }).waitFor();
  await screenshot("mobile-390");

  phase = "privacy";
  const anonymous = await browser.newContext();
  const unauthorized = await anonymous.request.get(base + "/api/command-center/preparation?id=" + encodeURIComponent(sessionId));
  assert.ok([401, 403].includes(unauthorized.status()));
  await anonymous.close();

  console.log("PASS: isolated Spielabend -> Kaserne / Taberna scenes -> HTML preview -> fullscreen -> save/reload -> responsive/SL privacy.");
  console.log("NOTE: 125% simulated using CSS zoom, not native browser zoom.");
} catch (error) {
  console.error("FAIL story browser smoke at phase: " + phase, error);
  try { await screenshot("failure-" + phase.replace(/[^a-z0-9-]/gi, "-").toLowerCase()); } catch {}
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
