import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {npcReferencesVisibleFile} from '../server/npc-file-access.ts';
const player={id:'player',campaignId:'c',status:'active',gm:false,role:'player'};
const entity={id:'npc',campaignId:'c',type:'NPC',ownerId:'gm',visibility:'sl',canonStatus:'confirmed',defaultVisibility:'player_visible',title:'NPC',content:{image_primary:'/api/files?id=primary',image_secondary:'/api/files?id=secondary',field_visibility:{image_primary:'player_visible',image_secondary:'sl_secret'}},gmBody:''};
test('NPC image reads require both entity access and explicit field release',()=>{
 assert.equal(npcReferencesVisibleFile(player,[entity],[],'primary'),true);
 assert.equal(npcReferencesVisibleFile(player,[entity],[],'secondary'),false);
 assert.equal(npcReferencesVisibleFile(player,[{...entity,defaultVisibility:'sl_secret'}],[],'primary'),false);
 assert.equal(npcReferencesVisibleFile(player,[{...entity,canonStatus:'GM_SECRET'}],[],'primary'),false);
 assert.equal(npcReferencesVisibleFile(player,[{...entity,campaignId:'other'}],[],'primary'),false);
 assert.equal(npcReferencesVisibleFile(player,[entity],[],'unlinked'),false);
 assert.equal(npcReferencesVisibleFile(player,[{...entity,content:{...entity.content,field_visibility:{}}}],[],'primary'),false);
});
test('NPC uploads are staged until save, SL-protected, image-only and bounded',()=>{
 const source=readFileSync('app/spielbereich/modules/npc-editor.tsx','utf8');
 assert.match(source,/type="file" accept="image\/jpeg,image\/png,image\/webp"/);
 assert.match(source,/form\.set\('visibility','sl'\)/);
 assert.match(source,/file\.size>10\*1024\*1024/);
 assert.match(source,/Promise\.allSettled\(uploaded\.map/);
 const save=source.indexOf('async function save');
 assert.ok(source.indexOf("api<{id:string}>('/api/files','POST',form)")>save);
});
