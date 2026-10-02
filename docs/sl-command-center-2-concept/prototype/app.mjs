import { tools, people, stateKey, layoutKey, createState, createLayout, readLayout, contextFor, togglePin, movePanel, addPanel, selectPerson, sendDemo, deliveredTo, recordOccurrence } from "./model.mjs";
import { iconMarkup } from "./icons.mjs";

const auxiliary = new URLSearchParams(location.search).get("window") === "aux";
const windowId = auxiliary ? "aux" : "main";
const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const icon = (name) => iconMarkup[name] || iconMarkup.book;
const labels = { story: "Storybuch", character: "Charakterakte", places: "Ortsakte", media: "Medien & Versand", notes: "SL-Notizen", log: "Sitzungsprotokoll" };
const iconNames = { story: "book", character: "person", places: "map", media: "media", notes: "pen", log: "history" };
const storageRead = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
let storageAvailable = true;
const storageWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { storageAvailable = false; $("#save-state").textContent = "Browser-Speicher nicht verfügbar · Anordnung nur für dieses Fenster"; } };
const readState = () => {
  const stored = storageRead(stateKey);
  if (!stored || !people[stored.selected] || !Array.isArray(stored.deliveries) || !Array.isArray(stored.events)) return createState();
  return { ...createState(), ...stored, notes: String(stored.notes || "").slice(0, 8000), storyNote: String(stored.storyNote || "").slice(0, 8000), deliveries: stored.deliveries.filter((d) => people[d.recipient] && typeof d.id === "string"), events: stored.events.filter((e) => e.kind === "occurred" && typeof e.text === "string") };
};
let state = readState();
let layout = readLayout(storageRead(layoutKey(windowId)), auxiliary);
const recipients = new Map();
const storyTabs = new Map();
let inboxPerson = "helena";
let pendingRecipient = null;
let pendingDeliveryId = null;
let toastTimer;
const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("chroniplay-cc2-concept") : null;
$("#window-label").textContent = auxiliary ? "Nebenfenster · eigene Anordnung" : "Hauptregie";

function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3800);
}
function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((node) => { node.innerHTML = icon(node.dataset.icon); });
}
function saveLayout() {
  storageWrite(layoutKey(windowId), layout);
  storageWrite(`${layoutKey(windowId)}-${layout.mode}`, layout);
  if (storageAvailable) $("#save-state").textContent = "Eigene Anordnung lokal gemerkt";
}
function updateState(change, repaint = true) {
  // Only synthetic demo content is shared between same-origin concept windows.
  state = change(readState());
  storageWrite(stateKey, state);
  channel?.postMessage({ type: "invalidated", version: state.version, source: windowId });
  if (repaint) render();
}
function externalRefresh() {
  state = readState();
  const active = document.activeElement;
  if (active?.matches("textarea")) {
    $("#sync-state").textContent = "Anderes Fenster aktualisiert · eigene Texteingabe bleibt erhalten";
    renderPeople();
    return;
  }
  render();
  $("#sync-state").textContent = "Personenfokus und Probeereignisse zwischen Fenstern abgeglichen";
  if ($("#player-dialog").open) renderInbox();
}
if (channel) channel.onmessage = (event) => {
  if (event.data?.type === "invalidated" && event.data.source !== windowId) externalRefresh();
};
window.addEventListener("storage", (event) => { if (!channel && event.key === stateKey) externalRefresh(); });

