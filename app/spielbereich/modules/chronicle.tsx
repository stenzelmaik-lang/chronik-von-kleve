"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { Entry } from "@/domain/legacy";
import { ArrowUpRight, BookOpen, X } from "lucide-react";
import { useRef, useState } from "react";
import { richTeaser } from "./rich-teaser";
import { RichTextView } from "./rich-text";
import styles from "./chronicle.module.css";

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "long", timeZone: "UTC" });
const undated = "Ohne Datum";

function chronicleDate(entry: Entry) {
  const time = Date.parse(String(entry.body?.date || entry.updated_at || ""));
  const date = Number.isFinite(time) ? new Date(time) : null;
  return {
    time: date?.getTime() ?? Number.MIN_SAFE_INTEGER,
    year: date ? String(date.getUTCFullYear()) : undated,
    label: date ? dateFormat.format(date) : undated,
    iso: date?.toISOString().split("T")[0],
  };
}

function yearId(year: string) {
  return "chronik-jahr-" + (year === undated ? "undatiert" : year);
}

export function ChroniclePanel({ entries }: { entries: Entry[] }) {
  const [releasedOnly, setReleasedOnly] = useState(false);
  const [selected, setSelected] = useState<Entry | null>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const showVisibility = entries.some((entry) => entry.visibility !== "group");
  const visible = entries
    .filter((entry) => !releasedOnly || entry.visibility === "group")
    .map((entry) => ({ entry, date: chronicleDate(entry) }))
    .sort((a, b) => b.date.time - a.date.time);
  const years = new Map<string, typeof visible>();
  for (const item of visible) {
    const year = years.get(item.date.year);
    if (year) year.push(item);
    else years.set(item.date.year, [item]);
  }

  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <div>
          <p className={styles.kicker}>Chronik von Kleve</p>
          <h1>Die Nacht hinterlässt Spuren.</h1>
          <p className={styles.intro}>Ereignisse, Beobachtungen und Rückblicke aus der Domäne.</p>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.timelineLabel}>
          <h2 id="chronik-zeitstrahl">Zeitstrahl</h2>
          <p aria-live="polite">{visible.length} {visible.length === 1 ? "Eintrag" : "Einträge"} · Neueste zuerst</p>
        </div>
        {showVisibility && (
          <label className={styles.filter}>
            <input type="checkbox" checked={releasedOnly} onChange={(event) => setReleasedOnly(event.target.checked)} />
            Nur freigegeben
          </label>
        )}
        {years.size > 1 && (
          <nav className={styles.yearNav} aria-label="Zu einem Jahr springen">
            {Array.from(years.keys(), (year) => <a key={year} href={"#" + yearId(year)}>{year}</a>)}
          </nav>
        )}
      </div>

      {visible.length === 0 ? (
        <Empty className="empty-night">
          <EmptyHeader>
            <BookOpen size={32} aria-hidden="true" className="text-primary mb-3" />
            <EmptyTitle>Noch keine {releasedOnly ? "freigegebenen " : ""}Einträge</EmptyTitle>
            <EmptyDescription>Hier erscheinen die Ereignisse der Domäne, sobald sie eingetragen sind.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className={styles.timeline} aria-labelledby="chronik-zeitstrahl">
          {Array.from(years, ([year, items]) => (
            <section className={styles.year} key={year} aria-labelledby={yearId(year)}>
              <h3 id={yearId(year)} className={styles.yearLabel}>{year}</h3>
              <ol className={styles.events}>
                {items.map(({ entry, date }) => {
                  const recap = entry.body?.type === "rueckblick";
                  const teaser = richTeaser(entry.body?.summary || entry.body?.text, 175);
                  const action = <>Eintrag öffnen <ArrowUpRight size={15} aria-hidden="true" /></>;
                  return (
                    <li key={entry.id || entry.title} className={styles.event}>
                      <article className={styles.card} data-recap={recap || undefined}>
                        <div className={styles.meta}>
                          {date.iso ? <time dateTime={date.iso}>{date.label}</time> : <span>{date.label}</span>}
                          {recap && <span className={styles.tag}>Rückblick</span>}
                          {showVisibility && <span className={styles.tag}>{entry.visibility === "group" ? "Freigegeben" : "Spielleitung"}</span>}
                          {entry.body?.source && <span className={styles.source}>{String(entry.body.source)}</span>}
                        </div>
                        <h4>{entry.title}</h4>
                        {teaser && <p className={styles.teaser}>{teaser}</p>}
                        {recap && entry.id ? (
                          <a className={styles.open} aria-label={"Eintrag öffnen: " + entry.title} href={"/spielbereich?bereich=rueckblick&session=" + encodeURIComponent(entry.id)}>{action}</a>
                        ) : (
                          <button type="button" className={styles.open} aria-label={"Eintrag öffnen: " + entry.title} onClick={(event) => {
                            opener.current = event.currentTarget;
                            setSelected(entry);
                          }}>{action}</button>
                        )}
                      </article>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        {selected && (
          <DialogContent
            className={styles.reader}
            showCloseButton={false}
            onOpenAutoFocus={(event) => { event.preventDefault(); heading.current?.focus(); }}
            onCloseAutoFocus={(event) => { event.preventDefault(); opener.current?.focus(); }}
          >
            <header className={styles.readerHeader}>
              <DialogDescription className={styles.readerDate}>{chronicleDate(selected).label}</DialogDescription>
              <DialogTitle ref={heading} tabIndex={-1} className={styles.readerTitle}>{selected.title}</DialogTitle>
              <DialogClose className={styles.close} aria-label="Eintrag schließen"><X size={20} aria-hidden="true" /></DialogClose>
            </header>
            <RichTextView value={String(selected.body?.text || selected.body?.summary || "Zu diesem Eintrag gibt es keinen Lesetext.")} readable className={styles.readerText} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
