type PlaceChoice={id:string;title:string;parent_id?:string|null;level?:string};
export function preparationPlaces(places:PlaceChoice[]) {
  const byId=new Map(places.map(place=>[place.id,place]));
  return places.map(place=>{
    const ancestors:string[]=[],seen=new Set([place.id]);let parent=place.parent_id;
    while(parent&&!seen.has(parent)) {
      seen.add(parent);const node=byId.get(parent);if(!node)break;
      ancestors.unshift(node.title);parent=node.parent_id;
    }
    const levels:Record<string,string>={location:'Ort',area:'Bereich',room:'Raum'};
    return {...place,type:'PLACE',summary:[levels[place.level||'']||'',...ancestors,place.title].filter(Boolean).join(' › ')};
  });
}
