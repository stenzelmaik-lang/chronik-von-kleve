import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadNPCList, loadNPCDetail } from '../app/spielbereich/modules/npc-data.ts';

test('NPC list uses M1 entities only', async () => {
  const paths = [];
  const result = await loadNPCList(async path => { paths.push(path); return {entities:[{id:'npc',type:'NPC'},{id:'place',type:'PLACE'}]}; });
  assert.deepEqual(paths, ['/api/entities?type=NPC&includeRedacted=1&view=player']);
  assert.deepEqual(result.map(e => e.id), ['npc']);
});
test('NPC detail loads original, ordered blocks and relationships; player presentation excludes secrets', async () => {
  const paths = [];
  const request = async path => {
    paths.push(path);
    if (path.startsWith('/api/entities')) return {entities:[{id:'npc',type:'NPC'}]};
    if (path.startsWith('/api/content-blocks')) return {blocks:[
      {id:'last',entityId:'npc',position:5,visibility:'player_visible'},
      {id:'secret',entityId:'npc',position:0,visibility:'sl_secret',content:'SECRET'},
      {id:'first',entityId:'npc',position:1,visibility:'player_visible'},
    ]};
    return {relationships:[{id:'r',sourceId:'npc',targetId:'place',type:'located_at'}]};
  };
  const player = await loadNPCDetail(request,'npc',false);
  assert.deepEqual(player.blocks.map(b=>b.id), ['first','last']);
  assert.equal(JSON.stringify(player).includes('SECRET'),false);
  assert.equal(player.relationships[0].targetId,'place');
  const detailPaths=['/api/entities?id=npc&type=NPC','/api/content-blocks?entityId=npc','/api/relationships?entityId=npc','/api/entities?id=place'];
  assert.deepEqual(paths,detailPaths.map(path=>path+'&view=player'));
  paths.length=0;
  assert.deepEqual((await loadNPCDetail(request,'npc',true)).blocks.map(b=>b.id),['secret','first','last']);
  assert.deepEqual(paths,detailPaths.map(path=>path+'&view=sl'));
});
test('missing original or denied child requests cannot produce partial detail', async () => {
  await assert.rejects(loadNPCDetail(async () => ({entities:[],blocks:[],relationships:[]}), 'npc',false), /NPC nicht gefunden/);
  await assert.rejects(loadNPCDetail(async () => { throw new Error('Forbidden'); },'npc',false), /Forbidden/);
});
test('NPC workspace uses read panel and bypasses legacy fetch; other legacy paths remain', () => {
  const workspace = readFileSync(new URL('../app/spielbereich/workspace.tsx',import.meta.url),'utf8');
  const data = readFileSync(new URL('../app/spielbereich/modules/use-workspace-data.ts',import.meta.url),'utf8');
  assert.match(workspace,/section === "nscs" \? \(\s*<NPCPanel/);
  assert.match(data,/\[[^\]]*"nscs"[^\]]*\]\.includes\(section\)\)\s*return `empty:\$\{section\}`/);
  assert.match(data,/if \(pathFor\(section, inspection\)\.startsWith\('empty:'\)\)\s*return empty/);
  assert.match(data,/\/api\/records\?kind=/);
  const panel = readFileSync(new URL('../app/spielbereich/modules/npc-panel.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(panel,/RecordEditor|\/api\/records/);
});
