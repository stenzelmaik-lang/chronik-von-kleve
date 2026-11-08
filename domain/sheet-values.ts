// Character sheet values for read-only views. Taken over from the retired Abenteuerjournal
// (AJ-01, tag archiv/abenteuerjournal-aj01) for the shared sheet display in a later stage.

/**
 * A missing value stays recognisably missing (null, shown as "–"); a real zero stays zero.
 * Whole numbers only; numeric strings are accepted because older sheets store them that way.
 */
export function sheetNumber(value:unknown):number|null{
 if(typeof value==='number'&&Number.isFinite(value))return Math.trunc(value);
 if(typeof value==='string'&&/^-?\d+$/.test(value.trim()))return Number(value.trim());
 return null;
}
/** Dots of a paper-sheet row: at least five, more when the value is higher (elders, generation limits). */
export function dotSlots(value:number|null,min=5){return Math.max(min,value??0);}
/** Screen reader text for dots and boxes. */
export function dotLabel(name:string,value:number|null,max?:number|null){
 if(value===null)return name+': nicht erfasst';
 return name+': '+value+(max!=null?' von '+max:'');
}
