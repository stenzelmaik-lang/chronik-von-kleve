export async function locationCreationIntegration({req,check,base}) {
  if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Location creation QA requires an isolated local worker.');
  const create=async(level,title,parentId)=>{
    const result=await req('/api/cms/locations','gm','POST',{level,title,...(parentId?{parentId}:{})});
    check(result.s===201,'CREATE existing location model creates synthetic '+level);return result.d;
  };
  const publish=async(node,payload,heroFileId)=>{
    const saved=await req('/api/cms/drafts','gm','PATCH',{revisionId:node.revisionId,expectedVersion:1,payload,...(heroFileId?{heroFileId}:{})});
    const review=await req('/api/cms/transitions','gm','POST',{action:'submit',revisionId:node.revisionId,expectedVersion:saved.d.version});
    const approved=await req('/api/cms/transitions','gm','POST',{action:'approve',revisionId:node.revisionId,expectedVersion:review.d.version});
    const released=await req('/api/cms/releases','gm','POST',{action:'publish',entityId:node.id,scope:'group',revisionId:node.revisionId,expectedReleaseVersion:0,discoveryState:'known',reason:'Isolated hierarchy acceptance'});
    check([saved,review,approved,released].every(result=>result.s===200),'CREATE baseline is explicitly published only in the isolated test database');
  };
  const station=await create('location','Hauptbahnhof Kleve');
  await publish(station,{title:station.title,summary:'Synthetischer bestehender Hauptort; keine Produktionsdaten.'});
  const forecourt=await create('area','Bahnhofsvorplatz',station.id);
  const image=new FormData();
  image.set('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'creation-fixture.png');
  const media=await req('/api/cms/media','gm','POST',image);
  check(media.s===201,'CREATE baseline image remains in the existing private media store');
  await publish(forecourt,{title:forecourt.title,playerHint:'Unveränderter bestehender Bereich.'},media.d.id);
  const tree=()=>req('/api/cms/locations?place='+encodeURIComponent(station.id),'gm');
  const snapshot=async()=>Promise.all([req('/api/cms/drafts?entityId='+station.id,'gm'),req('/api/cms/drafts?entityId='+forecourt.id,'gm'),req('/api/cms/releases?entityId='+station.id+'&scope=group','gm'),req('/api/cms/releases?entityId='+forecourt.id+'&scope=group','gm')]).then(results=>results.map(result=>result.d));
  const rootsBefore=(await req('/api/cms/locations','gm')).d.locations;
  const treeBefore=(await tree()).d.nodes;
  const contentBefore=await snapshot();

  const hall=await create('area','Empfangshalle',station.id);
  check(hall.parentId===station.id&&hall.locationId===station.id&&hall.id!==station.id,'CREATE Empfangshalle belongs to the same existing Hauptbahnhof identity');
  const room=await create('room','Warteraum',hall.id);
  check(room.parentId===hall.id&&room.locationId===station.id,'CREATE optional room belongs to Empfangshalle, not to the main place');
  const after=(await tree()).d.nodes;
  const siblings=after.filter(node=>[forecourt.id,hall.id].includes(node.id));
  check(siblings.length===2&&siblings.every(node=>node.level==='area'&&node.parentId===station.id),'CREATE Bahnhofsvorplatz and Empfangshalle are siblings under Hauptbahnhof Kleve');
  check(JSON.stringify((await req('/api/cms/locations','gm')).d.locations)===JSON.stringify(rootsBefore),'CREATE adding an area and room creates no extra main place');
  check(treeBefore.every(node=>JSON.stringify(after.find(item=>item.id===node.id))===JSON.stringify(node)),'CREATE existing node IDs, parent references, positions and titles remain unchanged');
  check(JSON.stringify(await snapshot())===JSON.stringify(contentBefore),'CREATE existing descriptions, image references, revisions and releases remain unchanged');
  const player=await req('/api/locations?place='+station.id+'&view=player&target=player','a');
  check(player.s===200&&JSON.stringify(player.d).includes('Bahnhofsvorplatz')&&!JSON.stringify(player.d).includes('Empfangshalle')&&!JSON.stringify(player.d).includes('Warteraum'),'CREATE new drafts are not automatically released beside the existing visible area');
  const hallDrafts=await req('/api/cms/drafts?entityId='+hall.id,'gm');
  check(hallDrafts.d.drafts.length===1&&hallDrafts.d.drafts[0].status==='draft','CREATE area starts with the existing unpublished draft workflow');

  check((await req('/api/cms/locations','gm','POST',{level:'area',parentId:forecourt.id,title:'Wrong nesting'})).s===400,'CREATE server rejects area under area');
  check((await req('/api/cms/locations','gm','POST',{level:'room',parentId:station.id,title:'Wrong room parent'})).s===400,'CREATE server rejects room directly under main place');
  check((await req('/api/cms/locations','gm','POST',{level:'area',parentId:'place.missing',title:'Missing parent'})).s===404,'CREATE server rejects absent parent');
  check((await req('/api/cms/locations','a','POST',{level:'area',parentId:station.id,title:'Forbidden player write'})).s===403,'CREATE players cannot create areas');
  check(JSON.stringify((await tree()).d.nodes)===JSON.stringify(after),'CREATE rejected requests leave no extra nodes or hierarchy changes');
}
