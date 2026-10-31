"use client";
/** Remembered second-screen Regie per run: a second click focuses the open tab instead of opening another. */
let opened:Window|null=null;
export const regieWindowName=(runId:string)=>'chroniplay-regie-'+runId.replace(/[^a-zA-Z0-9-]/g,'');
export function regieWindowUrl(sessionId:string){return '/sl/regie?sessionId='+encodeURIComponent(sessionId);}
export function openRegieWindow(sessionId:string,runId:string){
 if(opened&&!opened.closed){opened.focus();return opened;}
 // A named target finds the tab again even after the table was reloaded; an existing Regie is only focused, not reloaded.
 opened=window.open('',regieWindowName(runId));
 if(!opened)return null;
 let blank=true;try{blank=opened.location.href==='about:blank';}catch{/* foreign page: navigate */}
 if(blank)opened.location.href=regieWindowUrl(sessionId);
 opened.focus();
 return opened;
}
