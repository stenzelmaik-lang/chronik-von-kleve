// Local adapter for the existing session/event and stage snapshot pattern, not production auth.
import {rollD10Pool,evaluateNormalV20} from '../../domain/w10.ts';
export const DICE_SESSION='synthetic-prototype';
const members={gm:'Demo Spielleitung',a:'Demo Spieler A',b:'Demo Spieler B'};
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export function diceMember(viewer,sessionId=DICE_SESSION){if(!Object.hasOwn(members,viewer)||sessionId!==DICE_SESSION)fail(403,'Kein Zugang zu dieser lokalen Testrunde.');}
const empty=()=>({sessionId:DICE_SESSION,revision:0,events:[]});
export function projectDice(state,viewer,sessionId=DICE_SESSION){
  diceMember(viewer,sessionId);const journal=state.diceJournal||empty();
  return {sessionId:journal.sessionId,revision:journal.revision,events:journal.events.map(e=>({id:e.id,sessionId:e.sessionId,sequence:e.sequence,revision:e.revision,kind:'roll',authorId:e.authorId,authorName:e.authorName,at:e.at,recipients:null,status:e.status,roll:e.roll,result:e.result,animationSeed:e.animationSeed}))};
}
export function changeDice(state,viewer,command,{sample=rollD10Pool,now=()=>new Date().toISOString(),seed=()=>Array.from(crypto.getRandomValues(new Uint32Array(4)))}={}){
  if(command.sessionId!==DICE_SESSION)fail(403,'Kein Zugang zu dieser lokalen Testrunde.');diceMember(viewer,command.sessionId);
  const allowed=command.action==='roll'?['action','sessionId','eventId','pool','target']:['action','sessionId','eventId','expectedRevision'];
  if(!['roll','closeRoll'].includes(command.action)||Object.keys(command).some(k=>!allowed.includes(k)))fail(400,'Ungültiger Würfelbefehl.');
  if(typeof command.eventId!=='string'||!/^[-0-9a-f]{36}$/i.test(command.eventId))fail(400,'Stabile Wurf-ID erforderlich.');
  const journal=state.diceJournal||empty(),previous=journal.events.find(e=>e.id===command.eventId);
  if(command.action==='closeRoll'){
    if(viewer!=='gm')fail(403,'Nur die Spielleitung darf für alle schließen.');
    if(!previous)fail(404,'Wurf nicht gefunden.');
    if(previous.status==='closed_shared')return false;
    if(command.expectedRevision!==previous.revision)fail(409,'Wurf wurde inzwischen geändert.');
    previous.status='closed_shared';previous.revision++;journal.revision++;state.version++;return true;
  }
  if(!Number.isInteger(command.pool)||command.pool<1||command.pool>30||!Number.isInteger(command.target)||command.target<2||command.target>10)fail(400,'W10: 1–30 Würfel, Schwierigkeit 2–10.');
  if(previous){if(previous.authorId!==viewer||previous.roll.pool!==command.pool||previous.roll.target!==command.target)fail(409,'Wurf-ID wurde bereits anders verwendet.');return false;}
  if(journal.events.length>=500)fail(429,'Lokales Sitzungsprotokoll voll; bestehende Würfe bleiben erhalten.');
  const at=now();if(journal.events.filter(e=>e.authorId===viewer&&Date.parse(e.at)>Date.parse(at)-60000).length>=30)fail(429,'Zu viele Würfe. Bitte kurz warten.');
  const dice=sample(command.pool),result=evaluateNormalV20(dice,command.target);
  if(dice.length!==command.pool)fail(400,'Zufallsquelle lieferte einen unvollständigen Wurf.');
  const event={id:command.eventId,sessionId:DICE_SESSION,sequence:journal.events.length+1,revision:1,authorId:viewer,authorName:members[viewer],at,status:'settled_open',roll:{pool:command.pool,target:command.target,dice:[...dice]},result,animationSeed:seed()};
  journal.events.push(event);journal.revision++;state.diceJournal=journal;state.version++;return true;
}
export function validateDiceJournal(journal){
  if(journal===undefined)return true;
  if(!journal||journal.sessionId!==DICE_SESSION||!Number.isSafeInteger(journal.revision)||journal.revision<0||!Array.isArray(journal.events)||journal.events.length>500)return false;
  const ids=new Set();
  return journal.events.every((e,i)=>{
    try{
      if(!e||typeof e.id!=='string'||ids.has(e.id)||e.sequence!==i+1||e.sessionId!==DICE_SESSION||!Object.hasOwn(members,e.authorId)||e.authorName!==members[e.authorId]||!Number.isFinite(Date.parse(e.at))||!Number.isInteger(e.revision)||e.revision<1||!['settled_open','closed_shared'].includes(e.status)||e.roll.pool!==e.roll.dice.length||!Array.isArray(e.animationSeed)||e.animationSeed.length!==4||e.animationSeed.some(v=>!Number.isInteger(v)||v<0||v>0xffffffff))return false;
      ids.add(e.id);return JSON.stringify(e.result)===JSON.stringify(evaluateNormalV20(e.roll.dice,e.roll.target));
    }catch{return false;}
  });
}
