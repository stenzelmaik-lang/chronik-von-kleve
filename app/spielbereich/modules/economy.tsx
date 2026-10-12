"use client";
import { ChevronRight, Coins, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { Entry, Transaction } from "@/domain/legacy";

import { api } from "./api-client";
export function EconomyPanel({
  entries,
  onRefresh,
}: {
  entries: Entry[];
  onRefresh: () => void;
}) {
  const existing = entries.find((e) => e.kind === "wirtschaft");
  const initial = existing?.body || {};
  const [money, setMoney] = useState(
    Number(initial.money_euro ?? initial.money ?? 0),
  );
  const [resources, setResources] = useState(Number(initial.resources ?? 1));
  const [successes, setSuccesses] = useState(
    Number(initial.finances_successes ?? 0),
  );
  const [tx, setTx] = useState<Transaction[]>(
    Array.isArray(initial.transactions) ? initial.transactions : [],
  );
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const income = resources * 600 + successes * 100;
  async function save(
    next = {
      money_euro: money,
      resources,
      finances_successes: successes,
      transactions: tx,
    },
  ) {
    setSaving(true);
    try {
      await api("/api/records", "POST", {
        id: existing?.id,
        version: existing?.version,
        kind: "wirtschaft",
        title: "Finanzprofil",
        visibility: "private",
        body: next,
      });
      toast.success("Finanzprofil gespeichert");
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function addTx(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!desc.trim() || !Number.isFinite(n) || n === 0) return;
    const nextMoney = money + n;
    const nextTx = [
      {
        id: crypto.randomUUID(),
        description: desc.trim(),
        amount: n,
        date: new Date().toISOString().slice(0, 10),
      },
      ...tx,
    ];
    setMoney(nextMoney);
    setTx(nextTx);
    setDesc("");
    setAmount(0);
    await save({
      money_euro: nextMoney,
      resources,
      finances_successes: successes,
      transactions: nextTx,
    });
  }
  return (
    <div className="feature-stack">
      <div className="economy-hero">
        <div>
          <p className="eyebrow">BANK UND LEDGER</p>
          <h2>{initial.money_euro !== undefined || initial.money !== undefined ? `${money.toLocaleString("de-DE")} €` : "Vermögen nicht erfasst"}</h2>
          <p className="muted">Private Wirtschaft · Eingaben werden erst beim Speichern übernommen</p>
        </div>
        <div className="economy-income">
          <span>Vorschau monatlicher Zufluss</span>
          <strong>+{income.toLocaleString("de-DE")} €</strong>
          <small>
            Ressourcen {resources} · Finanzproben {successes}
          </small>
        </div>
      </div>
      <div className="feature-grid three">
        <section className="panel">
          <h3>Ressourcen</h3>
          <p className="muted">
            Der Hintergrund bestimmt deinen monatlichen Spielraum. Fehlende Werte sind nur ungespeicherte Eingabevorschläge.
          </p>
          <input
            className="range-input"
            aria-label="Ressourcen"
            type="range"
            min="0"
            max="5"
            value={resources}
            onChange={(e) => setResources(Number(e.target.value))}
          />
          <div className="range-labels">
            <span>0</span>
            <b>{resources}</b>
            <span>5</span>
          </div>
          <label className="field">
            <span>Erfolge der letzten Finanzprobe</span>
            <input
              type="number"
              min="0"
              max="10"
              value={successes}
              onChange={(e) => setSuccesses(Number(e.target.value))}
            />
          </label>
          <button
            className="button primary"
            disabled={saving}
            onClick={() => save()}
          >
            <Save size={16} /> Werte speichern
          </button>
        </section>
        <section className="panel">
          <h3>Neue Buchung</h3>
          <p className="muted">
            Positive Beträge sind Einnahmen, negative Beträge Ausgaben.
          </p>
          <form onSubmit={addTx} className="stack-form">
            <label className="field">
              <span>Beschreibung</span>
              <input
                required
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="z. B. Ausrüstung Rost"
              />
            </label>
            <label className="field">
              <span>Betrag in Euro</span>
              <input
                required
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </label>
            <button className="button" disabled={saving || !desc.trim()}>
              Buchung speichern
            </button>
          </form>
        </section>
        <section className="panel">
          <h3>Schulden</h3>
          <div className="debt-list">
            <div>
              <span>„Rost“</span>
              <strong>
                {initial.debt_rost !== undefined ? `${Number(initial.debt_rost).toLocaleString("de-DE")} €` : "Nicht erfasst"}
              </strong>
            </div>
            <div>
              <span>Der Kurator</span>
              <strong>
                {initial.debt_kurator !== undefined ? `${Number(initial.debt_kurator).toLocaleString("de-DE")} €` : "Nicht erfasst"}
              </strong>
            </div>
          </div>
          <p className="muted">
            Schulden kannst du in den Gefallen vermerken und mit der
            Spielleitung klären.
          </p>
          <a className="button" href="/spielbereich?bereich=gefallen">
            Zu den Gefallen <ChevronRight size={16} />
          </a>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Transaktionschronik</h3>
            <p className="muted">Alle Buchungen deines Charakters.</p>
          </div>
          <Coins size={24} className="text-primary" />
        </div>
        {tx.length === 0 ? (
          <p className="muted">Noch keine Buchungen.</p>
        ) : (
          <div className="transaction-list">
            {tx.map((t) => (
              <div
                className="transaction-row"
                key={t.id || t.date + t.description}
              >
                <span>
                  <strong>{t.description}</strong>
                  <small>{t.date}</small>
                </span>
                <b className={Number(t.amount) >= 0 ? "positive" : "negative"}>
                  {Number(t.amount) >= 0 ? "+" : ""}
                  {Number(t.amount).toLocaleString("de-DE")} €
                </b>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
