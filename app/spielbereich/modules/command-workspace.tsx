"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Search, ShieldCheck, Eye, RefreshCw, MonitorUp, Star, Plus, LockKeyhole, Check, Circle, ArrowUpRight, X } from 'lucide-react';
import type { Actor } from '@/domain/types';
import type { Entry } from '@/domain/legacy';
import type { CommandCharacterSummary } from '@/domain/character-live';
import { commandSyncSchema, emptyStory, type CommandPanel, type CommandTool, type CommandWorkspace as Layout, type CommandReference, type MomentView, type WorkspaceMode } from '@/domain/command-workspace';
import { api, ApiError } from './api-client';
import { useCommandWorkspace } from './use-command-workspace';
import { CommandBoard, commandToolLabels } from './command-board';
import { CommandStory } from './command-story';
import { CommandDispatch } from './command-dispatch';
import { CommandMoments } from './command-moments';
import { CommandDossier } from './command-dossier';
import { CommandCharacter } from './command-character';
import { CommandNotes } from './command-notes';
import { CommandPlace, sessionPlaceId } from './command-place';
import { useCommandConfirmation } from './command-confirmation';
import { StorySceneManager } from './story-scene-manager';
import type { SceneSummary } from '@/domain/story-scene';
import { DicePanel } from './dice';
import { CharacterReviewQueue } from './character-review-queue';
import { PlayerSession, type PlayerCommandData } from './command-player-session';
import styles from './command-workspace.module.css';

