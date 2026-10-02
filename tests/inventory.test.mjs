import {test} from 'node:test';
import assert from 'node:assert/strict';
import {carryProfiles,bodySlots} from '../domain/inventory.ts';
import {deriveCarry,placementIssue,concealmentWarning,openlyCarried,slotCategoryIssue,statusForLocation} from '../domain/inventory-rules.ts';
const item=(changes={})=>({id:'item.a',characterId:'character.a',name:'Synthetic item',category:'Werkzeug',description:'',quantity:1,status:'Mitgeführt',visibility:'private',tags:[],slotCost:1,location:'BACKPACK',lifecycleStatus:'ACTIVE',revision:1,createdAt:'test',updatedAt:'test',canEdit:true,testData:true,...changes});
test('inventory profiles keep the confirmed 4/8/12/20 capacities and stable identifiers',()=>assert.deepEqual(Object.values(carryProfiles).map(p=>p.capacity),[4,8,12,20]));
test('body and backpack share capacity, storage and archived entries do not',()=>{
 const entries=[item({location:'BODY',bodySlot:'HAND_LEFT',slotCost:2}),item({id:'item.b',slotCost:2}),item({id:'item.c',location:'STORED',slotCost:20}),item({id:'item.d',lifecycleStatus:'ARCHIVED',slotCost:20})];
 assert.equal(deriveCarry('BODY_ONLY',4,entries).used,4);
 assert.equal(placementIssue(deriveCarry('BODY_ONLY',4,entries),entries,item({id:'item.new'})),'Trageprofil überschritten: 1 Slots müssen zuerst gelagert werden.');
});
test('quantity and optional weight preserve the existing per-entry slot rule',()=>assert.equal(deriveCarry('BODY_ONLY',0,[item({quantity:900,weightKg:9000})]).used,1));
test('moving the same item deducts its previous capacity instead of double counting',()=>{
 const old=item({slotCost:4}); const carry=deriveCarry('BODY_ONLY',1,[old]);
 assert.equal(placementIssue(carry,[old],{...old,location:'BODY',bodySlot:'HAND_LEFT'}),null);
 assert.equal(placementIssue(carry,[old],{...old,location:'STORED',slotCost:20}),null);
});
test('body slot collision is rejected; moving that slot owner remains possible',()=>{
 const old=item({location:'BODY',bodySlot:'HAND_LEFT'}),carry=deriveCarry('BODY_ONLY',1,[old]);
 assert.match(placementIssue(carry,[old],item({id:'item.b',location:'BODY',bodySlot:'HAND_LEFT'})),/Linke Hand.*Synthetic item/);
 assert.equal(placementIssue(carry,[old],{...old,description:'changed'}),null);
});
test('wearable positions extend rather than rename legacy pocket and weapon positions',()=>{
 assert.ok(['HEAD','EYES','TORSO','OUTERWEAR','GLOVES','LEGS','FEET','ACCESSORY','COAT_INNER','HAND_LEFT','BACK_EXTERNAL','JACKET_INNER_LEFT','TROUSER_POCKET_RIGHT'].every(s=>bodySlots.includes(s)));
 assert.equal(new Set(bodySlots).size,bodySlots.length);
});
test('wearable slots accept clothing and protection, weapons cannot become a helmet',()=>{
 assert.equal(slotCategoryIssue('Kleidung','HEAD'),null);
 assert.equal(slotCategoryIssue('Schutz / Rüstung','TORSO'),null);
 assert.match(slotCategoryIssue('Waffe','HEAD'),/Kleidungs- oder Schutzplatz/);
 assert.equal(slotCategoryIssue('Waffe','HAND_LEFT'),null);
 assert.equal(slotCategoryIssue('Elektronik','EYES'),null);
});
test('T and J concealment retain their existing pocket and jacket semantics',()=>{
 const weapon=item({location:'BODY',bodySlot:'TROUSER_POCKET_LEFT',category:'Waffe',weaponProfile:{concealmentClass:'T'}});
 assert.equal(concealmentWarning(weapon),false);
 assert.equal(concealmentWarning({...weapon,bodySlot:'HAND_LEFT'}),true);
 assert.equal(concealmentWarning({...weapon,weaponProfile:{concealmentClass:'J'}}),true);
 assert.equal(concealmentWarning({...weapon,bodySlot:'JACKET_INNER_RIGHT',weaponProfile:{concealmentClass:'J'}}),false);
});
test('M uses an explicit inner coat place; N is never concealed',()=>{
 const weapon=item({location:'BODY',bodySlot:'COAT_INNER',weaponProfile:{concealmentClass:'M'}});
 assert.equal(concealmentWarning(weapon),false);
 assert.equal(concealmentWarning({...weapon,bodySlot:'HAND_RIGHT'}),true);
 assert.equal(concealmentWarning({...weapon,weaponProfile:{concealmentClass:'N'}}),true);
});
test('hands and external back are openly carried; storage is never openly carried',()=>{
 assert.equal(openlyCarried(item({location:'BODY',bodySlot:'HAND_LEFT'})),true);
 assert.equal(openlyCarried(item({location:'BODY',bodySlot:'BACK_EXTERNAL'})),true);
 assert.equal(openlyCarried(item({location:'BODY',bodySlot:'JACKET_INNER_LEFT'})),false);
 assert.equal(openlyCarried(item({location:'STORED',weaponProfile:{concealmentClass:'N'}})),false);
});
test('attention is presentation, not an invented masquerade or movement consequence',()=>{
 const result=deriveCarry('BODY_ONLY',1,[item({location:'BODY',bodySlot:'HAND_LEFT',weaponProfile:{concealmentClass:'N'}})]);
 assert.equal(result.attention,'SEHR_AUFFAELLIG');assert.deepEqual(result.openVisibleItems,['item.a']);
 assert.ok(!Object.keys(result).some(k=>/masquerade|movement|penalty/i.test(k)));
});
test('a shared GM excerpt is explicitly incomplete, never claims full private capacity',()=>assert.equal(deriveCarry('BACKPACK_MEDIUM',8,[item()],false).complete,false));
test('new moves consistently use body/equipped, backpack/carried and storage/stored',()=>assert.deepEqual(['BODY','BACKPACK','STORED'].map(statusForLocation),['Ausgerüstet','Mitgeführt','Gelagert']));
test('capacity decreases are reflected immediately without changing any item',()=>{
 const entries=[item({slotCost:8})],before=structuredClone(entries);
 assert.equal(deriveCarry('BACKPACK_SMALL',2,entries).used,8);
 assert.ok(placementIssue(deriveCarry('BODY_ONLY',3,entries),entries,item({id:'item.b'})));
 assert.deepEqual(entries,before);
});
