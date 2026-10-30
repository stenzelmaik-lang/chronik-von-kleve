/* eslint-disable @next/next/no-img-element -- Authenticated recipient-specific files. */
import {RichTextView} from './rich-text';
import {richTextFileIds} from '@/domain/location-rich-text';

export type PersonalMessageAttachment={id:string;name:string;mime:string};
export function PersonalMessageBody({text,format,attachments=[]}:{text:string;format?:'rich';attachments?:PersonalMessageAttachment[]}) {
  const embedded=format==='rich'?richTextFileIds(text):[];
  return <>{format==='rich'?<RichTextView value={text} readable flowing/>:text}
    {attachments.filter(file=>!embedded.includes(file.id)).map(file=><figure key={file.id}>{file.mime.startsWith('image/')?<img style={{maxWidth:'100%',maxHeight:480,objectFit:'contain'}} src={'/api/files?id='+encodeURIComponent(file.id)} alt={file.name}/>:file.mime.startsWith('audio/')?<audio controls src={'/api/files?id='+encodeURIComponent(file.id)}/>:file.mime.startsWith('video/')?<video style={{maxWidth:'100%'}} controls src={'/api/files?id='+encodeURIComponent(file.id)}/>:<a href={'/api/files?id='+encodeURIComponent(file.id)} target="_blank" rel="noopener noreferrer">Unterlage öffnen: {file.name}</a>}<figcaption>{file.name}</figcaption></figure>)}
  </>;
}
