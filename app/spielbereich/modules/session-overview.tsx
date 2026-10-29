import { ArrowUp, ArrowDown, MapPin, Users, FileText, NotebookPen } from 'lucide-react';
import type { PreparedSession } from '@/domain/story-preparation';
import type { SceneSummary } from '@/domain/story-scene';
import type { CommandReference } from '@/domain/command-workspace';
import { orderedSessionScenes, preparationSections } from '@/domain/session-overview';
import s from './story-workspace.module.css';

export const preparationStatusNames: Record<string, string> = {
  draft: 'Entwurf', ready: 'Vorbereitet', active: 'In Arbeit', completed: 'Abgeschlossen', archived: 'Archiviert',
};

export function SessionList({sessions,scenes,references,busy,message,onOpen}:{sessions:PreparedSession[];scenes:SceneSummary[];references:CommandReference[];busy:boolean;message:string;onOpen:(id:string)=>void}) {
  const names=new Map(references.map(reference=>[reference.id,reference.title]));
  return <section className={s.sessionIndex} aria-label="Alle Spielabende">
    <header className={s.indexHead}><div><h2>Deine Spielabende</h2><p>Öffne einen Abend, um seine Szenen zu planen. Einen neuen Abend legst du oben über „Spielabend anlegen“ an.</p></div><small>Zuletzt bearbeitet zuerst</small></header>
    <p role="status" className={s.overviewHint}>{message}</p>
    {!sessions.length&&<p className={s.indexEmpty}>Keine passenden Spielabende vorhanden. Lege oben deinen ersten Abend an oder passe Suche und Filter an.</p>}
    <ul className={s.sessionIndexList}>{sessions.map(session=>{
      const linked=orderedSessionScenes(session.id,session.document,scenes);
      const places=[...new Set(linked.map(scene=>scene.placeId).filter(Boolean))];
      return <li key={session.id}>
        <div className={s.indexEntryHead}><h3>{session.document.title}</h3><span className={s.indexStatus}>{preparationStatusNames[session.document.status]}</span></div>
        <p className={s.indexMeta}>{session.document.date?`${session.document.date.replace('T',' · ')} · `:''}{linked.length} {linked.length===1?'Szene':'Szenen'}{places.length?` · ${places.map(id=>names.get(id)||'Verknüpfter Schauplatz').join(', ')}`:''}</p>
        <p className={s.indexDescription}>{session.document.summary||(linked[0]?.preparation?.narrationExcerpt ? `Auftakt: ${linked[0].preparation.narrationExcerpt}` : 'Noch kein Kurzüberblick hinterlegt. Du kannst ihn unter „Spielabend bearbeiten“ ergänzen.')}</p>
        <div className={s.indexEntryFoot}><p>{linked.length?linked.slice(0,3).map(scene=>scene.title).join(' → '):'Dieser Abend wartet auf seine erste Szene.'}{linked.length>3?' …':''}</p><button disabled={busy} onClick={()=>onOpen(session.id)} aria-label={`Spielabend öffnen: ${session.document.title}`}>Spielabend öffnen</button></div>
      </li>;
    })}</ul>
  </section>;
}

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
    <section className={s.eveningPlan}><h3>Für diesen Abend geplant</h3><p className={s.overviewSummary}>{session.document.summary||'Noch kein Kurzüberblick hinterlegt. Ergänze unter „Spielabend bearbeiten“, was du für diesen Abend vorhast.'}</p></section>
    <p role="status" className={s.overviewHint}>{message}</p>
    <div className={s.sessionHead}><h3>Dein Szenenablauf</h3><button disabled={busy} onClick={onCreate}>+ Szene für diesen Spielabend</button></div>
    <p className={s.overviewHint}>Plane deinen Abend Szene für Szene. Die Reihenfolge ist deine Orientierung; veröffentlicht wird erst durch deine bewusste Freigabe.</p>
    {missing.length > 0 && <p role="alert">{missing.length} verknüpfte Szene(n) sind nicht verfügbar. Die Verknüpfungen bleiben erhalten; prüfe sie unter „Spielabend bearbeiten“.</p>}
    {!linked.length && <p>Noch keine Szenen vorbereitet. Lege die erste Szene an oder verknüpfe eine vorhandene über „Spielabend bearbeiten“.</p>}
    <ol className={s.overviewScenes}>{linked.map((scene, index) => {
      const preparation = scene.preparation;
      const people = [...new Set([...(preparation?.npcIds || []), ...(preparation?.materials.filter(m=>m.kind==='person').map(m=>m.referenceId) || [])])];
      const materials = preparation?.materials.filter(m=>m.kind!=='person' && m.kind!=='place') || [];
      const embedded = preparation?.embeddedFileIds.filter(id=>!materials.some(material=>material.fileId===id)) || [];
      const materialNames=[...materials.map(m=>`${m.kind==='audio'?'Audio':m.kind==='image'?'Bild':m.kind==='handout'?'Handout':m.kind==='video'?'Video':m.kind==='check'?'Probe':'Material'}: ${m.title}${m.fileId ? ` (${fileNames.get(m.fileId)||'Datei nicht verfügbar'})` : ''}`), ...embedded.map(id=>`Bild: ${fileNames.get(id)||'Datei nicht verfügbar'}`), ...(preparation?.clueIds.map(id=>names.get(id)||'Verknüpfter Hinweis nicht verfügbar') || [])];
      return <li key={scene.id} className={s.overviewScene}>
        <div className={s.overviewSceneHead}>
          <div className={s.sceneIdentity}><span className={s.sceneNumber} aria-label={`Szene ${index+1}`}>{String(index+1).padStart(2,'0')}</span><div><h4>{scene.title}</h4><p className={s.sceneLocation}><MapPin size={15} aria-hidden="true"/>{scene.placeId ? names.get(scene.placeId) || 'Verknüpfter Schauplatz nicht verfügbar' : 'Noch kein Schauplatz gewählt'}{scene.archived ? ' · Archiviert' : ''}</p></div></div>
          <button className={s.sceneEdit} disabled={busy} onClick={()=>onScene(scene.id)} aria-label={`Szene bearbeiten: ${scene.title}`}>Szene bearbeiten</button>
        </div>
        <p className={s.sceneSynopsis}>{preparation?.narrationExcerpt||'Noch keine Erzählung vorbereitet. Über „Szene bearbeiten“ kannst du den geplanten Einstieg ergänzen.'}</p>
        <section className={s.sceneContents} aria-label={`Vorhandene Inhalte: ${scene.title}`}>
          <h5><NotebookPen size={16} aria-hidden="true"/>Vorhandene Inhalte</h5>
          {preparation?.sections.length ? <ul className={s.sectionTags}>{preparation.sections.map(key=><li key={key}>{preparationSections[key as keyof typeof preparationSections]}</li>)}</ul> : <p>{preparation?'Hier ist noch Raum für deine Erzählung und Regiehinweise.':'Vorbereitungsstand nicht verfügbar.'}</p>}
        </section>
        <div className={s.sceneResources}>
          <section><h5><Users size={16} aria-hidden="true"/>Mitwirkende</h5>{people.length?<ul>{people.map(id=><li key={id}>{names.get(id)||'Verknüpfte Person nicht verfügbar'}</li>)}</ul>:<p>Noch keine NPCs zugeordnet.</p>}</section>
          <section><h5><FileText size={16} aria-hidden="true"/>Spielmaterial</h5>{materialNames.length?<ul>{materialNames.map((name,index)=><li key={index}>{name}</li>)}</ul>:<p>Noch kein Material zugeordnet.</p>}</section>
        </div>
        <div className={s.overviewOrder} aria-label={`Reihenfolge: ${scene.title}`}>
          <button disabled={busy||index===0} onClick={()=>onMove(scene.id,-1)} aria-label={`${scene.title} nach oben`}><ArrowUp size={15} aria-hidden="true"/>Nach oben</button>
          <button disabled={busy||index===linked.length-1} onClick={()=>onMove(scene.id,1)} aria-label={`${scene.title} nach unten`}><ArrowDown size={15} aria-hidden="true"/>Nach unten</button>
          <small>Szene {index+1} von {linked.length}</small>
        </div>
      </li>;
    })}</ol>
  </section>;
}
