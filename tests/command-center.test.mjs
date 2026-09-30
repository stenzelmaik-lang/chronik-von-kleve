import assert from 'node:assert/strict';
import {test} from 'node:test';
import {commandCenterAllowed,commandHandouts} from '../domain/command-center.ts';
const gm={status:'active',gm:true,role:'campaign_gm'};
test('Command center requires active campaign SL role, not a platform flag',()=>{
 assert.equal(commandCenterAllowed(gm),true);
 for(const patch of [{gm:false},{role:'campaign_editor'},{role:'player'},{role:'platform_admin'},{status:'blocked'},{status:'pending'}])assert.equal(commandCenterAllowed({...gm,...patch}),false);
});
test('Handout candidates exclude recovery, secrets and foreign campaign data',()=>{
 const h={id:'h',campaignId:'c',type:'HANDOUT',canonStatus:'WORKING',content:{text:'allowed'}};
 const variants=[h,{...h,id:'foreign',campaignId:'other'},{...h,id:'secret',canonStatus:'GM_SECRET'},{...h,id:'recovery',content:{recoveryOnly:true}},{...h,id:'nested',content:{canon_status:'GM_SECRET'}},{...h,id:'character',type:'CHARACTER'}];
 assert.deepEqual(commandHandouts(variants,'c').map(e=>e.id),['h']);
});
