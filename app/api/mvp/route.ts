import { z } from 'zod';
import { actor, database, failure, gmOnly, input, json, sameOrigin, HttpError } from '@/server/access';
import {
  MvpVoteError, finishMvpVote, listOpenMvpVotes, openMvpVote, submitMvpVote, viewMvpVote,
} from '@/server/mvp-vote-service';
export const dynamic='force-dynamic';

const id=z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const actions=z.discriminatedUnion('action',[
  z.object({action:z.literal('open'),sessionId:id}).strict(),
  z.object({action:z.literal('close'),sessionId:id}).strict(),
  z.object({action:z.literal('vote'),sessionId:id,nomineeId:id}).strict(),
]);
function errorAsHttp(error:unknown):never {
  if(error instanceof MvpVoteError)throw new HttpError(error.status,error.message);
  throw error;
}
/** Players see only open elections they participated in, no voter identities. */
export async function GET(req:Request){
  try{
    const a=await actor(),db=database(),search=new URL(req.url).searchParams,sessionId=search.get('sessionId');
    if(sessionId!==null){
      if(!id.safeParse(sessionId).success)throw new HttpError(400,'Ungültiger Spielabend.');
      try{return json({poll:await viewMvpVote(db,a.campaignId,sessionId,a.id,a.gm)});}
      catch(error){errorAsHttp(error);}
    }
    if(search.size>0)throw new HttpError(400,'Unbekannte MVP-Abfrage.');
    try{return json({openPolls:await listOpenMvpVotes(db,a.campaignId,a.id)});}
    catch(error){errorAsHttp(error);}
  }catch(error){return failure(error,req);}
}
export async function POST(req:Request){
  try{
    sameOrigin(req);
    const a=await actor(),parsed=actions.safeParse(await input(req));
    if(!parsed.success)throw new HttpError(400,parsed.error.issues[0].message);
    const d=parsed.data,db=database(),now=new Date().toISOString();
    try{
      if(d.action==='open'){
        gmOnly(a);
        return json({poll:await openMvpVote(db,a.campaignId,d.sessionId,a.id,now)});
      }
      if(d.action==='close'){
        gmOnly(a);
        return json({poll:await finishMvpVote(db,a.campaignId,d.sessionId,a.id,now)});
      }
      return json({poll:await submitMvpVote(db,a.campaignId,d.sessionId,a.id,d.nomineeId,now)});
    }catch(error){errorAsHttp(error);}
  }catch(error){return failure(error,req);}
}
