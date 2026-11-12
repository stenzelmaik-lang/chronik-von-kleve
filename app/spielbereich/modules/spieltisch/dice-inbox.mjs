// Per-client presentation only. Never rolls dice or evaluates rules.
// A stored roll is final. "Open" here only means "this client has not looked at it yet": on first load (or reconnect)
// every stored roll counts as known, so old rolls never come back as hints; they stay in the Würfelprotokoll.
export function createInbox(hidden=[],selectedId=null){return {revision:-1,events:[],selectedId,hidden:[...hidden],animate:false,replay:false};}
export function ingestDice(inbox,journal){
  if(!journal||!journal.sessionId||(inbox.sessionId&&inbox.sessionId!==journal.sessionId))return inbox;
  const epoch=journal.epoch??0,before=inbox.epoch??0;
  if(epoch<before||(epoch===before&&journal.revision<=inbox.revision))return inbox;
  const reset=epoch>before&&inbox.revision>=0;
  const events=journal.events,oldIds=new Set(reset?[]:inbox.events.map(e=>e.id)),hiddenBefore=reset?[]:inbox.hidden;
  const open=e=>e.status==='settled_open'&&!hiddenBefore.includes(e.id);
  const current=reset?null:events.find(e=>e.id===inbox.selectedId&&(e.status==='settled_open'||inbox.replay));
  const incoming=inbox.revision<0?null:events.find(e=>open(e)&&!oldIds.has(e.id));
  const chosen=current||(!reset&&inbox.selectedId&&inbox.revision>=0?null:incoming);
  // First load: only a view this tab still had open comes back, without animation; everything else is known.
  const hidden=inbox.revision<0?[...new Set([...hiddenBefore,...events.filter(e=>e.id!==chosen?.id).map(e=>e.id)])]:hiddenBefore;
  return {...inbox,sessionId:journal.sessionId,epoch,revision:journal.revision,events,hidden,selectedId:chosen?.id||null,animate:current?inbox.animate:!!chosen&&inbox.revision>=0,replay:!reset&&inbox.replay};
}
export function dismissDice(inbox){return {...inbox,selectedId:null,hidden:[...new Set([...inbox.hidden,...(inbox.selectedId?[inbox.selectedId]:[])])],animate:false};}
export function showDice(inbox,id){const chosen=inbox.events.find(e=>e.id===id);return chosen?{...inbox,selectedId:id,hidden:[...new Set([...inbox.hidden,...(inbox.selectedId&&inbox.selectedId!==id?[inbox.selectedId]:[])])].filter(v=>v!==id),animate:false,replay:chosen.status==='closed_shared'}:inbox;}
