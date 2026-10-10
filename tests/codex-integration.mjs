import {CODEX_PRE_ALPHA_DECISION} from '../domain/codex.ts';

export async function codexIntegration({req,check,localSql,sqlQuote}){
 const campaign='chronik-von-kleve';
 const source={tab:'t.0',start:1,end:50};
 const chapter={id:'codex-qa-public-chapter',title:'TEST Kapitel',sections:[{id:'section-t.0-1',kind:'paragraph',level:0,runs:[{text:'CODEX_PUBLIC_SENTINEL Willenskraft',bold:false,italic:false}],rows:[],source}]};
 const statements=[];
 for(const [id,visibility,rights,camp] of [['codex-qa-public','player_visible','own',campaign],['codex-qa-secret','sl_secret','own',campaign],['codex-qa-pending','player_visible','pending',campaign],['codex-qa-foreign','player_visible','own','phase-b-other-campaign']]){
   const blockId=id+'-chapter',text=id==='codex-qa-secret'?'CODEX_SECRET_SENTINEL Willenskraft':chapter.sections[0].runs[0].text;
   const body={...chapter,id:blockId,sections:[{...chapter.sections[0],runs:[{text,bold:false,italic:false}]}]};
   statements.push("INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,default_visibility,title,content,created_at,updated_at) VALUES("+[id,camp,'RULE','confirmed','sprint1-gm','group',visibility,id,JSON.stringify({documentKind:'codex_book',edition:'HOUSE',rights,readerReady:true}), 'now','now'].map(sqlQuote).join(',')+")");
   statements.push("INSERT INTO entity_content_blocks(id,campaign_id,entity_id,kind,content,visibility,position) VALUES("+[blockId,camp,id,'codex_chapter',JSON.stringify(body),'player_visible',0].map(sqlQuote).join(',')+")");
   statements.push("INSERT INTO codex_sections(id,block_id,heading,plain_text,source) VALUES("+[blockId+'-section-t.0-1',blockId,'TEST Kapitel',text,JSON.stringify(source)].map(sqlQuote).join(',')+")");
 }
 localSql(statements.join(';'));
 check((await req('/api/codex')).s===401,'Codex denies anonymous readers and search');
 check((await req('/api/codex?q=Willenskraft','blockedGm')).s===403,'Codex denies blocked campaign accounts');
 const list=await req('/api/codex','a');
 check(list.s===200&&list.d.books.some(b=>b.id==='codex-qa-public')&&!JSON.stringify(list.d).includes('codex-qa-secret')&&!JSON.stringify(list.d).includes('codex-qa-foreign'),'Player shelf contains only permitted campaign metadata');
 const toc=await req('/api/codex?book=codex-qa-public','a');
 check(toc.s===200&&toc.d.chapters.length===1&&!JSON.stringify(toc.d).includes('CODEX_PUBLIC_SENTINEL'),'TOC contains no chapter bodies');
 const read=await req('/api/codex?book=codex-qa-public&chapter=codex-qa-public-chapter','a');
 check(read.s===200&&JSON.stringify(read.d).includes('CODEX_PUBLIC_SENTINEL'),'Authorized player loads one prepared chapter');
 for(const who of ['a','gm']){
   check((await req('/api/codex?book=codex-qa-pending&chapter=codex-qa-pending-chapter',who)).s===(who==='gm'?200:403),'Separate full SL access and pending publisher player denial for '+who);
   check((await req('/api/codex?book=codex-qa-foreign',who)).s===404,'Codex campaign boundaries hold for '+who);
 }
 check((await req('/api/codex?book=codex-qa-secret','a')).s===404,'Secret book cannot be opened by guessed ID');
 check((await req('/api/codex?book=codex-qa-secret','gm')).s===200,'SL can open authorized SL-only own rules');
 check((await req('/api/codex','a','PATCH',{book:'codex-qa-public',playerReleased:false})).s===403,'Player cannot change book grants');
 check((await req('/api/codex','gm','PATCH',{book:'codex-qa-pending',playerReleased:true})).s===403,'SL cannot substitute release for pending rights');
 check((await req('/api/codex','gm','PATCH',{book:'codex-qa-public',playerReleased:false,rights:'own'})).s===400,'Publication endpoint cannot alter rights');
 check((await req('/api/codex','gm','PATCH',{book:'codex-qa-public',playerReleased:false})).s===200,'SL revokes own book');
 check((await req('/api/codex?book=codex-qa-public','a')).s===403,'Revocation blocks player chapter access immediately');
 check((await req('/api/codex','gm','PATCH',{book:'codex-qa-public',playerReleased:true})).s===200,'SL explicitly republishes own book');
 const hits=await req('/api/codex?q=Willenskraft','a');
 check(hits.s===200&&hits.d.hits.length===1&&hits.d.hits[0].sectionId==='section-t.0-1'&&!JSON.stringify(hits.d).includes('SECRET'),'FTS results enforce visibility and contain direct section anchors');
 check((await req('/api/codex?q=Willenskraft&edition=V5','a')).d.hits.length===0,'Search does not mix editions');
 check((await req('/api/codex?q=%22%20OR%20*&edition=INVALID','a')).s===400,'Invalid edition is rejected');
 check((await req('/api/content-blocks?entityId=codex-qa-pending','gm')).d.blocks.length===0,'Generic block API cannot bypass Codex rights');
 check((await req('/api/content-blocks','gm','PATCH',{id:'codex-qa-public-chapter',entityId:'codex-qa-public',kind:'description',content:'stale-index-bypass',visibility:'player_visible',position:0})).s===403,'Generic authoring cannot mutate an indexed chapter');
 localSql("UPDATE entity_content_blocks SET visibility='sl_secret' WHERE id='codex-qa-public-chapter'");
 check((await req('/api/codex?q=Willenskraft','a')).d.hits.length===0,'Search respects chapter visibility revocation immediately');
 check((await req('/api/codex?book=codex-qa-public&chapter=codex-qa-public-chapter','a')).s===404,'Chapter read respects visibility revocation immediately');
 localSql("UPDATE entities SET content=json_set(content,'$.playerAccessBasis','operator_pre_alpha','$.playerAccessDecision',"+sqlQuote(CODEX_PRE_ALPHA_DECISION)+") WHERE id='codex-qa-pending'");
 check((await req('/api/codex','gm','PATCH',{book:'codex-qa-pending',playerReleased:true})).s===200,'SL releases documented operator decision without a licence claim');
 const operatorBook=(await req('/api/codex','a')).d.books.find(b=>b.id==='codex-qa-pending');
 check(operatorBook.readerReady&&operatorBook.rights==='pending'&&operatorBook.publicationBasis==='operator_pre_alpha','Player access and unresolved rights remain distinct');
 check((await req('/api/codex?book=codex-qa-pending&chapter=codex-qa-pending-chapter','a')).s===200,'Player reads full released operator-decision chapter');
 check((await req('/api/codex?q=Willenskraft','a')).d.hits.some(h=>h.bookId==='codex-qa-pending'),'Player searches operator-decision book');
 check((await req('/api/codex','a','PATCH',{book:'codex-qa-pending',playerReleased:false})).s===403,'Player cannot revoke or publish books');
 check((await req('/api/codex','gm','PATCH',{book:'codex-qa-pending',playerReleased:false})).s===200,'SL can immediately revoke operator-decision book');
 check((await req('/api/codex?book=codex-qa-pending','a')).s===403,'Revoked operator-decision reader denied');
 check(!(await req('/api/codex?q=Willenskraft','a')).d.hits.some(h=>h.bookId==='codex-qa-pending'),'Revoked operator-decision search denied');
 localSql("DELETE FROM entities WHERE id IN ('codex-qa-public','codex-qa-secret','codex-qa-pending','codex-qa-foreign')");
 check((await req('/api/codex?q=Willenskraft','a')).d.hits.length===0,'Cascade removal leaves no search ghosts');
}
