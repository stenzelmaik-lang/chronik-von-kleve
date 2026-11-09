"use client";
import { useEffect, useState } from "react";
import { Check, CalendarCheck } from "lucide-react";
import type { Actor } from "@/domain/types";
import type { Entry } from "@/domain/legacy";
import { appointmentOptions, type AppointmentChoice } from "@/domain/appointments";
import { api } from "./api-client";
import styles from "./dashboard.module.css";

type Vote = { memberId: string; name: string; choices: Record<string, AppointmentChoice>; version?: number };
type Appointment = Entry & { votes: Vote[] };
const labels: Record<AppointmentChoice, string> = { yes: "Ja", maybe: "Vielleicht", no: "Nein" };
const format = (date: string) => new Date(date).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Zuflucht · Nächster Abend: while a date poll is open, the calendar block turns into the poll.
 * Everyone answers right here; the SL fixes the date, then the block shows the calendar again.
 */
export function DashboardPoll({ a, pollId, onChanged }: { a: Actor; pollId: string; onChanged: () => void }) {
  const [poll, setPoll] = useState<Appointment | null>(null), [draft, setDraft] = useState<Record<string, AppointmentChoice>>({});
  const [busy, setBusy] = useState(false), [status, setStatus] = useState(""), [reload, setReload] = useState(0);
  useEffect(() => { let on = true; api<{ records: Appointment[] }>("/api/appointments").then(r => { if (!on) return; const p = r.records.find(x => x.id === pollId) || null; setPoll(p); setDraft(p?.votes.find(v => v.memberId === a.id)?.choices || {}); }).catch(e => { if (on) setStatus((e as Error).message); }); return () => { on = false; }; }, [pollId, a.id, reload]);
  if (!poll) return <p>{status || "Abstimmung wird geladen …"}</p>;
  let options: { id: string; date: string }[] = [];
  try { options = appointmentOptions(poll.body.pollOptions); } catch { return <p role="alert">Die Terminvorschläge dieser Abstimmung sind ungültig.</p>; }
  const own = poll.votes.find(v => v.memberId === a.id), complete = options.every(o => draft[o.id]);
  const yes = (id: string) => poll.votes.filter(v => v.choices[id] === "yes").length;
  async function write(body: Record<string, unknown>, done: string, finish = false) {
    setBusy(true); setStatus("");
    try { await api("/api/appointments", "POST", body); setStatus(done); if (finish) onChanged(); else setReload(n => n + 1); }
    catch (e) { setStatus((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div className={styles.pollBlock}>
    <p className={styles.pollTitle}>{poll.title}</p>
    {typeof poll.body.summary === "string" && poll.body.summary && <p className={styles.pollNote}>{poll.body.summary}</p>}
    <ul className={styles.pollOptions}>{options.map(o => <li key={o.id}>
      <div><strong>{format(o.date)}</strong><small>{yes(o.id)} Zusage{yes(o.id) === 1 ? "" : "n"}</small></div>
      <div className={styles.pollChoices} role="group" aria-label={"Antwort für " + format(o.date)}>{(["yes", "maybe", "no"] as const).map(c => <button key={c} type="button" data-choice={c} aria-pressed={draft[o.id] === c} disabled={busy} onClick={() => setDraft(d => ({ ...d, [o.id]: c }))}>{labels[c]}</button>)}</div>
      {a.gm && <button type="button" className={styles.pollFix} disabled={busy} onClick={() => void write({ action: "finalize", id: poll.id, version: poll.version, optionId: o.id }, "Termin festgelegt.", true)}><CalendarCheck size={14} aria-hidden="true" />Festlegen</button>}
    </li>)}</ul>
    <div className={styles.calendarLinks}>
      <button type="button" disabled={busy || !complete} onClick={() => void write({ action: "vote", id: poll.id, version: own?.version || 0, choices: draft }, "Antwort gespeichert.")}><Check size={16} aria-hidden="true" />{own ? "Antwort ändern" : "Antwort speichern"}</button>
      <span role="status">{status || (!complete ? "Bitte für jeden Vorschlag antworten." : "")}</span>
    </div>
  </div>;
}
