import {changeDice,diceMember} from './shared-dice.mjs';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {projectStage,changeStage,canSee} from './stage-state.mjs';
import {readStage,writeStage} from './stage-storage.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const dependencyRoot=process.env.CVK_PROTOTYPE_DEPENDENCIES||'C:/Users/Stenz/Documents/Codex/cvk-m1-kernmodell/node_modules';
const esbuildPath=join(dependencyRoot,'.pnpm',readdirSync(join(dependencyRoot,'.pnpm')).find(n=>n.startsWith('esbuild@0.28.1'))||'missing','node_modules/esbuild/lib/main.js');
const {build}=await import(pathToFileURL(esbuildPath));
const output=resolve(root,process.env.CVK_PROTOTYPE_BUILD_DIR||'.local-work/spieltisch-2/build');mkdirSync(output,{recursive:true});
let browserAssets=new Map();
await build({entryPoints:[resolve(root,'prototypes/spieltisch-2/main.tsx')],outdir:output,bundle:true,format:'esm',jsx:'automatic',target:'es2022',minify:true,metafile:true,
  splitting:true,chunkNames:'chunks/[name]-[hash]',
  alias:{'@':root,react:join(dependencyRoot,'react'),'react-dom':join(dependencyRoot,'react-dom'),'lucide-react':join(dependencyRoot,'lucide-react')},
  logLevel:'warning'}).then(result=>{writeFileSync(join(output,'build-meta.json'),JSON.stringify(result.metafile));for(const key of Object.keys(result.metafile.outputs)){const path=resolve(root,key),suffix=path.slice(output.length).replaceAll('\\','/');browserAssets.set(suffix,path);}});
