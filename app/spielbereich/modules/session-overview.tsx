import type { PreparedSession } from '@/domain/story-preparation';
import type { SceneSummary } from '@/domain/story-scene';
import type { CommandReference } from '@/domain/command-workspace';
import { orderedSessionScenes, preparationSections } from '@/domain/session-overview';
import s from './story-workspace.module.css';

export const preparationStatusNames: Record<string, string> = {
  draft: 'Entwurf', ready: 'Vorbereitet', active: 'In Arbeit', completed: 'Abgeschlossen', archived: 'Archiviert',
};

export function SessionOverview({ session, scenes, references, files, busy, onEdit, onScene, onCreate, onMove, message }:{
  session: PreparedSession; scenes: SceneSummary[]; references: CommandReference[];
  files: {id:string;name:string;mime:string}[]; busy:boolean; message:string;
  onEdit:()=>void; onScene:(id:string)=>void; onCreate:()=>void; onMove:(id:string,direction:number)=>void;
}) {
  const linked = orderedSessionScenes(session.id, session.document, scenes);
  const names = new Map(references.map(reference => [reference.id, reference.title]));
  const fileNames = new Map(files.map(file => [file.id, file.name]));
  const missing = session.document.sceneIds.filter(id => !scenes.some(scene => scene.id === id));
  return <section aria-label="Spielabendübersicht" className={s.overview}>
    <header className={s.overviewHead}>
      <div><h2>{session.document.title}</h2><p>{preparationStatusNames[session.document.status]}{session.document.date ? ` · ${session.document.date.replace('T', ' · ')}` : ''}</p></div>
      <button type="button" disabled={busy} onClick={onEdit}>Spielabend bearbeiten</button>
    </header>
    {session.document.summary && <p className={s.overviewSummary}>{session.document.summary}</p>}
    <p role="status">{message}</p>
    <div className={s.sessionHead}><h3>Geplante Szenen</h3><button disabled={busy} onClick={onCreate}>+ Szene für diesen Spielabend</button></div>
    <p className={s.overviewHint}>Deine geplante Reihenfolge. Die Vorbereitung bleibt privat; du entscheidest später, was ausgespielt wird.</p>
    {missing.length > 0 && <p role="alert">{missing.length} verknüpfte Szene(n) sind nicht verfügbar. Die Verknüpfungen bleiben erhalten; prüfe sie unter „Spielabend bearbeiten“.</p>}
    {!linked.length && <p>Noch keine Szenen vorbereitet. Lege die erste Szene an oder verknüpfe eine vorhandene über „Spielabend bearbeiten“.</p>}
    <ol className={s.overviewScenes}>{linked.map((scene, index) => {
      const preparation = scene.preparation;
      const people = [...new Set([...(preparation?.npcIds || []), ...(preparation?.materials.filter(m=>m.kind==='person').map(m=>m.referenceId) || [])])];
      const materials = preparation?.materials.filter(m=>m.kind!=='person' && m.kind!=='place') || [];
      const embedded = preparation?.embeddedFileIds.filter(id=>!materials.some(material=>material.fileId===id)) || [];
      return <li key={scene.id} className={s.overviewScene}>
        <div className={s.overviewSceneHead}><div><h4>{index+1}. {scene.title}</h4><p>{scene.placeId ? names.get(scene.placeId) || 'Verknüpfter Schauplatz nicht verfügbar' : 'Schauplatz optional'}{scene.archived ? ' · Archiviert' : ''}</p></div>
          <button disabled={busy} onClick={()=>onScene(scene.id)} aria-label={`Szene bearbeiten: ${scene.title}`}>Szene bearbeiten</button></div>
        <dl className={s.overviewFacts}>
          <div><dt>Inhalte</dt><dd>{preparation ? (preparation.sections.length ? preparation.sections.map(key=>preparationSections[key as keyof typeof preparationSections]).join(' · ') : 'Noch keine Texte hinterlegt') : 'Vorbereitungsstand nicht verfügbar'}</dd></div>
          <div><dt>NPCs</dt><dd>{people.length ? people.map(id=>names.get(id)||'Verknüpfte Person nicht verfügbar').join(', ') : 'Keine verknüpft'}</dd></div>
          <div><dt>Spielmaterial</dt><dd>{[...materials.map(m=>`${m.kind==='audio'?'Audio':m.kind==='image'?'Bild':m.kind==='handout'?'Handout':m.kind==='video'?'Video':m.kind==='check'?'Probe':'Material'}: ${m.title}${m.fileId ? ` (${fileNames.get(m.fileId)||'Datei nicht verfügbar'})` : ''}`), ...embedded.map(id=>`Bild: ${fileNames.get(id)||'Datei nicht verfügbar'}`), ...(preparation?.clueIds.map(id=>names.get(id)||'Verknüpfter Hinweis nicht verfügbar') || [])].join(' · ') || 'Kein Material verknüpft'}</dd></div>
        </dl>
        <div className={s.overviewOrder} aria-label={`Reihenfolge: ${scene.title}`}>
          <button disabled={busy||index===0} onClick={()=>onMove(scene.id,-1)} aria-label={`${scene.title} nach oben`}>Nach oben</button>
          <button disabled={busy||index===linked.length-1} onClick={()=>onMove(scene.id,1)} aria-label={`${scene.title} nach unten`}>Nach unten</button>
          <small>Position {index+1} von {linked.length}</small>
        </div>
      </li>;
    })}</ol>
  </section>;
}
