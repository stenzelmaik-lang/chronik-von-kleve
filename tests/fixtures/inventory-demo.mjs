import assert from 'node:assert/strict';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8T8AAAAASUVORK5CYII=','base64');
export async function seedInventoryDemo(base,cookie,characterId){
 assert.equal(new URL(base).hostname,'127.0.0.1');
 const call=async(path,method='GET',body)=>{const r=await fetch(base+path,{method,headers:{Cookie:cookie,Origin:base,...(body instanceof FormData?{}:body?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});const result=await r.json();if(!r.ok)throw new Error(`Isolated inventory fixture failed: ${path} ${r.status} ${result.error}`);return result;};
 const current=await call('/api/inventory?characterId='+characterId);
 await call('/api/inventory/profile','PATCH',{characterId,profile:'BACKPACK_MEDIUM',expectedRevision:current.carry.revision});
 const entries=[
  {name:'Mantel',category:'Kleidung',location:'BODY',bodySlot:'OUTERWEAR',slotCost:2,visibility:'sl',description:'Synthetische Kleidung für die lokale Ausrüstungsabnahme.'},
  {name:'Stiefel',category:'Kleidung',location:'BODY',bodySlot:'FEET',visibility:'group'},
  {name:'Dunkle Kleidung',category:'Kleidung',location:'BODY',bodySlot:'TORSO',visibility:'sl'},
  {name:'Handschuhe',category:'Kleidung',location:'BODY',bodySlot:'GLOVES',visibility:'sl'},
  {name:'Taschenlampe',category:'Werkzeug',visibility:'group'},
  {name:'Telefon',category:'Elektronik',visibility:'sl'},
  {name:'Notizbuch',category:'Dokument',visibility:'private'},
  {name:'Schlüssel',category:'Schlüssel',visibility:'private'},
  {name:'Verbandmaterial',category:'Medizin',location:'STORED',quantity:3,visibility:'private'},
  {name:'Reservejacke',category:'Kleidung',location:'STORED',visibility:'sl'},
  {name:'Übungsprofil',category:'Waffe',location:'STORED',visibility:'sl',weaponProfile:{damage:'',range:'',rate:'',capacity:'',concealability:'T',concealmentClass:'T',note:'Synthetischer Gegenstand ohne festgelegte Kampfwerte.'}},
 ];
 for(const e of entries){const view=await call('/api/inventory?characterId='+characterId);const location=e.location||'BACKPACK';await call('/api/inventory','POST',{characterId,action:'create',name:e.name,category:e.category,description:e.description||'TEST_DATA – ausschließlich lokale Funktionsprüfung.',quantity:1,status:location==='BODY'?'Ausgerüstet':location==='STORED'?'Gelagert':'Mitgeführt',tags:['TEST_DATA'],testData:true,slotCost:1,visibility:'private',...e,location,expectedCarryRevision:view.carry.revision});}
 // A small valid PNG remains available for a real file-picker upload; no media
 // are made public or injected directly into the item persistence layer.
 return {png,characterId};
}
