"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import styles from './table-tools.module.css';

export type SceneTool = { id: string; label: string; icon: LucideIcon; content: ReactNode };
export function SceneToolDrawer({ tools, requestedId }: { tools: SceneTool[]; requestedId?: string | null }) {
  const [active, setActive] = useState<string | null>(null);
  const [opened, setOpened] = useState<string[]>([]);
  const owner = useId();
  useEffect(() => {
    const change = (event: Event) => { if ((event as CustomEvent<string>).detail !== owner) setActive(null); };
    window.addEventListener('chroniplay-scene-tool', change);
    return () => window.removeEventListener('chroniplay-scene-tool', change);
  }, [owner]);
  useEffect(() => { if (active) window.dispatchEvent(new CustomEvent('chroniplay-scene-tool', {detail:owner})); }, [active, owner]);
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});
  const current = tools.find(tool => tool.id === active);
  useEffect(() => {
    if (!requestedId) return;
    queueMicrotask(() => { setActive(requestedId); setOpened(old => old.includes(requestedId) ? old : [...old, requestedId]); });
  }, [requestedId]);
  function close() { if (active) triggers.current[active]?.focus(); setActive(null); }
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && active) { triggers.current[active]?.focus(); setActive(null); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [active]);
  return <div className={styles.sceneTools}>
    <nav className={styles.toolRail} aria-label="Szenenwerkzeuge">{tools.map(tool => <button key={tool.id} ref={element => { triggers.current[tool.id] = element; }} type="button" title={tool.label} aria-label={tool.label} aria-expanded={active === tool.id} aria-controls={`scene-tool-${tool.id}`} onClick={() => { setActive(active === tool.id ? null : tool.id); setOpened(old => old.includes(tool.id) ? old : [...old, tool.id]); }}><tool.icon size={21} aria-hidden="true"/></button>)}</nav>
    {opened.length > 0 && <aside hidden={!current} className={styles.toolDrawer} aria-label={current?.label || 'Szenenwerkzeug'}>
      <header><h2>{current?.label}</h2><button type="button" aria-label="Seitenbereich schließen" onClick={close}><X size={20}/></button></header>
      {tools.filter(tool => opened.includes(tool.id)).map(tool => <div key={tool.id} id={`scene-tool-${tool.id}`} hidden={active !== tool.id}>{tool.content}</div>)}
    </aside>}
  </div>;
}
