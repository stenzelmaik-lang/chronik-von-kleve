"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import type { Actor } from '@/domain/types';
import { CommandPlace } from './command-place';
import styles from './location-quick-access.module.css';

/** Reading only. The live table stays mounted and no active place is changed. */
export function LocationQuickAccess({ a, initialPlaceId = '' }: { a: Actor; initialPlaceId?: string }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!a.gm || !element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
    if (!open) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = previous; };
  }, [open, a.gm]);
  if (!a.gm) return null;
  return <>
    <button ref={trigger} type="button" className="button" onClick={() => setOpen(true)} aria-haspopup="dialog"><MapPin size={17} aria-hidden="true"/> Ortswissen</button>
    <dialog ref={dialog} className={styles.drawer} aria-labelledby={titleId} onClose={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }} onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const element=dialog.current;if(!element)return;
      const controls=[...element.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]')].filter(control=>control.getClientRects().length>0);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first&&last){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last&&first){event.preventDefault();first.focus();}
    }}>
      <header className={styles.header}><div><h2 id={titleId}>Ortswissen</h2><p>Nur Spielleitung · Lesen verändert den Spielabend nicht.</p></div><button type="button" aria-label="Ortswissen schließen" onClick={() => dialog.current?.close()}><X size={21} aria-hidden="true"/></button></header>
      <div className={styles.body}>{open && <CommandPlace a={a} readOnly initialPlaceId={initialPlaceId} onRefresh={() => {}}/>}</div>
    </dialog>
  </>;
}