type Snapshot = { campaignId: string; members: { id: string; name: string }[]; characters: CommandCharacterSummary[]; handouts: { id: string; title: string; text: string; revocable: boolean }[]; grants: { entity_id: string; audience: string; subject_id: string; state: string }[]; sessions: Entry[]; references: CommandReference[]; stories: { id: string; title: string; version: number; updatedAt: string }[]; scenes:SceneSummary[]; moments: MomentView[] };
const modeNames: Record<WorkspaceMode, string> = { prepare: 'Vorbereiten', live: 'Spielabend', recap: 'Nachbereiten' };
export function CommandWorkspace({ a, onRefresh, preparation = false }: { a: Actor; entries: Entry[]; onRefresh: () => void; preparation?: boolean }) {
  const { ask, cancel, dialog } = useCommandConfirmation();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [error, setError] = useState(''), [locked, setLocked] = useState(false);
  const [mode, setMode] = useState<WorkspaceMode>(preparation ? 'prepare' : 'live'), [windowRole, setWindowRole] = useState<'main' | 'companion'>('main');
  const [search, setSearch] = useState(''), [dossierId, setDossierId] = useState(''), [notice, setNotice] = useState(''), [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<PlayerCommandData | null>(null), [previewBusy, setPreviewBusy] = useState(false), [target, setTarget] = useState(''), [grantBusy, setGrantBusy] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null), snapshotRef = useRef<Snapshot | null>(null), lockedRef = useRef(false), dirtyPanels = useRef<Record<string, boolean>>({});
  const syncFocus = useRef<Layout['focus'] | null>(null), syncRole = useRef<'main' | 'companion'>('main'), focusRequested = useRef(false);
  const inFlight = useRef(false), alive = useRef(true), createId = useRef<string | null>(null), previewRef = useRef(false);
  const deny = useCallback(() => { cancel(); lockedRef.current = true; setLocked(true); setSnapshot(null); snapshotRef.current = null; setPreview(null); channel.current?.postMessage({ type: 'lock' }); }, [cancel]);
  const prefs = useCommandWorkspace(mode, windowRole, deny);
  const { view, change, save, load } = prefs;
  useEffect(() => { syncRole.current = windowRole; syncFocus.current = view ? { ...view.workspace.focus, sessionId: view.workspace.focus.sessionId || snapshot?.sessions[0]?.id || '', storyId: view.workspace.focus.storyId || snapshot?.stories[0]?.id || '' } : null; }, [view, snapshot, windowRole]);
  useEffect(() => { if (windowRole === 'companion' && view && snapshot && !focusRequested.current) { focusRequested.current = true; channel.current?.postMessage({ type: 'request-focus' }); } }, [view, snapshot, windowRole]);
  const reload = useCallback(async () => {
    if (inFlight.current || lockedRef.current) return;
    inFlight.current = true;
    try {
      const data = await api<Snapshot>('/api/command-center');
      if (!alive.current || lockedRef.current) return;
      snapshotRef.current = data; setSnapshot(data); setError('');
      if (previewRef.current) { const safe = await api<PlayerCommandData>('/api/command-center?view=player'); if (alive.current && !lockedRef.current) setPreview(safe); }
    } catch (e) { if (alive.current) { setError((e as Error).message); if (previewRef.current) setPreview(null); if (e instanceof ApiError && [401, 403].includes(e.status)) deny(); } }
    finally { inFlight.current = false; }
  }, [deny]);
  const changed = useCallback(() => { onRefresh(); void reload(); channel.current?.postMessage({ type: 'invalidate' }); }, [onRefresh, reload]);
  useEffect(() => {
    alive.current = true; queueMicrotask(() => { if (alive.current) setWindowRole(new URLSearchParams(window.location.search).get('commandWindow') === 'companion' ? 'companion' : 'main'); });
    queueMicrotask(() => void reload()); const focus = () => void reload(); window.addEventListener('focus', focus);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void reload(); }, 10000);
    const leave = (e: BeforeUnloadEvent) => { if (Object.values(dirtyPanels.current).some(Boolean)) e.preventDefault(); };
    window.addEventListener('beforeunload', leave);
    return () => { alive.current = false; window.removeEventListener('focus', focus); window.removeEventListener('beforeunload', leave); window.clearInterval(timer); };
  }, [reload]);
  useEffect(() => {
    if (!('BroadcastChannel' in window)) return;
    const bc = new BroadcastChannel(`chroniplay-command:${a.campaignId}:${a.id}`); channel.current = bc;
    bc.onmessage = event => {
      const parsed = commandSyncSchema.safeParse(event.data); if (!parsed.success) return;
      const message = parsed.data;
      if (message.type === 'lock') { lockedRef.current = true; setLocked(true); setSnapshot(null); snapshotRef.current = null; setPreview(null); return; }
      if (message.type === 'invalidate') { void reload(); return; }
      if (message.type === 'request-focus') { if (syncRole.current === 'main' && syncFocus.current) bc.postMessage({ type: 'focus', ...syncFocus.current }); return; }
      if (Object.values(dirtyPanels.current).some(Boolean)) { setNotice('Eine Auswahl im zweiten Fenster wurde nicht übernommen: Hier sind noch ungespeicherte Eingaben.'); return; }
      const s = snapshotRef.current; if (!s) return;
      const next: Partial<Layout['focus']> = {};
      if (message.characterId !== undefined && (!message.characterId || s.characters.some(c => c.id === message.characterId))) next.characterId = message.characterId;
      if (message.storyId !== undefined && (!message.storyId || s.stories.some(c => c.id === message.storyId))) next.storyId = message.storyId;
      if (message.sessionId !== undefined && (!message.sessionId || s.sessions.some(c => c.id === message.sessionId))) next.sessionId = message.sessionId;
      if (message.placeId !== undefined && (!message.placeId || s.references.some(c => c.id === message.placeId && c.type === 'PLACE'))) next.placeId = message.placeId;
      if (message.sceneId !== undefined && (!message.sceneId || s.scenes.some(c => c.id === message.sceneId))) next.sceneId = message.sceneId;
      change(w => ({ ...w, focus: { ...w.focus, ...next } }));
    };
    return () => { bc.close(); channel.current = null; };
  }, [a.id, a.campaignId, change, reload]);
  async function allowDiscard(ids: string[]) {
    if (ids.some(id => dirtyPanels.current[id]) && !await ask('In dieser Arbeitsfläche sind noch ungespeicherte Eingaben. Jetzt verwerfen?')) return false;
    for (const id of ids) delete dirtyPanels.current[id]; return true;
  }
  const focus = { characterId: '', storyId: '', sessionId: '', placeId: '', sceneId: '', ...view?.workspace.focus };
  if (!focus.sessionId) focus.sessionId = snapshot?.sessions[0]?.id || '';
  if (!focus.storyId) focus.storyId = snapshot?.stories[0]?.id || '';
  if (!focus.sceneId) focus.sceneId = snapshot?.scenes[0]?.id || '';
  const session = snapshot?.sessions.find(s => s.id === focus.sessionId), activeCharacter = snapshot?.characters.find(c => c.id === focus.characterId);
  async function selectFocus(next: Partial<Layout['focus']>, sync = true) {
    const affected = view?.workspace.panels.filter(p => !p.pinnedId && (next.characterId !== undefined && p.tool === 'character' || next.storyId !== undefined && p.tool === 'story' || next.sceneId !== undefined && p.tool === 'scene' || next.sessionId !== undefined && ['scene', 'notes', 'moments'].includes(p.tool))).map(p => p.id) || [];
    if (!await allowDiscard(affected)) return;
    change(w => ({ ...w, focus: { ...w.focus, ...next } })); if (sync) channel.current?.postMessage({ type: 'focus', ...next });
  }
  function ensureTool(tool: CommandTool, explicitAdd = false, pinnedId?: string) {
    change(w => {
      const instances = w.panels.filter(p => p.tool === tool), multiple = ['story', 'character', 'places', 'dossiers'].includes(tool);
      if (instances.length && (!explicitAdd || !multiple)) { setNotice(commandToolLabels[tool].label + ' ist bereits auf deiner Arbeitsfläche geöffnet.'); return w; }
      if (w.panels.length >= 10 || instances.length >= 3) { setNotice('Schließe zuerst eine Arbeitsfläche. Bis zu zehn Werkzeuge und drei Akten je Werkzeug sind möglich.'); return w; }
      const preferred = ['story', 'moments', 'dossiers'].includes(tool) ? 0 : 1;
      const column = w.panels.filter(p => p.column === preferred).length >= 5 ? (1 - preferred) as 0 | 1 : preferred as 0 | 1;
      return { ...w, panels: [...w.panels, { id: tool + '-' + crypto.randomUUID(), tool, column, height: 50, pinnedId: pinnedId || null }] };
    });
  }
  async function openReference(reference: CommandReference) {
    if (reference.type === 'PLACE') { await selectFocus({ placeId: reference.id }); ensureTool('places'); }
    else if (reference.type === 'PLOT') { await selectFocus({ storyId: reference.id }); ensureTool('story'); }
    else if (reference.type === 'CHARACTER') { await selectFocus({ characterId: reference.id }); ensureTool('character'); }
    else if (reference.type === 'SCENE') { await selectFocus({ sceneId: reference.id }); ensureTool('scene'); }
    else { setDossierId(reference.id); ensureTool('dossiers'); } setSearch('');
  }
  function favorite(id: string) { change(w => ({ ...w, favorites: w.favorites.includes(id) ? w.favorites.filter(old => old !== id) : w.favorites.length < 40 ? [...w.favorites, id] : w.favorites })); }
  function panelContext(panel: CommandPanel) { return panel.pinnedId || (panel.tool === 'character' ? focus.characterId : panel.tool === 'story' ? focus.storyId : panel.tool === 'places' ? focus.placeId || sessionPlaceId(session) : panel.tool === 'dossiers' ? dossierId : ''); }
  function panelTitle(panel: CommandPanel) {
    const id = panelContext(panel); return (panel.tool === 'character' ? snapshot?.characters.find(c => c.id === id)?.title : panel.tool === 'story' ? snapshot?.stories.find(s => s.id === id)?.title : snapshot?.references.find(r => r.id === id)?.title) || (['scene', 'notes', 'moments'].includes(panel.tool) ? session?.title : null) || (panel.pinnedId ? 'Angeheftete Akte' : 'Folgt deiner Auswahl');
  }
  async function pin(panel: CommandPanel) { const id = panelContext(panel); if (!panel.pinnedId && !id) { setNotice('Wähle zuerst eine Akte, die du anheften möchtest.'); return; } if (panel.pinnedId && !await allowDiscard([panel.id])) return; change(w => ({ ...w, panels: w.panels.map(p => p.id === panel.id ? { ...p, pinnedId: p.pinnedId ? null : id } : p) })); }
  async function close(panel: CommandPanel) { if (!await allowDiscard([panel.id])) return; change(w => ({ ...w, panels: w.panels.filter(p => p.id !== panel.id) })); }
  async function move(panel: CommandPanel, direction: 'up' | 'down' | 'column') {
    if (direction === 'column' && !await allowDiscard([panel.id])) return;
    change(w => {
      if (direction === 'column') { if (w.panels.filter(p => p.column !== panel.column).length >= 5) { setNotice('Diese Spalte enthält bereits fünf Werkzeuge.'); return w; } return { ...w, panels: w.panels.map(p => p.id === panel.id ? { ...p, column: (1 - p.column) as 0 | 1 } : p) }; }
      const peers = w.panels.filter(p => p.column === panel.column), index = peers.findIndex(p => p.id === panel.id), other = peers[index + (direction === 'up' ? -1 : 1)];
      if (!other) return w; const panels = [...w.panels], first = panels.findIndex(p => p.id === panel.id), second = panels.findIndex(p => p.id === other.id); [panels[first], panels[second]] = [panels[second], panels[first]]; return { ...w, panels };
    });
  }
  async function switchMode(next: WorkspaceMode) { if (next === mode || !await allowDiscard(view?.workspace.panels.map(p => p.id) || [])) return; if (!await save()) { setNotice('Speichere oder kläre zuerst die offene Anordnung.'); return; } setMode(next); }
  async function newStory() {
    if (creating || !await allowDiscard(view?.workspace.panels.filter(p => p.tool === 'story' && !p.pinnedId).map(p => p.id) || [])) return; setCreating(true); setError(''); createId.current ||= crypto.randomUUID();
    try { const result = await api<{ story: { id: string } }>('/api/command-center/story', 'POST', { action: 'create', clientRequestId: createId.current, document: emptyStory() }); createId.current = null; await reload(); await selectFocus({ storyId: result.story.id }); }
    catch (e) { setError((e as Error).message); if (e instanceof ApiError && [401, 403].includes(e.status)) deny(); } finally { setCreating(false); }
  }
  async function showPreview() {
    if (previewRef.current) { previewRef.current = false; setPreview(null); return; } setPreviewBusy(true);
    try { const data = await api<PlayerCommandData>('/api/command-center?view=player'); setPreview(data); previewRef.current = true; } catch (e) { setError((e as Error).message); } finally { setPreviewBusy(false); }
  }
  async function grant(id: string, enabled: boolean) {
    if (!target || grantBusy) return;
    if (!await ask(`${enabled ? 'Freigeben' : 'Freigabe zurückziehen'} für ${target === 'group' ? 'die aktive Kampagnengruppe' : snapshot?.members.find(m => m.id === target)?.name}? Andere Zielgruppen bleiben unverändert.`)) return;
    setGrantBusy(true); setError('');
    try { await api('/api/knowledge', 'POST', { entityId: id, audience: target === 'group' ? 'group' : 'player', ...(target === 'group' ? {} : { playerId: target }), state: enabled ? 'DISCOVERED' : 'UNKNOWN' }); changed(); setNotice(enabled ? 'Für diese Zielgruppe freigegeben.' : 'Freigabe für diese Zielgruppe zurückgezogen.'); } catch (e) { setError((e as Error).message); } finally { setGrantBusy(false); }
  }
  function renderTool(panel: CommandPanel) {
    const id = panelContext(panel), onDirty = (dirty: boolean) => { dirtyPanels.current[panel.id] = dirty; };
    if (panel.tool === 'story') return <><div className={styles.toolContext}><select aria-label="Handlungsstrang auswählen" value={id} disabled={!!panel.pinnedId} onChange={e => selectFocus({ storyId: e.target.value })}><option value="">Handlungsstrang auswählen</option>{snapshot?.stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select><button disabled={!preparation || creating || !!panel.pinnedId} onClick={() => void newStory()} aria-label="Neuen Handlungsstrang anlegen"><Plus size={15}/></button></div>{id ? <CommandStory allowEditing={preparation} key={id} id={id} version={snapshot?.stories.find(s => s.id === id)?.version} references={snapshot?.references || []} scenes={snapshot?.scenes || []} onOpenScene={sceneId=>{void selectFocus({sceneId});ensureTool('scene');}} onChanged={changed} onDirty={onDirty} onOpenReference={openReference} onDenied={deny} ask={ask}/> : <div className={styles.empty}><BookOpen size={35}/><h2>Dein roter Faden</h2><p>Private Handlungsstränge mit Geheimnissen, Möglichkeiten und Verweisen auf deine vorhandenen Akten.</p><button className={styles.primary} disabled={!preparation || creating} onClick={() => void newStory()}><Plus size={15}/>{creating ? 'Wird angelegt …' : 'Ersten Handlungsstrang anlegen'}</button></div>}</>;
    if (panel.tool === 'scene') return <StorySceneManager preparation={preparation} key={session?.id || 'new'} a={a} session={session} id={focus.sceneId} storyId={focus.storyId} scenes={snapshot?.scenes || []} stories={snapshot?.stories || []} references={snapshot?.references || []} characters={snapshot?.characters || []} moments={snapshot?.moments || []} onSelect={(sceneId,storyId,placeId)=>void selectFocus({sceneId,...(storyId?{storyId}:{}),...(placeId?{placeId}:{})})} onRefresh={changed} onDirty={onDirty} onDenied={deny} onOpenReference={openReference} ask={ask}/>;
    if (panel.tool === 'character') return <><div className={styles.toolContext}><select aria-label="Charakterakte auswählen" disabled={!!panel.pinnedId} value={id} onChange={e => selectFocus({ characterId: e.target.value })}><option value="">Charakter auswählen</option>{snapshot?.characters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>{id && <button aria-label="Zweiten Charakter daneben öffnen" onClick={() => ensureTool('character', true, id)}><Plus size={15}/></button>}</div>{id ? <CommandCharacter key={id} id={id} version={snapshot?.characters.find(c => c.id === id)?.version} onChanged={changed} onDirty={onDirty}/> : <div className={styles.empty}><ShieldCheck size={28}/><p>Wähle einen Charakter deiner Kampagne. Private Spielernotizen und Nachrichten bleiben geschützt.</p></div>}</>;
    if (panel.tool === 'places') return <CommandPlace key={session?.id || 'new'} session={session} a={a} browseId={id} pinned={!!panel.pinnedId} onBrowse={placeId => selectFocus({ placeId })} onRefresh={changed}/>;
    if (panel.tool === 'dossiers') return <CommandDossier id={id} references={snapshot?.references || []} favorites={view?.workspace.favorites || []} onSelect={next => panel.pinnedId ? change(w => ({ ...w, panels: w.panels.map(p => p.id === panel.id ? { ...p, pinnedId: next || null } : p) })) : setDossierId(next)} onFavorite={favorite} onDenied={deny}/>;
    if (panel.tool === 'notes' && !preparation) return <p>Vorbereitungsnotizen im <a href='/sl/command-center'>Command Center</a> bearbeiten.</p>;
    if (panel.tool === 'notes') return <CommandNotes key={session?.id || 'new'} session={session} onRefresh={changed} onDirty={onDirty} ask={ask}/>;
    if (panel.tool === 'moments') return <CommandMoments moments={snapshot?.moments || []} focus={focus} stories={snapshot?.stories || []} scenes={snapshot?.scenes || []} onOpenStory={storyId=>{void selectFocus({storyId});ensureTool('story');}} onOpenScene={sceneId=>{void selectFocus({sceneId});ensureTool('scene');}} onChanged={changed} onDirty={onDirty}/>;
    if (panel.tool === 'dice') return <DicePanel/>;
    return <><CommandDispatch members={snapshot?.members || []} initialRecipient={activeCharacter?.ownerId || ''} onChanged={changed} onDirty={onDirty}/><details className={styles.fold}><summary>Vorbereitete Handouts freigeben</summary><label className={styles.field}>Zielgruppe ausdrücklich auswählen<select aria-label="Handout-Zielgruppe" value={target} onChange={e => setTarget(e.target.value)}><option value="">Keine Zielgruppe ausgewählt</option><option value="group">Aktive Kampagnengruppe</option>{snapshot?.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>{snapshot?.handouts.map(h => { const released = snapshot.grants.some(g => g.entity_id === h.id && g.subject_id === (target === 'group' ? a.campaignId : target) && g.audience === (target === 'group' ? 'group' : 'player') && g.state !== 'UNKNOWN'); return <article className={styles.handout} key={h.id}><strong>{h.title}</strong><p>{h.text}</p>{h.revocable ? <button disabled={!target || grantBusy} onClick={() => void grant(h.id, !released)}>{released ? 'Für diese Zielgruppe zurückziehen' : 'Für diese Zielgruppe freigeben'}</button> : <small>Bestehende öffentliche oder Gruppenregel · im CMS verwalten.</small>}</article>; })}</details></>;
  }
  if (locked) return <div className={styles.root}><div className={styles.empty}><LockKeyhole size={35}/><h1>Geschützter Arbeitsplatz geschlossen</h1><p>Deine Anmeldung oder Kampagnenberechtigung ist nicht mehr gültig. Private Arbeitsflächen wurden entfernt.</p><a href="/anmelden" className="button">Erneut anmelden</a></div></div>;
  const searchable: CommandReference[] = [...snapshot?.references || [], ...(snapshot?.stories || []).map(s => ({ id: s.id, title: s.title, type: 'PLOT', summary: 'Privater Handlungsstrang' })), ...(snapshot?.scenes || []).map(s=>({id:s.id,title:s.title,type:'SCENE',summary:'Vorbereitete Szene und getrennte Szenenläufe'})), ...(snapshot?.characters || []).map(c => ({ id: c.id, title: c.title, type: 'CHARACTER', summary: 'Berechtigter Charakterkontext' }))];
  const results = searchable.filter(r => (r.title + ' ' + r.summary).toLowerCase().includes(search.toLowerCase())).slice(0, 9);
  const pending = snapshot?.characters.reduce((n, c) => n + (c.state === 'review' ? 1 : 0) + c.pendingRequests, 0) || 0;
  return <div className={styles.root}>
    <header className={styles.topbar}><div className={styles.brand}><span className={styles.brandSeal}><BookOpen size={21}/></span><div><p className={styles.eyebrow}>CHRONIPLAY · PRIVATE SL-REGIE{windowRole === 'companion' ? ' · ZWEITES FENSTER' : ''}</p><h1>{preparation ? "Command Center" : "SL Live-Sitzung"} <span>2.0</span></h1></div></div><nav className={styles.modes} aria-label="Arbeitsmodus">{Object.entries(modeNames).filter(([key]) => preparation ? key !== "live" : key === "live").map(([key, label]) => <button aria-pressed={mode === key} key={key} onClick={() => void switchMode(key as WorkspaceMode)}>{label}</button>)}</nav><div className={styles.topActions}><button disabled={previewBusy} aria-pressed={!!preview} onClick={() => void showPreview()}><Eye size={15}/><span>{preview ? 'Zur SL-Regie' : 'Gruppenblick'}</span></button><button aria-label="Zweites Command-Center-Fenster öffnen" title="Separates Fenster für den zweiten Monitor" onClick={() => window.open('/spielbereich?bereich=sitzung&commandWindow=companion', 'chroniplay-command-companion', 'popup,width=1200,height=850')}><MonitorUp size={17}/></button><button aria-label="Regie aktualisieren" onClick={changed}><RefreshCw size={15}/></button><a href={preparation ? "/spielbereich?bereich=sitzung" : "/sl/command-center"} title="Arbeitsbereich bewusst wechseln">{preparation ? "Live-Sitzung" : "Vorbereitung"} <ArrowUpRight size={13}/></a></div></header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {preview && <div className={styles.preview}><div className={styles.previewBanner}><Eye size={17}/><div><strong>Veröffentlichte Gruppenansicht</strong><p>Serverseitig freigegebener Stand. Persönliche Freigaben und SL-Inhalte sind ausgeschlossen; dies ersetzt keinen unabhängigen Spielerlogin.</p></div><button onClick={() => void showPreview()}><X size={16}/>Zur Regie</button></div><PlayerSession a={a} entries={[]} onRefresh={changed} preview={{ ...preview, sessions: preview.sessions.filter(s => s.id === focus.sessionId) }}/></div>}
    <div hidden={!!preview}>
      <div className={styles.contextbar}><label><span>Aktive Sitzung</span><select aria-label="Aktive Regiesitzung" value={focus.sessionId} onChange={e => selectFocus({ sessionId: e.target.value })}><option value="">Neue Sitzung im Szenenwerkzeug</option>{snapshot?.sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label><label><span>Person im Fokus</span><select aria-label="Person im Regiefokus" value={focus.characterId} onChange={e => selectFocus({ characterId: e.target.value })}><option value="">Kein Charakter ausgewählt</option>{snapshot?.characters.map(c => <option key={c.id} value={c.id}>{c.title} · {snapshot.members.find(m => m.id === c.ownerId)?.name || 'Mitglied'}</option>)}</select></label><div className={styles.globalSearch}><label><Search size={15}/><input aria-label="Kampagnenakten suchen" placeholder="Ort, NSC, Hinweis …" value={search} onChange={e => setSearch(e.target.value)}/></label>{search && <div className={styles.searchResults}>{results.map(r => <div key={r.id}><button onClick={() => openReference(r)}><strong>{r.title}</strong><small>{r.type} · {r.summary}</small></button><button aria-label={r.title + ' als Favorit'} aria-pressed={view?.workspace.favorites.includes(r.id)} onClick={() => favorite(r.id)}><Star size={13}/></button></div>)}{!results.length && <p>Keine vorhandene Akte gefunden.</p>}<button onClick={() => setSearch('')}>Suche schließen</button></div>}</div></div>
      {snapshot && <details className={styles.reviewFold} open={pending > 0 || undefined}><summary><ShieldCheck size={14}/>{pending ? `${pending} Prüfungen / Anträge warten auf dich` : 'Keine offenen Charakterprüfungen'}<span>Bestehende Character Engine</span></summary><CharacterReviewQueue characters={snapshot.characters} onSelect={c => { selectFocus({ characterId: c.id }); ensureTool('character'); }}/></details>}
      {!!view?.workspace.favorites.length && <nav className={styles.favorites} aria-label="Angeheftete Kampagnenfavoriten"><Star size={13}/>{view.workspace.favorites.map(id => { const ref = searchable.find(r => r.id === id); return ref ? <button key={id} onClick={() => openReference(ref)}>{ref.title}</button> : null; })}</nav>}
      <nav className={styles.toolRail} aria-label="Command-Center-Werkzeuge">{Object.entries(commandToolLabels).map(([key, t]) => { const count = view?.workspace.panels.filter(p => p.tool === key).length || 0; return <button aria-pressed={count > 0} key={key} onClick={() => ensureTool(key as CommandTool, true)}><t.icon size={16}/><span>{t.label}</span>{count > 0 && <small>{count}</small>}</button>; })}</nav>
      {!view || !snapshot ? <div className={styles.empty}><BookOpen size={30}/><p role="status">{prefs.error || error || 'Dein geschützter Arbeitsplatz wird geladen …'}</p>{prefs.error && <button onClick={() => void load()}>Anordnung erneut laden</button>}</div> : <CommandBoard workspace={view.workspace} onChange={change} renderTool={renderTool} title={panelTitle} onPin={pin} onClose={close} onMove={move}/>}
      {prefs.error && <p role="alert" className={styles.error}>{prefs.error} <button onClick={async () => { if (await ask('Die Anordnung aus dem anderen Fenster laden? Deine lokale Anordnung wird ersetzt; Dokumentinhalte bleiben erhalten.')) void load(); }}>Gespeicherte Anordnung laden</button></p>}
      {dialog}<footer className={styles.statusbar}><span><LockKeyhole size={12}/>Nur Spielleitung · bewusste Freigaben</span><span role="status" aria-live="polite">{notice || (prefs.busy ? 'Anordnung wird gespeichert …' : prefs.dirty ? 'Anordnung noch offen' : 'Persönliche Anordnung gespeichert')}{prefs.dirty ? <Circle size={11}/> : <Check size={12}/>}</span></footer>
    </div>
  </div>;
}
