/** Normal V20 checks only. No specialties, automatic successes, damage/soak or house rules. */
import { evaluateV20 } from './w10-core.ts';
/** Version of the live normal-check evaluation. Bump when its interpretation changes. */
export const V20_NORMAL_RULES_VERSION = 'v20-normal-1';
export const W10_ACCEPTED_WORDS=4294967290; // 10 * 429496729, exactly divisible by ten.
export type V20Outcome='success'|'failure'|'botch';
export type V20Report=Readonly<{rule:'v20-normal';target:number;dice:readonly number[];rawSuccesses:number;ones:number;cancelled:number;netSuccesses:number;outcome:V20Outcome;cancelledSuccessIndices:readonly number[]}>;
export type W10LogEntry=Readonly<{id:string;at:string;report:V20Report}>;

export function rollD10Pool(pool:number,source:(words:Uint32Array)=>unknown=words=>globalThis.crypto.getRandomValues(words)):number[]{
  if(!Number.isInteger(pool)||pool<1||pool>30)throw Error('W10: 1–30 Würfel.');
  return Array.from({length:pool},()=>{
    const word=new Uint32Array(1);
    for(let attempt=0;attempt<128;attempt++){
      source(word);
      if(word[0]<W10_ACCEPTED_WORDS)return word[0]%10+1;
    }
    // A broken source fails closed; never substitute a success, a value or Math.random.
    throw Error('Die Zufallsquelle liefert keine verwendbaren Zufallswerte. Kein Wurf gespeichert.');
  });
}
export function evaluateNormalV20(values:readonly number[],target:number):V20Report{
  if(!Array.isArray(values)||values.length<1||values.length>30||values.some(v=>!Number.isInteger(v)||v<1||v>10)||!Number.isInteger(target)||target<2||target>10)throw Error('V20: ungültige Würfelwerte oder Schwierigkeit.');
  const result=evaluateV20(values,{difficulty:target});
  const {rawSuccesses,ones,cancelled,outcome,cancelledSuccessIndices}=result,netSuccesses=result.netRolledSuccesses;
  return Object.freeze({rule:'v20-normal',target,dice:Object.freeze([...values]),rawSuccesses,ones,cancelled,netSuccesses,
    outcome,cancelledSuccessIndices});
}
export function recordNormalV20(values:readonly number[],target:number):W10LogEntry{
  return Object.freeze({id:globalThis.crypto.randomUUID(),at:new Date().toISOString(),report:evaluateNormalV20(values,target)});
}
/** Old events without a report remain readable; never replace a stored original evaluation. */
export function reportForStoredV20Roll(roll:{dice:readonly number[];target:number},report?:V20Report):V20Report{
  return report??evaluateNormalV20(roll.dice,roll.target);
}
export const v20OutcomeLabel:Record<V20Outcome,string>={success:'Erfolg',failure:'Fehlschlag',botch:'Patzer'};
