"use client";
import {MediaLibrary} from "./modules/media-library";
import {PlayerArchive} from "./modules/player-archive";
import {MaterialPreparation} from "./modules/material-preparation";
/* eslint-disable @next/next/no-img-element -- Private authenticated R2 URLs and original legacy assets are served directly; no public image optimizer cache. */

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
  Search,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { Entry } from "@/domain/legacy";
import type { Actor } from "@/domain/types";
import { withCreationBaseValues } from "@/domain/character-engine";

import { api } from "./modules/api-client";
import { ChroniclePanel } from "./modules/chronicle";
import { CMSPanel } from "./modules/cms";
import { LocationCMS } from "./modules/location-cms";
import {SessionRecap} from "./modules/session-recap";
import { DashboardPanel } from "./modules/dashboard";
import { EngagementActivity } from './modules/engagement-activity';
import { AppointmentsPanel } from "./modules/appointments";
import { DicePanel } from "./modules/dice";
import { EconomyPanel } from "./modules/economy";
import { FavorPanel } from "./modules/favors";
import { MerchantPanel } from "./modules/merchant";
import { personal, sections } from "./modules/navigation";
import { RecordEditor } from "./modules/record-editor";
import { CommandCenter } from "./modules/command-center";
import { safeImage, visibilityNames } from "./modules/shared";
import { PlayerCharacterManagement } from "./modules/player-character-management";
import { CharacterDetail } from "./modules/character-detail";
import { NPCPanel } from "./modules/npc-panel";
import { CodexPanel } from "./modules/codex-panel";
import { InventoryPanel } from "./modules/inventory";
import { SLWorkspaceShell } from "./modules/sl-workspace-shell";
import { WorkspaceShell } from "./modules/shell";
import { useNavigation } from "./modules/use-navigation";
import { useWorkspaceData } from "./modules/use-workspace-data";
import { WorldExperience } from "./modules/world-experience";
import { PlayerGallery } from "./modules/player-gallery";
import { RecapDesk } from "./modules/recap-desk";
import {
  activatePlayerDataScope,
  clearPlayerDataScope,
  describeDataError,
  invalidatePlayerData,
} from "./modules/player-data-cache";
export default function Workspace({
  actor: a,
  initialSection = "dashboard",
  initialCharacterId,
  engagementAvailable = false,
  surface = "player",
}: {
  actor: Actor;
  surface?: "player" | "sl";
  initialSection?: string;
  initialCharacterId?: string;
  engagementAvailable?: boolean;
}) {
  const [preparationDirty,setPreparationDirty]=useState(false);
  const [search, setSearch] = useState(""),
    [edit, setEdit] = useState<Entry | null>(null),
    [saving, setSaving] = useState(false),
    [formError, setFormError] = useState(""),
    [remove, setRemove] = useState<{
      id: string;
      version?: number;
      file?: boolean;
    } | null>(null);
  const active = a.status === "active";
  const dataScope = `${a.campaignId}:${a.id}:${a.gm ? "gm" : "player"}:${surface}`;
  const [selection, setSelection] = useState<{ scope: string; id: string | null }>({ scope: dataScope, id: initialCharacterId || null });
  const activeCharacterId = selection.scope === dataScope ? selection.id : null;
  const [selectionError,setSelectionError]=useState('');
  const selectionQueue=useRef<Promise<void>>(Promise.resolve()),selectionVersion=useRef(0);
  const setActiveCharacterId = useCallback((id: string | null) => {
    const version=++selectionVersion.current;
    selectionQueue.current=selectionQueue.current.catch(()=>{}).then(async()=>{
      try{
        if(surface!=='sl')await api('/api/character-selection','PATCH',{characterId:id});
        if(version!==selectionVersion.current)return;
        invalidatePlayerData(dataScope);
        setSelection({scope:dataScope,id});setSelectionError('');
        const url=new URL(window.location.href);if(id)url.searchParams.set('character',id);else url.searchParams.delete('character');
        if(url.href!==window.location.href)history.replaceState(null,'',url);
      }catch(e){if(version===selectionVersion.current)setSelectionError((e as Error).message);}
    });
  }, [dataScope,surface]);
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
    surface === "sl" && a.gm,
    initialSection,
    resetEditor,
    surface === "sl" && a.status === "active" && ["campaign_owner", "campaign_gm", "campaign_editor"].includes(a.role),
  );
  const { entries, files, members, catalog, loading, refreshing, hasData, error, reload } =
    useWorkspaceData(section, active, dataScope, surface === "sl");
  const pendingCharacterSelection = useRef<string | null>(null);
  useEffect(() => {
    const id = pendingCharacterSelection.current;
    if (id && entries.some(entry => entry.id === id)) {
      pendingCharacterSelection.current = null;
      setActiveCharacterId(id);
    }
  }, [entries, setActiveCharacterId]);
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
        ? withCreationBaseValues({
            engineVersion: 1,
            characterState: "draft",
            creationAllocations: {
              attributes: { physical: 7, social: 5, mental: 3 },
              abilities: { talents: 13, skills: 9, knowledges: 5 },
            },
            freebiePurchases: [],
            xpLedger: [],
            player: a.name,
            chronicle: a.campaignId === "chronik-von-kleve" ? "Chronik von Kleve" : a.campaignId,
            attributes: {},
            skills: {},
            virtues: {},
            health: { current: "Gesund" },
          })
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
      const saved = await api<{ id: string }>("/api/records", "POST", edit);
      invalidatePlayerData(dataScope, "/api/dashboard");
      if (savedKind === "charaktere")
        invalidatePlayerData(dataScope, "/api/records?kind=charaktere");
      if (savedKind === "charaktere" && savedId)
        invalidatePlayerData(dataScope, `/api/character-detail?id=${encodeURIComponent(savedId)}`);
      setEdit(null);
      toast.success("Gespeichert");
      if (savedKind === "charaktere" && saved.id) pendingCharacterSelection.current = saved.id;
      reload();
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
  const Shell = surface === "sl" ? SLWorkspaceShell : WorkspaceShell;
  return (
    <Shell a={a} section={section} navigate={navigate} {...(surface === "sl" ? { preparationDirty } : {})}>

      {selectionError&&<p className="error-box" role="alert">Charakterwechsel nicht gespeichert: {selectionError}</p>}
      {!worldExperienceActive && section !== "chronik" && section !== "dashboard" && section !== "regelwerk" && section !== "charaktere" && section !== "inventar" && section !== "ortscms" && section !== "sitzung" && !((section === "galerie" || section === "rueckblick") && surface === "sl") && section !== "notizen" && section !== "vorbereitung" && <div className="section-title">
        <div>
          <p className="eyebrow">
            {surface === "sl" && a.gm ? "DIE CHRONIK IN DEINER HAND" : "DEIN ORT IN DER NACHT"}
          </p>
          <h1>{current.name}</h1>
          <p className="muted">{current.desc}</p>
        </div>
        {![
          "dashboard",
          "rueckblick",
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
          "nscs",
          "termine",
        ].includes(section) &&
          (surface === "sl" && a.gm || personal.includes(section)) && (
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
      ) : section === "ortscms" ? (
        <LocationCMS a={a} dataScope={dataScope} />
      ) : section === "regelwerk" ? (
        <CodexPanel key={dataScope} dataScope={dataScope} />
      ) : loading && !(section === "charaktere" && hasData) ? (
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
      ) : section === "nscs" ? (
        <NPCPanel key={dataScope} dataScope={dataScope} gm={surface === "sl" && a.gm} />
      ) : section === "charaktere" ? (
        <>{surface === "sl" ? <PlayerCharacterManagement a={a} inspection key={dataScope} entries={entries} dataScope={dataScope} activeCharacterId={activeCharacterId} onActiveCharacterChange={setActiveCharacterId} onCreate={() => create()} onEdit={(r) => setEdit(structuredClone(r))} onRefresh={reload} /> : <CharacterDetail a={a} inspection={false} key={dataScope} entries={entries} dataScope={dataScope} activeCharacterId={activeCharacterId} onActiveCharacterChange={setActiveCharacterId} onCreate={() => create()} onEdit={(r) => setEdit(structuredClone(r))} onRefresh={reload} />}</>
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
      ) : section === "rueckblick" ? (
        surface === "sl" && a.gm ? <RecapDesk key={dataScope}/> : <SessionRecap key={dataScope} dataScope={dataScope}/>
      ) : section === "termine" ? (
        <AppointmentsPanel key={dataScope} a={a} dataScope={dataScope} engagementAvailable={engagementAvailable}/>
      ) : section === "chronik" ? (
        <ChroniclePanel entries={entries} />
      ) : section === "galerie" ? (
        surface === "sl" ? <MediaLibrary a={a} files={files} onRefresh={reload}/> : <PlayerGallery key={dataScope} characterId={activeCharacterId}/>
      ) : section === "vorbereitung" ? (
        <MaterialPreparation key={dataScope} a={a}/>
      ) : section === "notizen" ? (
        <PlayerArchive key={dataScope} a={a}/>
      ) : section === "wuerfel" ? (
        <DicePanel />
      ) : section === "sitzung" ? (
        <CommandCenter preparation={surface === "sl"} entries={entries} a={a} onRefresh={reload} onPreparationDirty={setPreparationDirty} />
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
                    : surface === "sl" && a.gm && !personal.includes(section)
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
      {surface === 'player' && engagementAvailable && <EngagementActivity key={dataScope} section={section} />}
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
    </Shell>
  );
}




