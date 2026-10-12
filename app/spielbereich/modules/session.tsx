"use client";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Activity, Clock3, Plus, Radio, Save, Swords, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type {
  Entry,
  Initiative,
  LegacyBody,
  SessionLog,
} from "@/domain/legacy";
import type { Actor } from "@/domain/types";

import { api } from "./api-client";
import { Choice } from "./shared";
import { SessionStage } from "./session-stage";
import { SceneToolDrawer } from "./scene-tool-drawer";
export function SessionPanel({
  entries,
  a,
  onRefresh,
  compact = false,
  onDraftChange,
  onSaved,
}: {
  entries: Entry[];
  a: Actor;
  onRefresh: () => void;
  compact?: boolean;
  onDraftChange?: (dirty: boolean) => void;
  onSaved?: (entry: Entry) => void;
}) {
  const existing = entries.find((e) => e.kind === "sitzungen");
  const initial = existing?.body || {};
  const [scene, setScene] = useState(String(initial.scene || ""));
  const [subtitle, setSubtitle] = useState(String(initial.subtitle || ""));
  const [status, setStatus] = useState(String(initial.status || "Bereit"));
  const [round, setRound] = useState(Number(initial.round || 1));
  const [turn, setTurn] = useState(Number(initial.turn || 0));
  const [initiative, setInitiative] = useState<Initiative[]>(
    Array.isArray(initial.initiative) ? initial.initiative : [],
  );
  const [log, setLog] = useState<SessionLog[]>(
    Array.isArray(initial.log) ? initial.log : [],
  );
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState(6);
  const [logText, setLogText] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(
    next: LegacyBody = {
      scene,
      subtitle,
      status,
      round,
      turn,
      initiative,
      log,
    },
    publishScene = false,
  ) {
    if (!a.gm) return;
    setSaving(true);
    try {
      const payload = {
        id: existing?.id,
        version: existing?.version,
        kind: "sitzungen",
        title: (publishScene?next.scene:initial.scene) || "Nachtwache",
        visibility: "group",
        body: {...initial,...next,...(!publishScene?{scene:initial.scene||"",subtitle:initial.subtitle||""}:{})},
        gmBody: existing?.gmBody || "",
      };
      const stored = await api<{ id: string; version: number }>("/api/records", "POST", payload);
      onSaved?.({ ...payload, id: stored.id, version: stored.version, title: String(payload.title), visibility: 'group' });
      toast.success("Sitzung aktualisiert");
      if(publishScene)onDraftChange?.(false);
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function addInitiative(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const next = [
      ...initiative,
      {
        id: crypto.randomUUID(),
        name: newName.trim(),
        value: Number(newValue),
        condition: "bereit",
      },
    ].sort((x, y) => y.value - x.value);
    setInitiative(next);
    setNewName("");
    setNewValue(6);
    void save({ scene, subtitle, status, round, turn, initiative: next, log });
  }
  function addLog(e: React.FormEvent) {
    e.preventDefault();
    if (!logText.trim()) return;
    const next = [
      {
        id: crypto.randomUUID(),
        text: logText.trim(),
        time: new Date().toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      ...log,
    ];
    setLog(next);
    setLogText("");
    void save({ scene, subtitle, status, round, turn, initiative, log: next });
  }
  function nextTurn() {
    if (!initiative.length) return;
    const next = (turn + 1) % initiative.length;
    const nextRound = next === 0 ? round + 1 : round;
    setTurn(next);
    setRound(nextRound);
    void save({
      scene,
      subtitle,
      status,
      round: nextRound,
      turn: next,
      initiative,
      log,
    });
  }
  if (!existing && !a.gm)
    return (
      <Empty className="empty-night">
        <EmptyHeader>
          <Radio size={36} className="text-primary mb-3" />
          <EmptyTitle>Die nächste Sitzung ist noch nicht geöffnet.</EmptyTitle>
          <EmptyDescription>
            Noch keine Sitzung für dich geöffnet. Dein Charakter, private
            Notizen und bereits freigegebene Handouts bleiben erreichbar.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <div className="session-stack" data-compact={compact}>
      <SessionStage scene={String(initial.scene||"")} subtitle={String(initial.subtitle||"")} status={String(initial.status||"Bereit")} round={Number(initial.round||1)}/>
      {a.gm&&<div className="session-control"><Choice label="Sitzungsstatus" value={status} onChange={next=>{setStatus(next);void save({scene,subtitle,status:next,round,turn,initiative,log});}} options={["Bereit","Läuft","Pause","Abgeschlossen"].map(x=>[x,x] as [string,string])}/></div>}
      <SceneToolDrawer tools={[
        {id:'session-initiative',label:'Initiative',icon:Swords,content:<section className="panel initiative-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">KAMPF UND DRUCK</p>
              <h3>Initiative</h3>
            </div>
            <Swords size={23} className="text-primary" />
          </div>
          {initiative.length === 0 ? (
            <p className="muted">Noch keine Beteiligten eingetragen.</p>
          ) : (
            <div className="initiative-list">
              {initiative.map((x, i) => (
                <div
                  className={
                    i === turn ? "initiative-row active" : "initiative-row"
                  }
                  key={x.id}
                >
                  <span className="initiative-index">{i + 1}</span>
                  <span>
                    <strong>{x.name}</strong>
                    <small>{x.condition}</small>
                  </span>
                  <b>{x.value}</b>
                </div>
              ))}
            </div>
          )}
          {a.gm && (
            <form className="initiative-add" onSubmit={addInitiative}>
              <input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name oder NSC"
              />
              <input
                type="number"
                min="0"
                max="30"
                value={newValue}
                onChange={(e) => setNewValue(Number(e.target.value))}
              />
              <button className="button" disabled={saving}>
                <Plus size={15} /> Hinzufügen
              </button>
            </form>
          )}
          {a.gm && (
            <button
              className="button primary next-turn"
              disabled={!initiative.length || saving}
              onClick={nextTurn}
            >
              <Zap size={16} /> Nächster Zug
            </button>
          )}
        </section>},
        ...(a.gm ? [{id:'session-edit',label:'Szene bearbeiten',icon:Activity,content:<section className="panel scene-panel">
          {a.gm ? (
            <>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">SZENENSTEUERUNG</p>
                  <h3>Die Nacht dirigieren</h3>
                </div>
                <Activity size={23} className="text-primary" />
              </div>
              <div className="stack-form"><p role="status">{scene!==String(initial.scene||"")||subtitle!==String(initial.subtitle||"")?"Ungespeicherter Szenentext · noch nicht veröffentlicht":"Veröffentlichter Stand"}</p>

                <label className="field">
                  <span>Szene</span>
                  <input
                    value={scene}
                    onChange={(e) => {setScene(e.target.value);onDraftChange?.(e.target.value!==String(initial.scene||"")||subtitle!==String(initial.subtitle||""));}}
                    placeholder="z. B. Rückwärtsblutung"
                  />
                </label>
                <label className="field">
                  <span>Untertitel / Einsatz</span>
                  <textarea
                    rows={3}
                    value={subtitle}
                    onChange={(e) => {setSubtitle(e.target.value);onDraftChange?.(scene!==String(initial.scene||"")||e.target.value!==String(initial.subtitle||""));}}
                    placeholder="Was steht für die Charaktere auf dem Spiel?"
                  />
                </label>
                <button
                  className="button primary"
                  disabled={saving}
                  onClick={() => save(undefined,true)}
                >
                  <Save size={16} /> Für die Gruppe veröffentlichen
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="eyebrow">AKTUELLE SZENE</p>
              <h3>{scene || "Warte auf die Spielleitung"}</h3>
              <p className="muted">
                {subtitle ||
                  "Sobald eine Szene geöffnet wird, erscheint hier ihr Auftrag."}
              </p>
            </>
          )}
        </section>}] : []),
        {id:'session-log',label:'Protokoll',icon:Clock3,content:<section className="panel session-log">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">LIVE-PROTOKOLL</p>
            <h3>Ereignisse der Nacht</h3>
          </div>
          <Clock3 size={22} className="text-primary" />
        </div>
        {a.gm && (
          <form className="log-add" onSubmit={addLog}>
            <input
              required
              value={logText}
              onChange={(e) => setLogText(e.target.value)}
              placeholder="Kurze Notiz für den Tisch …"
            />
            <button className="button" disabled={saving}>
              Loggen
            </button>
          </form>
        )}
        {log.length === 0 ? (
          <p className="muted">Noch keine Ereignisse protokolliert.</p>
        ) : (
          <div className="session-log-list">
            {log.map((x) => (
              <div className="session-log-row" key={x.id}>
                <span className="log-time">{x.time}</span>
                <span>{x.text}</span>
              </div>
            ))}
          </div>
        )}
</section>},
      ]}/>

    </div>
  );
}
