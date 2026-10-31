// Spielmaterial 3.0 – synthetic fixture for the isolated local instance (scripts/test-local.mjs --material-3).
// Builds every acceptance case from generated images only: display assets (frame, envelope, dossier folder, radio,
// screen), a single framed photo, the six-photo "Anselmus" packet, a letter that reuses the packet's envelope,
// audio and video with their own assets, a pager message for Player A only, a scene backdrop, a material whose asset
// is missing, a secret dossier in scene 02 and a long file list. No real or personal data.
import {randomUUID} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {syntheticPng,syntheticWav} from './spieltisch-kaserne.mjs';

function crc32(buffer){let c,crc=0xffffffff;for(let n=0;n<buffer.length;n++){c=(crc^buffer[n])&0xff;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crc=(crc>>>8)^c;}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const length=Buffer.alloc(4);length.writeUInt32BE(data.length);const body=Buffer.concat([Buffer.from(type,'ascii'),data]);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(body));return Buffer.concat([length,body,crc]);}
/** RGBA PNG: a coloured border of `border` px around a transparent window (frames and screens), or fully opaque. */
export function framePng(width,height,[r,g,b],border,seal=false){
 const rows=[];
 for(let y=0;y<height;y++){const row=Buffer.alloc(1+width*4);for(let x=0;x<width;x++){
  const inside=x>=border&&x<width-border&&y>=border&&y<height-border;
  const dx=x-width/2,dy=y-height*.55,isSeal=seal&&dx*dx+dy*dy<(width*.09)**2;
  const shade=.82+.18*Math.sin((x+y)/9);
  row[1+x*4]=isSeal?150:Math.round(r*shade);row[2+x*4]=isSeal?20:Math.round(g*shade);row[3+x*4]=isSeal?24:Math.round(b*shade);row[4+x*4]=inside&&!isSeal&&border>0?0:255;}
  rows.push(row);}
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);
}
/** Minimal WebM signature only: accepted by the upload check, not a playable video (documented limitation). */
const webmPlaceholder=()=>Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(256)]);

