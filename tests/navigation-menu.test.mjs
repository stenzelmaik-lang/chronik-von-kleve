import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {commandCenterLinks,sections,worldSections} from '../app/spielbereich/modules/navigation.ts';

const shell=readFileSync(new URL('../app/spielbereich/modules/shell.tsx',import.meta.url),'utf8');

test('header (4c v3): Zuflucht, world and command center as dropdowns, Kampagnen beside the campaign name, no side menu', () => {
  assert.ok(shell.includes('<span>Zuflucht</span>'));
  assert.ok(!shell.includes('<span>Spieltisch</span>'),'the table is entered with the button on the Zuflucht');
  assert.ok(shell.indexOf('<span>Kampagnen</span>')<shell.indexOf('aria-label="Hauptnavigation"'),'Kampagnen sits left beside the campaign name');
  assert.ok(shell.includes('label="Die Welt"')&&shell.includes('label="Command Center"'));
  assert.ok(/a\.gm&&<Dropdown label="Command Center"/.test(shell),'only the SL sees the command center dropdown');
  assert.ok(!shell.includes('PlayerMenu')&&!shell.includes('Hauptmenü'),'no side menu');
  assert.ok(!shell.includes('Chronik erkunden')&&!shell.includes('Zur Spielerzentrale'));
});

test('the world dropdown is sorted as agreed and the command center jumps into its areas', () => {
  assert.deepEqual(worldSections.map(s=>s.name),['Orte','Chronik','Persönlichkeiten','Überlieferungen','Codex Noctis','Neuigkeiten','Händler']);
  assert.deepEqual(commandCenterLinks.map(l=>l.label),['Spieltisch-Regie','Charaktere','Persönlichkeiten (NSC)','Ortsverwaltung','Materialvorbereitung','Galerie (Dateien)','Rückblicke & Chronik','Chronik-CMS']);
  assert.ok(commandCenterLinks.every(l=>/^\/(sl\/command-center|spielbereich)\?bereich=[a-z]+$/.test(l.href)));
});

test('names follow the glossary; retired names are gone', () => {
  const name=id=>sections.find(s=>s.id===id).name;
  assert.equal(name('dashboard'),'Zuflucht');assert.equal(name('sitzung'),'Spieltisch');assert.equal(name('schauplaetze'),'Orte');assert.equal(name('archiv'),'Überlieferungen');assert.equal(name('galerie'),'Galerie');
  assert.equal(new Set(sections.map(s=>s.id)).size,sections.length);
  assert.ok(!sections.some(s=>/Spielerzentrale|Bilder & Dateien|Schauplätze|Chronik erkunden/.test(s.name)));
});
