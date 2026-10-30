import {z} from 'zod';
import {isRichTextWithinLimit,sanitizeRichTextInput,richTextToPlainText,richTextFileIds} from './location-rich-text.ts';

export const personalMessageSchema=z.object({
  clientRequestId:z.string().uuid(),recipients:z.array(z.string().min(1).max(100)).min(1).max(20),
  title:z.string().trim().min(1).max(160),text:z.string().max(65000),
  format:z.literal('rich').optional(),fileIds:z.array(z.string().min(1).max(100)).max(20).optional(),
}).strict().superRefine((value,ctx)=>{
  if(value.format==='rich') {
    let text;try{text=sanitizeRichTextInput(value.text);}catch{ctx.addIssue({code:'custom',message:'Ungültiges HTML.'});return;}
    if(!isRichTextWithinLimit(text,10000))ctx.addIssue({code:'custom',message:'Höchstens 10.000 sichtbare Zeichen.'});
    if(!richTextToPlainText(text).trim()&&!value.fileIds?.length&&!richTextFileIds(text).length)ctx.addIssue({code:'custom',message:'Ergänze eine Botschaft oder eine Datei.'});
  } else if(!value.text.trim()||value.text.trim().length>20000||value.fileIds!==undefined)ctx.addIssue({code:'custom',message:'Ungültige persönliche Nachricht.'});
});

export type PreparationRecipient={id:string;name:string;role:string;character:{id:string;name:string;portrait:string|null}|null};
