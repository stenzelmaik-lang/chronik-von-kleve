import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const source = readFileSync(new URL('../app/spielbereich/modules/scene-tool-drawer.tsx', import.meta.url), 'utf8');
test('scene tool selection is exclusive and an active icon closes its panel', () => {
  assert.ok(source.includes('setActive(active === tool.id ? null : tool.id)'));
  assert.ok(source.includes('hidden={active !== tool.id}'));
  assert.ok(source.includes('hidden={!current}'));
});
test('scene tools retain visited content and restore keyboard focus on Escape', () => {
  assert.ok(source.includes('opened.includes(tool.id)'));
  assert.ok(source.includes("event.key === 'Escape'"));
  assert.ok(source.includes('triggers.current[active]?.focus()'));
  assert.ok(source.includes('aria-expanded={active === tool.id}'));
});
