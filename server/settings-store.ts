import {database,HttpError} from './access';

/**
 * Small JSON documents in the existing `settings` table (no migration, not reachable through the records API).
 * Writes are compare-and-swap: a change only lands when nobody changed the value since it was read.
 */
export async function readSetting(key:string){return (await database().prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{value:string}>())?.value??null;}
async function writeCas(key:string,expected:string|null,next:string){
 const db=database();
 const result=expected===null
  ?await db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING').bind(key,next).run()
  :await db.prepare('UPDATE settings SET value=? WHERE key=? AND value=?').bind(next,key,expected).run();
 return result.meta.changes===1;
}
export async function mutateSetting<T>(key:string,parse:(raw:string|null)=>T,apply:(state:T)=>T,conflict='Gleichzeitig geändert. Bitte erneut versuchen.'){
 for(let attempt=0;attempt<4;attempt++){
  const raw=await readSetting(key),next=apply(parse(raw));
  if(await writeCas(key,raw,JSON.stringify(next)))return next;
 }
 throw new HttpError(409,conflict);
}
