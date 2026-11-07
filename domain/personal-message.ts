import { authoringTextMax, authoringSourceMax } from './authoring-limits.ts';
import {z} from 'zod';
import {isRichTextWithinLimit,sanitizeRichTextInput,richTextToPlainText,richTextFileIds} from './location-rich-text.ts';

export const personalMessageSchema=z.object({
  clientRequestId:z.string().uuid(),recipients:z.array(z.string().min(1).max(100)).min(1).max(20),
  title:z.string().trim().min(1).max(160),text:z.string().max(authoringSourceMax),
  format:z.literal('rich').optional(),fileIds:z.array(z.string().min(1).max(100)).max(20).optional(),
  replyToId:z.string().min(1).max(100).optional(),forwardOfId:z.string().min(1).max(100).optional(),
}).strict().superRefine((value,ctx)=>{
  if(value.replyToId&&value.forwardOfId)ctx.addIssue({code:'custom',message:'Antwort oder Weiterleitung wählen.'});
  if(value.format==='rich') {
    let text;try{text=sanitizeRichTextInput(value.text);}catch{ctx.addIssue({code:'custom',message:'Ungültiges HTML.'});return;}
    if(!isRichTextWithinLimit(text,authoringTextMax))ctx.addIssue({code:'custom',message:'Höchstens 20.000 sichtbare Zeichen.'});
    if(!richTextToPlainText(text).trim()&&!value.fileIds?.length&&!richTextFileIds(text).length)ctx.addIssue({code:'custom',message:'Ergänze eine Botschaft oder eine Datei.'});
  } else if(value.text.trim().length>20000||(!value.text.trim()&&!value.fileIds?.length))ctx.addIssue({code:'custom',message:'Ungültige persönliche Nachricht.'});
});

export type PreparationRecipient={id:string;name:string;role:string;character:{id:string;name:string;portrait:string|null}|null};

/*
 * Mailbox state is personal. Every recipient owns one copy (row) of a letter;
 * the sender's view of the same row uses separate sender* fields. Nothing in
 * here deletes a row: "remove" only hides the copy from that person's mailbox.
 */
export type MailBox='in'|'out';
export type MailFolder='inbox'|'sent'|'archive'|'trash';
export const mailFolders:MailFolder[]=['inbox','sent','archive','trash'];
export const mailActions=['read','unread','archive','unarchive','trash','restore','remove'] as const;
export type MailAction=typeof mailActions[number];
export const mailFields={
  in:{archived:'archivedAt',trashed:'trashedAt',removed:'removedAt'},
  out:{archived:'senderArchivedAt',trashed:'senderTrashedAt',removed:'senderRemovedAt'},
} as const;
export const mailActionSchema=z.object({action:z.enum(mailActions),box:z.enum(['in','out']),ids:z.array(z.string().min(1).max(100)).min(1).max(50)}).strict();
export const mailCopySchema=z.object({action:z.literal('to-notes'),box:z.enum(['in','out']),id:z.string().min(1).max(100)}).strict();

const stamp=(body:Record<string,unknown>,key:string)=>typeof body[key]==='string'&&body[key]!=='';

/** Folder of one copy for one person; null once removed from that mailbox. */
export function mailFolder(body:Record<string,unknown>,box:MailBox):MailFolder|null {
  const f=mailFields[box];
  if(stamp(body,f.removed))return null;
  if(stamp(body,f.trashed))return 'trash';
  if(stamp(body,f.archived))return 'archive';
  return box==='in'?'inbox':'sent';
}

/** JSON fields to set for an action, or an error message. Never touches the other party. */
export function mailActionPatch(body:Record<string,unknown>,box:MailBox,action:MailAction,now:string):{patch:Record<string,string|null>}|{error:string} {
  const f=mailFields[box],folder=mailFolder(body,box);
  if(!folder)return {error:'Nachricht nicht verfügbar.'};
  if(action==='read'||action==='unread') {
    if(box!=='in')return {error:'Gelesen-Markierungen gelten nur für erhaltene Briefe.'};
    return {patch:{readAt:action==='read'?(stamp(body,'readAt')?String(body.readAt):now):null}};
  }
  if(action==='archive')return {patch:{[f.archived]:now,[f.trashed]:null}};
  if(action==='unarchive')return folder==='archive'?{patch:{[f.archived]:null}}:{error:'Nur archivierte Briefe lassen sich zurücklegen.'};
  if(action==='trash')return {patch:{[f.trashed]:now}};
  if(action==='restore')return folder==='trash'?{patch:{[f.trashed]:null}}:{error:'Nur Briefe im Papierkorb lassen sich wiederherstellen.'};
  return folder==='trash'?{patch:{[f.removed]:now}}:{error:'Briefe zuerst in den Papierkorb legen.'};
}

/** SQL condition selecting one folder; field names are constants, never user input. */
export function mailFolderSql(folder:MailFolder,box:MailBox) {
  const f=mailFields[box],j=(key:string)=>`json_extract(body,'$.${key}')`;
  const base=`${j(f.removed)} IS NULL`;
  if(folder==='trash')return `${base} AND ${j(f.trashed)} IS NOT NULL`;
  if(folder==='archive')return `${base} AND ${j(f.trashed)} IS NULL AND ${j(f.archived)} IS NOT NULL`;
  return `${base} AND ${j(f.trashed)} IS NULL AND ${j(f.archived)} IS NULL`;
}

export function mailSubject(title:string,kind:'reply'|'forward') {
  const prefix=kind==='reply'?'Re: ':'Wg: ',clean=title.replace(/^((re|aw|wg|fwd?):\s*)+/i,'').trim();
  return (prefix+clean).slice(0,160);
}
export function mailQuote(text:string,meta:{senderName:string;createdAt:string;title:string},kind:'reply'|'forward') {
  const date=new Date(meta.createdAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin'});
  if(kind==='forward')return `\n\n-------- Weitergeleiteter Brief --------\nVon: ${meta.senderName}\nDatum: ${date}\nBetreff: ${meta.title}\n\n${text}`.slice(0,20000);
  return (`\n\nAm ${date} schrieb ${meta.senderName}:\n`+text.split('\n').map(line=>'> '+line).join('\n')).slice(0,20000);
}
