"use client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronRight,
  Clock3,
  Coins,
  HeartHandshake,
  Plus,
  Radio,
  Shield,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

import type { Entry } from "@/domain/legacy";
import type { Actor } from "@/domain/types";

import { api } from "./api-client";
export function DashboardPanel({
  a,
  onNavigate,
}: {
  a: Actor;
  onNavigate: (id: string) => void;
}) {
  const [data, setData] = useState<{ character: Entry | null; characterCount: number; nextSession: Entry | null; lastSession: Entry | null; economy: Entry | null; favors: Entry | null; notes: Entry[]; message: Entry | null }>({ character:null, characterCount:0, nextSession:null, lastSession:null, economy:null, favors:null, notes:[], message:null });
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    api("/api/dashboard").then((payload) => { if (alive) setData(payload as unknown as typeof data); })
      .catch((e) => alive && setErr((e as Error).message))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, []);
  if (busy)
    return (
      <div className="dashboard-loading">
        <Skeleton className="h-48 w-full" />
        <div className="entry-grid">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      </div>
    );
  const char = data.character;
  const eco = data.economy?.body || {};
  const hasEconomy = !!data.economy;
  const favors = Array.isArray(data.favors?.body?.favors)
    ? data.favors.body.favors
    : [];
  const openFavors = favors.filter(
    (f) => f.status !== "eingelöst" && Number(f.value) !== 0,
  ).length;
  const nextDate = data.nextSession;
  return (
    <div className="dashboard-stack">
      {err && <div className="error-box">{err}</div>}
      <section className="dashboard-banner">
        <div>
          <p className="eyebrow">
            <Zap size={14} /> NACHTPROTOKOLL ·{" "}
            {new Date().toLocaleDateString("de-DE")}
          </p>
          <h2>
            {char
              ? `Guten Abend, ${char.title}.`
              : `Willkommen in der Domäne, ${a.name}.`}
          </h2>
          <p>
            {char
              ? "Die letzten Signale warten auf deine Entscheidung."
              : "Erstelle deinen ersten Charakter und betrete die Chronik."}
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => onNavigate(char ? "sitzung" : "charaktere")}
        >
          {char ? (
            <>
              <Radio size={16} /> Zur laufenden Sitzung
            </>
          ) : (
            <>
              <Plus size={16} /> Charakter anlegen
            </>
          )}
        </button>
      </section>
      <div className="dashboard-grid">
        <button
          className="dash-card character"
          onClick={() => onNavigate("charaktere")}
        >
          <span className="dash-card-icon">
            <Shield size={22} />
          </span>
          <span className="eyebrow">DEIN BLATT</span>
          <h3>{char?.title || "Noch kein Charakter"}</h3>
          <p>
            {char
              ? [char.body?.clan, char.body?.concept]
                  .filter(Boolean)
                  .join(" · ") || "Konzept offen"
              : "Lege dein Kainskind an und halte jede Spur fest."}
          </p>
          {char && <span className="dash-metric">
            {char?.body?.humanity ?? "–"} <small>Menschlichkeit</small>
          </span>}
        </button>
        <button
          className="dash-card wealth"
          onClick={() => onNavigate("wirtschaft")}
        >
          <span className="dash-card-icon">
            <Coins size={22} />
          </span>
          <span className="eyebrow">LEDGER</span>
          <h3>{hasEconomy && eco.money_euro !== undefined ? `${Number(eco.money_euro).toLocaleString("de-DE")} €` : "Noch keine Daten"}</h3>
          <p>{hasEconomy ? "Verfügbares Vermögen und Ressourcen." : "Keine aktuelle Inventarvorschau verfügbar."}</p>
          {hasEconomy && <span className="dash-metric">
            +
            {(
              Number(eco.resources ?? 0) * 600 +
              Number(eco.finances_successes ?? 0) * 100
            ).toLocaleString("de-DE")}{" "}
            € <small>Monatlich</small>
          </span>}
        </button>
        <button
          className="dash-card social"
          onClick={() => onNavigate("gefallen")}
        >
          <span className="dash-card-icon">
            <HeartHandshake size={22} />
          </span>
          <span className="eyebrow">BEZIEHUNGEN</span>
          <h3>{openFavors} offene Gefallen</h3>
          <p>Schulden und Versprechen behalten Gewicht.</p>
          <span className="dash-metric">
            {favors.reduce((sum: number, f) => sum + Number(f.value || 0), 0) >
            0
              ? "+"
              : ""}
            {favors.reduce((sum: number, f) => sum + Number(f.value || 0), 0)}{" "}
            <small>Token-Saldo</small>
          </span>
        </button>
      </div>
      <section className="panel dashboard-next">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">NÄCHSTER EINTRAG</p>
            <h3>{nextDate?.title || "Die nächste Zusammenkunft"}</h3>
            <p className="muted">
              {nextDate?.body?.date || "Aktuell ist keine kommende Sitzung eingetragen."}
            </p>
          </div>
          <Clock3 size={24} className="text-primary" />
        </div>
        <p>
          {nextDate?.body?.summary ||
            "Sobald ein kommender Termin freigegeben ist, erscheint er hier."}
        </p>
        <button
          className="button"
          onClick={() => onNavigate(nextDate ? "termine" : "sitzung")}
        >
          {nextDate ? "Alle Termine ansehen" : "Sitzungszentrale öffnen"}{" "}
          <ChevronRight size={16} />
        </button>
      </section>
      <div className="dashboard-detail-grid">
        <section className="panel dashboard-info-panel"><p className="eyebrow">ERFAHRUNG & FORTSCHRITT</p><h3>{char?.body?.xp !== undefined ? `${char.body.xp} XP` : "Noch keine XP-Daten vorhanden."}</h3><p className="muted">{char?.body?.xp !== undefined ? "Dein aktueller Fortschritt." : "Sobald belastbare Charakterdaten vorliegen, erscheint der Fortschritt hier."}</p></section>
        <section className="panel dashboard-info-panel"><p className="eyebrow">LETZTES SITZUNGSPROTOKOLL</p><h3>{data.lastSession?.title || "Noch kein Protokoll"}</h3><p className="muted">{data.lastSession?.body?.summary || "Es ist noch kein freigegebenes Sitzungsprotokoll vorhanden."}</p>{data.lastSession && <button className="button" onClick={() => onNavigate("sitzung")}>Protokoll lesen <ChevronRight size={16}/></button>}</section>
        <section className="panel dashboard-info-panel"><p className="eyebrow">SL-MITTEILUNG</p><h3>{data.message?.title || "Aktuell liegt keine Mitteilung vor."}</h3><p className="muted">{data.message?.body?.summary || data.message?.body?.text || "Die Spielleitung hat noch keine aktuelle Nachricht freigegeben."}</p></section>
        <section className="panel dashboard-info-panel"><p className="eyebrow">AKTUELLE NOTIZEN</p>{data.notes.length ? data.notes.map((n) => <p className="dashboard-note" key={n.id}>{n.title}</p>) : <p className="muted">Keine persönlichen Hinweise vorhanden.</p>}<button className="button" onClick={() => onNavigate("notizen")}>Notizen öffnen <ChevronRight size={16}/></button></section>
      </div>
      <div className="dashboard-quick-actions"><span className="eyebrow">SCHNELLAKTIONEN</span><button className="button" onClick={() => onNavigate("wuerfel")}><Radio size={15}/> Wurf starten</button><button className="button" onClick={() => onNavigate("notizen")}><Plus size={15}/> Notiz anlegen</button><button className="button" onClick={() => onNavigate("charaktere")}><Shield size={15}/> Charakterbogen</button><button className="button" onClick={() => onNavigate("inventar")}><Coins size={15}/> Inventar</button><button className="button" onClick={() => onNavigate("gefallen")}><HeartHandshake size={15}/> Beziehungen</button></div>
    </div>
  );
}
