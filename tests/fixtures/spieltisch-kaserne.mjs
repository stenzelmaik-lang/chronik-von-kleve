// Synthetic Spieltisch 2.0 acceptance data for an isolated local D1/R2 store.
// Mirrors the structure of "Der Hunger bleibt – Szene 01 Kaserne" without any
// production content. Decoy scenes reproduce the reported foreign-scene bug.
import {randomUUID} from 'node:crypto';
import {deflateSync} from 'node:zlib';

function crc32(buffer){let c,crc=0xffffffff;for(let n=0;n<buffer.length;n++){c=(crc^buffer[n])&0xff;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crc=(crc>>>8)^c;}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const length=Buffer.alloc(4);length.writeUInt32BE(data.length);const body=Buffer.concat([Buffer.from(type,'ascii'),data]);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(body));return Buffer.concat([length,body,crc]);}
/** Small atmospheric gradient so the stage shows a real, authorized image. */
export function syntheticPng(width,height,[r1,g1,b1],[r2,g2,b2]){
 const rows=[];
 for(let y=0;y<height;y++){const row=Buffer.alloc(1+width*3);for(let x=0;x<width;x++){const t=(y/height)*.75+(Math.sin(x/37)*.5+.5)*.25;row[1+x*3]=Math.round(r1+(r2-r1)*t);row[2+x*3]=Math.round(g1+(g2-g1)*t);row[3+x*3]=Math.round(b1+(b2-b1)*t);}rows.push(row);}
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
 return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);
}

