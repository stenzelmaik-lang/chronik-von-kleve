import {gmOnly,HttpError,type Actor} from './access';
import {mutateSetting,readSetting} from './settings-store';
import {figureTemplateSchema,type FigureTemplate,type FigureTemplateInput} from '@/domain/figure-templates';

const key=(a:Actor)=>`standard-figure-templates:${a.campaignId}`;
function parse(raw:string|null):FigureTemplate[]{
  if(raw===null)return [];
  try{
    const data=JSON.parse(raw);
    if(Array.isArray(data)&&data.every(item=>{
      const {version,updatedAt,...input}=item;
      return Number.isInteger(version)&&version>0&&typeof updatedAt==='string'&&figureTemplateSchema.safeParse(input).success;
    }))return data;
  }catch{/* Preserve an unreadable library for diagnosis. */}
  throw new HttpError(409,'Die gespeicherte Figurenbibliothek ist nicht lesbar.');
}
export async function listFigureTemplates(a:Actor){
  gmOnly(a);
  return parse(await readSetting(key(a)));
}
export async function saveFigureTemplate(a:Actor,input:FigureTemplateInput,expectedVersion:number){
  gmOnly(a);
  const state=await mutateSetting(key(a),parse,templates=>{
    const previous=templates.find(template=>template.id===input.id);
    if((previous?.version??0)!==expectedVersion)throw new HttpError(409,'Diese Vorlage wurde zwischenzeitlich geändert. Lade die Bibliothek erneut.');
    if(!previous&&templates.length>=100)throw new HttpError(409,'Die Bibliothek enthält bereits 100 eigene Vorlagen.');
    const next={...input,version:expectedVersion+1,updatedAt:new Date().toISOString()};
    return [...templates.filter(template=>template.id!==input.id),next];
  });
  return state.find(template=>template.id===input.id)!;
}
