import test from "node:test";
import assert from "node:assert/strict";
import { createLayout, createState, readLayout, contextFor, togglePin, movePanel, addPanel, selectPerson, sendDemo, deliveredTo, recordOccurrence } from "./prototype/model.mjs";

test("a pinned character remains Helena while following tools move to Corvina", () => {
  let layout = createLayout(); let state = createState();
  layout = togglePin(layout, "char-main", state);
  layout = addPanel(layout, "character", "second-character");
  state = selectPerson(state, "corvina");
  assert.equal(contextFor(layout.panels.find((p) => p.id === "char-main"), state), "helena");
  assert.equal(contextFor(layout.panels.find((p) => p.id === "second-character"), state), "corvina");
  assert.equal(layout.panels[0].tool, "story");
  layout = togglePin(layout, "char-main", state);
  assert.equal(contextFor(layout.panels.find((p) => p.id === "char-main"), state), "corvina");
});
test("multiple character instances can be reordered without changing pin or deleting the story", () => {
  let layout = togglePin(createLayout(), "char-main", createState());
  layout = addPanel(layout, "character", "second-character");
  layout = movePanel(layout, "second-character", 0, "story-main");
  assert.equal(layout.panels[0].id, "second-character");
  assert.equal(layout.panels.find((p) => p.id === "char-main").binding, "pinned");
  assert.equal(layout.panels.filter((p) => p.tool === "character").length, 2);
  assert.equal(layout.panels.filter((p) => p.tool === "story").length, 1);
});
test("layout roundtrip preserves independent instances and clamps damaged values", () => {
  const expected = togglePin(createLayout(), "char-main", createState());
  assert.deepEqual(readLayout(JSON.parse(JSON.stringify(expected))), expected);
  const malformed = { width: 150, focused: "missing", panels: [{ ...expected.panels[1], context: "not-a-person" }, expected.panels[1], { id: "no-tool", tool: "admin" }] };
  const restored = readLayout(malformed);
  assert.equal(restored.width, 74); assert.equal(restored.focused, null);
  assert.equal(restored.panels.length, 1); assert.equal(restored.panels[0].binding, "follow");
});
test("two window layouts share a person selection without sharing panel positions", () => {
  const main = togglePin(createLayout(), "char-main", createState());
  const aux = createLayout(true);
  const state = selectPerson(createState(), "corvina");
  assert.equal(contextFor(main.panels[1], state), "helena");
  assert.equal(contextFor(aux.panels[1], state), "corvina");
  assert.notDeepEqual(main.panels, aux.panels);
});
test("demo delivery is explicit, recipient-scoped and idempotent", () => {
  const initial = createState();
  assert.equal(deliveredTo(initial, "helena").length, 0);
  const sent = sendDemo(initial, "helena", "send-1");
  assert.equal(deliveredTo(sent, "helena").length, 1);
  assert.equal(deliveredTo(sent, "corvina").length, 0);
  assert.equal(sendDemo(sent, "helena", "send-1"), sent);
  assert.equal(sendDemo(sent, "unknown", "send-2"), sent);
  assert.equal(sent.events.length, 0);
});
test("only an explicit occurrence creates a log event, with safe length and duplicate protection", () => {
  let state = createState();
  state = selectPerson(state, "corvina");
  state = sendDemo(state, "helena", "send-1");
  assert.equal(state.events.length, 0);
  assert.equal(recordOccurrence(state, " ", "event-1"), state);
  const recorded = recordOccurrence(state, "Die Gruppe verlässt das Gespräch.", "event-1");
  assert.equal(recorded.events.length, 1); assert.equal(recorded.events[0].kind, "occurred");
  assert.equal(recordOccurrence(recorded, "Nochmals", "event-1"), recorded);
  assert.equal(recordOccurrence(recorded, "x".repeat(900), "event-2").events[1].text.length, 800);
});
