import { castMvpVote, closeMvpVote, tallyMvpVotes, type MvpPoll } from '../domain/mvp-vote.ts';

/** Campaign-scoped ballot in existing settings, with optimistic concurrency. Awards remain in the XP ledger. */
export class MvpVoteError extends Error {
  readonly status: 400|403|404|409|503;
  constructor(status: 400|403|404|409|503, message: string) { super(message); this.status=status; this.name='MvpVoteError'; }
}
type Candidate = { id:string; name:string };
type PollRow = { value:string };
type SessionRow = { id:string; title:string; played_on:string };
const ident = /^[A-Za-z0-9_-]{1,100}$/;
function checked(id: string) {
  if (typeof id !== 'string' || !ident.test(id)) throw new MvpVoteError(400,'Ungültige Kennung.');
  return id;
}
const keyOf=(campaignId:string,sessionId:string)=>'mvp-vote:'+checked(campaignId)+':'+checked(sessionId);
function decode(value:string):MvpPoll {
  let state:unknown;
  try { state=JSON.parse(value); }catch{throw new MvpVoteError(409,'MVP-Abstimmungsstand ungültig.');}
  if (!state || typeof state!=='object' || Array.isArray(state)) throw new MvpVoteError(409,'MVP-Abstimmungsstand ungültig.');
  const p=state as MvpPoll;
  if (!Number.isSafeInteger(p.version) || p.version<1 || !['open','closed'].includes(p.status) || !Array.isArray(p.votes) ||
    p.votes.some(v=>!v || typeof v.voterId !== 'string' || typeof v.nomineeId !== 'string' || typeof v.at!=='string'))
    throw new MvpVoteError(409,'MVP-Abstimmungsstand ungültig.');
  return p;
}
const participantsSql = [
  'SELECT DISTINCT m.id,m.name FROM xp_settlements s',
  'JOIN xp_settlement_participants p ON p.settlement_id=s.id AND p.attended=1',
  "JOIN records r ON r.id=p.character_id AND r.campaign_id=s.campaign_id AND r.kind='charaktere'",
  'JOIN members m ON m.id=r.owner_id',
  'LEFT JOIN campaign_memberships cm ON cm.user_id=m.id AND cm.campaign_id=s.campaign_id',
  "WHERE s.campaign_id=? AND s.played_session_id=? AND COALESCE(cm.status,m.status)='active'",
  'ORDER BY m.name,m.id',
].join(' ');
async function context(db:D1Database,campaignId:string,sessionId:string) {
  checked(campaignId);checked(sessionId);
  const session=await db.prepare('SELECT id,title,played_on FROM played_sessions WHERE id=? AND campaign_id=?')
    .bind(sessionId,campaignId).first<SessionRow>();
  if (!session) throw new MvpVoteError(404,'Gespielter Abend nicht verfügbar.');
  const rows=await db.prepare(participantsSql).bind(campaignId,sessionId).all<Candidate>();
  return {session,candidates:rows.results};
}
async function stored(db:D1Database,key:string):Promise<PollRow|null> {
  return db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first<PollRow>();
}
export type MvpVoteView = {
  session:{id:string;title:string;playedOn:string};
  status:'none'|'open'|'closed';
  candidates:Candidate[];
  myVote:string|null;
  totalVotes:number;
  results?:{ nomineeId:string;votes:number }[];
};
function project(ctx:Awaited<ReturnType<typeof context>>,state:MvpPoll|null,actorId:string,gm:boolean):MvpVoteView {
  const eligible=ctx.candidates.some(c=>c.id===actorId);
  if (!eligible && !gm) throw new MvpVoteError(403,'Nur teilnehmende Spieler dürfen die MVP-Wahl öffnen.');
  return {session:{id:ctx.session.id,title:ctx.session.title,playedOn:ctx.session.played_on},
    status:state?.status??'none', candidates:ctx.candidates,
    myVote:state?.votes.find(v=>v.voterId===actorId)?.nomineeId??null,
    totalVotes:state?.votes.length??0,
    ...(state?.status==='closed'?{results:tallyMvpVotes(state.votes)}:{})};
}
export async function viewMvpVote(db:D1Database,campaignId:string,sessionId:string,actorId:string,gm:boolean):Promise<MvpVoteView> {
  const ctx=await context(db,campaignId,sessionId);
  const row=await stored(db,keyOf(campaignId,sessionId));
  return project(ctx,row?decode(row.value):null,actorId,gm);
}
export async function openMvpVote(db:D1Database,campaignId:string,sessionId:string,actorId:string,now:string):Promise<MvpVoteView> {
  const ctx=await context(db,campaignId,sessionId);
  const settlement=await db.prepare('SELECT status FROM xp_settlements WHERE campaign_id=? AND played_session_id=?')
    .bind(campaignId,sessionId).first<{status:string}>();
  if(settlement?.status !== 'complete')throw new MvpVoteError(409,'Bitte zuerst die Sitzungsabrechnung vollständig abschließen.');
  if(ctx.candidates.length<2)throw new MvpVoteError(409,'Die MVP-Wahl benötigt mindestens zwei teilnehmende Spieler.');
  const key=keyOf(campaignId,sessionId);
  const initial:MvpPoll={version:1,status:'open',votes:[],openedAt:now,openedBy:actorId};
  await db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING')
    .bind(key,JSON.stringify(initial)).run();
  const saved=await stored(db,key);
  if(!saved)throw new MvpVoteError(503,'MVP-Wahl konnte nicht geöffnet werden.');
  return project(ctx,decode(saved.value),actorId,true);
}
export async function submitMvpVote(db:D1Database,campaignId:string,sessionId:string,actorId:string,nomineeId:string,now:string):Promise<MvpVoteView> {
  checked(actorId);checked(nomineeId);
  const ctx=await context(db,campaignId,sessionId),key=keyOf(campaignId,sessionId);
  for(let i=0;i<8;i++){
    const row=await stored(db,key);
    if(!row)throw new MvpVoteError(404,'Keine MVP-Wahl für diesen Abend geöffnet.');
    const current=decode(row.value);
    let next:MvpPoll;
    try{next=castMvpVote(current,actorId,nomineeId,ctx.candidates.map(c=>c.id),now);}
    catch(e){throw new MvpVoteError(409,(e as Error).message);}
    if(next===current)return project(ctx,current,actorId,false);
    const update=await db.prepare('UPDATE settings SET value=? WHERE key=? AND value=?')
      .bind(JSON.stringify(next),key,row.value).run();
    if(update.meta.changes===1)return project(ctx,next,actorId,false);
  }
  throw new MvpVoteError(409,'Die MVP-Abstimmung wurde parallel geändert. Bitte erneut versuchen.');
}
export async function finishMvpVote(db:D1Database,campaignId:string,sessionId:string,actorId:string,now:string):Promise<MvpVoteView> {
  const ctx=await context(db,campaignId,sessionId),key=keyOf(campaignId,sessionId);
  for(let i=0;i<8;i++){
    const row=await stored(db,key);
    if(!row)throw new MvpVoteError(404,'Keine MVP-Wahl vorhanden.');
    const current=decode(row.value),next=closeMvpVote(current,actorId,now);
    if(current===next)return project(ctx,current,actorId,true);
    const update=await db.prepare('UPDATE settings SET value=? WHERE key=? AND value=?')
      .bind(JSON.stringify(next),key,row.value).run();
    if(update.meta.changes===1)return project(ctx,next,actorId,true);
  }
  throw new MvpVoteError(409,'Die MVP-Abstimmung wurde parallel geändert. Bitte erneut versuchen.');
}
/** Discover open MVP elections without exposing other players' ballots. */
export async function listOpenMvpVotes(db:D1Database,campaignId:string,actorId:string):Promise<{id:string;title:string;playedOn:string}[]> {
  checked(campaignId);checked(actorId);
  const sql=[
    'SELECT p.id,p.title,p.played_on FROM played_sessions p',
    "JOIN settings v ON v.key=('mvp-vote:'||p.campaign_id||':'||p.id)",
    "WHERE p.campaign_id=? AND json_extract(v.value,'$.status')='open'",
    'AND EXISTS (SELECT 1 FROM xp_settlements s',
    'JOIN xp_settlement_participants participant ON participant.settlement_id=s.id AND participant.attended=1',
    "JOIN records r ON r.id=participant.character_id AND r.campaign_id=s.campaign_id AND r.kind='charaktere'",
    'WHERE s.campaign_id=p.campaign_id AND s.played_session_id=p.id AND r.owner_id=?)',
    'ORDER BY p.played_on DESC,p.id DESC LIMIT 20',
  ].join(' ');
  const result=await db.prepare(sql).bind(campaignId,actorId).all<SessionRow>();
  return result.results.map(row=>({id:row.id,title:row.title,playedOn:row.played_on}));
}
