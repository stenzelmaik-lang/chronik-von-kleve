// Calendar dates as ISO strings (YYYY-MM-DD), so that they sort as text. Taken over from the retired
// Abenteuerjournal (AJ-01, tag archiv/abenteuerjournal-aj01) for the notebook page date.

export const CALENDAR_DATE=/^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar day, years 1–9999, with true month lengths and leap years. */
export function validCalendarDate(value:unknown):value is string{
 if(typeof value!=='string')return false;
 const m=value.match(CALENDAR_DATE);if(!m)return false;
 const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);
 if(y<1||mo<1||mo>12||d<1)return false;
 const days=[31,(y%4===0&&y%100!==0)||y%400===0?29:28,31,30,31,30,31,31,30,31,30,31][mo-1];
 return d<=days;
}

const months=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
/** "14. März 1998". An invalid stored value is shown as given, so nothing silently disappears. */
export function formatCalendarDate(value:string|null|undefined,empty='Ohne Datum'){
 if(!value)return empty;
 if(!validCalendarDate(value))return value;
 const [y,m,d]=value.split('-').map(Number);
 return d+'. '+months[m-1]+' '+y;
}
