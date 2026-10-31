/**
 * ULTIO pager R-03: device logic without DOM. The server owns addressing, storage and acknowledgement;
 * this module only turns the viewer's own pager messages into what the five keys and the LCD show.
 */
export const pagerKeys=['menu','up','down','ok','back'] as const;
export type PagerKey=typeof pagerKeys[number];
/** Built-in LCD views. Further views can be registered by the client; MENU cycles through the menu views. */
export const pagerBaseMenu=['home','inbox','status'];
export type PagerDeviceView=string;
export type PagerSource={id:string;text:string;at:string;title?:string;sender?:string;priority?:'normal'|'hoch';read?:boolean;acknowledged?:boolean};
export type PagerDeviceMessage={id:string;text:string;at:string;title:string;sender:string;urgent:boolean;acknowledged:boolean;opened:boolean};
export type PagerDeviceState={view:PagerDeviceView;inboxIndex:number;selectedId:string|null};
export type PagerEffect={type:'opened';id:string}|{type:'acknowledge';id:string}|{type:'scroll';step:-1|1}|{type:'collapse'};
export const initialPagerDevice=():PagerDeviceState=>({view:'home',inboxIndex:0,selectedId:null});

/**
 * Viewer messages, newest first. The same id is shown once (replays and reloads deliver the same id again).
 * opened/acknowledged are local hints; a server acknowledgement always wins.
 */
export function pagerDeviceMessages(pagers:readonly PagerSource[],opened:readonly string[]=[],acknowledged:readonly string[]=[]):PagerDeviceMessage[]{
 const byId=new Map<string,PagerSource>();
 for(const p of pagers)if(p&&typeof p.id==='string'&&p.id&&!byId.has(p.id))byId.set(p.id,p);
 return [...byId.values()].map(p=>{const acked=!!p.acknowledged||acknowledged.includes(p.id);return {id:p.id,text:p.text,at:p.at,title:p.title||'',sender:p.sender||'',urgent:p.priority==='hoch',acknowledged:acked,opened:acked||!!p.read||opened.includes(p.id)};})
  .sort((x,y)=>y.at.localeCompare(x.at)||y.id.localeCompare(x.id));
}
/** Unopened messages: the badge on the folded pager. */
export const pagerUnread=(messages:readonly PagerDeviceMessage[])=>messages.filter(m=>!m.opened).length;
/** Keyboard on the focused device: arrows, Enter, Escape and M, like the five keys. */
export function pagerKeyOf(key:string):PagerKey|undefined{return ({ArrowUp:'up',ArrowDown:'down',Enter:'ok',Escape:'back',m:'menu',M:'menu'} as Record<string,PagerKey>)[key];}

/** One key press. Returns the next device state and at most one effect for the client to carry out. */
export function pressPagerKey(state:PagerDeviceState,key:PagerKey,messages:readonly PagerDeviceMessage[],menu:readonly string[]=pagerBaseMenu):{state:PagerDeviceState;effect?:PagerEffect}{
 const clamp=(i:number)=>Math.max(0,Math.min(Math.max(0,messages.length-1),i));
 if(key==='menu'){const i=menu.indexOf(state.view);return {state:{...state,view:menu[(i+1)%menu.length]}};}
 if(key==='back'){
  if(state.view==='message')return {state:{...state,view:'inbox'}};
  if(state.view!=='home')return {state:{...state,view:'home'}};
  return {state,effect:{type:'collapse'}};
 }
 if(key==='up'||key==='down'){
  const step=key==='up'?-1:1;
  if(state.view==='inbox')return {state:{...state,inboxIndex:clamp(state.inboxIndex+step)}};
  if(state.view==='message')return {state,effect:{type:'scroll',step}};
  return {state};
 }
 // OK
 if(state.view==='home')return {state:{...state,view:'inbox',inboxIndex:clamp(state.inboxIndex)}};
 if(state.view==='inbox'){const m=messages[clamp(state.inboxIndex)];return m?{state:{...state,view:'message',selectedId:m.id},effect:{type:'opened',id:m.id}}:{state};}
 if(state.view==='message'){const m=messages.find(x=>x.id===state.selectedId);return m&&!m.acknowledged?{state,effect:{type:'acknowledge',id:m.id}}:{state};}
 return {state:{...state,view:'home'}};
}
/** New ids since the last look: these float the pager in and may ring. Withdrawn ids simply vanish. */
export function pagerArrivals(previous:readonly string[]|null,messages:readonly PagerDeviceMessage[]){return previous===null?[]:messages.filter(m=>!previous.includes(m.id));}
/**
 * Which messages ring and float the pager in. heard holds every id this viewer has already been shown; it only grows,
 * so a reload (heard seeded with the current ids), a repeated event or a late, older snapshot never rings twice.
 * Several new ids in one sync are one ring; an urgent one makes it the alarm.
 */
export function pagerRing(heard:ReadonlySet<string>,messages:readonly PagerDeviceMessage[]){
 const fresh=messages.filter(m=>!heard.has(m.id));
 return {fresh,kind:fresh.length?(fresh.some(m=>m.urgent)?'alarm' as const:'ping' as const):null,heard:new Set([...heard,...messages.map(m=>m.id)])};
}
/** Messages opened here whose read receipt the server does not have yet (lost request, other tab, older snapshot). */
export function pagerReadsToSync(pagers:readonly PagerSource[],opened:readonly string[],pending:ReadonlySet<string>){
 return pagers.filter(p=>!p.read&&!p.acknowledged&&opened.includes(p.id)&&!pending.has(p.id)).map(p=>p.id);
}
/** Keeps the selection on a real message; a withdrawn message sends the device back to the inbox. */
export function settlePagerDevice(state:PagerDeviceState,messages:readonly PagerDeviceMessage[]):PagerDeviceState{
 const inboxIndex=Math.max(0,Math.min(Math.max(0,messages.length-1),state.inboxIndex));
 if(state.view==='message'&&!messages.some(m=>m.id===state.selectedId))return {view:'inbox',inboxIndex,selectedId:null};
 return inboxIndex===state.inboxIndex?state:{...state,inboxIndex};
}
