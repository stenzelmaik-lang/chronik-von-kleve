/** Presentation only. Stable IDs reuse existing personal layouts; no game state lives here. */
export const regieGroups = [
  {id:'scene', title:'Szene führen', areas:['narration','dialogue','atmosphere','interactions','secrets','consequences','notes']},
  {id:'interaction', title:'Interaktion', areas:['Szenenmaterial','material','pager','Pager · spontan','whispers','images','pdfs','handouts']},
  {id:'mood', title:'Stimmung', areas:['effects','sound','recordings','music','video','backdrop','vitals']},
  {id:'checks', title:'Proben & NPCs', areas:['checks','npcs','figures']},
  {id:'table', title:'Tischblick', areas:['table']},
] as const;
export type RegieGroup = typeof regieGroups[number]['id'];
const legacyAreas:Record<string,string>={'Bilder · Polaroids':'images','Dokumente · PDF':'pdfs','Handout-Akten':'handouts','Tonaufnahmen · Kassette':'recordings','Video · Röhrenbildschirm':'video','Hintergrundmusik':'music','Hintergrund':'backdrop'};
export const regieTileId=(id:string)=>legacyAreas[id]||id;
export const regieAreaLabels:Record<string,string> = {
  narration:'Erzählung', dialogue:'Dialoge', atmosphere:'Atmosphäre', interactions:'Interaktionen',
  secrets:'Geheimnisse', consequences:'Folgen', notes:'SL-Notizen', Szenenmaterial:'Szenenmaterialien',
  material:'Spontanmaterialien', pager:'Pager vorbereitet', 'Pager · spontan':'Spontan-Pager',
  whispers:'Visionen & Briefe', images:'Bilder', pdfs:'Dokumente', handouts:'Handout-Akten',
  effects:'Effekte', sound:'Ambiente', recordings:'Tonaufnahmen', music:'Hintergrundmusik',
  video:'Video', backdrop:'Hintergrund', vitals:'Zustände', checks:'Proben', npcs:'Szenen-NPCs',
  figures:'Standardfiguren & Würfel', table:'Auf dem Tisch',
};
export function regieGroupOf(area:string):RegieGroup {
  return regieGroups.find(group=>(group.areas as readonly string[]).includes(area))?.id || 'scene';
}
export function regieAreaOf(group:RegieGroup, available:readonly string[], remembered?:string):string|undefined {
  const areas=regieGroups.find(item=>item.id===group)!.areas as readonly string[];
  if(remembered&&areas.includes(remembered)&&available.includes(remembered))return remembered;
  return areas.find(area=>available.includes(area));
}
