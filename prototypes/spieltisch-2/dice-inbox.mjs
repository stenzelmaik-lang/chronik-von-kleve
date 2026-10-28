// Per-client presentation only. Never rolls dice or evaluates rules.
export function createInbox(hidden=[],selectedId=null){return {revision:-1,events:[],selectedId,hidden:[...hidden],animate:false,replay:false};}
export function ingestDice(inbox,journal){
  if(!journal||journal.sessionId!=='synthetic-prototype'||journal.revision<=inbox.revision)return inbox;
  const events=journal.events,oldIds=new Set(inbox.events.map(e=>e.id)),open=e=>e.status==='settled_open'&&!inbox.hidden.includes(e.id);
  const current=events.find(e=>e.id===inbox.selectedId&&(e.status==='settled_open'||inbox.replay));
  const incoming=events.find(e=>open(e)&&!oldIds.has(e.id));
  const chosen=current||(inbox.selectedId&&inbox.revision>=0?null:inbox.revision<0?events.find(open):incoming);
  return {...inbox,revision:journal.revision,events,selectedId:chosen?.id||null,animate:current?inbox.animate:!!chosen&&inbox.revision>=0};
}
export function dismissDice(inbox){return {...inbox,selectedId:null,hidden:[...new Set([...inbox.hidden,...(inbox.selectedId?[inbox.selectedId]:[])])],animate:false};}
export function showDice(inbox,id){const chosen=inbox.events.find(e=>e.id===id);return chosen?{...inbox,selectedId:id,hidden:[...new Set([...inbox.hidden,...(inbox.selectedId&&inbox.selectedId!==id?[inbox.selectedId]:[])])].filter(v=>v!==id),animate:false,replay:chosen.status==='closed_shared'}:inbox;}
