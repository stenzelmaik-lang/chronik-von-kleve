/**
 * Browser UX smoke for the isolated ChroniPlay story-workspace fixture.
 * This script must never point at production or an external hostname.
 * Run with the isolated --spieltisch-release server and a Playwright installation.
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
const { chromium } = await import(process.env.CVK_PLAYWRIGHT_MODULE || "playwright");

const base = process.env.CVK_TEST_URL || "http://127.0.0.1:8820";
const parsedBase = new URL(base);
assert.equal(parsedBase.hostname, "127.0.0.1", "Browser smoke must stay on 127.0.0.1");
assert.ok(["8820","8822","8824"].includes(parsedBase.port), "Browser smoke uses only the isolated SL/player fixture or separate session-overview fixture");
const dir = "artifacts/story-browser-smoke";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CVK_BROWSER_CHANNEL ? {channel:process.env.CVK_BROWSER_CHANNEL} : {}) });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "de-DE" });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const sessionTitle = "SYNTHETISCH – Spielabend " + crypto.randomUUID().slice(0,8);
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
  const item = page.getByRole("combobox",{name:"Spielabend auswählen",exact:true});
  const create = page.getByRole("button", { name: "+ Szene für diesen Spielabend" });
  for (let attempt = 0; attempt < 3; attempt++) {
    await item.selectOption({label:sessionTitle});
    try {
      await create.waitFor({ timeout: 4000 });
      return;
    } catch {
      // The previous save may have just finished. Retry the user navigation.
    }
  }
  throw new Error("Navigation did not return to the session after saving the scene");
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
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("button", { name: "Editor vergrößern" }).getAttribute("aria-pressed"), "false");
  await page.getByRole("button", { name: "Editor vergrößern" }).click();
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

  // Seed the existing accepted location fixture in this isolated local database.
  phase = "prepare Taberna fixture";
  const tabernaSeed = await api("/api/locations/migrate", "POST", {placeId:"place.electric-taberna"});
  assert.equal(tabernaSeed.status, 200, JSON.stringify(tabernaSeed.body));
  const catalog = await api("/api/command-center/preparation");
  assert.ok(catalog.body.places.some(p => p.id === "place.electric-taberna"));
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
  await page.locator("main").getByLabel("Titel", { exact: true }).fill(sessionTitle);
  await saveOrAutosave("session", sessionId, s =>
    s.document.title === sessionTitle);

  phase = "Kaserne scene and HTML";
  await chooseSession();
  const kaserneId = await addScene("Kaserne – Ankunft", "SYNTHETISCH – Kaserne Schwarzholz",
    '<h2>Rückkehr zur Kaserne</h2><p class="cp-intro">Eine stille Nacht in Kleve.</p><p><span style="color:#d6b36f">SL-Hinweis</span>: Die Gruppe entscheidet selbst.</p><table><tr><th>Hinweis</th></tr><tr><td>Versiegelte Order</td></tr></table><details><summary>Optionaler Dialog</summary><p>Schäfer wartet.</p></details>');

  phase = "SL material summary";
  const npc=await api("/api/entities","POST",{type:"NPC",title:"SYNTHETISCH – Schäfer",text:"PRIVATE_NPC_NOTES"});
  assert.equal(npc.status,201,JSON.stringify(npc.body));
  const prepared=(await api("/api/command-center/scenes?id="+encodeURIComponent(kaserneId))).body.scene;
  const attached=await api("/api/command-center/scenes","POST",{action:"save",id:kaserneId,version:prepared.version,document:{...prepared.document,npcIds:[npc.body.id]}});
  assert.equal(attached.status,200,JSON.stringify(attached.body));
  phase = "Taberna scene and HTML";
  await chooseSession();
  const tabernaId = await addScene("Electric Taberna – Besuch", "Electric Taberna",
    '<h2>Electric Taberna</h2><p>Die Spieler betreten Avis Bar.</p><blockquote>Die nächste Entscheidung bleibt offen.</blockquote>');

  phase = "reload and navigate between locations";
  await chooseSession();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Spielabend & Story" }).waitFor();
  await page.getByRole("region", {name:"Spielabendübersicht"}).getByText("SYNTHETISCH – Kaserne Schwarzholz").waitFor();
  await page.getByRole("region", {name:"Spielabendübersicht"}).getByText("Electric Taberna", { exact: true }).waitFor();
  const session = await api("/api/command-center/preparation?id=" + encodeURIComponent(sessionId));
  assert.equal(session.status, 200);
  assert.ok(session.body.session.document.sceneIds.includes(kaserneId));
  assert.ok(session.body.session.document.sceneIds.includes(tabernaId));
  await screenshot("spielabend-desktop-1920");

  const nav = page.getByRole("region",{name:"Vorbereitungsaktionen"});
  await page.getByRole("button",{name:"Szene bearbeiten: Kaserne – Ankunft",exact:true}).click();
  await page.getByRole("heading", { name: "Spielabend & Story" }).waitFor();
  const first = await api("/api/command-center/scenes?id=" + encodeURIComponent(kaserneId));
  assert.ok(first.body.scene.document.narration.includes("Versiegelte Order"));
  await page.getByRole("combobox",{name:"Weitere Szene dieses Spielabends"}).selectOption({label:"Electric Taberna – Besuch"});
  const second = await api("/api/command-center/scenes?id=" + encodeURIComponent(tabernaId));
  assert.ok(second.body.scene.document.narration.includes("Avis Bar"));

  phase = "overview order and return context";
  await chooseSession();
  const overview=page.getByRole("region",{name:"Spielabendübersicht"});
  assert.equal(await page.locator("main").getByLabel("Titel",{exact:true}).count(),0,"Reading does not open a form");
  await overview.getByRole("button",{name:"Kaserne – Ankunft nach unten",exact:true}).press("Enter");
  await waitForStored("session",sessionId,s=>s.document.sceneIds[0]===tabernaId);
  await page.reload({waitUntil:"domcontentloaded"});
  await overview.waitFor();
  assert.ok((await overview.locator("ol > li h4").first().innerText()).includes("Electric Taberna"));
  await overview.getByRole("button",{name:"Szene bearbeiten: Kaserne – Ankunft",exact:true}).click();
  await page.getByRole("button",{name:"Zurück zum Spielabend",exact:true}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("fromSession"),sessionId);
  await page.goBack();await overview.waitFor();
  await page.goForward();await page.getByRole("button",{name:"Zurück zum Spielabend",exact:true}).waitFor();
  await page.getByRole("button",{name:"Zurück zum Spielabend",exact:true}).click();await overview.waitFor();
  phase = "shared scene returns to invoking session";
  assert.ok((await overview.innerText()).includes("SYNTHETISCH – Schäfer"),"NPC is visible without opening the scene editor");
  const alternate=await api("/api/command-center/preparation","POST",{action:"create",clientRequestId:crypto.randomUUID(),document:{title:"SYNTHETISCH – Zweiter Abend",sceneIds:[kaserneId]}});
  assert.equal(alternate.status,201,JSON.stringify(alternate.body));
  const alternateId=alternate.body.session.id;
  await page.goto(base+"/sl/command-center?bereich=sitzung&session="+encodeURIComponent(alternateId));
  await overview.getByRole("button",{name:"Szene bearbeiten: Kaserne – Ankunft",exact:true}).click();
  await page.getByRole("button",{name:"Zurück zum Spielabend",exact:true}).waitFor();
  await page.reload({waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"Zurück zum Spielabend",exact:true}).click();
  await overview.getByRole("heading",{name:"SYNTHETISCH – Zweiter Abend",exact:true}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("session"),alternateId);
  await page.goto(base+"/sl/command-center?bereich=sitzung&session="+encodeURIComponent(sessionId));
  phase = "unlink scene from both existing references";
  await chooseSession();
  await page.getByRole("button",{name:"Spielabend bearbeiten",exact:true}).click();
  await page.getByText("Vorhandene Storys, Szenen und Schauplätze verknüpfen").click();
  const scenePicker = page.getByRole("group", { name: "Szenen" });
  await scenePicker.getByRole("checkbox", { name: /Electric Taberna – Besuch/ }).uncheck();
  await saveOrAutosave("session", sessionId, s => !s.document.sceneIds.includes(tabernaId));
  const unlinkedScene = await api("/api/command-center/scenes?id=" + encodeURIComponent(tabernaId));
  assert.ok(!unlinkedScene.body.scene.document.sessionIds.includes(sessionId), "Unlink clears the scene-side reference too");
  assert.ok(unlinkedScene.body.scene.document.narration.includes("Avis Bar"), "Unlink preserves scene content");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Zur Spielabendübersicht" }).click();
  await page.getByRole("region", { name: "Spielabendübersicht" }).waitFor();
  assert.equal(await nav.getByRole("button", { name: /Electric Taberna – Besuch/ }).count(), 0);
  const freeFiles = nav.locator("details").filter({ hasText: "Weitere Akten" });
  await freeFiles.locator("summary").click();
  assert.equal(await freeFiles.getByRole("button", { name: /Electric Taberna – Besuch/ }).count(), 1, "Unlinked scene remains available as a free original");
  assert.equal(await freeFiles.getByRole("button", { name: /Kaserne – Ankunft/ }).count(), 0, "Assigned scenes are not listed as free");

  phase = "unlink an existing scene-only reference";
  const oneSided = await api("/api/command-center/scenes", "POST", {
    action: "create", clientRequestId: crypto.randomUUID(),
    document: { ...unlinkedScene.body.scene.document, title: "SYNTHETISCH – alter Szenenverweis", sessionIds: [sessionId] },
  });
  assert.equal(oneSided.status, 201);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "+ Szene für diesen Spielabend" }).waitFor();
  await page.getByRole("button",{name:"Spielabend bearbeiten",exact:true}).click();
  await page.getByText("Vorhandene Storys, Szenen und Schauplätze verknüpfen").click();
  const legacyCheckbox = page.getByRole("group", { name: "Szenen" }).getByRole("checkbox", { name: /SYNTHETISCH – alter Szenenverweis/ });
  assert.ok(await legacyCheckbox.isChecked(), "A scene-only reference is visible as selected");
  const previousSession = (await api("/api/command-center/preparation?id=" + encodeURIComponent(sessionId))).body.session;
  await legacyCheckbox.uncheck();
  await saveOrAutosave("session", sessionId, s => s.version > previousSession.version);
  const afterLegacyUnlink = await api("/api/command-center/scenes?id=" + encodeURIComponent(oneSided.body.scene.id));
  assert.ok(!afterLegacyUnlink.body.scene.document.sessionIds.includes(sessionId));

  await page.getByRole("button",{name:"Zur Spielabendübersicht",exact:true}).click();
  await page.getByRole("region",{name:"Spielabendübersicht"}).waitFor();
  phase = "responsive desktop 1440 and approximate 125% CSS zoom";
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { document.documentElement.style.zoom = "125%"; });
  await screenshot("desktop-1440-zoom-css125");
  const geometry = await page.evaluate(() => ({ viewport: window.innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(geometry.scroll <= geometry.viewport + 20, "Page should not overflow horizontally at approximate CSS zoom");

  phase = "mobile navigation";
  await page.evaluate(() => { document.documentElement.style.zoom = ""; });
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot("overview-mobile-390");
  await page.getByRole("combobox",{name:"Spielabend auswählen",exact:true}).waitFor();
  assert.equal(await page.locator('nav[aria-label="Storynavigation"]').count(),0,"No duplicated scene sidebar");
  await screenshot("mobile-390");

  phase = "privacy";
  const anonymous = await browser.newContext();
  const unauthorized = await anonymous.request.get(base + "/api/command-center/preparation?id=" + encodeURIComponent(sessionId));
  assert.ok([401, 403].includes(unauthorized.status()));
  await anonymous.close();
  const player = await browser.newContext();
  const playerLogin = await player.request.post(base + "/api/auth/login", {
    headers: { Origin: base }, data: { email: "command-a@example.invalid", password: "ChroniPlay-Demo-2036!" },
  });
  assert.equal(playerLogin.status(), 200);
  for (const route of ["preparation?id=" + encodeURIComponent(sessionId), "scenes?id=" + encodeURIComponent(kaserneId)]) {
    const denied = await player.request.get(base + "/api/command-center/" + route);
    assert.equal(denied.status(), 403, "Players cannot access private SL preparation");
  }
  const playerScenes = await player.request.get(base + "/api/session-scenes");
  assert.ok(playerScenes.ok());
  const visible = await playerScenes.text();
  assert.ok(!visible.includes("Versiegelte Order") && !visible.includes("Kaserne – Ankunft"), "Unpublished scene details stay private");
  await player.close();

  phase = "delete confirmation and cancel";
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + "/sl/command-center", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "+ Spielabend anlegen" }).click();
  await page.waitForFunction(() => new URLSearchParams(location.search).has("session"));
  const disposableId = new URL(page.url()).searchParams.get("session");
  const deleteButton = page.getByRole("button", { name: "Spielabend löschen" });
  await deleteButton.waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Spielabend löschen' && !button.disabled));
  await deleteButton.press("Enter");
  const dialog = page.getByRole("alertdialog");
  await dialog.getByText(/endgültig löschen/).waitFor();
  await page.waitForFunction(() => { const box = document.querySelector('[role="alertdialog"]'); return box && Number(getComputedStyle(box).opacity) >= 0.99; });
  await screenshot("delete-confirmation");
  await dialog.getByRole("button", { name: "Abbrechen" }).press("Enter");
  assert.equal((await api("/api/command-center/preparation?id=" + disposableId)).status, 200, "Cancel leaves the entry intact");
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileGeometry = await page.evaluate(() => ({ viewport: window.innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(mobileGeometry.scroll <= mobileGeometry.viewport + 1, "Delete controls should not overflow on mobile");
  await deleteButton.press("Enter");
  await dialog.getByRole("button", { name: "Bestätigen" }).waitFor();
  await page.waitForFunction(() => { const box = document.querySelector('[role="alertdialog"]'); return box && Number(getComputedStyle(box).opacity) >= 0.99; });
  await screenshot("delete-confirmation-mobile");
  await dialog.getByRole("button", { name: "Bestätigen" }).press("Enter");
  await page.getByText("Spielabend gelöscht.", { exact: true }).waitFor();
  assert.equal((await api("/api/command-center/preparation?id=" + disposableId)).status, 404, "Confirm removes the entry");

  console.log("PASS: isolated Spielabend -> Kaserne / Taberna scenes -> HTML preview -> fullscreen -> save/reload -> responsive/SL privacy -> delete/cancel.");
  console.log("VIEW: " + base + "/sl/command-center?bereich=sitzung&session=" + encodeURIComponent(sessionId));
  console.log("NOTE: 125% simulated using CSS zoom, not native browser zoom.");
} catch (error) {
  console.error("FAIL story browser smoke at phase: " + phase, error);
  try { await screenshot("failure-" + phase.replace(/[^a-z0-9-]/gi, "-").toLowerCase()); } catch {}
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