function renderPeople() {
  $("#people").innerHTML = Object.entries(people).map(([id, person]) => `<button class="person-chip ${state.selected === id ? "active" : ""}" data-person="${id}" aria-pressed="${state.selected === id}"><span class="initials">${person.initials}</span>${person.name}</button>`).join("");
}
function menu(panel) {
  return `<details class="panel-menu"><summary aria-label="Werkzeug anordnen">${icon("more")}</summary><div class="menu-popover"><p>Anordnung</p><button data-arrange="left" data-id="${panel.id}">In die linke Spalte</button><button data-arrange="right" data-id="${panel.id}">In die rechte Spalte</button><button data-arrange="up" data-id="${panel.id}">Weiter nach oben</button><p>Werkzeughöhe</p>${["small", "medium", "large"].map((size, index) => `<button data-size="${size}" data-id="${panel.id}" aria-pressed="${panel.size === size}">${["Kompakt", "Mittel", "Groß"][index]}${panel.size === size ? " · gewählt" : ""}</button>`).join("")}</div></details>`;
}
function panelMarkup(panel) {
  const context = contextFor(panel, state);
  const person = people[context];
  const contextLabel = panel.tool === "character" ? `${panel.binding === "pinned" ? "Angeheftet · " : "Folgt · "}${person.name}` : panel.tool === "story" ? "Fester Storykontext" : panel.tool === "notes" ? "SL-intern" : "Synthetische Probe";
  return `<section class="panel" data-panel="${panel.id}" data-tool="${panel.tool}" data-size="${panel.size}" aria-label="${labels[panel.tool]}${panel.tool === "character" ? ` ${person.name}` : ""}"><header class="panel-head" draggable="true" data-drag="${panel.id}"><span class="panel-label">${icon(iconNames[panel.tool])}${labels[panel.tool]}</span><span class="panel-context">${contextLabel}</span>${panel.tool === "character" ? `<button class="icon-button ${panel.binding === "pinned" ? "pinned" : ""}" data-pin="${panel.id}" aria-label="${panel.binding === "pinned" ? "Akte lösen" : "Akte anheften"}" title="${panel.binding === "pinned" ? "Personenfokus wieder folgen" : "Diese Person in der Akte behalten"}" aria-pressed="${panel.binding === "pinned"}">${icon("pin")}</button>` : ""}${menu(panel)}<button class="icon-button" data-focus="${panel.id}" aria-label="${layout.focused === panel.id ? "Alle Werkzeuge zeigen" : "Werkzeug groß ansehen"}">${icon(layout.focused === panel.id ? "minimize" : "maximize")}</button><button class="icon-button" data-close-panel="${panel.id}" aria-label="${labels[panel.tool]} schließen">${icon("close")}</button></header><div class="panel-body">${contentFor(panel, context)}</div></section>`;
}
function contentFor(panel, context) {
  if (panel.tool === "story") return storyContent(panel);
  if (panel.tool === "character") return characterContent(context);
  if (panel.tool === "places") return placeContent();
  if (panel.tool === "media") return mediaContent(panel);
  if (panel.tool === "notes") return `<span class="badge private">Nur die Spielleitung</span><h3 style="margin-top:16px">Gedanken festhalten.</h3><p class="small muted">Eine private Notiz ist weder ein Ereignis noch eine Nachricht an die Gruppe.</p><label for="note-${panel.id}">Synthetische SL-Notiz</label><textarea id="note-${panel.id}" data-note="notes" rows="7" maxlength="8000" placeholder="Hier bleibt Raum für spontane Gedanken …">${escape(state.notes)}</textarea><p class="note-status" data-note-status>Nur im Browser gespeichert · keine Kampagnendatenbank</p><button class="button" data-tool="log">${icon("history")} Tatsächliche Ereignisse ansehen</button>`;
  return logContent();
}
function storyContent(panel) {
  const tab = storyTabs.get(panel.id) || "guide";
  const sections = {
    guide: `<div class="section-label">${icon("compass")} Der rote Faden</div><div class="story-copy"><p>Zwei Personen wünschen dasselbe Gespräch – aus unterschiedlichen Gründen. Die Gruppe entscheidet selbst, ob sie zuhört, nachfragt oder den Ort verlässt.</p><p><strong>Die Vorbereitung ist ein Angebot.</strong> Keine Szene muss auf eine andere folgen. Eine <button class="inline-link" data-tool="places">Ortsakte</button> beschreibt die Umgebung; Motive und mögliche Folgen bleiben im Plotdossier.</p></div><div class="subtle-box"><p>Für die SL: Was will die Testperson? Was weiß sie wirklich? Was könnte sich durch die Entscheidungen der Gruppe verändern?</p></div><div class="section-label">Möglichkeiten · noch nicht geschehen</div><div class="possibility"><span class="possibility-number">01</span><div><h4>Ein Gespräch anbieten</h4><p>Die Beteiligten haben Motive, keine vorgeschriebenen Dialogzeilen.</p></div><span class="badge">Offen</span></div><div class="possibility"><span class="possibility-number">02</span><div><h4>Einen Hinweis zugänglich machen</h4><p>Die SL entscheidet, ob und für wen der Hinweis erreichbar wird.</p></div><span class="badge">Offen</span></div><div class="possibility"><span class="possibility-number">03</span><div><h4>Auf eine unerwartete Entscheidung reagieren</h4><p>Auch das Verlassen der Situation ist eine gültige Entscheidung.</p></div><span class="badge">Offen</span></div>`,
    knowledge: `<div class="section-label">Drei verschiedene Perspektiven</div><div class="subtle-box"><p><strong>SL-Wahrheit</strong><br>Vorbereitete Motive und Geheimnisse bleiben intern. Sie werden nicht als Spielertext kopiert.</p></div><div class="subtle-box"><p><strong>Charakterwissen</strong><br>Nur ausdrücklich bestätigte Entdeckungen bestimmen das Wissen einer Figur.</p></div><div class="subtle-box"><p><strong>Wissen der Person am Tisch</strong><br>Eine gelesene Nachricht beweist weder eine Handlung noch eine Entdeckung der Figur.</p></div><p class="small muted">Im echten System stammen Freigaben aus dem bestehenden Knowledge-System. Dieser Entwurf liest keine Grants.</p>`,
    links: `<div class="section-label">Einmal pflegen · überall verbinden</div><div class="place-links"><button data-tool="places"><span>Testsalon</span><span>Ortsakte öffnen ↗</span></button><button data-tool="character"><span>${people[state.selected].name}</span><span>Charakterakte öffnen ↗</span></button><button data-tool="media"><span>Die versiegelte Nachricht</span><span>Medium öffnen ↗</span></button><button data-tool="log"><span>Tatsächlicher Verlauf</span><span>Sitzung ansehen ↗</span></button></div><p class="small muted">Im Produkt werden stabile IDs verknüpft. Die Geschichte dupliziert keine NSC-, Orts- oder Charakterdaten.</p>`,
  };
  return `<div class="story-meta"><span class="eyebrow">PLOT DOSSIER · SYNTHETISCHES BEISPIEL</span><span class="badge private">SL-vertraulich</span></div><h2 class="story-title">Ein Gespräch<br>ohne vorgeschriebenen Ausgang.</h2><p class="story-lede">Nicht die nächste Szene suchen. Die Situation verstehen und auf die Menschen am Tisch reagieren.</p><nav class="story-tabs" aria-label="Storyansicht">${[["guide", "Roter Faden"], ["knowledge", "Wissensperspektiven"], ["links", "Verknüpfungen"]].map(([key, title]) => `<button class="${key === tab ? "active" : ""}" data-story-tab="${key}" data-id="${panel.id}" aria-pressed="${key === tab}">${title}</button>`).join("")}</nav>${sections[tab]}${layout.mode === "prepare" ? `<label for="story-note-${panel.id}">Vorbereitung ergänzen · nur Konzeptnotiz</label><textarea id="story-note-${panel.id}" data-note="storyNote" rows="4" maxlength="8000" placeholder="Motive, offene Fragen, alternative Entwicklungen …">${escape(state.storyNote)}</textarea><p class="note-status" data-note-status>Lokaler Konzepttext · kein echter Dokumenteditor</p>` : ""}<div class="story-footer"><button data-moment>${icon("plus")} Tatsächlichen Moment notieren</button><button data-tool="media">${icon("media")} Vorbereitetes Medium öffnen</button></div>`;
}
function characterContent(id) {
  const person = people[id];
  const dots = (n) => `<span class="dot-values" aria-label="${n} von 5 Punkten">${Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? "filled" : ""}"></i>`).join("")}</span>`;
  return `<div class="char-top"><div class="portrait">${person.initials}</div><div><p class="eyebrow">SYNTHETISCHER CHARAKTER</p><h3>${person.name}</h3><p>${person.clan} · V20</p></div><span class="badge">Beispielwerte</span></div><div class="resources"><div class="resource"><span>Blut</span><strong>${person.blood}<small> / 10</small></strong></div><div class="resource"><span>Willenskraft</span><strong>${person.will}<small> / 7</small></strong></div><div class="resource"><span>Verfügbare XP</span><strong>${person.xp}</strong></div></div><div class="char-health">${icon("shield")} ${person.health}<span class="small muted">· Laufzeitstatus</span></div><div class="char-actions"><button class="button" data-planned="Vollständiger Bogen wird mit der bestehenden CharacterDetailProjection verbunden.">${icon("person")} Bogen</button><button class="button" data-planned="XP-Vergabe nutzt die vorhandene Character Engine und deren Versionsschutz.">XP vergeben</button><button class="button" data-tool="notes">SL-Notiz</button><button class="button" data-send-to="${id}">${icon("send")} Brief</button></div><div class="mini-heading">Ausgewählte Werte · lesend</div><div class="char-list"><div class="char-row"><span>Wahrnehmung</span>${dots(id === "helena" ? 3 : 4)}</div><div class="char-row"><span>Menschenkenntnis</span>${dots(id === "helena" ? 4 : 2)}</div><div class="char-row"><span>Heimlichkeit</span>${dots(id === "helena" ? 2 : 4)}</div></div><details class="char-disclosure"><summary>Seltene Korrekturen & Freigaben</summary><p>Im echten System: dokumentierte Ausnahmen und kontrollierte Korrekturen. Bestätigte permanente Werte bleiben geschützt. Dieser Entwurf verändert keine Charakterwerte.</p></details>`;
}
function placeContent() {
  return `<div class="place-heading">${icon("map")}<div><p class="eyebrow">EIGENSTÄNDIGE ORTSAKTE</p><h3>Testsalon</h3><p>Synthetischer Ort · Position unbekannt</p></div></div><div class="notice">Die Ortsakte erklärt die Umgebung. Begegnungen und mögliche Ereignisse stehen im verknüpften Plotdossier.</div><div class="place-links"><button data-planned="Hier wird das vorhandene Ortsdossier eingebunden. Kein zweites Ortsmodell."><span>Räume & Atmosphäre</span><span>Ortsdossier ↗</span></button><button data-planned="Freigaben verwenden den bestehenden sicheren Location-Projektor."><span>Spielerfreigaben prüfen</span><span>Serverseitige Projektion ↗</span></button><button data-tool="story"><span>Ein Gespräch ohne Ausgang</span><span>Plotdossier ↗</span></button></div><p class="small muted">Keine erfundene Position, kein Beispielmarker. Electric Taberna bleibt im tatsächlichen System unverändert. Die Einbindung ihrer bestehenden Akte ist Teil der späteren Umsetzung.</p>`;
}
function mediaContent(panel) {
  const recipient = recipients.get(panel.id) || state.selected;
  const count = state.deliveries.length;
  return `<div class="media-top"><div><p class="eyebrow">VORBEREITETER INHALT · TEXT</p><h3>Die versiegelte Nachricht</h3><p>Öffnen ist keine Freigabe.</p></div><div class="media-illustration">${icon("letter")}</div></div><article class="letter"><p>Eine persönliche Nachricht, bewusst an eine ausgewählte Person ausgespielt.</p></article><label for="recipient-${panel.id}">Ausschließlich an</label><div class="send-controls"><select id="recipient-${panel.id}" data-recipient="${panel.id}" aria-label="Empfänger auswählen">${Object.entries(people).map(([id, person]) => `<option value="${id}" ${id === recipient ? "selected" : ""}>${person.name}</option>`).join("")}</select><button class="button primary" data-send-panel="${panel.id}">${icon("send")} Prüfen & senden</button></div><div class="media-bottom"><span>${count === 0 ? "Noch nicht ausgespielt" : `${count} Probeversand${count === 1 ? "" : "e"}`}</span><button data-inbox>Empfängersicht vergleichen ↗</button></div>`;
}
function logContent() {
  return `<p class="eyebrow">VERLAUF · SYNTHETISCHE PROBESITZUNG</p><h3>Was wirklich passiert ist.</h3><p class="small muted">Vorbereitete Möglichkeiten bleiben im Storybuch. Nur bewusst notierte Momente erscheinen hier.</p>${layout.mode === "after" ? `<div class="after-summary"><div><strong>${state.events.length}</strong><span>Notierte Ereignisse</span></div><div><strong>3</strong><span>Offene Möglichkeiten</span></div></div>` : ""}<button class="button primary" data-moment>${icon("plus")} Moment notieren</button>${state.events.length ? state.events.map((event) => `<article class="event"><time>${new Date(event.at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</time><div><span class="badge live">Tatsächlich notiert</span><p>${escape(event.text)}</p></div></article>`).join("") : `<p class="empty-note">Noch kein tatsächliches Ereignis notiert.<br>Die vorbereitete Geschichte bleibt offen.</p>`}<p class="small muted">Probeereignisse bleiben lokal. Es wird kein Kampagnenkanon erstellt.</p>`;
}
function render() {
  renderPeople();
  const headings = { prepare: ["Raum für die nächste Geschichte.", "Schreiben, verbinden, vorbereiten. Nichts davon veröffentlicht sich von selbst."], live: ["Der Abend gehört der Geschichte.", "Story offen halten. Menschen im Blick behalten. Bewusst ausspielen."], after: ["Die Nacht hinterlässt Spuren.", "Geschehenes prüfen. Offene Möglichkeiten bewahren. Wissen bewusst trennen."] };
  $("#mode-title").textContent = headings[layout.mode][0];
  $("#mode-caption").textContent = headings[layout.mode][1];
  document.querySelectorAll("[data-mode]").forEach((button) => { button.classList.toggle("active", button.dataset.mode === layout.mode); button.setAttribute("aria-pressed", String(button.dataset.mode === layout.mode)); });
  document.querySelectorAll(".toolrail [data-tool]").forEach((button) => button.classList.toggle("open", layout.panels.some((p) => p.tool === button.dataset.tool)));
  $("#desk").classList.toggle("focused", Boolean(layout.focused));
  $("#desk").style.setProperty("--split", `${layout.width}fr`);
  $("#desk").style.setProperty("--rest", `${100 - layout.width}fr`);
  $("#splitter").setAttribute("aria-valuenow", String(Math.round(layout.width)));
  for (const lane of [0, 1]) {
    const panels = layout.panels.filter((p) => p.lane === lane && (!layout.focused || layout.focused === p.id));
    $(`#lane-${lane}`).innerHTML = panels.map(panelMarkup).join("") || (layout.focused ? "" : `<div class="empty-lane">Werkzeug links öffnen<br>oder eine Akte in diese Spalte ziehen.</div>`);
  }
}
function openTool(tool) {
  const next = addPanel(layout, tool, crypto.randomUUID());
  if (next === layout) return toast("Maximal acht Werkzeuge im Konzept. Schließe zunächst eine Akte.");
  layout = next;
  saveLayout(); render();
  const panel = layout.panels.at(-1);
  $(`[data-panel="${panel.id}"]`)?.scrollIntoView({ block: "nearest" });
}
function setMode(mode) {
  saveLayout();
  const stored = storageRead(`${layoutKey(windowId)}-${mode}`);
  if (stored) layout = readLayout(stored, auxiliary);
  else {
    layout = createLayout(auxiliary);
    if (mode === "prepare") layout.panels = [{ ...layout.panels[0], tool: "story", lane: 0, size: "large" }, { ...layout.panels[1], tool: "places", lane: 1, size: "medium" }, { id: "prepare-notes", tool: "notes", lane: 1, size: "medium", binding: "follow", context: null }];
    if (mode === "after") layout.panels = [{ ...layout.panels[0], tool: "log", lane: 0, size: "large" }, { ...layout.panels[1], tool: "notes", lane: 1, size: "medium" }, { id: "after-story", tool: "story", lane: 1, size: "medium", binding: "follow", context: null }];
  }
  layout.mode = mode;
  layout.focused = null;
  saveLayout(); render();
}
function openSend(recipient) {
  pendingRecipient = people[recipient] ? recipient : state.selected;
  pendingDeliveryId = crypto.randomUUID();
  const person = people[pendingRecipient];
  $("#send-recipient").innerHTML = `<span class="initials">${person.initials}</span><div><strong>${person.name}</strong><small>Nur diese Person erhält die Beispielnachricht.</small></div>`;
  $("#send-dialog").showModal();
}
function renderInbox() {
  $("#player-tabs").innerHTML = Object.entries(people).map(([id, p]) => `<button data-inbox-person="${id}" class="${id === inboxPerson ? "active" : ""}" aria-pressed="${id === inboxPerson}">${p.name}</button>`).join("");
  const messages = deliveredTo(state, inboxPerson);
  $("#player-inbox").innerHTML = messages.length ? messages.map((message) => `<article class="letter"><p class="eyebrow">NUR FÜR ${people[inboxPerson].name.toUpperCase()}</p><h3>${escape(message.title)}</h3><p>${escape(message.text)}</p></article>`).join("") : `<div class="empty-note">${people[inboxPerson].name} hat keine Nachricht erhalten.</div>`;
}
function showMoment() { $("#moment-dialog").showModal(); $("#moment-text").focus(); }
function showSearch() { renderSearch(); $("#search-dialog").showModal(); $("#search-input").focus(); }
function renderSearch() {
  const needle = $("#search-input").value.trim().toLowerCase();
  $("#search-results").innerHTML = tools.filter((tool) => labels[tool].toLowerCase().includes(needle)).map((tool) => `<button data-search-tool="${tool}">${icon(iconNames[tool])}${labels[tool]}<span>Werkzeug öffnen ↗</span></button>`).join("") || `<p class="empty-note">Kein Konzeptwerkzeug gefunden.</p>`;
}
document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.person) updateState((current) => selectPerson(current, button.dataset.person));
  if (button.dataset.mode) setMode(button.dataset.mode);
  if (button.dataset.tool) openTool(button.dataset.tool);
  if (button.dataset.pin) { layout = togglePin(layout, button.dataset.pin, state); saveLayout(); render(); }
  if (button.dataset.closePanel) { layout.panels = layout.panels.filter((p) => p.id !== button.dataset.closePanel); if (layout.focused === button.dataset.closePanel) layout.focused = null; saveLayout(); render(); }
  if (button.dataset.focus) { layout.focused = layout.focused === button.dataset.focus ? null : button.dataset.focus; saveLayout(); render(); }
  if (button.dataset.size) { layout.panels = layout.panels.map((p) => p.id === button.dataset.id ? { ...p, size: button.dataset.size } : p); saveLayout(); render(); }
  if (button.dataset.arrange) {
    const panel = layout.panels.find((p) => p.id === button.dataset.id);
    if (button.dataset.arrange === "up") {
      const siblings = layout.panels.filter((p) => p.lane === panel.lane);
      const index = siblings.findIndex((p) => p.id === panel.id);
      if (index > 0) layout = movePanel(layout, panel.id, panel.lane, siblings[index - 1].id);
    } else layout = movePanel(layout, panel.id, button.dataset.arrange === "left" ? 0 : 1);
    saveLayout(); render();
  }
  if (button.dataset.storyTab) { storyTabs.set(button.dataset.id, button.dataset.storyTab); render(); }
  if (button.dataset.sendTo) openSend(button.dataset.sendTo);
  if (button.dataset.sendPanel) openSend(recipients.get(button.dataset.sendPanel) || state.selected);
  if (button.hasAttribute("data-inbox")) { renderInbox(); $("#player-dialog").showModal(); }
  if (button.dataset.inboxPerson) { inboxPerson = button.dataset.inboxPerson; renderInbox(); }
  if (button.hasAttribute("data-moment")) showMoment();
  if (button.hasAttribute("data-close-dialog")) button.closest("dialog").close();
  if (button.dataset.searchTool) { $("#search-dialog").close(); openTool(button.dataset.searchTool); }
  if (button.dataset.planned) toast(`${button.dataset.planned} Noch nicht in diesem Konzept implementiert.`);
});
document.addEventListener("change", (event) => {
  if (event.target.dataset.recipient) recipients.set(event.target.dataset.recipient, event.target.value);
});
document.addEventListener("input", (event) => {
  const key = event.target.dataset.note;
  if (key === "notes" || key === "storyNote") {
    const text = event.target.value;
    updateState((current) => ({ ...current, [key]: text, version: current.version + 1 }), false);
    event.target.parentElement.querySelector("[data-note-status]").textContent = storageAvailable ? "Konzepttext lokal gemerkt · keine Kampagnendatenbank" : "Speicherung nicht verfügbar · Text nur in diesem Fenster";
  }
});
$("#send-confirm").addEventListener("click", () => {
  const recipient = pendingRecipient;
  if (!recipient || !pendingDeliveryId) return;
  updateState((current) => sendDemo(current, recipient, pendingDeliveryId));
  pendingDeliveryId = null;
  $("#send-dialog").close();
  toast(`Beispielnachricht ausschließlich an ${people[recipient].name} ausgespielt.`);
});
$("#moment-save").addEventListener("click", () => {
  const text = $("#moment-text").value.trim();
  if (!text) { $("#moment-text").setCustomValidity("Beschreibe zunächst einen tatsächlichen Moment."); $("#moment-text").reportValidity(); return; }
  $("#moment-text").setCustomValidity("");
  updateState((current) => recordOccurrence(current, text, crypto.randomUUID()));
  $("#moment-text").value = ""; $("#moment-dialog").close(); toast("Tatsächlicher Probemoment notiert. Keine Storymöglichkeit automatisch abgeschlossen.");
});
$("#moment-text").addEventListener("input", () => $("#moment-text").setCustomValidity(""));
$("#moment-open").addEventListener("click", showMoment);
$("#search-open").addEventListener("click", showSearch);
$("#search-input").addEventListener("input", renderSearch);
$("#help-open").addEventListener("click", () => $("#help-dialog").showModal());
$("#add-character").addEventListener("click", () => openTool("character"));
$("#layout-reset").addEventListener("click", () => { layout = createLayout(auxiliary); saveLayout(); render(); toast("Anordnung zurückgesetzt. Probeinhalte bleiben erhalten."); });
$("#second-window").addEventListener("click", () => {
  const opened = window.open(`${location.origin}${location.pathname}?window=aux`, "chroniplay-cc2-concept-aux", "popup,width=1280,height=900");
  if (!opened) toast("Fenster wurde vom Browser blockiert. Erlaube das zweite lokale Konzeptfenster.");
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); if (!document.querySelector("dialog[open]")) showSearch(); }
});
const splitter = $("#splitter");
splitter.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  layout.width = event.key === "Home" ? 38 : event.key === "End" ? 74 : Math.max(38, Math.min(74, layout.width + (event.key === "ArrowLeft" ? -2 : 2)));
  $("#desk").style.setProperty("--split", `${layout.width}fr`); $("#desk").style.setProperty("--rest", `${100 - layout.width}fr`); splitter.setAttribute("aria-valuenow", String(Math.round(layout.width))); saveLayout();
});
splitter.addEventListener("pointerdown", (event) => {
  event.preventDefault(); splitter.setPointerCapture(event.pointerId);
  const rect = $("#desk").getBoundingClientRect();
  const drag = (e) => {
    layout.width = Math.max(38, Math.min(74, 100 * (e.clientX - rect.left) / rect.width));
    $("#desk").style.setProperty("--split", `${layout.width}fr`); $("#desk").style.setProperty("--rest", `${100 - layout.width}fr`); splitter.setAttribute("aria-valuenow", String(Math.round(layout.width)));
  };
  const end = () => { splitter.removeEventListener("pointermove", drag); splitter.removeEventListener("pointerup", end); splitter.removeEventListener("pointercancel", end); saveLayout(); };
  splitter.addEventListener("pointermove", drag); splitter.addEventListener("pointerup", end); splitter.addEventListener("pointercancel", end);
});
document.addEventListener("dragstart", (event) => {
  const header = event.target.closest("[data-drag]");
  if (!header || event.target.closest("button,summary")) { event.preventDefault(); return; }
  event.dataTransfer.setData("text/plain", header.dataset.drag); event.dataTransfer.effectAllowed = "move";
});
document.querySelectorAll("[data-lane]").forEach((lane) => {
  lane.addEventListener("dragover", (event) => { event.preventDefault(); lane.classList.add("drag-over"); });
  lane.addEventListener("dragleave", (event) => { if (!lane.contains(event.relatedTarget)) lane.classList.remove("drag-over"); });
  lane.addEventListener("drop", (event) => {
    event.preventDefault(); lane.classList.remove("drag-over");
    const id = event.dataTransfer.getData("text/plain");
    const target = event.target.closest("[data-panel]")?.dataset.panel;
    if (id === target) return;
    layout = movePanel(layout, id, Number(lane.dataset.lane), target); saveLayout(); render();
  });
});
hydrateIcons(); render();
