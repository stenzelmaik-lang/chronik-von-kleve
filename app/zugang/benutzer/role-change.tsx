"use client";

import { useState } from "react";

export function RoleChange({ accountId, campaignId, role, version }: {
  accountId: string; campaignId: string; role: "player" | "campaign_gm"; version: number;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const next = role === "player" ? "campaign_gm" : "player";
  const label = role === "player" ? "Kampagnenrolle auf SL ändern" : "Kampagnenrolle auf Spieler ändern";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/alpha/campaign-roles", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, campaignId, role: next, expectedVersion: version, reason }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Rollenänderung fehlgeschlagen.");
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rollenänderung fehlgeschlagen.");
      setBusy(false);
    }
  }
  return <details><summary>{label}</summary><form onSubmit={submit}>
    <label>Begründung <input required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label>
    <button type="submit" disabled={busy || !reason.trim()}>{busy ? "Speichern …" : label}</button>
    {error && <p role="alert">{error}</p>}
  </form></details>;
}
