"use client";
import { sheetView, type SheetListRow, type SheetCostRow, type SheetRow } from "@/domain/character-sheet-view";
import styles from "./character-sheet.module.css";

/** Dots of one row. A missing value is a dash, never empty dots; values above five get more dots. */
function Dots({ value, slots, label }: { value: number | null; slots: number; label: string }) {
  if (value === null) return <span className={styles.missing} role="img" aria-label={label}>–</span>;
  return <span className={styles.dots} role="img" aria-label={label}>{Array.from({ length: slots }, (_, i) => <i key={i} data-on={i < value || undefined} />)}</span>;
}
function Row({ row }: { row: SheetRow | SheetListRow }) {
  const extra = "specialties" in row && row.specialties.length ? row.specialties.join(", ") : "note" in row ? row.note : "";
  return <div className={styles.row}><span className={styles.name}>{row.name}{extra && <small>{"specialties" in row && row.specialties.length ? "Spezialisierung: " : ""}{extra}</small>}</span><Dots value={row.value} slots={row.slots} label={row.label} /></div>;
}
function List({ title, rows, empty = "Keine Einträge." }: { title: string; rows: (SheetRow | SheetListRow)[] | string; empty?: string }) {
  return <section className={styles.group}><h4>{title}</h4>{typeof rows === "string" ? <p className={styles.free}>{rows || empty}</p> : rows.length ? rows.map((r, i) => <Row key={r.name + i} row={r} />) : <p className={styles.empty}>{empty}</p>}</section>;
}
function Costs({ title, rows }: { title: string; rows: SheetCostRow[] | string }) {
  return <section className={styles.group}><h4>{title}</h4>{typeof rows === "string" ? <p className={styles.free}>{rows || "Keine Einträge."}</p> : rows.length ? rows.map((r, i) => <div className={styles.row} key={r.name + i}><span className={styles.name}>{r.name}</span><span className={styles.cost}>{r.cost === null ? "–" : r.cost + " Pkt."}</span></div>) : <p className={styles.empty}>Keine Einträge.</p>}</section>;
}
function Boxes({ filled, total, label }: { filled: number | null; total: number | null; label: string }) {
  if (total === null || total <= 0) return <span className={styles.missing} role="img" aria-label={label + ": nicht erfasst"}>–</span>;
  return <span className={styles.boxes} role="img" aria-label={`${label}: ${filled ?? "–"} von ${total}`}>{Array.from({ length: Math.min(total, 50) }, (_, i) => <i key={i} data-on={filled !== null && i < filled || undefined} />)}</span>;
}

/**
 * The V20 sheet for every reading place: player area and SL view ("wide"), in-game menu ("narrow").
 * Reads the existing projection only; editing stays in the existing editor.
 */
export type SheetSection = "identity" | "attributes" | "abilities" | "advantages" | "resources";
export function CharacterSheet({ identity, sheet, progression, layout, section, withIdentity = true }: { identity: Record<string, unknown>; sheet: Record<string, unknown>; progression?: Record<string, unknown>; layout: "wide" | "narrow"; section?: SheetSection; withIdentity?: boolean }) {
  const v = sheetView(identity, sheet, progression);
  const show = (part: SheetSection) => !section || section === part;
  const wp = v.willpower, bl = v.blood;
  return <article className={`${styles.sheet} ${layout === "wide" ? styles.wide : styles.narrow}`} aria-label="Charakterbogen">
    <span className={styles.corners} aria-hidden="true" />
    {!section && <header className={styles.masthead}><p>V20 · Charakterbogen</p><h2>{String(identity.name || "Charakter")}</h2></header>}
    {show("identity") && withIdentity && <dl className={styles.header}>{v.header.map(([k, value]) => <div key={k}><dt>{k}</dt><dd>{value}</dd></div>)}</dl>}

    {show("attributes") && <section className={styles.block} aria-labelledby="cs-attributes"><h3 id="cs-attributes">Attribute</h3>
      <div className={styles.columns}>{v.attributes.map(g => <List key={g.title} title={g.title} rows={g.rows} />)}</div>
    </section>}
    {show("abilities") && <section className={styles.block} aria-labelledby="cs-abilities"><h3 id="cs-abilities">Fähigkeiten</h3>
      <div className={styles.columns}>{v.abilities.map(g => <List key={g.title} title={g.title} rows={g.rows} />)}</div>
      {(v.unassigned.length > 0 || v.legacyText.length > 0) && <div className={styles.columns}>{v.unassigned.length > 0 && <List title="Werte ohne Zuordnung" rows={v.unassigned} />}{v.legacyText.map((t, i) => <section key={i} className={styles.group}><h4>Freie Fähigkeiten (Altbestand)</h4><p className={styles.free}>{t}</p></section>)}</div>}
    </section>}
    {show("advantages") && <><section className={styles.block} aria-labelledby="cs-advantages"><h3 id="cs-advantages">Vorteile</h3>
      <div className={styles.columns}>
        <div><List title="Disziplinen" rows={v.disciplines} />{v.paths.length > 0 && <List title="Pfade" rows={v.paths} />}</div>
        <List title="Hintergründe" rows={v.backgrounds} />
        <List title="Tugenden" rows={v.virtues} />
      </div>
    </section>
    <section className={styles.block} aria-labelledby="cs-traits"><h3 id="cs-traits">Vorzüge & Schwächen</h3>
      <div className={styles.columns}>
        <Costs title="Vorzüge" rows={v.merits} />
        <Costs title="Schwächen" rows={v.flaws} />
        <section className={styles.group}><h4>Clansschwäche</h4><p className={styles.free}>{v.clanWeakness || "Keine Clansschwäche hinterlegt."}</p></section>
      </div>
    </section></>}
    {show("resources") && <section className={styles.block} aria-labelledby="cs-state"><h3 id="cs-state">Menschlichkeit, Willenskraft, Blut, Gesundheit</h3>
      <div className={styles.columns}>
        <section className={styles.group}><h4>{v.humanity.name}</h4><Dots value={v.humanity.value} slots={Math.max(10, v.humanity.value ?? 0)} label={v.humanity.name + ": " + (v.humanity.value ?? "nicht erfasst")} /></section>
        <section className={styles.group}><h4>Willenskraft</h4>
          <Dots value={wp.permanent} slots={Math.max(10, wp.permanent ?? 0)} label={"Willenskraft permanent: " + (wp.permanent ?? "nicht erfasst")} />
          <Boxes filled={wp.temporary} total={wp.permanent === null ? null : Math.max(10, wp.permanent)} label="Willenskraft aktuell" />
        </section>
        <section className={styles.group}><h4>Blutvorrat</h4>
          <Boxes filled={bl.current} total={bl.max} label="Blutvorrat" />
          <p className={styles.small}>{bl.current ?? "–"} / {bl.max ?? "–"} · pro Runde {bl.perTurn ?? "–"}</p>
        </section>
        <section className={styles.group}><h4>Gesundheit{v.health.status ? " · " + v.health.status : ""}</h4>
          <ol className={styles.health} aria-label={"Gesundheit: " + v.health.level}>{v.health.levels.map(l => <li key={l.name}><span>{l.name}</span><span className={styles.penalty}>{l.penalty}</span><span className={styles.mark} title={l.damage || undefined} aria-label={l.damage ? l.name + ": " + l.damage : l.name + ": frei"}>{l.mark}</span></li>)}</ol>
        </section>
      </div>
      <p className={styles.small}>Erfahrung: {v.experience.free ?? "–"} frei · {v.experience.total ?? "–"} insgesamt</p>
    </section>}
  </article>;
}
