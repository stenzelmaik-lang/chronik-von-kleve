import {z} from 'zod';
import {actor,gmOnly,sameOrigin,input,json,failure,HttpError} from '@/server/access';
import {figureTemplateSchema} from '@/domain/figure-templates';
import {listFigureTemplates,saveFigureTemplate} from '@/server/figure-templates';

export const dynamic='force-dynamic';
const save=z.object({template:figureTemplateSchema,expectedVersion:z.number().int().min(0)}).strict();
export async function GET(req:Request){
  try{return json({templates:await listFigureTemplates(await actor())});}
  catch(error){return failure(error,req);}
}
export async function POST(req:Request){
  try{
    sameOrigin(req);
    const a=await actor();gmOnly(a);
    const data=save.safeParse(await input(req));
    if(!data.success)throw new HttpError(400,'Prüfe Name und Werte der Figurenvorlage.');
    return json({template:await saveFigureTemplate(a,data.data.template,data.data.expectedVersion)});
  }catch(error){return failure(error,req);}
}
