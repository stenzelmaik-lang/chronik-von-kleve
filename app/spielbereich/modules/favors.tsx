"use client";
import { HeartHandshake } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { Entry } from "@/domain/legacy";

import { api } from "./api-client";
export function FavorPanel({
  entries,
  onRefresh,
}: {
  entries: Entry[];
  onRefresh: () => void;
}) {
  const existing = entries.find((e) => e.kind === "gefallen");
  const list = Array.isArray(existing?.body?.favors)
    ? existing.body.favors
    : [];
  const [npc, setNpc] = useState("");
  const [value, setValue] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!npc.trim()) return;
    setSaving(true);
    try {
      await api("/api/records", "POST", {
        id: existing?.id,
        version: existing?.version,
        kind: "gefallen",
        title: "Gefallen und Schulden",
        visibility: "private",
        body: {
          favors: [
            {
              id: crypto.randomUUID(),
              npc: npc.trim(),
              value: Number(value),
              note: note.trim(),
              status: "offen",
              date: new Date().toISOString().slice(0, 10),
            },
            ...list,
          ],
        },
      });
      setNpc("");
      setNote("");
      setValue(1);
      toast.success("Gefallen vermerkt");
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="feature-stack">
      <div className="favor-top">
        <section className="panel">
          <p className="eyebrow">SOZIALES LEDGER</p>
          <h2>Gefallen haben Gewicht</h2>
          <p className="muted">
            Ein positiver Wert bedeutet: Der NSC schuldet dir etwas. Ein
            negativer Wert bedeutet: Du stehst in seiner Schuld.
          </p>
          <form onSubmit={add} className="favor-form">
            <label className="field">
              <span>Kontakt / NSC</span>
              <input
                required
                value={npc}
                onChange={(e) => setNpc(e.target.value)}
                placeholder="z. B. Elara Bosch"
              />
            </label>
            <label className="field">
              <span>Token</span>
              <input
                type="number"
                min="-5"
                max="5"
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
              />
            </label>
            <label className="field wide">
              <span>Notiz</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Was wurde versprochen?"
              />
            </label>
            <button className="button primary wide" disabled={saving}>
              <HeartHandshake size={17} /> Gefallen speichern
            </button>
          </form>
        </section>
        <section className="panel favor-legend">
          <h3>Token-Lesart</h3>
          <div>
            <span className="token positive">+1</span>
            <p>Der Kontakt schuldet dir einen Gefallen.</p>
          </div>
          <div>
            <span className="token negative">−1</span>
            <p>Du schuldest dem Kontakt einen Gefallen.</p>
          </div>
          <div>
            <span className="token neutral">0</span>
            <p>Ausgeglichen oder eingelöst.</p>
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h3>Offene Gefallen</h3>
          <span className="badge">
            {list.filter((x) => x.value !== 0).length} aktiv
          </span>
        </div>
        {list.length === 0 ? (
          <p className="muted">Noch keine Gefallen eingetragen.</p>
        ) : (
          <div className="favor-list">
            {list.map((f) => (
              <div className="favor-row" key={f.id}>
                <span
                  className={`token ${f.value > 0 ? "positive" : f.value < 0 ? "negative" : "neutral"}`}
                >
                  {f.value > 0 ? "+" : ""}
                  {f.value}
                </span>
                <span>
                  <strong>{f.npc}</strong>
                  <small>
                    {f.note || "Ohne Notiz"} · {f.date}
                  </small>
                </span>
                <em>{f.status}</em>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
