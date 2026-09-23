"use client";
import { useEffect, useState } from "react";
import { api } from "./api-client";
import { Choice } from "./shared";
import {
  knowledgeStateSchema,
  type Actor,
  type KnowledgeState,
} from "@/domain/types";
type Grant = {
  id: string;
  audience: "group" | "player";
  subject_id: string;
  state: KnowledgeState;
};
export function KnowledgeGrants({ entityId }: { entityId: string }) {
  const [members, setMembers] = useState<Actor[]>([]),
    [grants, setGrants] = useState<Grant[]>([]);
  const [audience, setAudience] = useState("group"),
    [player, setPlayer] = useState(""),
    [state, setState] = useState<KnowledgeState>("DISCOVERED");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all([
      api("/api/members"),
      api<{ knowledge: Grant[] }>(
        "/api/knowledge?entityId=" + encodeURIComponent(entityId),
      ),
    ])
      .then(([m, k]) => {
        if (alive) {
          setMembers(m.members.filter((p) => p.status === "active"));
          setGrants(k.knowledge);
          setLoaded(true);
        }
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [entityId]);
  async function grant() {
    setBusy(true);
    setError("");
    try {
      await api("/api/knowledge", "POST", {
        entityId,
        audience,
        playerId: audience === "player" ? player : undefined,
        state,
      });
      setGrants(
        (
          await api<{ knowledge: Grant[] }>(
            "/api/knowledge?entityId=" + encodeURIComponent(entityId),
          )
        ).knowledge,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel wide gm-field">
      <h3>Wissen freigeben</h3>
      <p className="muted">
        Die Freigabe gilt für den Lesetext. Der Spielleitertext bleibt
        geschützt. UNKNOWN hebt diese einzelne Freigabe auf; Gruppenfreigaben
        und die Sichtbarkeit „Gesamte Spielgruppe“ gelten weiterhin.
      </p>
      <div className="form-grid">
        <Choice
          label="Empfänger"
          value={audience}
          onChange={setAudience}
          options={[
            ["group", "Aktive Spielgruppe"],
            ["player", "Einzelner Spieler"],
          ]}
        />
        {audience === "player" && (
          <Choice
            label="Spieler"
            value={player}
            onChange={setPlayer}
            options={members.map((m) => [m.id, m.name])}
          />
        )}
        <Choice
          label="Wissensstand"
          value={state}
          onChange={(s) => setState(s as KnowledgeState)}
          options={knowledgeStateSchema.options.map((s) => [s, s])}
        />
      </div>
      <button
        type="button"
        className="button"
        disabled={!loaded || busy || (audience === "player" && !player)}
        onClick={grant}
      >
        {busy ? "Wird gespeichert …" : "Freigabe speichern"}
      </button>
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      <ul>
        {grants.map((g) => (
          <li key={g.id}>
            {g.audience === "group"
              ? "Spielgruppe"
              : members.find((m) => m.id === g.subject_id)?.name || "Spieler"}
            : {g.state}
          </li>
        ))}
      </ul>
    </section>
  );
}
