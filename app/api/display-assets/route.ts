import {z} from 'zod';
import {actor,sameOrigin,input,json,failure,HttpError} from '@/server/access';
import {listDisplayAssets,saveDisplayAsset,deleteDisplayAsset,displayAssetUsage} from '@/server/display-assets';
import {displayAssetSchema} from '@/domain/material-system';
export const dynamic='force-dynamic';
const write=z.object({id:z.string().min(1).max(160).optional(),version:z.number().int().positive().optional(),asset:displayAssetSchema}).strict().refine(d=>!d.id||!!d.version);
const remove=z.object({id:z.string().min(1).max(160),version:z.number().int().positive()}).strict();
/** GM display assets: list (optionally the scenes using one), save and delete the definition. Files stay untouched. */
export async function GET(req:Request){try{const a=await actor(),usage=new URL(req.url).searchParams.get('usage');return json(usage?{usage:await displayAssetUsage(a,usage)}:{assets:await listDisplayAssets(a)});}catch(e){return failure(e,req);}}
export async function POST(req:Request){try{sameOrigin(req);const a=await actor(),d=write.safeParse(await input(req));if(!d.success)throw new HttpError(400,d.error.issues[0]?.message||'Bitte Name, Art und Zustände prüfen.');return json({asset:await saveDisplayAsset(a,d.data.asset,d.data.id,d.data.version)});}catch(e){return failure(e,req);}}
export async function DELETE(req:Request){try{sameOrigin(req);const a=await actor(),d=remove.safeParse(await input(req));if(!d.success)throw new HttpError(400,'Darstellung oder Version fehlt.');await deleteDisplayAsset(a,d.data.id,d.data.version);return json({ok:true});}catch(e){return failure(e,req);}}
