import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectEntity} from '../server/entities.ts';
import {npcSaveSchema} from '../domain/npc-authoring.ts';
import {npcReadingSections,npcIdentityFacts} from '../app/spielbereich/modules/npc-dossier-data.ts';
import {npcCardData} from '../app/spielbereich/modules/npc-card-data.ts';
const gm={id:'gm',campaignId:'c',role:'campaign_gm',gm:true,status:'active'},player={...gm,id:'player',role:'player',gm:false};
const entity={id:'npc',type:'NPC',campaignId:'c',title:'Secret name',canonStatus:'confirmed',playState:null,defaultVisibility:'player_visible',visibility:'sl',ownerId:'gm',legacyRecordId:null,content:{title:'Secret epithet',role:'Secret role',clan:'Secret clan',generation:6,npc_status:'Aktiv',image_primary:'/api/files?id=secret',field_visibility:{}}};

test('Structured NPC fields fail closed; explicit releases never reveal other fields or raw map',()=>{
  const original=structuredClone(entity);const hidden=projectEntity(player,entity,[]);
  assert.equal(hidden.title,'Unbekannte Persönlichkeit');assert.deepEqual(hidden.content,{field_visibility:{}});
  const partial=projectEntity(player,{...entity,content:{...entity.content,field_visibility:{name:'player_visible',role:'player_visible',generation:'sl_secret'}}},[]);
  assert.equal(partial.title,'Secret name');assert.equal(partial.content.role,'Secret role');assert.ok(!('generation' in partial.content));assert.ok(!('image_primary' in partial.content));
  assert.deepEqual(projectEntity(gm,entity,[]),entity);assert.deepEqual(entity,original);
  assert.equal(projectEntity(player,{...entity,defaultVisibility:'sl_secret'},[]),null);
});
test('New fields without a visibility map stay secret, independent of a legacy group grant',()=>{
  const content={...entity.content};delete content.field_visibility;
  const result=projectEntity(player,{...entity,legacyRecordId:'legacy',visibility:'group',content},[]);
  assert.deepEqual(result.content,{field_visibility:{}});assert.equal(result.title,'Unbekannte Persönlichkeit');
});
test('NPC status is distinct from canon status; generation and visibility inputs are bounded',()=>{
  const payload={title:'Silas Vance',canonStatus:'confirmed',playState:null,defaultVisibility:'sl_secret',profile:{npc_status:'Aktiv',generation:6,field_visibility:{clan:'sl_secret'}},blocks:[],retainedRelationships:[],addedRelationships:[]};
  assert.ok(npcSaveSchema.safeParse(payload).success);
  for(const patch of [{canonStatus:'Aktiv'},{profile:{generation:21}},{profile:{field_visibility:{clan:'group'}}},{profile:{image_primary:'https://bad.invalid/image.png'}}])assert.equal(npcSaveSchema.safeParse({...payload,...patch}).success,false);
  assert.equal(npcIdentityFacts(entity).find(f=>f.key==='npc_status').value,'Aktiv');
  assert.equal(npcIdentityFacts(entity).some(f=>f.value==='confirmed'),false);
  assert.equal(npcCardData(entity,false).facts.some(f=>f.label==='Kanon'),false);
});
test('Reading categories preserve positions and omit empty or unreleased blocks',()=>{
  const blocks=[['b','biography','Second',3,'sl_secret'],['a','biography','First',1,'sl_secret'],['s','short_profile','Short',5,'sl_secret'],['p','personality','Personality',2,'player_visible'],['e','biography','  ',0,'sl_secret'],['i','sl_agenda','Private',4,'sl_secret']].map(([id,kind,content,position,visibility])=>({id,kind,content,position,visibility,entityId:'npc'}));
  const result=npcReadingSections(blocks,true);assert.deepEqual(result.biography.map(b=>b.id),['a','b']);assert.equal(result.short[0].id,'s');assert.equal(result.internal[0].id,'i');
  const publicResult=npcReadingSections(blocks,false);assert.equal(publicResult.personality.length,1);assert.deepEqual(publicResult.internal,[]);assert.deepEqual(publicResult.biography,[]);
});
test('Explicit SL block kinds cannot be authored publicly and remain hidden on corrupt reads',()=>{
  const payload={title:'A',canonStatus:'draft',playState:null,defaultVisibility:'player_visible',profile:{},blocks:[{kind:'sl_secrets',content:'SECRET',position:0,visibility:'player_visible'}],retainedRelationships:[],addedRelationships:[]};
  assert.equal(npcSaveSchema.safeParse(payload).success,false);assert.equal(npcReadingSections([{...payload.blocks[0],id:'x'}],false).internal.length,0);
});
test('NPC detail has exact section ordering, no empty placeholders, and protected image references',()=>{
  const source=readFileSync('app/spielbereich/modules/npc-dossier.tsx','utf8').split("if(entity.type==='NPC'){")[1].split('return <article className={styles.dossier}>')[0];
  const full=readFileSync('app/spielbereich/modules/npc-dossier.tsx','utf8');
  let position=full.indexOf("if(entity.type==='NPC'){");for(const label of ['Kurzprofil','Biografie','Persönlichkeit','Beziehungen','Weltverknüpfungen','SL-INTERN']){const next=full.indexOf('aria-label="'+label+'"',position);assert.ok(next>position,label);position=next;}
  assert.match(source,/image_secondary/);assert.match(full,/relation.note/);assert.match(full,/reading.biography.length>0\|\|legacyBio/);assert.doesNotMatch(full,/Wird später vollständig ausgearbeitet/);
  const editor=readFileSync('app/spielbereich/modules/npc-editor.tsx','utf8');assert.match(editor,/id=\{'npc-profile-'\+key\}/);assert.match(editor,/id="npc-title"/);
});
