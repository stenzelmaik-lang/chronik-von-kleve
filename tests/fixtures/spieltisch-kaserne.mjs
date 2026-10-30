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

/** Short synthetic radio-hum tone as 16-bit mono WAV. */
export function syntheticWav(seconds=4,rate=8000){
 const n=seconds*rate,data=Buffer.alloc(n*2);
 for(let i=0;i<n;i++)data.writeInt16LE(Math.round(Math.sin(i/rate*2*Math.PI*220)*Math.sin(i/rate*Math.PI/seconds)*9000),i*2);
 const h=Buffer.alloc(44);h.write('RIFF',0);h.writeUInt32LE(36+data.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);
 return Buffer.concat([h,data]);
}
/** Minimal one-page PDF with a single text line. */
export function syntheticPdf(text){
 const stream=`BT /F1 20 Tf 60 760 Td (${text.replace(/[()\\]/g,'')}) Tj ET`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let out='%PDF-1.4\n';const offsets=[];objects.forEach((o,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`;});
 const xref=out.length;out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Buffer.from(out,'latin1');
}

export async function seedSpieltischKaserne({db,base,cookie}){
 const headers={Origin:base,Cookie:cookie};
 const call=async(path,body,expected=[200,201])=>{const r=await fetch(base+path,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});const text=await r.text();if(!expected.includes(r.status))throw new Error('Spieltisch fixture failed: '+path+' '+r.status+' '+text.slice(0,300));return JSON.parse(text);};
 const upload=async(name,png,type='image/png')=>{const form=new FormData();form.set('file',new Blob([png],{type}),name);form.set('visibility','sl');const r=await fetch(base+'/api/files',{method:'POST',headers,body:form});if(!r.ok)throw new Error('Spieltisch fixture upload failed '+r.status);return (await r.json()).id;};

 const kaserneImage=await upload('Kaserne Schwarzholz – Tor bei Nacht.png',syntheticPng(960,540,[18,22,20],[72,78,58]));
 const hallImage=await upload('Kaserne – Wachstube.png',syntheticPng(960,540,[30,18,14],[110,74,40]));
 const schaeferImage=await upload('Herr Schäfer – Porträt.png',syntheticPng(360,480,[24,24,30],[120,110,96]));
 const foundPhoto=await upload('Fundfoto – Silas am Tor 1994.png',syntheticPng(480,600,[60,52,40],[190,170,130]));
 const tape=await upload('Funkspruch Wache 3.wav',syntheticWav(),'audio/wav');
 const order=await upload('Dienstbuch Seite 12.pdf',syntheticPdf('Dienstbuch Kaserne Schwarzholz - Eintrag 12'),'application/pdf');

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

 // A deliberately long, synthetic read-aloud text exercises scrolling, headings, lists and tables of the stage narration.
 const longNarration='<h3>Der Weg über den Appellplatz</h3>'
  +'<p>Kies knirscht unter euren Schuhen. Zwischen den Betonplatten des Appellplatzes wächst Moos, und die Fahnenstange in der Mitte trägt nur noch ein ausgefranstes Seil, das im Wind gegen das Metall schlägt – ein hohles, gleichmäßiges Klopfen, als zähle jemand die Sekunden bis zu eurer Ankunft.</p>'
  +'<p>Links reihen sich die Mannschaftsgebäude, drei Stockwerke hoch, die Fenster mit Spanplatten vernagelt. Auf einer Platte hat jemand mit weißer Farbe eine Zahl gemalt: 47. Die Farbe ist frischer als alles andere hier.</p>'
  +'<blockquote>„Wer hier Wache schiebt, lernt, dass der Wald zurückschaut.“ – eingeritzt in den Türrahmen der Wachstube</blockquote>'
  +'<h3>Was ihr wahrnehmt</h3><ul><li>Der Geruch von kaltem Zigarettenrauch, obwohl niemand zu sehen ist.</li><li>Ein Generator brummt irgendwo hinter den Garagen, unregelmäßig, als stottere er.</li><li>Reifenspuren im Schlamm, höchstens zwei Tage alt, die zum Kellerabgang führen.</li><li>Auf dem Dach des Stabsgebäudes sitzen Krähen, ungewöhnlich still.</li></ul>'
  +'<p>Je näher ihr der Wachstube kommt, desto deutlicher hört ihr ein Radio. Es spielt keine Musik, sondern Rauschen, unterbrochen von Zahlenfolgen, die eine monotone Frauenstimme verliest. Sieben. Vier. Sieben. Pause. Dann wieder Rauschen.</p>'
  +'<hr><h3>Die Wachstube</h3>'
  +'<p>Die Tür steht einen Spalt offen. Drinnen brennt eine Schreibtischlampe mit grünem Glasschirm. Auf dem Tisch liegt ein aufgeschlagenes Dienstbuch, daneben ein Becher Kaffee, der noch dampft. Der Stuhl ist zurückgeschoben, als sei jemand gerade erst aufgestanden.</p>'
  +'<p>An der Wand hängt ein Dienstplan aus dem Jahr 1993. Alle Namen sind mit schwarzem Filzstift durchgestrichen – bis auf einen: Schäfer. Daneben, in einer anderen Handschrift: <em>bleibt</em>.</p>'
  +'<table><tr><th>Uhrzeit</th><th>Eintrag im Dienstbuch</th><th>Kürzel</th></tr><tr><td>22:00</td><td>Rundgang Nord ohne Befund.</td><td>S.</td></tr><tr><td>23:30</td><td>Licht im Keller. Nicht nachgesehen.</td><td>S.</td></tr><tr><td>01:15</td><td>Er ist wach.</td><td>–</td></tr></table>'
  +'<p>Der letzte Eintrag ist nicht mit Tinte geschrieben. Die Schrift ist braun, getrocknet und leicht verwischt, als hätte jemand sie mit dem Finger gezogen.</p>'
  +'<h3>Stimmen aus dem Dunkel</h3>'
  +'<p>Draußen verstummt das Radio. Für einen Augenblick ist es so still, dass ihr euren eigenen Atem hört – und dann, sehr leise, das Geräusch von Schritten auf der Kellertreppe. Langsam. Gleichmäßig. Sie kommen nicht näher, sie entfernen sich, tiefer hinab, als wolle jemand, dass ihr folgt.</p>'
  +'<ol><li>Wer folgt den Schritten zuerst?</li><li>Wer bleibt bei der Wachstube und dem Dienstbuch?</li><li>Wer behält den Appellplatz und das Tor im Blick?</li></ol>'
  +'<p>Hinter euch, am Tor, glimmt eine Zigarette auf. Herr Schäfer steht dort, wo eben noch niemand stand, und hebt grüßend die Hand. „Sie sind spät“, sagt er. „Man hat Sie früher erwartet.“</p>'
  +'<p class="cp-intro">Ende des synthetischen Vorlesetextes – wenn ihr diese Zeile lest, wurde nichts abgeschnitten.</p>';
 const kaserne=await scene('Szene 01 – Spielort Kaserne (Auftakt)',{
  storyId,placeId:place.id,npcIds:[npc.id],clueIds:[handout.id],backdropFileId:kaserneImage,
  narration:'<h2>Ankunft am Tor</h2><p>Der Reichswald schluckt das Scheinwerferlicht. Hinter dem rostigen Tor liegt die Kaserne Schwarzholz – still, aber nicht verlassen.</p><p class="cp-intro">Ein einzelnes Fenster der Wachstube ist erleuchtet.</p>'+longNarration,
  atmosphere:'<ul><li><strong>Licht:</strong> Natriumdampf, flackernd, ein Mast defekt.</li><li><strong>Geräusche:</strong> Kiefern im Wind, entferntes Hundegebell.</li><li><strong>Geruch:</strong> Diesel, nasses Laub, etwas Metallisches.</li></ul>',
  dialogueNotes:'<h3>Herr Schäfer</h3><p><em>Erster Eindruck:</em> „Hier ist seit 1994 niemand mehr stationiert.“</p><h3>Fragen zu Silas Vance</h3><p>Schäfer weicht aus, schaut zum Kellerabgang. Bei Druck: „Der Amerikaner? Der war nur einmal hier.“</p>',
  interactions:'<p>Das Tor lässt sich mit der Order öffnen. Die Wachstube enthält ein Dienstbuch.</p><table><tr><th>Objekt</th><th>Fundort</th><th>Probe</th></tr><tr><td>Dienstbuch</td><td>Wachstube</td><td>Wahrnehmung + Nachforschung (6)</td></tr><tr><td>Schlüsselbund</td><td>Schäfers Gürtel</td><td>Geschick + Taschendiebstahl (7)</td></tr></table>',
  secrets:'<p><strong>SL_PRIVATE_SECRET:</strong> Im Keller liegt Silas Vance in Starre. Schäfer ist sein Ghul.</p>',
  possibleConsequences:'<ul><li>Gewalt gegen Schäfer: Silas erwacht in der nächsten Nacht.</li><li>Freundliches Gespräch: Schäfer verrät den Kellerzugang.</li></ul>',
  gmNotes:'<p><strong>Spickzettel:</strong> Tempo langsam, Schäfer nicht sofort als Bedrohung zeigen. Dienstbuch ist der rote Faden.</p>',
  elements:[
   {id:randomUUID(),kind:'image',title:'Fundfoto: Silas am Tor',text:'<p>Liegt unter dem Dienstbuch.</p>',referenceId:'',fileId:foundPhoto},
   {id:randomUUID(),kind:'image',title:'Wachstube',text:'',referenceId:'',fileId:hallImage},
   {id:randomUUID(),kind:'audio',title:'Funkspruch Wache 3',text:'<p>Läuft im alten Funkgerät der Wachstube.</p>',referenceId:'',fileId:tape},
   {id:randomUUID(),kind:'handout',title:'Dienstbuch, Seite 12',text:'',referenceId:'',fileId:order},
   {id:randomUUID(),kind:'handout',title:'Versiegelte Order',text:'',referenceId:handout.id,fileId:''},
   {id:randomUUID(),kind:'person',title:'Herr Schäfer',text:'<p>Steht rauchend am Tor.</p>',referenceId:npc.id,fileId:''},
  ],
 });
 const cellarImage=await upload('Kellertreppe.png',syntheticPng(960,540,[10,10,14],[50,40,44]));
 const second=await scene('Szene 02 – Der Keller',{storyId,placeId:place.id,backdropFileId:cellarImage,narration:'<p>Eine Betontreppe führt hinab.</p>',gmNotes:'<p>Nur wenn die Spieler den Zugang finden.</p>'});
 // Decoys: same campaign, not linked to the evening. They must not appear in Live-Regie by default.
 await scene('Technische Prüfung Hauptszene',{narration:'<p>Testinhalt.</p>'});
 await scene('Neue Szene');

 const session=await call('/api/command-center/preparation',{action:'create',clientRequestId:randomUUID(),document:{title:'Der Hunger bleibt – Spielabend 01',summary:'Auftakt in der Kaserne Schwarzholz.',sceneIds:[kaserne,second],storyIds:storyId?[storyId]:[],status:'ready'}});
 return {sessionId:session.session?.id||session.id,kaserne,second,npc:npc.id,place:place.id,images:[kaserneImage,hallImage,foundPhoto],audio:tape,pdf:order,cellarImage};
}
