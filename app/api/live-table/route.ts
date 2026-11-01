import { env } from 'cloudflare:workers';
import { actor,database,sameOrigin,json,failure,HttpError,gmOnly,type Actor } from '@/server/access';
import { GET as recordsGET } from '../records/route';
import type { Entry,LegacyRecordRow } from '@/domain/legacy';
import { boardElement,tableSignal,tablePeerId,TABLE_PEER_TTL,BOARD_MAX_CHARS,BOARD_MAX_ELEMENTS,type TablePeer } from '@/domain/live-table';
import {LIVE_ACTIONS,liveCommand,liveEvents} from '@/server/live-commands';
import {roomAllowed,liveFile,liveMembers,type LiveRoom} from '@/server/live-game';
export const dynamic='force-dynamic';
type TableBody=LiveRoom;
async function tableInput(req:Request) {
  if(!(req.headers.get('content-type')||'').includes('application/json'))throw new HttpError(415,'JSON erwartet.');
  if(!req.body)throw new HttpError(400,'Spielraumaktion fehlt.');
  const reader=req.body.getReader(),decoder=new TextDecoder();let size=0,text='';
  try {
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>32000){await reader.cancel();throw new HttpError(413,'Spielraumdaten sind zu groß.');}text+=decoder.decode(part.value,{stream:true});}
    text+=decoder.decode();
  }finally{reader.releaseLock();}
  try{return JSON.parse(text);}catch{throw new HttpError(400,'Ungültige Spielraumaktion.');}
}
async function sessions(req:Request,viewer:Actor):Promise<Entry[]> {
  const url=new URL(req.url);url.search='?kind=sitzungen';
  const response=await recordsGET(new Request(url,{headers:req.headers}));
  if(!response.ok)throw new HttpError(response.status,'Sitzungen sind nicht verfügbar.');
  const available=(await response.json() as {records:Entry[]}).records.filter(entry=>entry.visibility==='group');
  const rows=await database().prepare("SELECT json_object('sessionId',json_extract(body,'$.sessionId'),'title',json_extract(body,'$.title'),'participants',json_extract(body,'$.participants')) AS body FROM records WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table' AND json_extract(body,'$.started')=1 AND json_extract(body,'$.open')=1").bind(viewer.campaignId).all<{body:string}>();
  for(const row of rows.results){const room=JSON.parse(row.body) as LiveRoom;if(roomAllowed(viewer,room)&&!available.some(session=>session.id===room.sessionId))available.push({id:room.sessionId,title:room.title||'Live-Spielabend',kind:'sitzungen',visibility:'group',body:{},version:1});}
  return available;
}
function bodyOf(row:LegacyRecordRow):TableBody {
  const body=JSON.parse(row.body);
  if(body.context!=='live-table'||!Array.isArray(body.elements)||typeof body.peers!=='object')throw new HttpError(409,'Ungültiger Spielraum.');
  return body;
}
function iceConfiguration():RTCIceServer[] {
  if ('AUTH_ACCESS_ENVIRONMENT' in env && env.AUTH_ACCESS_ENVIRONMENT === 'closed-alpha-production') {
    throw new HttpError(503,'Bildschirmfreigabe ist noch nicht für den Live-Betrieb freigegeben. Das Whiteboard bleibt verfügbar.');
  }
  const raw='LIVE_ICE_SERVERS_JSON' in env?String(env.LIVE_ICE_SERVERS_JSON):'';
  if(!raw)return [];
  try {
    const servers=JSON.parse(raw) as RTCIceServer[];
    if(!Array.isArray(servers)||servers.length>4||servers.some(server=>![server.urls].flat().every(url=>typeof url==='string'&&/^(stun|stuns|turn|turns):/.test(url))))throw new Error();
    return servers;
  }catch{throw new HttpError(503,'Die Bildschirm-Verbindung ist noch nicht korrekt konfiguriert.');}
}
export async function GET(req:Request) {
  try {
    const a=await actor();const db=database(),q=new URL(req.url).searchParams;
    let sessionId=q.get('sessionId');
    if(q.get('view')==='active'){
      const active=await db.prepare("SELECT body FROM records WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table' AND json_extract(body,'$.started')=1 AND json_extract(body,'$.open')=1 ORDER BY updated_at DESC LIMIT 1").bind(a.campaignId).first<{body:string}>();
      if(!active||!roomAllowed(a,JSON.parse(active.body)))return json({room:null,events:[],members:[]});sessionId=JSON.parse(active.body).sessionId;
    }
    const rows=sessionId
      ? await db.prepare("SELECT * FROM records WHERE campaign_id=? AND id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table'").bind(a.campaignId,`live-table:${a.campaignId}:${sessionId}`).all<LegacyRecordRow>()
      : await db.prepare("SELECT id,json_object('context','live-table','sessionId',json_extract(body,'$.sessionId'),'open',json_extract(body,'$.open'),'started',json_extract(body,'$.started'),'title',json_extract(body,'$.title'),'participants',json_extract(body,'$.participants'),'elements',json('[]'),'peers',json('{}')) AS body FROM records WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table'").bind(a.campaignId).all<LegacyRecordRow>();
    const accessibleRooms=rows.results.map(bodyOf).filter(room=>roomAllowed(a,room));
    const available=sessionId&&accessibleRooms.some(room=>room.sessionId===sessionId&&room.started&&room.open)?[]:await sessions(req,a);
    for(const room of accessibleRooms.filter(room=>room.started&&room.open))if(!available.some(session=>session.id===room.sessionId))available.push({id:room.sessionId,title:room.title||'Live-Spielabend',kind:'sitzungen',visibility:'group',body:{},version:1});
    if(!sessionId)return json({sessions:available.map(session=>({id:session.id,title:accessibleRooms.find(room=>room.sessionId===session.id&&room.started)?.title||session.title,open:accessibleRooms.some(room=>room.sessionId===session.id&&room.open),started:accessibleRooms.some(room=>room.sessionId===session.id&&room.open&&room.started)}))});
    if(!available.some(session=>session.id===sessionId))throw new HttpError(404,'Spielraum nicht verfügbar.');
    const row=rows.results.find(row=>bodyOf(row).sessionId===sessionId);
    if(!row)return json({room:null});
    const room=bodyOf(row);if(!roomAllowed(a,room))throw new HttpError(404,'Spielraum nicht verfügbar.');const now=Date.now();
    const changes=room.started&&room.open?await db.prepare("SELECT count(*) AS n,COALESCE(sum(version),0) AS v FROM records WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table-event' AND json_extract(body,'$.sessionId')=? AND json_extract(body,'$.runId')=? AND (?=1 OR json_extract(body,'$.recipients') IS NULL OR EXISTS(SELECT 1 FROM json_each(records.body,'$.recipients') WHERE value=?))").bind(a.campaignId,sessionId,room.runId,a.gm?1:0,a.id).first<{n:number;v:number}>():null;
    const cursor=`${a.id}:${a.gm}:${row.version}:${room.runId||''}:${changes?.n||0}:${changes?.v||0}`;
    if(q.get('cursor')===cursor)return json({unchanged:true,cursor});
    const peers=Object.values(room.peers).filter(peer=>peer.seen>now-TABLE_PEER_TTL);
    const screen=room.open&&room.screen&&peers.some(peer=>peer.id===room.screen?.peerId)?room.screen:null;
    const peerId=new URL(req.url).searchParams.get('peerId');
    const peer=peerId?peers.find(peer=>peer.id===peerId&&peer.memberId===a.id):undefined;
    const signalRows=peer&&screen?await db.prepare("SELECT id,body FROM records WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table-signal' AND json_extract(body,'$.sessionId')=? AND json_extract(body,'$.target')=? AND json_extract(body,'$.screenId')=? AND updated_at>? ORDER BY created_at,id LIMIT 100").bind(a.campaignId,sessionId,peer.id,screen.screenId,new Date(now-45000).toISOString()).all<{id:string;body:string}>():{results:[]};
    let iceServers:RTCIceServer[]=[];let mediaError='';
    if(peer)try{iceServers=iceConfiguration();}catch(error){mediaError=(error as Error).message;}
    return json({cursor,room:{sessionId,version:row.version,open:room.open,started:room.started||false,startedAt:room.startedAt||'',runId:room.runId||'',title:room.title||'',epoch:room.epoch,boardLocked:!!room.boardLocked,elements:room.open?room.elements:[],peers:room.open?peers:[],screen},members:room.started&&room.open?(await liveMembers(a)).filter(m=>room.participants?.includes(m.id)):[],events:room.started&&room.open?await liveEvents(a,sessionId,room):[],signals:signalRows.results.map(signal=>({id:signal.id,...JSON.parse(signal.body)})),iceServers,mediaError,relayConfigured:iceServers.some(server=>[server.urls].flat().some(url=>/^turns?:/.test(url)))});
  }catch(error){return failure(error,req);}
}
export async function POST(req:Request) {
  try {
    sameOrigin(req);const a=await actor();const d=await tableInput(req);
    if(!d||typeof d!=='object'||typeof d.sessionId!=='string'||d.sessionId.length>160)throw new HttpError(400,'Ungültiger Spielraum.');
    if(LIVE_ACTIONS.includes(d.action))return json(await liveCommand(a,d));
    const db=database(),id=`live-table:${a.campaignId}:${d.sessionId}`,now=Date.now(),stamp=new Date(now).toISOString();
    const row=await db.prepare("SELECT * FROM records WHERE campaign_id=? AND id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table'").bind(a.campaignId,id).first<LegacyRecordRow>();
    const active=row&&bodyOf(row).started&&bodyOf(row).open&&roomAllowed(a,bodyOf(row));
    const available=active?[{id:d.sessionId}]:await sessions(req,a);const session=available.find(session=>session.id===d.sessionId);
    if(!session)throw new HttpError(404,'Nur eine für die Gruppe freigegebene Sitzung kann einen Spielraum erhalten.');
    if(row&&!roomAllowed(a,bodyOf(row)))throw new HttpError(404,'Spielraum nicht verfügbar.');
    if(d.action==='open'){
      gmOnly(a);
      if(!row){
        const body:TableBody={context:'live-table',sessionId:d.sessionId,open:true,epoch:0,elements:[],peers:{},screen:null};
        await db.prepare("INSERT INTO records(id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at,campaign_id) VALUES(?,?,'notizen','private','Gemeinsamer Spielraum',?,'',?,?,?) ON CONFLICT(id) DO NOTHING").bind(id,a.id,JSON.stringify(body),stamp,stamp,a.campaignId).run();
      }else await db.prepare("UPDATE records SET body=json_set(body,'$.open',json('true')),version=version+1,updated_at=? WHERE id=? AND campaign_id=?").bind(stamp,id,a.campaignId).run();
      return json({ok:true});
    }
    if(!row)throw new HttpError(404,'Spielraum nicht verfügbar.');
    const room=bodyOf(row);
    if(d.action==='close'){
      gmOnly(a);
      await db.batch([db.prepare("UPDATE records SET body=json_set(body,'$.open',json('false'),'$.peers',json('{}'),'$.screen',json('null')),version=version+1,updated_at=? WHERE id=? AND campaign_id=?").bind(stamp,id,a.campaignId),db.prepare("DELETE FROM records WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table-signal' AND json_extract(body,'$.sessionId')=?").bind(a.campaignId,d.sessionId)]);
      return json({ok:true});
    }
    if(!room.open)throw new HttpError(409,'Der Spielraum ist geschlossen.');
    if(d.runId!==undefined&&d.runId!==room.runId)throw new HttpError(409,'Dieser Spielabend wurde neu gestartet.');
    if(!tablePeerId(d.peerId))throw new HttpError(400,'Ungültige Teilnehmerkennung.');
    const existing=room.peers[d.peerId];
    if(existing&&existing.memberId!==a.id)throw new HttpError(403,'Diese Teilnehmerkennung gehört nicht dir.');
    const peerPath=`$.peers."${d.peerId}"`;
    if(d.action==='join'){
      const peer:TablePeer={id:d.peerId,memberId:a.id,name:a.name,seen:now};
      const result=await db.prepare("UPDATE records SET body=json_set(body,'$.peers',json((SELECT COALESCE(json_group_object(key,json(value)),'{}') FROM json_each(records.body,'$.peers') WHERE json_extract(value,'$.seen')>?)),?,json(?)),version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND json_extract(body,'$.open')=1 AND (json_extract(body,?) IS NULL OR json_extract(body,?)=?) AND (json_extract(body,?)=? OR (SELECT count(*) FROM json_each(records.body,'$.peers') WHERE json_extract(value,'$.seen')>?)<8)").bind(now-TABLE_PEER_TTL,peerPath,JSON.stringify(peer),stamp,id,a.campaignId,peerPath+'.memberId',peerPath+'.memberId',a.id,peerPath+'.memberId',a.id,now-TABLE_PEER_TTL).run();
      if(!result.meta.changes)throw new HttpError(409,'Der Raum ist geschlossen oder bereits mit acht Verbindungen belegt.');
      return json({ok:true});
    }
    if(!existing||existing.seen<=now-TABLE_PEER_TTL)throw new HttpError(403,'Bitte dem Spielraum erneut beitreten.');
    const requirePeer="id=? AND campaign_id=? AND json_extract(body,'$.open')=1 AND json_extract(body,?)=?";
    // Sketch changes: players only while the GM has not locked the sketch (checked again inside every write).
    const unlocked=" AND (?=1 OR COALESCE(json_extract(body,'$.boardLocked'),0)=0)";
    if(['draw','edit','remove','clearMine'].includes(d.action)&&!a.gm&&room.boardLocked)throw new HttpError(423,'Die SL hat die Skizze gerade gesperrt.');
    if(d.action==='pulse'){
      if(d.afk!==undefined&&typeof d.afk!=='boolean')throw new HttpError(400,'AFK muss ausdrücklich gewählt werden.');
      const awayPath='$.away.'+JSON.stringify(a.id);
      const update=d.afk===undefined?db.prepare(`UPDATE records SET body=json_set(body,?,?),version=version+1,updated_at=? WHERE ${requirePeer}`).bind(peerPath+'.seen',now,stamp,id,a.campaignId,peerPath+'.memberId',a.id):db.prepare(`UPDATE records SET body=json_set(body,?,?,?,json(?)),version=version+1,updated_at=? WHERE ${requirePeer}`).bind(peerPath+'.seen',now,awayPath,JSON.stringify(d.afk),stamp,id,a.campaignId,peerPath+'.memberId',a.id);
      await db.batch([update,db.prepare("DELETE FROM records WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table-signal' AND updated_at<?").bind(a.campaignId,new Date(now-45000).toISOString())]);
      return json({ok:true});
    }
    if(d.action==='leave'){
      await db.prepare(`UPDATE records SET body=json_remove(body,?),version=version+1,updated_at=? WHERE ${requirePeer}`).bind(peerPath,stamp,id,a.campaignId,peerPath+'.memberId',a.id).run();return json({ok:true});
    }
    if(d.action==='draw'){
      let element;try{element={...boardElement(d.element),memberId:a.id,name:a.name,revision:1};}catch(error){throw new HttpError(400,(error as Error).message);}
      if(element.fileId){const file=await liveFile(a,element.fileId);if(!file.mime.startsWith('image/'))throw new HttpError(400,'Nur Bilder auf dem Whiteboard.');}
      if(room.elements.some(item=>item.id===element.id)){
        const previous=room.elements.find(item=>item.id===element.id);
        if(JSON.stringify({...previous,revision:previous?.revision||1})!==JSON.stringify(element))throw new HttpError(409,'Diese Zeichenkennung ist bereits belegt.');
        return json({ok:true});
      }
      if(!Number.isInteger(d.epoch)||d.epoch!==room.epoch)throw new HttpError(409,'Das Whiteboard wurde zwischenzeitlich geleert. Dein Entwurf bleibt erhalten.');
      const encoded=JSON.stringify(element);
      if(room.elements.length>=BOARD_MAX_ELEMENTS||JSON.stringify(room.elements).length+encoded.length+1>BOARD_MAX_CHARS)throw new HttpError(409,'Die Skizze ist voll. Eigene Striche löschen oder die SL leert sie.');
      const result=await db.prepare(`UPDATE records SET body=json_insert(body,'$.elements[#]',json(?)),version=version+1,updated_at=? WHERE ${requirePeer}${unlocked} AND json_extract(body,'$.epoch')=? AND json_array_length(body,'$.elements')<? AND length(json_extract(body,'$.elements'))+?<=? AND NOT EXISTS(SELECT 1 FROM json_each(records.body,'$.elements') WHERE json_extract(value,'$.id')=?)`).bind(encoded,stamp,id,a.campaignId,peerPath+'.memberId',a.id,a.gm?1:0,d.epoch,BOARD_MAX_ELEMENTS,encoded.length+1,BOARD_MAX_CHARS,element.id).run();
      if(!result.meta.changes)throw new HttpError(409,'Skizze inzwischen geändert, geschlossen oder voll. Dein Strich bleibt zum erneuten Senden.');
      return json({ok:true});
    }
    if(d.action==='edit'||d.action==='remove'){
      if(!tablePeerId(d.elementId)||!Number.isInteger(d.expectedRevision)||!Number.isInteger(d.epoch)||d.epoch!==room.epoch)throw new HttpError(409,'Whiteboard geändert. Bitte erneut versuchen.');
      const index=room.elements.findIndex(e=>e.id===d.elementId),previous=room.elements[index];
      if(!previous)throw new HttpError(404,'Whiteboard-Objekt nicht mehr vorhanden.');
      if(!a.gm&&previous.memberId!==a.id)throw new HttpError(403,'Nur eigene Striche lassen sich ändern; die SL kann alles ändern.');
      if((previous.revision||1)!==d.expectedRevision)throw new HttpError(409,'Dieses Objekt wurde inzwischen von jemand anderem geändert.');
      const path=`$.elements[${index}]`;
      let bodyExpression='json_remove(body,?)',args:unknown[]=[path];
      if(d.action==='edit'){
        let next;try{next=boardElement(d.element);}catch(error){throw new HttpError(400,(error as Error).message);}
        if(next.id!==previous.id||next.fileId!==previous.fileId)throw new HttpError(400,'Objektkennung oder Bildquelle darf nicht ersetzt werden.');
        next={...next,memberId:previous.memberId,name:previous.name,revision:d.expectedRevision+1};bodyExpression='json_set(body,?,json(?))';args=[path,JSON.stringify(next)];
      }
      const changed=await db.prepare(`UPDATE records SET body=${bodyExpression},version=version+1,updated_at=? WHERE ${requirePeer}${unlocked} AND json_extract(body,'$.epoch')=? AND json_extract(body,?)=? AND COALESCE(json_extract(body,?),1)=? AND (?=1 OR json_extract(body,?)=?) AND (?=1 OR length(json_extract(body,'$.elements'))-length(json_extract(body,?))+?<=?)`).bind(...args,stamp,id,a.campaignId,peerPath+'.memberId',a.id,a.gm?1:0,d.epoch,path+'.id',previous.id,path+'.revision',d.expectedRevision,a.gm?1:0,path+'.memberId',a.id,d.action==='remove'?1:0,path,d.action==='edit'?String(args[1]).length:0,BOARD_MAX_CHARS).run();
      if(!changed.meta.changes)throw new HttpError(409,'Objekt inzwischen geändert oder entfernt. Dein Entwurf bleibt erhalten.');
      return json({ok:true,revision:d.expectedRevision+1});
    }
    if(d.action==='clear'){
      gmOnly(a);
      const result=await db.prepare(`UPDATE records SET body=json_set(body,'$.elements',json('[]'),'$.epoch',json_extract(body,'$.epoch')+1),version=version+1,updated_at=? WHERE ${requirePeer} AND json_extract(body,'$.epoch')=?`).bind(stamp,id,a.campaignId,peerPath+'.memberId',a.id,d.epoch).run();
      if(!result.meta.changes)throw new HttpError(409,'Whiteboard inzwischen geändert.');return json({ok:true});
    }
    if(d.action==='clearMine'){
      // Removes every own element at once, in place; elements of others keep their order.
      if(!Number.isInteger(d.epoch)||d.epoch!==room.epoch)throw new HttpError(409,'Die Skizze wurde inzwischen geleert.');
      const result=await db.prepare(`UPDATE records SET body=json_set(body,'$.elements',json((SELECT COALESCE(json_group_array(json(value)),'[]') FROM (SELECT value FROM json_each(records.body,'$.elements') WHERE COALESCE(json_extract(value,'$.memberId'),'')<>? ORDER BY key)))),version=version+1,updated_at=? WHERE ${requirePeer}${unlocked} AND json_extract(body,'$.epoch')=?`).bind(a.id,stamp,id,a.campaignId,peerPath+'.memberId',a.id,a.gm?1:0,d.epoch).run();
      if(!result.meta.changes)throw new HttpError(409,'Skizze inzwischen geändert.');return json({ok:true});
    }
    if(d.action==='lock'){
      gmOnly(a);if(typeof d.locked!=='boolean')throw new HttpError(400,'Sperre ausdrücklich wählen.');
      await db.prepare(`UPDATE records SET body=json_set(body,'$.boardLocked',json(?)),version=version+1,updated_at=? WHERE ${requirePeer}`).bind(String(d.locked),stamp,id,a.campaignId,peerPath+'.memberId',a.id).run();
      return json({ok:true,locked:d.locked});
    }
    const activeScreen=room.screen&&room.peers[room.screen.peerId]?.seen>now-TABLE_PEER_TTL?room.screen:null;
    if(d.action==='startScreen'){
      iceConfiguration();
      if(!tablePeerId(d.screenId))throw new HttpError(400,'Ungültige Bildschirmkennung.');
      if(activeScreen&&activeScreen.peerId!==d.peerId)throw new HttpError(409,'Ein Bildschirm wird bereits geteilt.');
      const result=await db.prepare(`UPDATE records SET body=json_set(body,'$.screen',json(?)),version=version+1,updated_at=? WHERE ${requirePeer} AND version=?`).bind(JSON.stringify({peerId:d.peerId,screenId:d.screenId}),stamp,id,a.campaignId,peerPath+'.memberId',a.id,row.version).run();
      if(!result.meta.changes)throw new HttpError(409,'Spielraum inzwischen geändert. Bitte erneut versuchen.');return json({ok:true,version:row.version+1});
    }
    if(d.action==='stopScreen'){
      await db.prepare(`UPDATE records SET body=json_set(body,'$.screen',json('null')),version=version+1,updated_at=? WHERE ${requirePeer} AND json_extract(body,'$.screen.peerId')=?`).bind(stamp,id,a.campaignId,peerPath+'.memberId',a.id,d.peerId).run();return json({ok:true});
    }
    if(d.action==='signal'){
      if(!activeScreen||activeScreen.screenId!==d.screenId||!tablePeerId(d.target)||d.target===d.peerId||!room.peers[d.target]||room.peers[d.target].seen<=now-TABLE_PEER_TTL)throw new HttpError(404,'Bildschirmverbindung nicht verfügbar.');
      let signal;try{signal=tableSignal(d.signal);}catch(error){throw new HttpError(400,(error as Error).message);}
      const presenter=activeScreen.peerId===d.peerId;
      if((signal.type==='offer'&&!presenter)||(signal.type==='answer'&&presenter)||(!presenter&&d.target!==activeScreen.peerId))throw new HttpError(403,'Ungültige Bildschirmrichtung.');
      const pending=await db.prepare("SELECT count(*) AS total FROM records WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table-signal' AND json_extract(body,'$.sessionId')=? AND json_extract(body,'$.target')=? AND updated_at>?").bind(a.campaignId,d.sessionId,d.target,new Date(now-45000).toISOString()).first<{total:number}>();
      if((pending?.total||0)>=100)throw new HttpError(429,'Zu viele Verbindungssignale. Bitte kurz warten.');
      const body=JSON.stringify({context:'live-table-signal',sessionId:d.sessionId,screenId:d.screenId,from:d.peerId,target:d.target,...signal});
      const result=await db.prepare("INSERT INTO records(id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at,campaign_id) SELECT ?,?,'notizen','private','Verbindungssignal',?,'',?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND campaign_id=? AND json_extract(body,'$.open')=1 AND json_extract(body,'$.screen.screenId')=?)").bind(crypto.randomUUID(),a.id,body,stamp,stamp,a.campaignId,id,a.campaignId,d.screenId).run();
      if(!result.meta.changes)throw new HttpError(409,'Die Bildschirmfreigabe wurde beendet.');return json({ok:true});
    }
    throw new HttpError(400,'Unbekannte Spielraumaktion.');
  }catch(error){return failure(error,req);}
}
