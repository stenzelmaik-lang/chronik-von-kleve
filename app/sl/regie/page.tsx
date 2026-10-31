import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {actor} from '@/server/access';
import {currentUserFromContext} from '@/server/platform-auth';
import {RegieWindow} from '@/app/spielbereich/modules/spieltisch/regie-window';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Live-Regie · ChroniPlay',robots:{index:false,follow:false}};
/** Second-screen Regie of the running evening. GM only; players never receive this page or its data. */
export default async function Page({searchParams}:{searchParams:Promise<{sessionId?:string}>}){
 if(!await currentUserFromContext())redirect('/anmelden');
 const a=await actor(false).catch(()=>null);
 if(!a||a.status!=='active'||!a.gm)return <main className="shell"><h1>Nur für die Spielleitung</h1><p>Die Live-Regie steht ausschließlich der Spielleitung zur Verfügung.</p><a href="/spielbereich?bereich=sitzung">Zum Spieltisch</a></main>;
 const q=await searchParams;
 return <RegieWindow a={a} sessionHint={typeof q.sessionId==='string'&&q.sessionId.length<=160?q.sessionId:''}/>;
}
