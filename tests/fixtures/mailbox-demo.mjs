import {randomUUID} from 'node:crypto';

// Synthetic letters for the isolated local mailbox demo (scripts/test-local.mjs --nachrichten).
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1cAAAAASUVORK5CYII=';
export async function seedMailbox({base,gmCookie,playerCookie}) {
  const call=async(cookie,path,body)=>{const form=body instanceof FormData;const response=await fetch(base+path,{method:'POST',headers:{Origin:base,Cookie:cookie,...(form?{}:{'Content-Type':'application/json'})},body:form?body:JSON.stringify(body)});if(!response.ok)throw new Error('Synthetic mailbox seed failed: '+path+' '+response.status);return response.json();};
  const form=new FormData();form.set('file',new Blob([Buffer.from(PNG,'base64')],{type:'image/png'}),'SYNTHETISCH-Siegelabdruck.png');form.set('visibility','sl');
  const handout=(await call(gmCookie,'/api/files',form)).id;
  const letters=[
    await call(gmCookie,'/api/messages',{clientRequestId:randomUUID(),recipients:['command-a','command-b'],title:'SYNTHETISCH – Einladung ins Elysium',text:'Ihr seid für morgen Nacht ins Elysium geladen.\nKommt pünktlich und ohne Waffen.'}),
    await call(gmCookie,'/api/messages',{clientRequestId:randomUUID(),recipients:['command-a'],title:'SYNTHETISCH – Nur für Spieler A',text:'Dieser Brief und sein Siegelabdruck sind nur für Spieler A bestimmt.',fileIds:[handout]}),
    await call(playerCookie,'/api/messages',{clientRequestId:randomUUID(),recipients:['command-b'],title:'SYNTHETISCH – Gruß von A',text:'Treffen wir uns vor dem Elysium?'}),
  ];
  return {letters:letters.reduce((n,l)=>n+l.sent,0),handout};
}
