"use client";
import { Search, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { Entry } from "@/domain/legacy";

import { api } from "./api-client";
export const merchants = [
  {
    id: "rost",
    name: "„Rost“",
    role: "Der Waffenschmied",
    icon: "⚔️",
    tone: "Tausch und Schutz",
    items: [
      ["Gebrauchte Pistole", 900, "Feuerwaffe · diskret"],
      ["Schutzweste", 650, "Panzerung · unauffällig"],
      ["Dietrich-Set", 240, "Werkzeug · 5-teilig"],
      ["Motorrad „Nachtwind“", 3200, "Fahrzeug · gebraucht"],
    ],
  },
  {
    id: "kurator",
    name: "Der Kurator",
    role: "Alchemist und Sammler",
    icon: "🔮",
    tone: "Einzigartiges und Dienste",
    items: [
      ["Abhörwanze Ghost-Tech", 1500, "48 h Akku · schwer zu orten"],
      ["Störsender", 2000, "Elektronik · 20 m Radius"],
      ["Blutkonserve", 180, "Verbrauch · diskret"],
      ["Altes Siegel", 800, "Okkultes Objekt · Herkunft unklar"],
    ],
  },
] as const;

export function MerchantPanel({
  onRefresh,
}: {
  entries: Entry[];
  onRefresh: () => void;
}) {
  const [dealer, setDealer] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const current = merchants.find((m) => m.id === dealer);
  const items =
    current?.items.filter(
      (i) =>
        i[0].toLowerCase().includes(query.toLowerCase()) ||
        i[2].toLowerCase().includes(query.toLowerCase()),
    ) || [];
  async function buy(item: readonly [string, number, string]) {
    setSaving(true);
    try {
      const economy = await api("/api/records?kind=wirtschaft");
      const e = (economy.records || []).find(
        (x: Entry) => x.kind === "wirtschaft",
      );
      const b = e?.body || {};
      const tx = Array.isArray(b.transactions) ? b.transactions : [];
      const nextMoney = Number(b.money_euro ?? 0) - item[1];
      const nextTx = [
        {
          id: crypto.randomUUID(),
          description: `${current?.name}: ${item[0]}`,
          amount: -item[1],
          date: new Date().toISOString().slice(0, 10),
        },
        ...tx,
      ];
      await api("/api/records", "POST", {
        id: e?.id,
        version: e?.version,
        kind: "wirtschaft",
        title: "Finanzprofil",
        visibility: "private",
        body: { ...b, money_euro: nextMoney, transactions: nextTx },
      });
      await api("/api/records", "POST", {
        kind: "inventar",
        title: item[0],
        visibility: "private",
        body: {
          category: "Ausrüstung",
          merchant: current?.name,
          price: item[1],
          description: item[2],
          quantity: 1,
        },
      });
      toast.success(`${item[0]} wurde ins Inventar gelegt`);
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  if (!current)
    return (
      <div className="feature-stack">
        <section className="panel merchant-intro">
          <p className="eyebrow">DIE KONTAKTE</p>
          <h2>Wähle deinen Händler</h2>
          <p className="muted">
            Die Angebote stammen aus dem Händler-Ledger. Jeder Kontakt bevorzugt
            eine andere Währung: Euro, Tausch oder Gefallen.
          </p>
          <div className="merchant-cards">
            {merchants.map((m) => (
              <button
                type="button"
                className="merchant-card"
                key={m.id}
                onClick={() => setDealer(m.id)}
              >
                <span className="merchant-icon">{m.icon}</span>
                <strong>{m.name}</strong>
                <span>{m.role}</span>
                <small>{m.tone}</small>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  return (
    <div className="feature-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">HÄNDLER-LEDGER</p>
            <h2>
              {current.icon} {current.name}
            </h2>
            <p className="muted">
              {current.role} · {current.tone}
            </p>
          </div>
          <button className="button" onClick={() => setDealer(null)}>
            ← Händler wechseln
          </button>
        </div>
        <div className="search-row">
          <Search size={18} />
          <input
            aria-label="Angebote durchsuchen"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Angebote durchsuchen …"
          />
          <span>{items.length} Angebote</span>
        </div>
        <div className="merchant-items">
          {items.map((item) => (
            <article className="merchant-item" key={item[0]}>
              <div>
                <span className="badge">{item[2].split(" · ")[0]}</span>
                <h3>{item[0]}</h3>
                <p className="muted">{item[2]}</p>
              </div>
              <div className="merchant-price">
                <strong>{item[1].toLocaleString("de-DE")} €</strong>
                <button
                  className="button primary"
                  disabled={saving}
                  onClick={() => buy(item)}
                >
                  <ShoppingBag size={15} /> Kaufen
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
