import {readFileSync} from 'node:fs';
import {npcFieldNames} from '../../domain/npc-profile.ts';

// Explicit, narrowly scoped local acceptance conversion. Never called by app
// startup, a production route, or a migration. Original legacy rows stay intact.
export async function seedSilasNPC({db,base,cookie,primary,secondary}){
  if(base!=='http://127.0.0.1:8794')throw Error('Silas acceptance conversion is local-only.');
  if(!primary||!secondary)throw Error('Provide --npc-primary=PATH and --npc-secondary=PATH.');
  const catalog=JSON.parse(readFileSync(new URL('../../server/catalog.json',import.meta.url),'utf8'));
  const silas=catalog.find(r=>r.title==='Silas Vance'),hardenberg=catalog.find(r=>r.title==='Justikar Hardenberg'),place=catalog.find(r=>r.title==='Kaserne Schwarzholz – „Ultio“');
  if(!silas||!hardenberg||!place)throw Error('Missing original reference in catalog; no substitute is created.');
  const campaign='chronik-von-kleve',stamp=new Date().toISOString();
  for(const row of [silas,hardenberg,place]){
    if(await db.prepare('SELECT id FROM entities WHERE id=?').bind(row.id).first())throw Error('Local original already exists; no overwrite.');
    await db.prepare('INSERT INTO records(id,campaign_id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(row.id,campaign,'command-gm',row.kind,'sl',row.title,JSON.stringify(row.body),row.gmBody??'',stamp,stamp).run();
  }
  const request=async(path,body)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error(path+' '+r.status);return r.json();};
  const upload=async(path,name)=>{
    const form=new FormData();form.set('file',new Blob([readFileSync(path)],{type:'image/png'}),name);form.set('visibility','sl');
    const r=await fetch(base+'/api/files',{method:'POST',headers:{Cookie:cookie,Origin:base},body:form});if(!r.ok)throw Error('Protected local image upload failed '+r.status);return '/api/files?id='+(await r.json()).id;
  };
  const draft=await request('/api/entities/npc?id='+silas.id);
  const paragraphs=silas.body.text.split('\n\n');
  const blocks=[
    {kind:'short_profile',content:'Silas Vance ist der operative Leiter von ULTIO und einer der gefährlichsten bekannten Akteure innerhalb der Organisation.'},
    {kind:'biography',content:paragraphs.slice(3).join('\n\n')},
    {kind:'personality',content:paragraphs[2]},
  ].filter(b=>b.content?.trim()).map((b,position)=>({...b,visibility:'sl_secret',position}));
  await request('/api/entities/npc',{
    id:silas.id,revision:draft.revision,title:'Silas Vance',canonStatus:'confirmed',playState:null,defaultVisibility:'sl_secret',
    profile:{title:'Der Ausbilder',role:'Leiter von ULTIO',clan:'Banu Haqim',generation:6,stance:'Eigenständig',affiliation:['ULTIO','Camarilla'],known_for:['Ausbildung','Taktik','Urteilsvermögen'],npc_status:'Aktiv',location_note:'Wechselnd',image_primary:await upload(primary,'Silas-Primärbild.png'),image_secondary:await upload(secondary,'Silas-Sekundärbild.png'),field_visibility:Object.fromEntries(Object.keys(npcFieldNames).map(key=>[key,'sl_secret']))},
    blocks,retainedRelationships:[],addedRelationships:[{targetId:hardenberg.id,type:'related_to',visibility:'sl',note:'Vorsitzender von ULTIO.'},{targetId:place.id,type:'located_at',visibility:'sl'}],
  });
  console.log('Silas local acceptance: explicitly converted catalog Legacy original '+silas.id+' to M1 blocks/profile, same ID; source row preserved; all fields/blocks/relations/images SL-only. No Herr Schäfer substitute created.');
}
