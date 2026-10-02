"use client";
import { useState } from 'react';
import { Clapperboard, MapPin, Eye } from 'lucide-react';
import { sceneStatusNames, type PlayerScene } from '@/domain/story-scene';
import { RichTextView } from './rich-text';
import styles from './story-scene.module.css';

// This component is shared by the real player table and the explicit GM preview.
// It can only accept the server's allowlisted PlayerScene, never a draft dossier.
export function ScenePlayerView({ scenes }: { scenes: PlayerScene[] }) {
  const [selected, setSelected] = useState('');
  const scene = scenes.find(s => s.id === selected) || scenes.find(s => s.runs.some(r => r.status === 'active')) || scenes[0];
  return <section className={styles.playerScenes} aria-label="Freigegebene Szenen">
    <header><p className="eyebrow">DEINE GESCHICHTE</p><h2><Clapperboard size={21}/>Szenen & Entdeckungen</h2></header>
    {scenes.length > 1 && <nav className={styles.playerSwitcher} aria-label="Freigegebene Szene auswählen">{scenes.map(s => <button key={s.id} aria-pressed={scene?.id === s.id} onClick={() => setSelected(s.id)}>{s.title}</button>)}</nav>}
    {scene ? <article className={styles.playerDossier} key={scene.id}>
      <div className={styles.playerMeta}><span><Eye size={12}/>Ausdrücklich freigegeben</span>{scene.runs.filter(r => r.status !== 'completed').map(r => <span key={r.id}>{sceneStatusNames[r.status]} · {r.label}</span>)}</div>
      <h3>{scene.title}</h3>{scene.place && <a href={'/spielbereich?bereich=schauplaetze&ort=' + encodeURIComponent(scene.place.id)}><MapPin size={13}/>{scene.place.title}</a>}
      <RichTextView value={scene.narration}/>
      {scene.persons.length > 0 && <p className={styles.persons}>Bekannte Personen: {scene.persons.map(p => p.title).join(' · ')}</p>}
      {scene.clues.length > 0 && <section aria-label="Dein Wissen in dieser Szene"><h4>Was du weißt</h4>{scene.clues.map(c => <article className={styles.clue} key={c.id}><h5>{c.title}</h5><RichTextView value={c.text}/><small>{c.state === 'RUMOR' ? 'Unbestätigter Hinweis' : c.state === 'DISPROVED' ? 'Widerlegte Information' : 'Entdeckte Information'}</small></article>)}</section>}
      {scene.runs.some(r => r.status === 'completed') && <details><summary>Bereits erlebte Szenenläufe</summary>{scene.runs.filter(r => r.status === 'completed').map(r => <p key={r.id}>{sceneStatusNames[r.status]} · {r.label}</p>)}</details>}
    </article> : <p className={styles.empty}>Noch keine Szene für diese Ansicht freigegeben. Geheime und unentdeckte Szenen werden hier nicht angezeigt.</p>}
  </section>;
}
