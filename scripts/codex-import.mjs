import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareDocument,preparePDF,indexText} from '../domain/codex.ts';

const sha=data=>createHash('sha256').update(data).digest('hex');
export const codexBookId=id=>'codex-'+sha(id).slice(0,24);
// Not an HTTP import endpoint. The caller must supply bindings from the fresh,
// isolated local test harness, never production Wrangler or existing game data.
export async function importCodexSources({db,bucket,base,root,owner='command-gm'}){
  if(new URL(base).hostname!=='127.0.0.1'||!new URL(base).port)throw Error('Import is strictly isolated/local-only.');
  const directory=resolve(root),inventory=JSON.parse(readFileSync(new URL('../tests/fixtures/codex-inventory.json',import.meta.url),'utf8'));
  const plans=inventory.map(m=>{
    const pdf=m.format==='PDF',original=join(directory,'sources',m.sourceId+(pdf?'.pdf':'.json'));
    const raw=readFileSync(original),hash=sha(raw),doc=JSON.parse(readFileSync(pdf?join(directory,'prepared',m.sourceId,'document.json'):original,'utf8'));
    if(pdf&&(raw.length!==m.bytes||doc.sourceHash!==hash))throw Error('PDF provenance mismatch: '+m.title);
    if(!pdf&&doc.documentId!==m.sourceId)throw Error('Native source identity mismatch: '+m.title);
    const facsimile=pdf?doc:JSON.parse(readFileSync(join(directory,'prepared',m.sourceId+'-facsimile','document.json'),'utf8'));
    if(!pdf&&facsimile.sourceHash!==sha(readFileSync(join(directory,'sources',m.sourceId+'-facsimile.pdf'))))throw Error('Native PDF export provenance mismatch.');
    const chapters=pdf?preparePDF(doc):[...prepareDocument(doc),...preparePDF(facsimile).map(c=>({...c,id:'export-'+c.id,title:'Originalansicht · '+c.title,bookmarks:c.bookmarks?.map(b=>({...b,sectionId:'export-'+b.sectionId})),sections:c.sections.map(s=>({...s,id:'export-'+s.id}))}))];
    if(!chapters.length)throw Error('Empty reader source: '+m.title);
    for(const p of facsimile.pages){
      if(!/^page-\d+\.jpg$/.test(p.image))throw Error('Invalid page asset path.');
      const image=readFileSync(join(directory,'prepared',m.sourceId+(pdf?'':'-facsimile'),p.image));
      if(image.length!==p.imageBytes||sha(image)!==p.imageHash||sha(p.text)!==p.textHash)throw Error('Prepared page integrity mismatch: '+m.title);
    }
    return {m,pdf,original,hash,doc,facsimile,chapters,id:codexBookId(m.sourceId)};
  });
  // Validate EVERY source and duplicate ID before touching even the local DB.
  for(const p of plans)if(await db.prepare('SELECT id FROM entities WHERE id=?').bind(p.id).first())throw Error('Existing book is preserved; import into a fresh isolated fixture.');
  const preservedTables=['campaigns','members','campaign_memberships','records','relationships','knowledge','world_events','files'];
  const before=await Promise.all(preservedTables.map(async table=>JSON.stringify((await db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()).results)));
  const otherEntities=JSON.stringify((await db.prepare("SELECT * FROM entities WHERE json_extract(content,'$.documentKind') IS NOT 'codex_book' ORDER BY id").all()).results);
  const audit=[];
  for(const p of plans){
    const {m,pdf,hash,doc,facsimile,chapters,id}=p,stamp=new Date().toISOString();
    const warnings=pdf?`Originalseiten sind verbindlich. ${doc.quality.pagesWithoutText.length} Seiten ohne Textschicht; ergänzende OCR-Suchfundstellen sind ausdrücklich ungeprüft, keine kanonischen Regeltexte.`:'Textansicht mit nativen Fundstellen. Grafiken, Seitenfuß und vollständiges Layout bleiben in den zusätzlichen Originalansicht-Kapiteln erhalten.';
    const content={documentKind:'codex_book',edition:m.edition,rights:m.rights,readerReady:false,localReview:true,bookType:m.type,format:m.format,sourceModified:m.modified,sourceHash:hash,qualityNote:warnings};
    await db.prepare("INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,default_visibility,title,content,created_at,updated_at) VALUES(?,'chronik-von-kleve','RULE','confirmed',?,'group','player_visible',?,?,?,?)").bind(id,owner,m.title,JSON.stringify(content),stamp,stamp).run();
    // Offline Node process, one bounded source at a time. R2 requires known
    // content length; no PDF parsing/buffering happens in the HTTP Worker.
    await bucket.put(`codex-originals/${hash}.${pdf?'pdf':'json'}`,readFileSync(p.original),{httpMetadata:{contentType:pdf?'application/pdf':'application/json'},customMetadata:{sha256:hash,sourceId:m.sourceId,revision:doc.revisionId??''}});
    if(!pdf)await bucket.put(`codex-originals/${facsimile.sourceHash}.pdf`,readFileSync(join(directory,'sources',m.sourceId+'-facsimile.pdf')),{httpMetadata:{contentType:'application/pdf'}});
    for(let offset=0;offset<facsimile.pages.length;offset+=4)await Promise.all(facsimile.pages.slice(offset,offset+4).map(page=>bucket.put(`codex-pages/${hash}/${page.image}`,readFileSync(join(directory,'prepared',m.sourceId+(pdf?'':'-facsimile'),page.image)),{httpMetadata:{contentType:'image/jpeg'}})));
    let rows=0;
    for(const [position,chapter] of chapters.entries()){
      const blockId=id+'-'+chapter.id,stored={...chapter,id:blockId};
      const statements=[db.prepare("INSERT INTO entity_content_blocks(id,campaign_id,entity_id,kind,content,visibility,position) VALUES(?,'chronik-von-kleve',?,'codex_chapter',?,?,?)").bind(blockId,id,JSON.stringify(stored),m.rights==='own'?'player_visible':'sl_secret',position)];
      let heading=chapter.title;
      for(const section of chapter.sections){
        const text=indexText(section);if(section.kind==='heading')heading=text.trim();
        if(text.trim()){rows++;statements.push(db.prepare('INSERT INTO codex_sections(id,block_id,heading,plain_text,source) VALUES(?,?,?,?,?)').bind(blockId+'-'+section.id,blockId,heading,text,JSON.stringify(section.source)));}
      }
      for(let offset=0;offset<statements.length;offset+=40)await db.batch(statements.slice(offset,offset+40));
    }
    // Fail-closed publication marker: partial imports never become readable.
    await db.prepare("UPDATE entities SET content=json_set(content,'$.readerReady',json('true')) WHERE id=?").bind(id).run();
    audit.push({id,title:m.title,format:m.format,rights:m.rights,hash,facsimileHash:facsimile.sourceHash,chapters:chapters.length,sections:chapters.reduce((n,c)=>n+c.sections.length,0),indexed:rows,pages:facsimile.pageCount,quality:facsimile.quality});
    console.log('Codex imported locally: '+m.title+' · '+chapters.length+' chapter parts · '+rows+' indexed sections.');
  }
  for(const [i,table] of preservedTables.entries())if(JSON.stringify((await db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()).results)!==before[i])throw Error('Local preservation check failed: '+table);
  if(JSON.stringify((await db.prepare("SELECT * FROM entities WHERE json_extract(content,'$.documentKind') IS NOT 'codex_book' ORDER BY id").all()).results)!==otherEntities)throw Error('Unrelated entity preservation check failed.');
  const fk=await db.prepare('PRAGMA foreign_key_check').all();if(fk.results.length)throw Error('Local foreign-key check failed.');
  console.log('Codex preservation verified: accounts, campaigns, characters, relationships, files and other entities unchanged.');
  return audit;
}
