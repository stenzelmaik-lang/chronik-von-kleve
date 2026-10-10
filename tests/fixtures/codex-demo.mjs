import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareDocument,sectionText} from '../../domain/codex.ts';

// Called ONLY by the isolated test runner. Never app startup, an API or SQL migration.
export async function seedCodex({db,bucket,base,sourcePath,owner='command-gm'}){
  if(new URL(base).hostname!=='127.0.0.1')throw Error('Codex import is local-only.');
  const inventory=JSON.parse(readFileSync(new URL('./codex-inventory.json',import.meta.url),'utf8'));
  const raw=readFileSync(sourcePath,'utf8'),doc=JSON.parse(raw),hash=createHash('sha256').update(raw).digest('hex');
  const approved=inventory.find(b=>b.rights==='own'&&b.readerReady);
  if(doc.documentId!==approved.sourceId)throw Error('Only the explicitly selected own chronicle document may be imported.');
  const chapters=prepareDocument(doc),stamp=new Date().toISOString(),campaign='chronik-von-kleve';
  const statements=[];
  for(const m of inventory){
    const id='codex-'+createHash('sha256').update(m.sourceId).digest('hex').slice(0,24),isSource=m.sourceId===doc.documentId;
    const content={documentKind:'codex_book',edition:m.edition,rights:m.rights,readerReady:isSource,bookType:m.type,format:m.format,sourceModified:m.modified,sourceHash:isSource?hash:''};
    statements.push(db.prepare("INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,default_visibility,title,content,created_at,updated_at) VALUES(?,?,'RULE','confirmed',?,'group','player_visible',?,?,?,?)").bind(id,campaign,owner,m.title,JSON.stringify(content),stamp,stamp));
    if(isSource)for(const [position,chapter] of chapters.entries()){
      const blockId=id+'-'+chapter.id,stored={...chapter,id:blockId};
      statements.push(db.prepare("INSERT INTO entity_content_blocks(id,campaign_id,entity_id,kind,content,visibility,position) VALUES(?,?,?,'codex_chapter',?,'player_visible',?)").bind(blockId,campaign,id,JSON.stringify(stored),position));
      let heading=chapter.title;
      for(const section of chapter.sections){
        const text=sectionText(section);if(section.kind==='heading')heading=text.trim();
        if(text.trim())statements.push(db.prepare('INSERT INTO codex_sections(id,block_id,heading,plain_text,source) VALUES(?,?,?,?,?)').bind(blockId+'-'+section.id,blockId,heading,text,JSON.stringify(section.source)));
      }
    }
  }
  // No public files row is created for this original. R2 has no public route.
  const key='codex-originals/'+hash+'.json';
  await bucket.put(key,raw,{httpMetadata:{contentType:'application/json'},customMetadata:{documentId:doc.documentId,revision:doc.revisionId??'',title:doc.title,sha256:hash}});
  // Duplicate imports fail without overwriting anything; batch is atomic.
  await db.batch(statements);
  console.log('Codex local import: 15 metadata entries, 1 own document, '+chapters.length+' chapters; SHA-256 '+hash+'.');
  return {hash,chapters,bookId:'codex-'+createHash('sha256').update(doc.documentId).digest('hex').slice(0,24)};
}
