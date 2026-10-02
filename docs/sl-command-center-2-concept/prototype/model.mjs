// Standalone design model. It never reads application data or calls its APIs.
export const tools = Object.freeze(["story", "character", "places", "media", "notes", "log"]);
export const people = Object.freeze({
  helena: { name: "Helena", initials: "HE", clan: "Toreador", blood: 8, will: 5, xp: 12, health: "Unverletzt" },
  corvina: { name: "Corvina", initials: "CO", clan: "Nosferatu", blood: 6, will: 4, xp: 9, health: "Verletzt · −1" },
});
export const stateKey = "chroniplay-cc2-concept-state-v1";
export const layoutKey = (windowId) => `chroniplay-cc2-concept-layout-v1-${windowId}`;
export const createState = () => ({ selected: "helena", notes: "", storyNote: "", deliveries: [], events: [], version: 0 });
export function createLayout(auxiliary = false) {
  return {
    mode: "live", width: 61, focused: null,
    panels: auxiliary
      ? [{ id: "aux-media", tool: "media", lane: 0, size: "large", binding: "follow", context: null }, { id: "aux-character", tool: "character", lane: 1, size: "large", binding: "follow", context: null }]
      : [{ id: "story-main", tool: "story", lane: 0, size: "large", binding: "follow", context: null }, { id: "char-main", tool: "character", lane: 1, size: "medium", binding: "follow", context: null }, { id: "media-main", tool: "media", lane: 1, size: "medium", binding: "follow", context: null }],
  };
}
export function readLayout(value, auxiliary = false) {
  if (!value || !Array.isArray(value.panels) || value.panels.length > 8) return createLayout(auxiliary);
  const ids = new Set();
  const panels = value.panels.filter((p) => p && typeof p.id === "string" && tools.includes(p.tool) && !ids.has(p.id) && ids.add(p.id)).map((p) => ({
    id: p.id, tool: p.tool, lane: p.lane === 1 ? 1 : 0,
    size: ["small", "medium", "large"].includes(p.size) ? p.size : "medium",
    binding: p.binding === "pinned" && people[p.context] ? "pinned" : "follow",
    context: people[p.context] ? p.context : null,
  }));
  return { panels, mode: ["prepare", "live", "after"].includes(value.mode) ? value.mode : "live", width: Math.min(74, Math.max(38, Number(value.width) || 61)), focused: panels.some((p) => p.id === value.focused) ? value.focused : null };
}
export function contextFor(panel, state) {
  return panel.binding === "pinned" && people[panel.context] ? panel.context : state.selected;
}
export function togglePin(layout, id, state) {
  return { ...layout, panels: layout.panels.map((p) => p.id === id ? { ...p, binding: p.binding === "pinned" ? "follow" : "pinned", context: p.binding === "pinned" ? null : state.selected } : p) };
}
export function movePanel(layout, id, lane, beforeId = null) {
  const found = layout.panels.find((p) => p.id === id);
  if (!found || (lane !== 0 && lane !== 1)) return layout;
  const panels = layout.panels.filter((p) => p.id !== id);
  const target = panels.findIndex((p) => p.id === beforeId && p.lane === lane);
  panels.splice(target < 0 ? panels.length : target, 0, { ...found, lane });
  return { ...layout, panels };
}
export function addPanel(layout, tool, id) {
  if (!tools.includes(tool) || layout.panels.length >= 8 || layout.panels.some((p) => p.id === id)) return layout;
  return { ...layout, focused: null, panels: [...layout.panels, { id, tool, lane: tool === "story" ? 0 : 1, size: "medium", binding: "follow", context: null }] };
}
export function selectPerson(state, id) {
  return people[id] ? { ...state, selected: id, version: state.version + 1 } : state;
}
export function sendDemo(state, recipient, id) {
  if (!people[recipient] || !id || state.deliveries.some((d) => d.id === id)) return state;
  return { ...state, version: state.version + 1, deliveries: [...state.deliveries, { id, recipient, title: "Die versiegelte Nachricht", text: "Dies ist eine synthetische persönliche Nachricht. Sie enthält keinen Kampagnenkanon.", at: Date.now() }] };
}
export const deliveredTo = (state, recipient) => state.deliveries.filter((d) => d.recipient === recipient);
export function recordOccurrence(state, text, id) {
  const clean = String(text).trim().slice(0, 800);
  if (!clean || !id || state.events.some((event) => event.id === id)) return state;
  return { ...state, version: state.version + 1, events: [...state.events, { id, text: clean, at: Date.now(), kind: "occurred" }] };
}
