import {htmlToRichText,richHtmlPrefix,richTextToHtml,richTextToPlainText} from '../domain/location-rich-text.ts';

export async function locationAreaIntegration({req,check,base,ids}) {
  if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Area QA requires an isolated local worker.');
  const existingEntities=(await req('/api/entities','gm')).d.entities;
  const membersBefore=(await req('/api/members','gm')).d.members;
  const charactersBefore=(await req('/api/records?kind=charaktere','gm')).d.records;
  const create=async(level,title,parentId)=>{
    const result=await req('/api/cms/locations','gm','POST',{level,title,...(parentId?{parentId}:{})});
    check(result.s===201,'AREA creates a new synthetic '+level+' without changing any existing place');return result.d;
  };
  const save=(node,payload,extra={})=>req('/api/cms/drafts','gm','PATCH',{revisionId:node.revisionId,expectedVersion:1,payload,...extra});
  const publish=async(node,version,discoveryState="known")=>{
    const review=await req('/api/cms/transitions','gm','POST',{action:'submit',revisionId:node.revisionId,expectedVersion:version});
    check(review.s===200,'AREA synthetic revision enters existing review');
    const approved=await req('/api/cms/transitions','gm','POST',{action:'approve',revisionId:node.revisionId,expectedVersion:review.d.version});
    check(approved.s===200,'AREA synthetic revision uses existing approval');
    const release=await req('/api/cms/releases','gm','POST',{action:'publish',entityId:node.id,scope:'group',revisionId:node.revisionId,expectedReleaseVersion:0,discoveryState,reason:'Isolated area HTML acceptance'});
    check(release.s===200,'AREA explicit group release succeeds');
  };
  const root=await create('location','AREA_QA – Testdossier');
  const oldText='AREA_QA alter Klartext\n\nZweiter Absatz mit <literal> & Zeichen.';
  const rootSaved=await save(root,{title:root.title,summary:oldText,atmosphere:'AREA_QA unveränderter Eindruck'});
  check(rootSaved.s===200,'AREA existing plain description saves without conversion');
  await publish(root,rootSaved.d.version);
  const area=await create('area','AREA_QA – Lesebereich',root.id);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=','base64');
  const uploadForm=new FormData();uploadForm.set('file',new Blob([png],{type:'image/png'}),'area-qa-private.png');
  const upload=await req('/api/cms/media','gm','POST',uploadForm);
  check(upload.s===201,'AREA image enters only the existing private media store');
  const html='<h2>AREA_QA beschriebener Bereich</h2><p class="cp-intro">Ankunft <strong>am Tor</strong>.</p><h3>Spuren</h3><ul><li><span class="cp-highlight">Erster Hinweis</span></li><li>Zweiter Hinweis</li></ul><blockquote class="cp-note">Ein Echo.</blockquote><p><a href="https://example.test/quelle">Fundstelle</a></p><hr class="cp-divider"><p onclick="AREA_XSS()">Sicher</p><script>AREA_SCRIPT_SECRET</script><iframe src="https://evil.test"></iframe>';
  const payload={title:area.title,playerHint:richHtmlPrefix+html};
  check((await req('/api/cms/drafts','a','PATCH',{revisionId:area.revisionId,expectedVersion:1,payload})).s===403,'AREA player cannot save HTML drafts');
  const saved=await save(area,payload,{heroFileId:upload.d.id});
  check(saved.s===200,'AREA actual CMS write sanitizes HTML on the server');
  const drafts=(await req('/api/cms/drafts?entityId='+area.id,'gm')).d.drafts;
  const persisted=drafts.find(d=>d.id===area.revisionId),text=JSON.parse(persisted.player_payload_json).playerHint;
  check(text===htmlToRichText(html)&&!text.includes('AREA_SCRIPT_SECRET')&&!text.includes('onclick'),'AREA persisted payload is canonical safe structure, not raw executable HTML');
  check(richTextToHtml(text).includes('class="cp-intro"')&&richTextToHtml(text).includes('class="cp-highlight"'),'AREA classes survive real save and reload');
  const preview=await req('/api/cms/preview','gm','POST',{revisionId:area.revisionId});
  const previewArea=preview.d.projection.location.areas.find(a=>a.title===area.title);
  check(preview.s===200&&previewArea?.playerHint===text,'AREA unsaved publication state can be previewed in the existing safe dossier');
  check((await fetch(base+previewArea.image,{headers:ids.a})).status===403,'AREA draft image preview cannot be used by a player');
  const beforeRelease=(await req('/api/locations?place='+root.id+'&view=player&target=player','a')).d;
  check(!JSON.stringify(beforeRelease).includes('AREA_QA beschriebener Bereich'),'AREA HTML editing does not automatically publish content');
  const tooLong=await req('/api/cms/drafts','gm','PATCH',{revisionId:area.revisionId,expectedVersion:persisted.version,payload:{title:area.title,playerHint:richHtmlPrefix+'<p>'+'x'.repeat(25001)+'</p>'}});
  check(tooLong.s===400,'AREA 25000-character limit is enforced against visible text server-side');
  const forged='cvk-rich-v1:'+JSON.stringify({version:1,blocks:[{type:'paragraph',className:'cp-intro hidden',children:[{text:'FORGED'}]}]});
  check((await req('/api/cms/drafts','gm','PATCH',{revisionId:area.revisionId,expectedVersion:persisted.version,payload:{title:area.title,playerHint:forged}})).s===400,'AREA direct structured input cannot bypass the CSS class allowlist');
  check((await req('/api/cms/drafts','gm','PATCH',{revisionId:area.revisionId,expectedVersion:persisted.version,payload:{title:area.title,playerHint:richHtmlPrefix+'x'.repeat(65001)}})).s===400,'AREA unbounded HTML fails safely in the Workers runtime');
  const reread=(await req('/api/cms/drafts?entityId='+area.id,'gm')).d.drafts.find(d=>d.id===area.revisionId);
  check(reread.version===persisted.version&&reread.player_payload_json===persisted.player_payload_json,'AREA rejected saves do not overwrite the valid description');
  const confidential=await req('/api/cms/drafts','gm','POST',{entityId:area.id,audience:'gm',gmSecret:{text:'AREA_QA_SL_SECRET'}});
  check(confidential.s===201,'AREA confidential text remains in a distinct existing SL draft');
  await publish(area,persisted.version);
  const rootRead='/api/cms/drafts?entityId='+root.id+'&scope=public';
  const baseline=await req(rootRead,'gm');
  check(baseline.s===200&&baseline.d.baseline?.payload?.title===root.title,'AREA opening an empty target loads safe editable content');
  const afterOpen=await req(rootRead,'gm');
  check(afterOpen.d.drafts.length===baseline.d.drafts.length&&await req(rootRead,'editor').then(r=>r.s===403),'AREA direct open creates no revision and preserves audience permissions');
  const approved=(await req('/api/cms/drafts?entityId='+area.id,'gm')).d.drafts.find(item=>item.id===area.revisionId);
  const directWrite={entityId:area.id,audience:'group',sourceRevisionId:approved.id,expectedLatest:approved.id+':'+approved.version,payload:{...payload,playerHint:'AREA_DIRECT_EDIT_DRAFT'}};
  const successor=await req('/api/cms/drafts','gm','POST',directWrite);
  check(successor.s===201&&successor.d.id!==approved.id&&successor.d.heroFileId===upload.d.id,'AREA direct save creates a separate revision with the existing image');
  check((await req('/api/cms/drafts','gm','POST',directWrite)).s===409,'AREA repeated or stale direct save cannot create another draft');
  const stillReleased=(await req('/api/locations?place='+root.id+'&view=player&target=player','a')).d;
  check(!JSON.stringify(stillReleased).includes('AREA_DIRECT_EDIT_DRAFT'),'AREA direct save leaves the player release untouched');
  const visible=(await req('/api/locations?place='+root.id+'&view=player&target=player','a')).d.projection.location;
  const playerArea=visible.areas.find(a=>a.title===area.title);
  check(visible.summary===oldText&&playerArea?.playerHint===text,'AREA published HTML and unchanged old plain text reach the same player projection');
  check(!JSON.stringify(visible).includes('AREA_QA_SL_SECRET')&&!JSON.stringify(visible).includes('AREA_SCRIPT_SECRET'),'AREA player projection includes neither SL text nor removed scripts');
  const image=await fetch(base+playerArea.image,{headers:ids.a});
  check(image.status===200&&/^private, no-(store|cache)$/.test(image.headers.get('cache-control')||''),'AREA lightbox source uses the existing authenticated private no-store media route');
  check((await fetch(base+playerArea.image)).status===401,'AREA anonymous visitors cannot retrieve lightbox image bytes');
  check((await fetch(base+'/api/files?id='+upload.d.id,{headers:ids.a})).status===404,'AREA public-facing descriptions do not turn private uploads into generic file links');
  check((await req('/api/cms/locations?place='+root.id,'gm')).d.nodes.some(n=>n.id===area.id&&n.parentId===root.id),'AREA identity and parent relationship survive HTML editing');
  const sl=(await req('/api/locations?place='+root.id+'&view=sl&target=group','gm')).d.projection.location;
  check(JSON.stringify(sl).includes('AREA_QA_SL_SECRET')&&sl.areas.find(a=>a.id===area.id)?.playerHint===text,'AREA SL reads the same released description plus only its confidential notes');
  const blocked=await req('/api/cms/releases','gm','POST',{action:'block',entityId:area.id,scope:'group',expectedReleaseVersion:1,reason:'Area QA block'});
  check(blocked.s===200&&!JSON.stringify((await req('/api/locations?place='+root.id+'&view=player&target=player','a')).d).includes('AREA_QA beschriebener Bereich'),'AREA existing group block still removes the formatted description');
  check((await fetch(base+playerArea.image,{headers:ids.a})).status===404,'AREA blocked image is inaccessible even with the previous lightbox URL');
  const tree={action:'publish-tree',placeId:root.id,discoveryState:'visited',entries:[
    {entityId:root.id,revisionId:root.revisionId,expectedReleaseVersion:1},
    {entityId:area.id,revisionId:approved.id,expectedReleaseVersion:2},
  ]};
  check((await req('/api/cms/releases','a','POST',tree)).s===403,'AREA tree release is SL only');
  const stale={...tree,entries:[tree.entries[0],{...tree.entries[1],expectedReleaseVersion:1}]};
  check((await req('/api/cms/releases','gm','POST',stale)).s===409,'AREA stale child rejects the entire location release');
  const rootState=await req('/api/cms/releases?scope=group&entityId='+root.id,'gm');
  check(rootState.d.currentVersion===1,'AREA rejected tree leaves root version unchanged');
  const releasedTree=await req('/api/cms/releases','gm','POST',tree);
  const treePlayer=(await req('/api/locations?place='+root.id+'&view=player&target=player','a')).d.projection.location;
  check(releasedTree.s===200&&releasedTree.d.count===2&&treePlayer.discovery==='visited'&&treePlayer.areas.some(item=>item.title===area.title),'AREA tree releases exactly selected root and child together');
  check(!JSON.stringify(treePlayer).includes('AREA_DIRECT_EDIT_DRAFT')&&!JSON.stringify(treePlayer).includes('AREA_QA_SL_SECRET'),'AREA tree never publishes drafts or confidential text');
  const rumor=await create('location','AREA_QA vertraulicher Name');
  const rumorSave=await save(rumor,{title:rumor.title,address:'AREA_QA genaue Adresse',mapRisk:'hostile'},{
    geography:{status:'approximate',coordinates:[6.25,51.875],accuracyMeters:50000,source:'AREA_QA private Herkunft',reference:'https://example.test/exakt',reviewedAt:new Date().toISOString()},
  });
  check(rumorSave.s===200,'AREA saves a coarse 50km search area');
  await publish(rumor,rumorSave.d.version,'rumored');
  const rumorPlayer=(await req('/api/locations?place='+rumor.id+'&view=player&target=player','a')).d.projection.location;
  check(rumorPlayer.title==='Unbekannter Ort'&&rumorPlayer.geography?.accuracyMeters===50000&&!rumorPlayer.mapRisk&&!JSON.stringify(rumorPlayer).includes('AREA_QA'),'AREA coarse rumor exposes a search radius without name, address, risk or source details');
  const entitiesAfter=(await req('/api/entities','gm')).d.entities;
  check(existingEntities.every(before=>JSON.stringify(entitiesAfter.find(after=>after.id===before.id))===JSON.stringify(before)),'AREA existing entities and their versions are unchanged');
  check(JSON.stringify((await req('/api/members','gm')).d.members)===JSON.stringify(membersBefore),'AREA existing member accounts and roles remain unchanged');
  check(JSON.stringify((await req('/api/records?kind=charaktere','gm')).d.records)===JSON.stringify(charactersBefore),'AREA existing player characters remain unchanged');
  check(richTextToPlainText(text).includes('Erster Hinweis'),'AREA text remains searchable and reusable without raw HTML markup');
}
