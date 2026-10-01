"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
type LoginResponse = { error?: string };
export default function AuthForm() { const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      // Platform failures can return an HTML error page instead of API JSON.
      // Always release the form; never show the raw upstream response.
      if (!res.headers.get("content-type")?.includes("application/json")) {
        setError("Die Anmeldung ist momentan technisch nicht verfügbar. Bitte später erneut versuchen.");
        return;
      }
      const body = await res.json() as LoginResponse;
      if (!res.ok) return setError(body.error ?? "Anmeldung nicht möglich.");
      router.push("/spielbereich");
      router.refresh();
    } catch {
      setError("Die Anmeldung konnte nicht abgeschlossen werden. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }
  return <form method="post" onSubmit={submit} className="auth-form"><label>E-Mail<input name="email" type="email" autoComplete="username" required /></label><label>Passwort<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p role="alert" className="auth-error">{error}</p>}<button disabled={busy}>{busy ? "Bitte warten…" : "Anmelden"}</button><p className="auth-hint">Der Zugang ist geschlossen. Nur bereits eingerichtete und mit einem Spielmitglied verknüpfte Konten können sich anmelden.</p><p><a href="/passwort-zuruecksetzen">Passwort vergessen?</a></p></form>;
}
