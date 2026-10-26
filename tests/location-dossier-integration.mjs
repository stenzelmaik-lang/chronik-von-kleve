import {richHtmlPrefix,richTextPrefix,richTextToHtml} from '../domain/location-rich-text.ts';

export async function locationDossierIntegration({req,check,base,ids}) {
  if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Dossier QA is restricted to isolated local resources.');
  const membersBefore=(await req('/api/members','gm')).d;
  const charactersBefore=(await req('/api/records?kind=charaktere','gm')).d;
  const create=async(level,title,parentId)=>{
    const r=await req('/api/cms/locations','gm','POST',{level,title,...(parentId?{parentId}:{})});
    check(r.s===201,'DOSSIER creates synthetic '+level+' in the existing model');return r.d;
  };
  const publish=async(node,payload)=>{
    const save=await req('/api/cms/drafts','gm','PATCH',{revisionId:node.revisionId,expectedVersion:1,payload});
    const review=await req('/api/cms/transitions','gm','POST',{action:'submit',revisionId:node.revisionId,expectedVersion:save.d.version});
    const approval=await req('/api/cms/transitions','gm','POST',{action:'approve',revisionId:node.revisionId,expectedVersion:review.d.version});
    const release=await req('/api/cms/releases','gm','POST',{action:'publish',entityId:node.id,scope:'group',revisionId:node.revisionId,expectedReleaseVersion:0,discoveryState:'known',reason:'Isolated SL dossier acceptance'});
    check([save,review,approval,release].every(r=>r.s===200),'DOSSIER public baseline uses only the existing explicit release path');
  };
  const root=await create('location','DOSSIER_QA – Hauptbahnhof');
  await publish(root,{title:root.title,summary:'DOSSIER_PUBLIC_ROOT'});
  const hall=await create('area','DOSSIER_QA – Empfangshalle',root.id);
  await publish(hall,{title:hall.title,playerHint:richHtmlPrefix+'<h2>Freigegebene Halle</h2><p>DOSSIER_PUBLIC_HALL</p>'});
  const room=await create('room','DOSSIER_QA – Dienstzimmer',hall.id);
  await publish(room,{title:room.title,short:'DOSSIER_PUBLIC_ROOM'});
  const playerPath='/api/locations?place='+root.id+'&view=player&target=player';
  const beforePlayer=(await req(playerPath,'a')).d;

  const original='DOSSIER_LEGACY_SECRET <literal> & Zeichen.\n\nZweite Zeile.\r\nDritte Zeile.';
  const legacy=await req('/api/cms/drafts','gm','POST',{entityId:root.id,audience:'gm',gmSecret:{text:original,source:'Unveränderte Quelle'}});
  check(legacy.s===201&&legacy.d.gmSecret.text===original,'DOSSIER existing plain SL text is stored byte-for-byte without conversion');
  const plainSave=await req('/api/cms/drafts','gm','PATCH',{revisionId:legacy.d.id,expectedVersion:1});
  check(plainSave.s===200,'DOSSIER saving another field does not require converting old SL text');
  const reread=(await req('/api/cms/drafts?entityId='+root.id,'gm')).d.drafts.find(r=>r.id===legacy.d.id);
  check(JSON.parse(reread.gm_secret_json).text===original,'DOSSIER historical paragraph and literal markup remain exact after save and reload');

  const html='<h2>Schnellübersicht</h2><p>DOSSIER_SECRET_ACCESS – nur Personal.</p><h2>Technik und Sicherheit</h2><h3>Seitentür</h3><ul><li>DOSSIER_SECRET_LOCK</li></ul><table><tr><td>Wache</td><td>Nachts</td></tr></table><p class="cp-note" onclick="evil()">DOSSIER_SECRET_NOTE</p><script>DOSSIER_SCRIPT_REMOVED</script><iframe src="https://evil.test"></iframe>';
  const confidential=await req('/api/cms/drafts','gm','POST',{entityId:hall.id,audience:'gm',gmSecret:{text:richHtmlPrefix+html,source:'DOSSIER_PRIVATE_SOURCE'}});
  check(confidential.s===201&&confidential.d.gmSecret.text.startsWith(richTextPrefix),'DOSSIER real SL create converts HTML into the existing typed document');
  const stored=confidential.d.gmSecret.text,safeHtml=richTextToHtml(stored);
  check(safeHtml.includes('<h2>')&&safeHtml.includes('<h3>')&&safeHtml.includes('<ul>')&&safeHtml.includes('<table>'),'DOSSIER headings, paragraphs, lists and tables survive actual storage');
  check(!safeHtml.includes('onclick')&&!safeHtml.includes('DOSSIER_SCRIPT_REMOVED')&&!safeHtml.includes('iframe'),'DOSSIER actual API write removes executable HTML and embeds');
  const form=new FormData();form.set('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'dossier-internal.png');
  const image=await req('/api/cms/media','gm','POST',form);
  const imageSave=await req('/api/cms/drafts','gm','PATCH',{revisionId:confidential.d.id,expectedVersion:1,heroFileId:image.d.id});
  check(image.s===201&&imageSave.s===200,'DOSSIER internal image remains in the existing private CMS attachment path');
  const sl=await req('/api/locations?node='+hall.id+'&view=sl&target=group','gm');
  const slNote=sl.d.projection?.location.slNotes?.find(n=>n.entityId===hall.id);
  check(sl.s===200&&sl.d.projection.location.id===root.id&&slNote?.text===stored,'DOSSIER area reference resolves the same main-place identity and saved SL chapters');
  check(sl.d.projection.location.slNotes.find(n=>n.entityId===root.id).text===original,'DOSSIER SL projection retains the original plain text');
  check((await req('/api/locations?node='+room.id+'&view=sl','gm')).d.projection.location.id===root.id,'DOSSIER room reference resolves through the same existing parent tree');
  check((await req('/api/locations?node=phase-c-foreign-place&view=sl','gm')).s===404,'DOSSIER cross-campaign node references are denied without metadata');
  check((await req('/api/locations?node=absent-dossier-node&view=sl','gm')).s===404,'DOSSIER absent node reference fails safely');
  check((await req('/api/locations?node='+hall.id+'&place='+root.id+'&view=sl','gm')).s===400,'DOSSIER ambiguous parent and node references are rejected');
  check((await req('/api/locations?node='+hall.id+'&view=sl','a')).s===403,'DOSSIER player cannot fetch the SL shortcut');
  check((await req('/api/locations?node='+hall.id+'&view=player','a')).s===403,'DOSSIER player cannot repurpose the SL reference resolver');
  check((await req('/api/locations?place='+root.id+'&view=sl','a')).s===403,'DOSSIER original SL endpoint remains protected');
  check((await req('/api/cms/drafts?entityId='+hall.id,'a')).s===403,'DOSSIER player cannot bypass the reader through draft endpoints');
  check((await fetch(base+slNote.image,{headers:ids.a})).status===403,'DOSSIER player cannot fetch the internal image by its known URL');
  const player=await req(playerPath,'a');
  check(player.s===200&&JSON.stringify(player.d)===JSON.stringify(beforePlayer),'DOSSIER adding internal chapters does not change the actual released player projection');
  check(!JSON.stringify(player.d).includes('DOSSIER_SECRET')&&!JSON.stringify(player.d).includes('DOSSIER_PRIVATE_SOURCE')&&!JSON.stringify(player.d).includes('DOSSIER_LEGACY_SECRET')&&!player.d.projection.location.slNotes,'DOSSIER no internal texts, sources, metadata or chapters are sent to players');
  const gmPreview=await req('/api/locations?place='+root.id+'&view=player&target=group','gm');
  check(gmPreview.s===200&&!gmPreview.d.projection.location.slNotes&&!JSON.stringify(gmPreview.d).includes('DOSSIER_SECRET'),'DOSSIER SL player preview also receives only the released player data');
  const invalid=await req('/api/cms/drafts','gm','PATCH',{revisionId:confidential.d.id,expectedVersion:imageSave.d.version,gmSecret:{text:richHtmlPrefix+'<p>'+'x'.repeat(5001)+'</p>'}});
  check(invalid.s===400,'DOSSIER oversized visible SL text is rejected server-side');
  const unchanged=(await req('/api/cms/drafts?entityId='+hall.id,'gm')).d.drafts.find(r=>r.id===confidential.d.id);
  check(unchanged.version===imageSave.d.version&&JSON.parse(unchanged.gm_secret_json).text===stored,'DOSSIER failed HTML save cannot overwrite the existing valid SL content');
  check(JSON.stringify((await req('/api/members','gm')).d)===JSON.stringify(membersBefore),'DOSSIER account-linked members and roles remain unchanged');
  check(JSON.stringify((await req('/api/records?kind=charaktere','gm')).d)===JSON.stringify(charactersBefore),'DOSSIER player character records remain unchanged');
}
