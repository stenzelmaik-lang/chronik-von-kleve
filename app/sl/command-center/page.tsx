import { redirect } from 'next/navigation';
import { actor } from '@/server/access';
import { currentUserFromContext } from '@/server/platform-auth';
import Workspace from '@/app/spielbereich/workspace';
export const dynamic = 'force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{bereich?:string;character?:string}>}) {
  if (!await currentUserFromContext()) redirect('/anmelden');
  const a = await actor(false);
  if(a.status !== 'active' || !['campaign_owner','campaign_gm','campaign_editor'].includes(a.role)) return <main className="shell"><h1>Nur für die Kampagnenredaktion</h1><a href="/spielbereich">Zum persönlichen Spielbereich</a></main>;
  const q=await searchParams;
  const section=['sitzung','charaktere','ortscms','galerie','vorbereitung','nscs'].includes(q.bereich||'') ? q.bereich! : 'sitzung';
  if(a.role === 'campaign_editor' && section !== 'ortscms') return <Workspace actor={a} surface="sl" initialSection="ortscms"/>;
  return <Workspace actor={a} surface="sl" initialSection={section} initialCharacterId={q.character}/>;
}