export async function seedSpieltischKaserne({db,base,cookie}){
 const headers={Origin:base,Cookie:cookie};
 const call=async(path,body,expected=[200,201])=>{const r=await fetch(base+path,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});const text=await r.text();if(!expected.includes(r.status))throw new Error('Spieltisch fixture failed: '+path+' '+r.status+' '+text.slice(0,300));return JSON.parse(text);};
 const upload=async(name,png)=>{const form=new FormData();form.set('file',new Blob([png],{type:'image/png'}),name);form.set('visibility','sl');const r=await fetch(base+'/api/files',{method:'POST',headers,body:form});if(!r.ok)throw new Error('Spieltisch fixture upload failed '+r.status);return (await r.json()).id;};

 const kaserneImage=await upload('Kaserne Schwarzholz – Tor bei Nacht.png',syntheticPng(960,540,[18,22,20],[72,78,58]));
 const hallImage=await upload('Kaserne – Wachstube.png',syntheticPng(960,540,[30,18,14],[110,74,40]));
 const schaeferImage=await upload('Herr Schäfer – Porträt.png',syntheticPng(360,480,[24,24,30],[120,110,96]));

 const place=await call('/api/cms/locations',{level:'location',title:'Kaserne Schwarzholz im Reichswald'});
 const npc=await call('/api/entities',{type:'NPC',title:'Herr Schäfer',text:'Ehemaliger Feldwebel, heute Hausmeister der stillgelegten Kaserne. Wortkarg, misstrauisch gegenüber Fremden.',gmBody:'SL_PRIVATE_NPC: Schäfer weiß, dass Silas Vance im Keller war.'});
 await db.prepare("UPDATE entities SET content=json_set(content,'$.image_primary',?) WHERE id=?").bind('/api/files?id='+schaeferImage,npc.id).run();
 const handout=await call('/api/entities',{type:'HANDOUT',title:'Versiegelte Order 7/II',text:'Befehl: Tor C bleibt nach 22:00 Uhr verschlossen. Unterschrift unleserlich.',gmBody:'SL_PRIVATE_HANDOUT: Die Order ist gefälscht.'});

 const story=await call('/api/command-center/story',{action:'create',clientRequestId:randomUUID(),document:{title:'Der Hunger bleibt',sections:{core:'Übergreifender Handlungsstrang (synthetisch).',background:'',secrets:'',clues:'',consequences:'',notes:''},references:[],possibilities:[]}});
 const storyId=story.story?.id||story.id||'';

 // HTML enters the store the same way the editor sends it: through the HTML input prefix.
 const html=value=>value.startsWith('<')?'cvk-html-v1:'+value:value;
 const fields=['narration','atmosphere','gmNotes','dialogueNotes','interactions','secrets','possibleConsequences'];
 const scene=async(title,document={})=>{
  const d={title,storyId:'',placeId:'',sessionIds:[],elements:[],narration:'',atmosphere:'',gmNotes:'',dialogueNotes:'',interactions:'',secrets:'',possibleConsequences:'',npcIds:[],clueIds:[],possibilities:[],...document};
  for(const f of fields)d[f]=html(d[f]);d.elements=d.elements.map(e=>({...e,text:html(e.text)}));
  return (await call('/api/command-center/scenes',{action:'create',clientRequestId:randomUUID(),document:d})).scene.id;
 };

 const kaserne=await scene('Szene 01 – Spielort Kaserne (Auftakt)',{
  storyId,placeId:place.id,npcIds:[npc.id],clueIds:[handout.id],
  narration:'<h2>Ankunft am Tor</h2><p>Der Reichswald schluckt das Scheinwerferlicht. Hinter dem rostigen Tor liegt die Kaserne Schwarzholz – still, aber nicht verlassen.</p><p class="cp-intro">Ein einzelnes Fenster der Wachstube ist erleuchtet.</p>',
  atmosphere:'<ul><li><strong>Licht:</strong> Natriumdampf, flackernd, ein Mast defekt.</li><li><strong>Geräusche:</strong> Kiefern im Wind, entferntes Hundegebell.</li><li><strong>Geruch:</strong> Diesel, nasses Laub, etwas Metallisches.</li></ul>',
  dialogueNotes:'<h3>Herr Schäfer</h3><p><em>Erster Eindruck:</em> „Hier ist seit 1994 niemand mehr stationiert.“</p><h3>Fragen zu Silas Vance</h3><p>Schäfer weicht aus, schaut zum Kellerabgang. Bei Druck: „Der Amerikaner? Der war nur einmal hier.“</p>',
  interactions:'<p>Das Tor lässt sich mit der Order öffnen. Die Wachstube enthält ein Dienstbuch.</p><table><tr><th>Objekt</th><th>Fundort</th><th>Probe</th></tr><tr><td>Dienstbuch</td><td>Wachstube</td><td>Wahrnehmung + Nachforschung (6)</td></tr><tr><td>Schlüsselbund</td><td>Schäfers Gürtel</td><td>Geschick + Taschendiebstahl (7)</td></tr></table>',
  secrets:'<p><strong>SL_PRIVATE_SECRET:</strong> Im Keller liegt Silas Vance in Starre. Schäfer ist sein Ghul.</p>',
  possibleConsequences:'<ul><li>Gewalt gegen Schäfer: Silas erwacht in der nächsten Nacht.</li><li>Freundliches Gespräch: Schäfer verrät den Kellerzugang.</li></ul>',
  gmNotes:'<p><strong>Spickzettel:</strong> Tempo langsam, Schäfer nicht sofort als Bedrohung zeigen. Dienstbuch ist der rote Faden.</p>',
  elements:[
   {id:randomUUID(),kind:'image',title:'Tor bei Nacht',text:'<p>Für den Auftakt zeigen.</p>',referenceId:'',fileId:kaserneImage},
   {id:randomUUID(),kind:'image',title:'Wachstube',text:'',referenceId:'',fileId:hallImage},
   {id:randomUUID(),kind:'handout',title:'Versiegelte Order',text:'',referenceId:handout.id,fileId:''},
   {id:randomUUID(),kind:'person',title:'Herr Schäfer',text:'<p>Steht rauchend am Tor.</p>',referenceId:npc.id,fileId:''},
  ],
 });
 const second=await scene('Szene 02 – Der Keller',{storyId,placeId:place.id,narration:'<p>Eine Betontreppe führt hinab.</p>',gmNotes:'<p>Nur wenn die Spieler den Zugang finden.</p>'});
 // Decoys: same campaign, not linked to the evening. They must not appear in Live-Regie by default.
 await scene('Technische Prüfung Hauptszene',{narration:'<p>Testinhalt.</p>'});
 await scene('Neue Szene');

 const session=await call('/api/command-center/preparation',{action:'create',clientRequestId:randomUUID(),document:{title:'Der Hunger bleibt – Spielabend 01',summary:'Auftakt in der Kaserne Schwarzholz.',sceneIds:[kaserne,second],storyIds:storyId?[storyId]:[],status:'ready'}});
 return {sessionId:session.session?.id||session.id,kaserne,second,npc:npc.id,place:place.id,images:[kaserneImage,hallImage]};
}
