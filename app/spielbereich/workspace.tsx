/* eslint-disable @next/next/no-img-element -- Private authenticated R2 URLs and original legacy assets are served directly; no public image optimizer cache. */
"use client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Feather,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { Entry } from "@/domain/legacy";
import type { Actor } from "@/domain/types";

import { api } from "./modules/api-client";
import { ChroniclePanel } from "./modules/chronicle";
import { CMSPanel } from "./modules/cms";
import { DashboardPanel } from "./modules/dashboard";
import { DicePanel } from "./modules/dice";
import { EconomyPanel } from "./modules/economy";
import { FavorPanel } from "./modules/favors";
import { MerchantPanel } from "./modules/merchant";
import { personal, sections } from "./modules/navigation";
import { RecordEditor } from "./modules/record-editor";
import { SessionPanel } from "./modules/session";
import { Choice, safeImage, visibilityNames } from "./modules/shared";
import { CharacterDetail } from "./modules/character-detail";
import { InventoryPanel } from "./modules/inventory";
import { WorkspaceShell } from "./modules/shell";
import { useNavigation } from "./modules/use-navigation";
import { useWorkspaceData } from "./modules/use-workspace-data";
import { WorldExperience } from "./modules/world-experience";
import {
  activatePlayerDataScope,
  clearPlayerDataScope,
  describeDataError,
  invalidatePlayerData,
} from "./modules/player-data-cache";
export default function Workspace({
  actor: a,
  initialSection = "dashboard",
}: {
  actor: Actor;
  initialSection?: string;
}) {
  const [search, setSearch] = useState(""),
    [edit, setEdit] = useState<Entry | null>(null),
    [saving, setSaving] = useState(false),
    [formError, setFormError] = useState(""),
    [remove, setRemove] = useState<{
      id: string;
      version?: number;
      file?: boolean;
    } | null>(null),
    [upload, setUpload] = useState<File | null>(null),
    [uploadVisibility, setUploadVisibility] = useState("private");
  const uploadInput = useRef<HTMLInputElement>(null),
    active = a.status === "active";
  const dataScope = `${a.campaignId}:${a.id}:${a.gm ? "gm" : "player"}`;
  const [selection, setSelection] = useState<{ scope: string; id: string | null }>({ scope: dataScope, id: null });
  const activeCharacterId = selection.scope === dataScope ? selection.id : null;
  const setActiveCharacterId = useCallback((id: string | null) => setSelection({ scope: dataScope, id }), [dataScope]);
  useEffect(() => {
    activatePlayerDataScope(dataScope);
    const clear = () => clearPlayerDataScope(dataScope);
    window.addEventListener("pagehide", clear);
    return () => {
      window.removeEventListener("pagehide", clear);
      clear();
    };
  }, [dataScope]);
  const resetEditor = useCallback(() => {
    setSearch("");
    setEdit(null);
  }, []);
  const { section, navigate } = useNavigation(
    a.gm,
    initialSection,
    resetEditor,
  );
  const { entries, files, members, catalog, loading, refreshing, hasData, error, reload } =
    useWorkspaceData(section, active, dataScope);
  const current = sections.find((s) => s.id === section) || {
    id: "verwaltung",
    name: "Spielleitung",
    desc: "Mitglieder freigeben und die Chronik übernehmen.",
    icon: Shield,
  };
  const worldExperienceActive = section === "schauplaetze" || section === "weltkarte";
  function create(kind = section) {
    setFormError("");
    const body =
      kind === "charaktere"
        ? { attributes: {}, skills: {}, virtues: {}, health: {} }
        : { text: "" };
    setEdit({
      kind,
      title: "",
      visibility:
        kind === "charaktere"
          ? "private"
          : personal.includes(kind)
            ? "private"
            : "sl",
      body,
      canEdit: true,
    });
  }
  async function save() {
    if (!edit) return;
    const savedKind = edit.kind;
    const savedId = edit.id;
    setSaving(true);
    setFormError("");
    try {
      await api("/api/records", "POST", edit);
      invalidatePlayerData(dataScope, "/api/dashboard");
      if (savedKind === "charaktere")
        invalidatePlayerData(dataScope, "/api/records?kind=charaktere");
      if (savedKind === "charaktere" && savedId)
        invalidatePlayerData(dataScope, `/api/character-detail?id=${encodeURIComponent(savedId)}`);
      setEdit(null);
      toast.success("Gespeichert");
      await reload();
    } catch (e) {
      setFormError((e as Error).message);
      if (describeDataError(e).permission) await reload();
    } finally {
      setSaving(false);
    }
  }
  async function destroy() {
    if (!remove) return;
    const removedId = remove.id;
    const removedCharacter = edit?.kind === "charaktere";
    setSaving(true);
    try {
      await api(remove.file ? "/api/files" : "/api/records", "DELETE", remove);
      invalidatePlayerData(dataScope, "/api/dashboard");
      invalidatePlayerData(dataScope, "/api/records?kind=charaktere");
      if (removedCharacter) {
        invalidatePlayerData(dataScope, `/api/character-detail?id=${encodeURIComponent(removedId)}`);
        if (activeCharacterId === removedId) setActiveCharacterId(null);
      }
      setRemove(null);
      setEdit(null);
      toast.success("Gelöscht");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
      if (describeDataError(e).permission) await reload();
    } finally {
      setSaving(false);
    }
  }
  async function uploadFile() {
    if (!upload) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.set("file", upload);
      form.set("visibility", uploadVisibility);
      await api("/api/files", "POST", form);
      setUpload(null);
      if (uploadInput.current) uploadInput.current.value = "";
      toast.success("Datei gespeichert");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const list = entries.filter((e) =>
    (e.title + " " + JSON.stringify(e.body))
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  if (!active)
    return (
      <main className="shell">
        <header className="masthead">
          <Link href="/" className="brand">
            CVK
          </Link>
          <a
            className="button"
            href="/signout-with-chatgpt?return_to=/"
            target="_top"
          >
            Abmelden
          </a>
        </header>
        <section className="waiting">
          <Shield size={40} />
          <p className="eyebrow">ZUGANG ZUR DOMÄNE</p>
          <h1>
            {a.status === "blocked"
              ? "Dein Zugang ist gesperrt."
              : "Deine Anmeldung ist angekommen."}
          </h1>
          <p>
            {a.name}, die Spielleitung muss deinen Zugang freigeben, bevor du
            die Chronik und deinen persönlichen Bereich nutzen kannst.
          </p>
          <a className="button primary" href="/spielbereich">
            Freigabe erneut prüfen
          </a>
        </section>
      </main>
    );
  return (
    <WorkspaceShell a={a} section={section} navigate={navigate}>
      {!worldExperienceActive && section !== "inventar" && <div className="section-title">
        <div>
          <p className="eyebrow">
            {a.gm ? "DIE CHRONIK IN DEINER HAND" : "DEIN ORT IN DER NACHT"}
          </p>
          <h1>{current.name}</h1>
          <p className="muted">{current.desc}</p>
        </div>
        {![
          "dashboard",
          "cms",
          "sitzung",
          "galerie",
          "verwaltung",
          "wuerfel",
          "weltkarte",
          "wirtschaft",
          "haendler",
          "gefallen",
          "inventar",
        ].includes(section) &&
          (a.gm || personal.includes(section)) && (
            <button className="button primary" onClick={() => create()}>
              <Plus size={18} />{" "}
              {section === "charaktere"
                ? "Charakter erstellen"
                : "Eintrag erstellen"}
            </button>
          )}
      </div>}
      {!worldExperienceActive && refreshing && <p className="muted" role="status">Wird aktualisiert …</p>}
      {!worldExperienceActive && error && hasData && (
        <div role="alert" className="error-box">
          <strong>{describeDataError(error).title}</strong>
          <p>{error.message}</p>
          <button className="button" onClick={reload}>Erneut versuchen</button>
        </div>
      )}
      {worldExperienceActive ? (
        <WorldExperience a={a} dataScope={dataScope} />
      ) : loading ? (
        <div className="entry-grid">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : error && !hasData ? (
        <section role="alert" className="panel">
          <h2>{describeDataError(error).title}</h2>
          <p className="muted">{error.message}</p>
          <button className="button" onClick={reload}>Erneut versuchen</button>
        </section>
      ) : section === "charaktere" ? (
        <CharacterDetail key={dataScope} entries={entries} dataScope={dataScope} activeCharacterId={activeCharacterId} onActiveCharacterChange={setActiveCharacterId} onCreate={() => create()} onEdit={(r) => setEdit(structuredClone(r))} onRefresh={reload} />
      ) : section === "inventar" ? (
        <InventoryPanel key={dataScope} dataScope={dataScope} activeCharacterId={activeCharacterId} onActiveCharacterChange={setActiveCharacterId} />
      ) : section === "verwaltung" ? (
        <div className="admin-stack">
          <section className="panel">
            <h2>Bestehende Chronik übernehmen</h2>
            <p>
              {catalog.imported} von {catalog.available} vorbereiteten Einträgen
              sind übernommen.
            </p>
            <p className="muted">
              Übernommene Inhalte sind zunächst nur für die Spielleitung
              sichtbar. Der separate Spielleitertext bleibt geschützt.
            </p>
            <button
              disabled={saving || catalog.imported >= catalog.available}
              className="button primary"
              onClick={async () => {
                setSaving(true);
                try {
                  const d = await api("/api/catalog", "POST", {});
                  toast.success(`${d.imported} Einträge übernommen`);
                  await reload();
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              {catalog.imported >= catalog.available
                ? "Chronik übernommen"
                : "Chronik jetzt übernehmen"}
            </button>
          </section>
          <section className="panel">
            <h2>Zugang zur Spielgruppe</h2>
            <p className="muted">
              Deine Freunde öffnen den Link und melden sich mit ChatGPT an. Hier
              kannst du ihren Zugang freigeben oder sperren.
            </p>
            {members.map((m) => (
              <div className="member-row" key={m.id}>
                <div>
                  <strong>{m.name}</strong>
                  <p className="muted">{m.email}</p>
                  <span className="badge">
                    {m.id === a.id
                      ? "Spielleitung"
                      : m.status === "active"
                        ? "Freigegeben"
                        : m.status === "blocked"
                          ? "Gesperrt"
                          : "Wartet auf Freigabe"}
                  </span>
                </div>
                {m.id !== a.id && (
                  <button
                    disabled={saving}
                    className="button"
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await api("/api/members", "POST", {
                          id: m.id,
                          status: m.status === "active" ? "blocked" : "active",
                          expectedVersion: m.version,
                        });
                        await reload();
                      } catch (e) {
                        toast.error((e as Error).message);
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    {m.status === "active" ? "Zugang sperren" : "Freigeben"}
                  </button>
                )}
              </div>
            ))}
            <button className="button mt-4" onClick={reload}>
              <RefreshCw size={16} /> Anmeldungen aktualisieren
            </button>
          </section>
          <section className="panel">
            <h2>Material aus deinem Drive</h2>
            <p>
              Die Spielwelt, Händlerlisten, Orte und der Charakterbogen stammen
              aus deiner CVK-LIVE-Ablage. Weitere Dokumente können jederzeit als
              Handout in der Galerie ergänzt werden.
            </p>
          </section>
        </div>
      ) : section === "cms" ? (
        <CMSPanel
          a={a}
          onNavigate={navigate}
          onOpen={(e) => {
            setFormError("");
            setEdit(structuredClone(e));
          }}
          onCreate={(kind) => create(kind)}
        />
      ) : section === "dashboard" ? (
        <DashboardPanel key={dataScope} a={a} onNavigate={navigate} dataScope={dataScope} activeCharacterId={activeCharacterId} onActiveCharacterChange={setActiveCharacterId} />
      ) : section === "chronik" ? (
        <ChroniclePanel
          entries={entries}
          onOpen={(e) => {
            setFormError("");
            setEdit(structuredClone(e));
          }}
        />
      ) : section === "galerie" ? (
        <>
          <section className="panel upload-panel">
            <label className="field">
              <span>Bild oder PDF auswählen · maximal 10 MB</span>
              <input
                ref={uploadInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setUpload(e.target.files?.[0] || null)}
              />
            </label>
            <Choice
              label="Wer darf die Datei sehen?"
              value={uploadVisibility}
              onChange={setUploadVisibility}
              options={Object.entries(visibilityNames)}
            />
            <button
              className="button primary"
              disabled={!upload || saving}
              onClick={uploadFile}
            >
              {saving ? "Wird gespeichert …" : "Hochladen"}
            </button>
          </section>
          {files.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Noch keine Dateien</EmptyTitle>
                <EmptyDescription>
                  Lade dein erstes Charakterbild oder Handout hoch.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="entry-grid">
              {files.map((f) => (
                <article className="entry-card" key={f.id}>
                  {f.mime.startsWith("image/") ? (
                    <img
                      className="card-image"
                      src={"/api/files?id=" + f.id}
                      alt={f.name}
                    />
                  ) : (
                    <div className="file-icon">
                      <ScrollText size={48} />
                    </div>
                  )}
                  <div className="card-body">
                    <span className="badge">
                      {visibilityNames[f.visibility]}
                    </span>
                    <h2>{f.name}</h2>
                    <p className="muted">
                      {(f.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <a
                      className="button"
                      href={"/api/files?id=" + f.id}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Öffnen
                    </a>
                    {f.owner_id === a.id && (
                      <button
                        className="danger-link"
                        onClick={() => setRemove({ id: f.id, file: true })}
                      >
                        Löschen
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : section === "wuerfel" ? (
        <DicePanel />
      ) : section === "sitzung" ? (
        <SessionPanel entries={entries} a={a} onRefresh={reload} />
      ) : section === "wirtschaft" ? (
        <EconomyPanel entries={entries} onRefresh={reload} />
      ) : section === "haendler" ? (
        <MerchantPanel entries={entries} onRefresh={reload} />
      ) : section === "gefallen" ? (
        <FavorPanel entries={entries} onRefresh={reload} />
      ) : (
        <>
          <div className="search-row">
            <Search size={18} />
            <input
              aria-label="Einträge durchsuchen"
              placeholder={`${current.name} durchsuchen …`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span>{list.length} Einträge</span>
          </div>
          {list.length === 0 ? (
            <Empty className="empty-night">
              <EmptyHeader>
                <Feather size={34} className="text-primary mb-3" />
                <EmptyTitle>
                  {search
                    ? "Keine passenden Einträge"
                    : "Hier beginnt die nächste Geschichte."}
                </EmptyTitle>
                <EmptyDescription>
                  {search
                    ? "Versuche einen anderen Suchbegriff."
                    : a.gm && !personal.includes(section)
                      ? "Erstelle einen Eintrag oder übernimm die bestehende Chronik im Spielleiterbereich."
                      : personal.includes(section)
                        ? "Lege deinen ersten Eintrag an. Du entscheidest, wer ihn sehen darf."
                        : "Die Spielleitung hat hier noch keine Inhalte freigegeben."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="entry-grid">
              {list.map((r) => (
                <button
                  key={r.id}
                  className="entry-card text-left"
                  onClick={() => {
                    setFormError("");
                    setEdit(structuredClone(r));
                  }}
                >
                  {safeImage(r.body.image) && (
                    <img
                      className="card-image"
                      src={safeImage(r.body.image)}
                      alt=""
                      loading="lazy"
                    />
                  )}
                  <div className="card-body">
                    <span className="badge">
                      {visibilityNames[r.visibility]}
                    </span>
                    {r.body.date && (
                      <span className="date-label">{String(r.body.date)}</span>
                    )}
                    <h2>{r.title}</h2>
                    <p className="muted card-summary">
                      {r.kind === "charaktere"
                        ? [r.body.clan, r.body.concept]
                            .filter(Boolean)
                            .join(" · ")
                        : r.body.summary ||
                          r.body.text?.slice(0, 155) ||
                          "Eintrag öffnen"}
                    </p>
                    {r.kind === "charaktere" && (
                      <div className="character-stats">
                        <span>
                          Menschlichkeit <b>{r.body.humanity ?? "–"}</b>
                        </span>
                        <span>
                          Willenskraft <b>{r.body.willpower ?? "–"}</b>
                        </span>
                      </div>
                    )}
                    <span className="card-link">
                      {r.canEdit ? "Öffnen & bearbeiten" : "Lesen"} ↗
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <RecordEditor
        edit={edit}
        setEdit={setEdit}
        a={a}
        saving={saving}
        formError={formError}
        save={save}
        setRemove={setRemove}
      />
      <AlertDialog
        open={!!remove}
        onOpenChange={(open) => {
          if (!open && !saving) setRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser {remove?.file ? "Upload" : "Eintrag"} wird dauerhaft
              gelöscht. Das lässt sich nicht rückgängig machen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void destroy();
              }}
            >
              {saving ? "Wird gelöscht …" : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkspaceShell>
  );
}




