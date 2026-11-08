"use client";
import { useId, useState, type ReactNode } from "react";
import { Info, X } from "lucide-react";
import styles from "./info-button.module.css";

/** A short, always reachable explanation of an area: what you can do here and how. Opens in place, no navigation. */
export function InfoButton({ title, children, label = "Kurz erklärt" }: { title: string; children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false), id = useId();
  return <span className={styles.wrap}>
    <button type="button" className={styles.trigger} aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)}><Info size={15} aria-hidden="true" /><span>{label}</span></button>
    {open && <section id={id} className={styles.panel} role="region" aria-label={title} onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } }}>
      <header><h2>{title}</h2><button type="button" aria-label="Erklärung schließen" onClick={() => setOpen(false)}><X size={16} /></button></header>
      <div className={styles.body}>{children}</div>
    </section>}
  </span>;
}
