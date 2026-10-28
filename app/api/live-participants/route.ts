import {actor,json,failure,HttpError} from '@/server/access';
import {participantView,participantAvatar} from '@/server/live-participants';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const a=await actor(),q=new URL(req.url).searchParams,session=q.get('sessionId'),member=q.get('memberId'),view=q.get('view')||'profile';
 if(!session||!member||session.length>160||member.length>160)throw new HttpError(400,'Spielabend und Teilnehmer wählen.');
 return view==='avatar'?await participantAvatar(a,session,member):json(await participantView(a,session,member,view,q.get('characterId')||undefined));
}catch(e){return failure(e,req);}}
