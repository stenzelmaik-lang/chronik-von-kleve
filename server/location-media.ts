import {LOCATION_MEDIA_KIND,parseLocationItemContent,type PublicLocationMedia} from '@/domain/location-library';
/** Private block rows are never returned. Only this explicit media allowlist
 * enters an already authorized location projection. */
export async function loadLocationMedia(db:D1Database,campaignId:string,entityIds:string[],sl=false){
  const map=new Map<string,PublicLocationMedia[]>();
  for(let start=0;start<entityIds.length;start+=60){
    const ids=entityIds.slice(start,start+60);if(!ids.length)continue;
    const rows=await db.prepare(`SELECT b.id,b.entity_id,b.kind,b.content,b.position,f.mime,f.size
      FROM entity_content_blocks b JOIN files f ON f.campaign_id=b.campaign_id AND f.id=json_extract(CASE WHEN json_valid(b.content) THEN b.content ELSE '{}' END,'$.data.fileId')
      WHERE b.campaign_id=? AND b.entity_id IN (${ids.map(()=>'?').join(',')}) AND b.kind=? AND b.visibility='sl_secret' AND f.visibility='sl' ORDER BY b.position,b.id`)
      .bind(campaignId,...ids,LOCATION_MEDIA_KIND).all<{id:string;entity_id:string;kind:string;content:string;position:number;mime:string;size:number}>();
    for(const row of rows.results){
      const data=parseLocationItemContent(row.content,row.kind)?.data;
      if(!data||!('fileId' in data)||data.state!=='active'||(!sl&&(!data.playerReleased||data.mediaType==='sl_plan')))continue;
      const media:PublicLocationMedia={id:row.id,title:data.title,description:data.description,mediaType:data.mediaType,hero:data.hero,mime:row.mime,size:row.size,position:row.position,url:`/api/locations/media?id=${encodeURIComponent(row.id)}${sl?'&preview=1':''}`};
      map.set(row.entity_id,[...(map.get(row.entity_id)||[]),media]);
    }
  }
  return map;
}
