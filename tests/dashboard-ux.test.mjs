import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const dashboard=readFileSync(new URL('../app/spielbereich/modules/dashboard.tsx',import.meta.url),'utf8');
const shell=readFileSync(new URL('../app/spielbereich/modules/shell.tsx',import.meta.url),'utf8');
const command=readFileSync(new URL('../app/spielbereich/modules/command-workspace.tsx',import.meta.url),'utf8');
test('overview follows the approved character/calendar, information and preparation order',()=>{
  const blocks=['styles.top','styles.information','styles.preparation}'].map(name=>dashboard.indexOf(name));
  assert.ok(blocks.every(index=>index>=0));
  assert.deepEqual(blocks,[...blocks].sort((a,b)=>a-b));
  assert.ok(!dashboard.includes('SCHNELLAKTIONEN'));
  assert.ok(!dashboard.includes('dashboard-grid'));
  assert.ok(dashboard.includes('Spieltisch betreten'));
});

test('overview reuses existing destinations and distinguishes legacy XP',()=>{
  assert.ok(dashboard.includes('kein bestätigter XP-Ledger-Saldo'));
  for(const destination of ['sitzung','termine'])assert.ok(dashboard.includes(`onNavigate('${destination}')`));
  for(const destination of ['charaktere','inventar','postfach','notizen','gefallen','wirtschaft'])assert.ok(dashboard.includes(`href={preparationHref('${destination}')}`));
  const nav=readFileSync(new URL('../app/spielbereich/modules/navigation.ts',import.meta.url),'utf8');
  assert.ok(!shell.includes('Chronik erkunden'),'4c: Die Welt steht im Menü, nicht in der Kopfleiste');
  assert.ok(shell.includes('label="Die Welt"'));
  assert.ok(shell.includes('showTrigger={false}'));
  for(const id of ['wuerfel','weltkarte'])assert.match(nav,new RegExp('id: "'+id+'"[^}]*mainNav: false'),id+' stays reachable but leaves the menu');
  assert.ok(!shell.includes('Zur Spielerzentrale'),'4c: Zuflucht steht fest in der Kopfleiste');
  assert.ok(!shell.includes('Journal & mehr'));
});

test('mobile icon actions retain accessible names and neutral context',()=>{
  assert.ok(shell.includes('aria-label="ChroniPlay – Zuflucht"'));
  assert.ok(command.includes('Veröffentlichten Gruppenblick öffnen'));
  assert.ok(!shell.includes('Aktive Nacht'));
  assert.ok(shell.includes('Kontomenü'));
});
test('mobile scene ordering copies panels and contextual tools remain mounted',()=>{
  const board=readFileSync(new URL('../app/spielbereich/modules/command-board.tsx',import.meta.url),'utf8');
  assert.ok(board.includes('[...workspace.panels].sort'));
  assert.ok(board.includes('<SceneToolDrawer'));
  assert.ok(board.includes('content:frame(p)'));
  assert.ok(command.includes('In der Regie ausgewählte Sitzung'));
});
test('player in-context dice reuse the existing raw-roll tool without preview exposure',()=>{
  const player=readFileSync(new URL('../app/spielbereich/modules/command-player-session.tsx',import.meta.url),'utf8');
  assert.ok(player.includes("import { DicePanel } from './dice'"));
  assert.ok(player.includes('!preview && <SceneToolDrawer'));
  assert.ok(player.includes('Rohwurf ohne Buchung'));
});
test('overview current scene comes from the authenticated player projection',()=>{
  const scene=readFileSync(new URL('../app/spielbereich/modules/dashboard-scene.tsx',import.meta.url),'utf8');
  assert.ok(scene.includes('/api/session-scenes'));
  assert.ok(!scene.includes('/api/command-center'));
  assert.ok(scene.includes("run.status === 'active'"));
  assert.ok(scene.includes('result.key === key'));
});
test('layout resizing is only available in the explicit arrangement mode',()=>{
  const board=readFileSync(new URL('../app/spielbereich/modules/command-board.tsx',import.meta.url),'utf8');
  assert.equal((board.match(/<Separator disabled=\{!arranging\}/g)||[]).length,2);
});
test('the session drawer uses the notebook: private pages, drafts in the shared player cache, no browser storage',()=>{
  const player=readFileSync(new URL('../app/spielbereich/modules/command-player-session.tsx',import.meta.url),'utf8');
  const notebook=readFileSync(new URL('../app/spielbereich/modules/notebook/notebook.tsx',import.meta.url),'utf8');
  const route=readFileSync(new URL('../app/api/notebook/route.ts',import.meta.url),'utf8');
  assert.ok(player.includes('<Notebook a={a} layout="narrow"/>'));
  assert.ok(notebook.includes('currentPlayerDataScope()'));
  assert.ok(!notebook.includes('localStorage'));
  assert.ok(route.includes("VALUES(?,?,'notizen','private'"));
});
test('player read errors are not presented as an empty scene or unopened session',()=>{
  const player=readFileSync(new URL('../app/spielbereich/modules/command-player-session.tsx',import.meta.url),'utf8');
  assert.ok(player.includes('!error&&<ScenePlayerView'));
  assert.ok(player.includes('!loading&&!error&&<SessionPanel'));
  assert.ok(player.includes('Freigegebener Spielstand wird geladen …'));
});
