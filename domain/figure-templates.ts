import {z} from 'zod';
import {ATTRIBUTES,resolveFigure,type FigureStats,type AttributeKey} from './standard-figures.ts';

const rating=z.number().int().min(0).max(10);
const attributes=z.object(Object.fromEntries(ATTRIBUTES.map(name=>[name,rating])) as Record<AttributeKey,typeof rating>).strict();
export const figureTemplateSchema=z.object({
  id:z.string().uuid(),
  name:z.string().trim().min(1).max(60),
  typeId:z.string().min(1).max(60),
  tierId:z.enum(['easy','standard','hard','very_hard','extreme']),
  attributes,
  skills:z.record(z.string().trim().min(1).max(60),rating).refine(value=>Object.keys(value).length<=60,'Höchstens 60 Fähigkeiten.'),
  willpower:rating,
  bloodMax:z.number().int().min(0).max(30).nullable(),
}).strict().refine(value=>resolveFigure(value.typeId,value.tierId)!==null,'Unbekannte Basisfigur.');

export type FigureTemplateInput=z.infer<typeof figureTemplateSchema>;
export type FigureTemplate=FigureTemplateInput&{version:number;updatedAt:string};

/** Keep the existing actions, but derive every pool from the saved SL values. */
export function resolveFigureTemplate(template:FigureTemplate):FigureStats{
  const base=resolveFigure(template.typeId,template.tierId);
  if(!base)throw new Error('Die Basis dieser Figur ist nicht verfügbar.');
  return {...base,version:`template:${template.id}:${template.version}`,
    attributes:{...template.attributes},skills:{...template.skills},
    willpower:template.willpower,bloodMax:template.bloodMax,
    actions:base.actions.map(action=>({...action,pool:template.attributes[action.attribute]+(action.ability?template.skills[action.ability]??0:0)})),
    explanation:`Eigene SL-Vorlage „${template.name}“, Version ${template.version}.`,
  };
}
