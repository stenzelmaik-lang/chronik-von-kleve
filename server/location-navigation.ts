import {locationPublicKey} from '@/domain/location-public-key';
import type {Actor} from '@/domain/types';
import {loadPersistedLocation} from './location-repository';
import {grantsFor,loadEntitiesForIds,projectEntity} from './entities';
import {cmsPublisher} from './location-cms-service';
export async function visibleLocationLink(db:D1Database,a:Actor,id:string,sl=false){
  const node=await db.prepare('SELECT location_id FROM location_nodes WHERE campaign_id=? AND entity_id=?').bind(a.campaignId,id).first<{location_id:string}>();if(!node)return null;
  const projection=await loadPersistedLocation(db,a,node.location_id,sl&&cmsPublisher(a)?'sl':'player',a.gm?'group':'player');if(!projection)return null;
  const place=projection.location;
  if(id===place.id&&!place.navigationOnly)return {id,title:place.title,kind:'Ort',href:`/spielbereich?bereich=schauplaetze&ort=${encodeURIComponent(id)}`};
  const nodes=[...place.areas.filter(area=>!area.redacted).map(area=>({title:area.title,href:area.dossierHref,kind:'Bereich'})),...place.areas.flatMap(area=>area.rooms.map(room=>({title:room.title,href:room.dossierHref,kind:'Raum'}))),...place.knownInformation.map(info=>({title:info.title,href:info.dossierHref,kind:'Erkenntnis'}))];
  const found=nodes.find(n=>n.href&&new URL(n.href,'https://chroniplay.invalid').searchParams.get('eintrag')===(sl?id:locationPublicKey(id)));return found?{id,title:found.title,kind:found.kind,href:found.href!}:null;
}
export async function visibleLocationRelatedTarget(db:D1Database,a:Actor,id:string,sl=false){
  const location=await visibleLocationLink(db,a,id,sl);if(location)return location;
  const entity=(await loadEntitiesForIds(db,a.campaignId,[id]))[0];if(!entity||entity.type!=='NPC')return null;
  const viewer={...a,gm:sl&&cmsPublisher(a)},safe=projectEntity(viewer,entity,await grantsFor(db,viewer));
  if(!safe||safe.content.redacted===true||safe.content.anonymous===true)return null;
  return {id,title:safe.title,kind:'NSC',href:`/spielbereich?bereich=nscs&npc=${encodeURIComponent(id)}`};
}
