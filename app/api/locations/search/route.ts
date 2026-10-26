import {actor,database,failure,HttpError,json} from '@/server/access';
import {cmsPublisher,requireCmsPublisher,requireActivePlayer} from '@/server/location-cms-service';
import {loadLocationHub} from '@/server/location-repository';
import {slDossierEditorValue} from '@/domain/location-dossier';
import {richTextToPlainText} from '@/domain/location-rich-text';
import {LOCATION_CHAPTER_KIND,parseLocationItemContent} from '@/domain/location-library';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
  const caller=await actor(),db=database(),p=new URL(req.url).searchParams;let a=caller;
  const viewerId=p.get('viewerId');if(viewerId){requireCmsPublisher(caller);await requireActivePlayer(db,caller.campaignId,viewerId);a={...caller,id:viewerId,gm:false,role:'player'};}
  const q=(p.get('q')||'').trim(),placeId=p.get('placeId'),sl=p.get('view')==='sl'&&cmsPublisher(a);if(q.length<2||q.length>160)throw new HttpError(400,'Suchbegriff: 2 bis 160 Zeichen.');
  const projections=await loadLocationHub(db,a,sl?'sl':'player',a.gm?'group':'player');
  const results:{title:string;context:string;snippet:string;href:string}[]=[],needle=q.toLocaleLowerCase('de-DE');
  const add=(title:string,body:string,context:string,href:string)=>{const text=richTextToPlainText(body),at=(title+' '+text).toLocaleLowerCase('de-DE').indexOf(needle);if(at<0||results.length>=50)return;const start=Math.max(0,text.toLocaleLowerCase('de-DE').indexOf(needle)-60);results.push({title,context,snippet:text.slice(start,start+240),href});};
  for(const {location:l} of projections){if(placeId&&l.id!==placeId)continue;const href=`/spielbereich?bereich=schauplaetze&ort=${encodeURIComponent(l.id)}`;if(!l.navigationOnly)add(l.title,richTextToPlainText(l.summary)+'\n'+richTextToPlainText(l.atmosphere),'Hauptort',href);
    for(const area of l.areas){if(!area.redacted)add(area.title,area.playerHint||'',l.title,area.dossierHref||href);for(const room of area.rooms)add(room.title,room.short||'',area.title,room.dossierHref||href);}
    for(const info of l.knownInformation)add(info.title,info.text,l.title,info.dossierHref||href);
    if(sl){
      const legacy=await db.prepare(`SELECT n.entity_id,n.attributes,v.gm_secret_json FROM location_nodes n JOIN entity_revisions v ON v.campaign_id=n.campaign_id AND v.entity_id=n.entity_id WHERE n.campaign_id=? AND n.location_id=? AND v.audience_scope='gm' AND v.audience_key='@gm' AND v.status IN ('draft','in_review','approved') AND v.revision_no=(SELECT MAX(x.revision_no) FROM entity_revisions x WHERE x.campaign_id=v.campaign_id AND x.entity_id=v.entity_id AND x.audience_scope='gm' AND x.status IN ('draft','in_review','approved')) AND NOT EXISTS(SELECT 1 FROM entity_content_blocks b WHERE b.campaign_id=n.campaign_id AND b.entity_id=n.entity_id AND b.kind='location_sl_adopted')`).bind(a.campaignId,l.id).all<{entity_id:string;attributes:string;gm_secret_json:string}>();
      for(const row of legacy.results){try{const attrs=JSON.parse(row.attributes),secret=JSON.parse(row.gm_secret_json);if(!['archived','deleted'].includes(attrs.lifecycle)&&typeof secret.text==='string')add(String(attrs.title||'SL-Vermerk'),slDossierEditorValue(secret.text),l.title+' · SL-intern',href+'&eintrag='+encodeURIComponent(row.entity_id));}catch{/* Malformed historical metadata never broadens access. */}}
      const rows=await db.prepare("SELECT b.entity_id,b.content,b.kind FROM entity_content_blocks b JOIN location_nodes n ON n.campaign_id=b.campaign_id AND n.entity_id=b.entity_id WHERE b.campaign_id=? AND n.location_id=? AND b.kind=? AND b.visibility='sl_secret'").bind(a.campaignId,l.id,LOCATION_CHAPTER_KIND).all<{entity_id:string;content:string;kind:string}>();for(const row of rows.results){const data=parseLocationItemContent(row.content,row.kind)?.data;if(data&&'body' in data&&data.state==='active')add(data.title,data.body,l.title+' · SL-intern',href+'&eintrag='+encodeURIComponent(row.entity_id));}}
  }
  return json({results,limit:50});
}catch(error){return failure(error,req);}}
