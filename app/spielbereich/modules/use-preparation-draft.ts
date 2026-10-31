"use client";
import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';

// Unsaved editor state only: no localStorage, no second saved material store.
// It survives internal navigation/drawer unmounts within this page, scoped to the authenticated actor.
const drafts=new Map<string,unknown>();
let warning=false;
const warn=(e:BeforeUnloadEvent)=>{if(drafts.size){e.preventDefault();e.returnValue='';}};
function remember(key:string,value:unknown){
 if(value===null)drafts.delete(key);else drafts.set(key,value);
 if(drafts.size&&!warning){window.addEventListener('beforeunload',warn);warning=true;}
 else if(!drafts.size&&warning){window.removeEventListener('beforeunload',warn);warning=false;}
}
export function usePreparationDraft<T>(key:string):[T|null,Dispatch<SetStateAction<T|null>>]{
 const [value,setValue]=useState<T|null>(null),ready=useRef(false);
 useEffect(()=>{let alive=true;const saved=drafts.get(key) as T|undefined;
  queueMicrotask(()=>{if(!alive)return;ready.current=true;if(saved!==undefined)setValue(saved);});
  return()=>{alive=false;};
 },[key]);
 useEffect(()=>{if(ready.current)remember(key,value);},[key,value]);
 return [value,setValue];
}