export async function seedMaterial3({base,cookie,fixture,largeList=80}){
 const headers={Origin:base,Cookie:cookie};
 const call=async(path,body,method='POST')=>{const r=await fetch(base+path,{method,headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});const text=await r.text();if(!r.ok)throw new Error('Material fixture '+path+' '+r.status+' '+text.slice(0,300));return JSON.parse(text);};
 const upload=async(name,bytes,type='image/png')=>{const form=new FormData();form.set('file',new Blob([bytes],{type}),name);form.set('visibility','sl');const r=await fetch(base+'/api/files',{method:'POST',headers,body:form});if(!r.ok)throw new Error('Material fixture upload '+name+' '+r.status);return (await r.json()).id;};
 const asset=async(title,kind,states)=>(await call('/api/display-assets',{asset:{title,kind,states:states.map(([key,label,fileId])=>({key,label,fileId})),tags:['synthetisch']}})).asset.id;

 // Display assets: every image is stored once and reused by reference.
 const frame=await upload('Asset – Messingrahmen.png',framePng(480,600,[176,140,72],46));
 const envelopeClosed=await upload('Asset – Paketumschlag geschlossen.png',framePng(640,440,[150,112,70],0,true));
 const envelopeOpen=await upload('Asset – Paketumschlag offen.png',framePng(640,440,[178,138,92],0));
 const folderClosed=await upload('Asset – Geheimakte Mappe zu.png',framePng(600,760,[70,84,58],0,true));
 const folderOpen=await upload('Asset – Geheimakte Mappe offen.png',framePng(600,760,[96,112,80],0));
 const radioClosed=await upload('Asset – Röhrenradio.png',framePng(640,400,[92,60,40],0));
 const radioOpen=await upload('Asset – Röhrenradio beleuchtet.png',framePng(640,400,[130,92,52],0));
 const screen=await upload('Asset – Fernsehgehäuse.png',framePng(800,560,[54,48,42],60));
 const sky=await upload('Asset – Nachthimmel Hintergrund.png',syntheticPng(960,540,[8,10,24],[40,40,80]));
 const assets={
  frame:await asset('Messingrahmen','frame',[['closed','Geschlossen',frame]]),
  envelope:await asset('Paketumschlag mit Siegel','envelope',[['closed','Geschlossen',envelopeClosed],['open','Geöffnet',envelopeOpen]]),
  folder:await asset('Geheimakte – grüne Mappe','folder',[['closed','Geschlossen',folderClosed],['open','Geöffnet',folderOpen]]),
  radio:await asset('Röhrenradio','device',[['closed','Geschlossen',radioClosed],['open','Geöffnet',radioOpen]]),
  screen:await asset('Fernsehgehäuse 1970','screen',[['closed','Geschlossen',screen]]),
  sky:await asset('Nachthimmel','backdrop',[['closed','Geschlossen',sky]]),
 };

 // Content files.
 const single=await upload('Foto – Brücke im Nebel.png',syntheticPng(480,600,[40,48,56],[150,160,170]));
 const colors=[[90,40,30],[30,70,90],[60,90,40],[100,80,30],[70,40,90],[30,30,30]];
 const anselmus=[];for(let i=0;i<6;i++)anselmus.push(await upload('Anselmus '+(i+1)+' von 6.png',syntheticPng(480,600,colors[i],[220,210,190])));
 const akte=[];for(let i=0;i<3;i++)akte.push(await upload('Geheimakte Blatt '+(i+1)+'.png',syntheticPng(600,800,[230,226,210],[180,170,150])));
 const tape=await upload('Tonband – Verhör.wav',syntheticWav(6),'audio/wav');
 const video=await upload('Überwachungsband (Platzhalter).webm',webmPlaceholder(),'video/webm');
 const unseal=await upload('Effektton – Siegel bricht.wav',syntheticWav(1),'audio/wav');
 const backdrop=await upload('Hintergrund – Hafen bei Nacht.png',syntheticPng(960,540,[10,20,30],[60,80,100]));
 for(let i=0;i<largeList;i++)await upload('Archivbild '+String(i+1).padStart(3,'0')+'.png',syntheticPng(64,48,[i*3%255,60,90],[200,190,170]));

 const effect=(open,extra={})=>({open,close:'fade',speed:'normal',soundFileId:'',afterClose:'closed',...extra});
 const files=(ids,label)=>ids.map((fileId,i)=>({id:randomUUID(),fileId,title:label?label+' '+(i+1):''}));
 const material=(kind,title,m,extra={})=>({id:randomUUID(),kind,title,text:'',referenceId:'',fileId:m.files?.[0]?.fileId||'',material:{assetId:'',display:'single',note:'',files:[],...m},...extra});
 const ids={};
 const add=(key,element)=>{ids[key]=element.id;return element;};
 const kaserneMaterials=[
  add('single',material('image','Foto: Brücke im Nebel',{type:'image',files:files([single]),assetId:assets.frame,effect:effect('fade')})),
  add('anselmus',material('handout','Anselmus-Paket',{type:'dossier',files:files(anselmus,'Foto'),assetId:assets.envelope,display:'stack',effect:effect('unseal',{soundFileId:unseal,afterClose:'open'}),note:'SL_PRIVATE_MATERIAL: Foto 6 zeigt den Täter.'})),
  add('letter',material('handout','Brief an Anselmus',{type:'letter',files:[],assetId:assets.envelope,effect:effect('slide-out')},{text:'cvk-html-v1:<p>PLAYER_MATERIAL: Komm nicht zur Brücke.</p>'})),
  add('audio',material('audio','Tonband: Verhör',{type:'audio',files:files([tape]),assetId:assets.radio,effect:effect('unfold')},{text:'cvk-html-v1:<p>SL_PRIVATE_CUE: Erst nach dem Verhör abspielen.</p>'})),
  add('video',material('video','Überwachungsband',{type:'video',files:files([video]),assetId:assets.screen,effect:effect('fade',{close:'close'})})),
  add('pager',{id:randomUUID(),kind:'pager',title:'NUR FÜR A',text:'',referenceId:'',fileId:'',pager:{sender:'ANSELMUS',text:'MATERIAL3: Nur Spieler A liest das.',priority:'normal',recipientIds:['command-a']},material:{type:'pager',files:[],assetId:'',display:'single',effect:effect('instant',{close:'instant'}),note:''}}),
  add('backdrop',material('image','Hafen bei Nacht',{type:'backdrop',files:files([backdrop]),effect:effect('fade',{speed:'slow'})})),
  add('missing',material('handout','Verschollener Umschlag',{type:'letter',files:files([akte[0]]),assetId:randomUUID(),effect:effect('unseal')})),
 ];
 const read=async id=>(await (await fetch(base+'/api/command-center/scenes?id='+encodeURIComponent(id),{headers})).json()).scene;
 const save=async(scene,elements)=>call('/api/command-center/scenes',{action:'save',id:scene.id,version:scene.version,document:{...scene.document,elements}});
 const kaserne=await read(fixture.kaserne);
 await save(kaserne,[...kaserne.document.elements,...kaserneMaterials]);
 const keller=await read(fixture.second);
 const secret=add('akte',material('handout','Geheimakte „Nachtfalter“',{type:'dossier',files:files(akte,'Blatt'),assetId:assets.folder,display:'spread',effect:effect('open-book',{speed:'slow'})}));
 await save(keller,[...keller.document.elements,secret]);
 return {assets,elements:ids,files:{single,anselmus,akte,tape,video,backdrop,envelopeClosed,envelopeOpen},scenes:{kaserne:fixture.kaserne,keller:fixture.second}};
}