if(process.argv.includes('--build-only')){console.log('Local prototype bundle built; no Worker, database or deployment invoked.');process.exit(0);}
const port=Number(process.env.CVK_PROTOTYPE_PORT||8812);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local prototype port');
const statePath=resolve(root,'.local-work/spieltisch-2',port===8812?'state.json':`state-${port}.json`);
let state=readStage(statePath);
const media={campaign:['public/images/chronik-von-kleve-banner.png','image/png'],barracks:['public/images/a26afdbc6dbae776e2b8.jpg','image/jpeg'],taberna:['public/images/edf112ec863d6cd02b1a.jpg','image/jpeg'],npc:['.local-work/spieltisch-2/npc-schaefer.png','image/png'],map:['public/images/chronik-stadtkarte-schematisch.svg','image/svg+xml']};
const document={title:'Ankunft',subtitle:'Synthetisches Testdokument',paragraphs:['Dieses Blatt dient ausschließlich dazu, den neuen Spieltisch zu erproben. Es ist kein Bestandteil der Chronik und ergänzt keinen kanonischen Inhalt.','Lege es auf die Bühne. Verschiebe es an einen anderen Platz, verändere seine Größe und öffne die Lesefassung. Deine persönliche Lesegröße verändert die gemeinsame Bühne nicht.','Die Originaldateien und sämtliche echten Spielerdaten bleiben unverändert.'],footer:'CHRONIPLAY · LOKALER PROTOTYP · KEIN KANON'};
const server=createServer(async(req,res)=>{
  const start=performance.now();
  const send=(status,value,mime='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Server-Timing':`local;dur=${(performance.now()-start).toFixed(2)}`,'Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; frame-ancestors 'none'"});res.end(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value));};
  try{
    if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host))return send(403,{error:'Nur lokaler Prototypzugang.'});
    const url=new URL(req.url,'http://127.0.0.1:'+port),viewer=url.searchParams.get('viewer')||'gm';
    if(url.searchParams.has('sessionId'))diceMember(viewer,url.searchParams.get('sessionId'));
    if(!['gm','a','b'].includes(viewer))return send(400,{error:'Unbekannte Simulationsansicht.'});
    if(req.method==='POST'){
      if(!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))return send(403,{error:'Lokale Herkunft erforderlich.'});
      if(url.pathname!=='/prototype/state')return send(404,{error:'Kein produktiver Schreibpfad.'});
      let body='';for await(const chunk of req){body+=chunk;if(body.length>64000)return send(413,{error:'Prototypaktion zu groß.'});}
      // Commit a copy only after durable local snapshot succeeds. Failed writes leave memory unchanged.
      const candidate=structuredClone(state),command=JSON.parse(body);
      if(['roll','closeRoll'].includes(command.action)){const changed=changeDice(candidate,viewer,command);if(changed){writeStage(statePath,candidate);state=candidate;}return send(200,projectStage(state,viewer));}
      const result=changeStage(candidate,viewer,command);
      writeStage(statePath,candidate);state=candidate;
      return send(200,result);
    }
    if(req.method!=='GET')return send(405,{error:'Methode nicht unterstützt.'});
    if(url.pathname==='/prototype/state'){
      if(Number(url.searchParams.get('version'))===state.version){res.writeHead(304,{'Cache-Control':'private, no-store'});return res.end();}
      return send(200,projectStage(state,viewer));
    }
    if(url.pathname==='/prototype/document'){
      const item=state.objects.find(o=>o.id==='document');return item&&canSee(item,viewer)?send(200,document):send(404,{error:'Dokument nicht freigegeben.'});
    }
    if(url.pathname.startsWith('/prototype/media/')){
      const id=url.pathname.split('/').at(-1),entry=media[id];if(!entry)return send(404,{error:'Testmedium fehlt.'});
      const visible=viewer==='gm'||(id==='npc'?state.objects.some(o=>o.id==='npc'&&canSee(o,viewer)):id==='map'||id===state.scene);
      if(!visible)return send(404,{error:'Testmedium nicht freigegeben.'});
      if(process.env.CVK_PROTOTYPE_FAIL_MEDIA===id)return send(404,{error:'Absichtlich fehlendes Medium im isolierten Browsertest.'});
      const delay=Math.min(2000,Math.max(0,Number(process.env.CVK_PROTOTYPE_MEDIA_DELAY_MS)||0));
      if(delay)await new Promise(done=>setTimeout(done,delay));
      const path=resolve(root,entry[0]);if(!existsSync(path))return send(404,{error:'Lokale Quelldatei fehlt.'});return send(200,readFileSync(path),entry[1]);
    }
    if(url.pathname==='/main.js')return send(200,readFileSync(join(output,'main.js')),'text/javascript');
    if(url.pathname==='/main.css')return send(200,readFileSync(join(output,'main.css')),'text/css');
    if(url.pathname.startsWith('/chunks/')){
      // A local rebuild may create new hashed chunks while this preview is running.
      const meta=JSON.parse(readFileSync(join(output,'build-meta.json'),'utf8'));
      for(const key of Object.keys(meta.outputs)){const path=resolve(root,key);if(path.startsWith(output+'\\')||path.startsWith(output+'/'))browserAssets.set(path.slice(output.length).replaceAll('\\','/'),path);}
    }
    if(browserAssets.has(url.pathname))return send(200,readFileSync(browserAssets.get(url.pathname)),url.pathname.endsWith('.css')?'text/css':'text/javascript');
    if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
    if(url.pathname==='/')return send(200,'<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ChroniPlay · Spieltisch 2.0 · Lokaler Prototyp</title><link rel="stylesheet" href="/main.css"></head><body><div id="root"></div><script type="module" src="/main.js"></script></body></html>','text/html; charset=utf-8');
    return send(404,{error:'Keine produktive Route. Ausschließlich isolierter Prototyp.'});
  }catch(e){send(e.status||400,{error:e.message||'Prototypaktion fehlgeschlagen.'});}
});
server.listen(port,'127.0.0.1',()=>console.log(`ChroniPlay local prototype: http://127.0.0.1:${port} · loopback only · private local test snapshot · zero D1/R2 bindings`));
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port bereits belegt. Kein bestehender Prozess wurde beendet.':e);process.exitCode=1;});
