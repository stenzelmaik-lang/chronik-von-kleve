"use client";
import {useId,type ReactNode,type MouseEvent} from 'react';
import {ChevronDown,X} from 'lucide-react';
import {Popover,PopoverTrigger,PopoverContent} from '@/components/ui/popover';
import s from './preparation-panel.module.css';

/** Existing portaled popover: bounded slide-down surface without layout reflow. */
export function PreparationPanel({label,children,open,onOpenChange,icon,wide=false,disabled=false,onTriggerMouseDown}:{label:string;children:ReactNode;open:boolean;onOpenChange:(open:boolean)=>void;icon?:ReactNode;wide?:boolean;disabled?:boolean;onTriggerMouseDown?:(event:MouseEvent)=>void}) {
  const id=useId();
  return <Popover open={open} onOpenChange={onOpenChange}>
    <PopoverTrigger asChild><button className={s.trigger} type="button" disabled={disabled} aria-label={label} data-preparation-panel-trigger="true" onMouseDown={onTriggerMouseDown}>{icon}<span>{label}</span><ChevronDown size={15} aria-hidden="true" className={open?s.chevronOpen:undefined}/></button></PopoverTrigger>
    <PopoverContent aria-labelledby={id} className={`${s.surface} ${wide?s.wide:''}`} align={wide?'start':'end'} side="bottom" sideOffset={8} collisionPadding={12} onEscapeKeyDown={event=>event.stopPropagation()} onCloseAutoFocus={event=>{
      // A closing panel must not steal focus from the panel just opened beside it.
      if(document.querySelector('[data-preparation-panel-trigger="true"][aria-expanded="true"]'))event.preventDefault();
    }}>
      <header className={s.head}><h2 id={id}>{label}</h2><button type="button" aria-label={label+' schließen'} onClick={()=>onOpenChange(false)}><X size={18} aria-hidden="true"/></button></header>
      <div className={s.body}>{children}</div>
    </PopoverContent>
  </Popover>;
}
