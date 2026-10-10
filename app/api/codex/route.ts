import {actor,database,json,failure,HttpError,sameOrigin,input,gmOnly} from '@/server/access';
import {library,contents,readChapter,search,pageAsset,setBookRelease,CodexError} from '@/server/codex';
import {z} from 'zod';
import {env} from 'cloudflare:workers';
import {editions,type Edition} from '@/domain/codex';
export const dynamic='force-dynamic';
export async function PATCH(req:Request){
  try{sameOrigin(req);const a=await actor();gmOnly(a);const d=z.object({book:z.string().min(1).max(200),playerReleased:z.boolean()}).strict().safeParse(await input(req));if(!d.success)throw new HttpError(400,'Ungültige Buchfreigabe.');return json({book:await setBookRelease(database(),a,d.data.book,d.data.playerReleased)});}
  catch(e){return failure(e instanceof CodexError?new HttpError(e.status,e.message):e,req);}
}
export async function GET(req:Request){
  try{
    const a=await actor(),db=database(),p=new URL(req.url).searchParams;
    const id=p.get('book'),chapter=p.get('chapter'),q=p.get('q'),edition=p.get('edition'),page=p.get('page');
    // Existing isolated runner binding only. A production Host/query parameter
    // cannot enable technical review of unlicensed works.
    const localReview=(env as unknown as {AUTH_ACCESS_ENVIRONMENT?:string}).AUTH_ACCESS_ENVIRONMENT==='local-test'&&['127.0.0.1','localhost'].includes(new URL(req.url).hostname);
    if((id!==null&&(!id||id.length>200))||(chapter!==null&&(!chapter||chapter.length>200))||(q!==null&&q.length>200)||(edition!==null&&!editions.includes(edition as Edition))||(chapter&&!id))throw new HttpError(400,'Ungültige Bibliotheksanfrage.');
    if(page!==null){if(!id||!chapter||!/^\d{1,5}$/.test(page)||Number(page)<1)throw new HttpError(400,'Ungültige Seite.');if(!env.BUCKET)throw new HttpError(503,'Dateispeicher nicht erreichbar.');return await pageAsset(db,env.BUCKET,a,id,chapter,Number(page),localReview);}
    if(q!==null)return json({hits:await search(db,a,q,edition?(edition as Edition):undefined,localReview)});
    if(id&&chapter)return json({chapter:await readChapter(db,a,id,chapter,localReview)});
    if(id)return json(await contents(db,a,id,localReview));
    return json({books:await library(db,a,localReview)});
  }catch(e){return failure(e instanceof CodexError?new HttpError(e.status,e.message):e,req);}
}
