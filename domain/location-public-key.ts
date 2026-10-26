/** Stable presentation key, never an authorization token. Every read still
 * resolves the actual audience projection. Internal/legacy IDs stay private. */
export function locationPublicKey(id:string){
  let a=2166136261,b=5381;for(const c of id){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}
  return 'entry-'+(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
}
