import {z} from 'zod';
import {actor,sameOrigin,input,json,failure,HttpError} from '@/server/access';
import {listMaterials,saveMaterial,deleteMaterial} from '@/server/table-materials';
import {materialSchema} from '@/domain/table-material';
export const dynamic='force-dynamic';
const write=z.object({id:z.string().min(1).max(160).optional(),version:z.number().int().positive().optional(),material:materialSchema}).strict().refine(d=>!d.id||!!d.version);
const remove=z.object({id:z.string().min(1).max(160),version:z.number().int().positive()}).strict();
export async function GET(req:Request){try{return json({materials:await listMaterials(await actor())});}catch(e){return failure(e,req);}}
export async function POST(req:Request){try{sameOrigin(req);const a=await actor(),d=write.safeParse(await input(req));if(!d.success)throw new HttpError(400,'Bitte Titel, Inhalt und passende Datei prüfen.');return json({material:await saveMaterial(a,d.data.material,d.data.id,d.data.version)});}catch(e){return failure(e,req);}}
export async function DELETE(req:Request){try{sameOrigin(req);const a=await actor(),d=remove.safeParse(await input(req));if(!d.success)throw new HttpError(400,'Unterlage oder Version fehlt.');await deleteMaterial(a,d.data.id,d.data.version);return json({ok:true});}catch(e){return failure(e,req);}}
