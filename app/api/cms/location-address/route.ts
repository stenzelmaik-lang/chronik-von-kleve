import {actor,failure,HttpError,input,json,sameOrigin} from '@/server/access';
import {requireCmsEditor} from '@/server/location-cms-service';

export const dynamic='force-dynamic';
const endpoint='https://gdi-api.krzn.de/kkle_navi_geb/collections/kkle_navi_geb/items';

export async function POST(req:Request){
 try{
  sameOrigin(req);
  requireCmsEditor(await actor());
  const body=await input(req) as {address?:unknown}|null;
  const address=typeof body?.address==='string'?body.address.trim():'';
  const match=address.length<=180&&/^(.+?)\s+(\d{1,5})([a-z]?)\s*,?\s+(\d{5})(?:\s+[^,]+)?$/i.exec(address);
  if(!match)throw new HttpError(400,'Gib Straße, Hausnummer und PLZ an, etwa Bahnhofsplatz 17, 47533 Kleve.');
  const [,street,house,suffix,zip]=match;
  const query=new URLSearchParams({f:'json',limit:'10',strassenname:street,haus_nr:house,postleitzahl:zip});
  const response=await fetch(endpoint+'?'+query,{signal:AbortSignal.timeout(6000)}).catch(()=>null);
  if(!response?.ok)throw new HttpError(503,'Die amtliche Adresssuche ist gerade nicht erreichbar.');
  const result=await response.json() as {features?:{id?:unknown;properties?:Record<string,unknown>;geometry?:{type:string;coordinates:number[]}}[]};
  const matches=(result.features??[]).filter(feature=>{
   const p=feature.properties;
   return p&&String(p.strassenname).toLocaleLowerCase('de-DE')===street.toLocaleLowerCase('de-DE')&&String(p.haus_nr)===house&&String(p.postleitzahl)===zip&&String(p.haus_nr_zusatz??'').trim().toLowerCase()===suffix.toLowerCase();
  });
  if(matches.length!==1)throw new HttpError(404,'Im amtlichen Adressbestand wurde kein eindeutiger Treffer gefunden. Prüfe Schreibweise und PLZ.');
  const hit=matches[0],coordinates=hit.geometry?.coordinates;
  if(hit.geometry?.type!=='Point'||coordinates?.length!==2||!coordinates.every(Number.isFinite)||Math.abs(coordinates[0])>180||Math.abs(coordinates[1])>90)
   throw new HttpError(503,'Der Adressdienst hat keine gültige Position geliefert.');
  return json({coordinates,source:'Kreis Kleve · NaviGeb',reference:endpoint+'/'+encodeURIComponent(String(hit.id))});
 }catch(error){return failure(error,req);}
}
