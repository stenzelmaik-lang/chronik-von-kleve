import {validateDiceJournal} from './shared-dice.mjs';
// Private loopback-test snapshot only. No database, credentials or production bindings.
import {existsSync,readFileSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
import {createStage,constrainRect,scenes,NOTE_LIMIT} from './stage-state.mjs';

export function readStage(path){
  if(!existsSync(path))return createStage();
  const saved=JSON.parse(readFileSync(path,'utf8'));
  const s=saved.state;
  if(saved.format!==1||!s||!validateDiceJournal(s.diceJournal)||!Number.isSafeInteger(s.version)||s.version<1||!scenes.some(v=>v.id===s.scene)||!Array.isArray(s.objects)||!Array.isArray(s.board)||!Number.isSafeInteger(s.boardEpoch)||!s.objects.every(o=>{
    if(!o||typeof o.id!=='string'||!['npc','document','note'].includes(o.kind)||!o.rect)return false;
    if(Object.keys(constrainRect(o.rect)).some(k=>constrainRect(o.rect)[k]!==o.rect[k]))return false;
    return o.kind==='note'?['gm','a','b'].includes(o.ownerId)&&['private','group'].includes(o.visibility)&&typeof o.content==='string'&&o.content.length<=NOTE_LIMIT&&Number.isSafeInteger(o.revision)&&o.revision>0:['sl','group'].includes(o.visibility);
  })||new Set(s.objects.map(o=>o.id)).size!==s.objects.length)throw Error('Lokaler Testspielstand ungültig. Datei bleibt unverändert; kein stiller Neustart mit leerem Stand.');
  return s;
}
export function writeStage(path,state){
  mkdirSync(dirname(path),{recursive:true});
  const temp=path+'.tmp';
  writeFileSync(temp,JSON.stringify({format:1,state},null,2),{mode:0o600});
  renameSync(temp,path);
}
