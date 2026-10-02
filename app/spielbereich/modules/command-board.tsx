"use client";
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { BookOpen, Clapperboard, Users, MapPin, Send, NotebookPen, Feather, Library, Dices, Pin, PinOff, Maximize2, Minimize2, X, MoreHorizontal, ArrowUp, ArrowDown, ArrowLeftRight, GripHorizontal } from 'lucide-react';
import type { CommandPanel, CommandTool, CommandWorkspace } from '@/domain/command-workspace';
import styles from './command-workspace.module.css';

export const commandToolLabels = {
  story: { label: 'Storybuch', icon: BookOpen }, scene: { label: 'Szenenregie', icon: Clapperboard },
  character: { label: 'Charakter', icon: Users }, places: { label: 'Ortsakte', icon: MapPin },
  dispatch: { label: 'Briefe & Freigaben', icon: Send }, notes: { label: 'Regienotizen', icon: NotebookPen },
  moments: { label: 'Sitzungsprotokoll', icon: Feather }, dossiers: { label: 'NSC & Akten', icon: Library }, dice: { label: 'Würfel', icon: Dices },
} satisfies Record<CommandTool, { label: string; icon: typeof BookOpen }>;
type Props = {
  workspace: CommandWorkspace; onChange: (update: (value: CommandWorkspace) => CommandWorkspace) => void;
  renderTool: (panel: CommandPanel) => ReactNode; title: (panel: CommandPanel) => string;
  onPin: (panel: CommandPanel) => void; onClose: (panel: CommandPanel) => void;
  onMove: (panel: CommandPanel, direction: 'up' | 'down' | 'column') => void;
};
export function CommandBoard({ workspace, onChange, renderTool, title, onPin, onClose, onMove }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null), [menu, setMenu] = useState<string | null>(null), [narrow, setNarrow] = useState(false);
  useEffect(() => { const media = window.matchMedia('(max-width: 850px)'); const update = () => setNarrow(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  useEffect(() => { const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setExpanded(null); setMenu(null); } }; window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape); }, []);
  const frame = (panel: CommandPanel) => {
    const tool = commandToolLabels[panel.tool], isExpanded = expanded === panel.id;
    return <section className={`${styles.panel} ${isExpanded ? styles.expanded : ''}`} aria-label={tool.label + (panel.pinnedId ? ' · angeheftet' : '')}>
      <header className={styles.panelHeading}><tool.icon size={15}/><div><strong>{tool.label}</strong><small>{title(panel)}</small></div>
        {['story', 'character', 'places', 'dossiers'].includes(panel.tool) && <button className={styles.iconButton} aria-label={tool.label + (panel.pinnedId ? ' lösen' : ' anheften')} aria-pressed={!!panel.pinnedId} onClick={() => onPin(panel)}>{panel.pinnedId ? <PinOff size={14}/> : <Pin size={14}/>}</button>}
        <button className={styles.iconButton} aria-label={tool.label + (isExpanded ? ' verkleinern' : ' vergrößern')} onClick={() => setExpanded(isExpanded ? null : panel.id)}>{isExpanded ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}</button>
        <button className={styles.iconButton} aria-label={tool.label + ' anordnen'} aria-expanded={menu === panel.id} onClick={() => setMenu(menu === panel.id ? null : panel.id)}><MoreHorizontal size={16}/></button>
        <button className={styles.iconButton} disabled={workspace.panels.length <= 1} aria-label={tool.label + ' schließen'} onClick={() => { onClose(panel); setMenu(null); }}><X size={15}/></button>
        {menu === panel.id && <div className={styles.panelMenu}><button onClick={() => { onMove(panel, 'up'); setMenu(null); }}><ArrowUp size={13}/>Weiter nach oben</button><button onClick={() => { onMove(panel, 'down'); setMenu(null); }}><ArrowDown size={13}/>Weiter nach unten</button><button onClick={() => { onMove(panel, 'column'); setMenu(null); }}><ArrowLeftRight size={13}/>Andere Spalte</button></div>}
      </header>
      <div className={styles.panelBody}>{renderTool(panel)}</div>
    </section>;
  };
  function column(index: 0 | 1) {
    const panels = workspace.panels.filter(p => p.column === index), total = panels.reduce((sum, p) => sum + p.height, 0);
    if (!panels.length) return <div className={styles.emptyColumn}><BookOpen size={24}/><p>Platz für dein nächstes Werkzeug</p><small>Oben öffnen oder über „Anordnen“ hierher verschieben.</small></div>;
    return <Group id={'command-column-' + index} orientation="vertical" className={styles.column} defaultLayout={Object.fromEntries(panels.map(p => [p.id, p.height / total * 100]))} onLayoutChanged={(layout, meta) => { if (!meta.isUserInteraction) return; onChange(w => ({ ...w, panels: w.panels.map(p => p.column === index && layout[p.id] != null ? { ...p, height: Math.max(15, Math.min(100, layout[p.id])) } : p) })); }}>
      {panels.map((p, i) => <Fragment key={p.id}>{i > 0 && <Separator className={styles.rowSeparator} aria-label="Werkzeughöhe verändern"><GripHorizontal size={14}/></Separator>}<Panel id={p.id} defaultSize={`${p.height / total * 100}%`} minSize="15%">{frame(p)}</Panel></Fragment>)}
    </Group>;
  }
  return narrow ? <div className={styles.narrowBoard}>{workspace.panels.map(p => <div key={p.id}>{frame(p)}</div>)}</div> : <div className={styles.board}><Group id="command-board" orientation="horizontal" defaultLayout={{ left: workspace.split, right: 100 - workspace.split }} onLayoutChanged={(layout, meta) => { if (meta.isUserInteraction && layout.left != null) onChange(w => ({ ...w, split: Math.max(30, Math.min(75, layout.left)) })); }}>
    <Panel id="left" defaultSize={`${workspace.split}%`} minSize="30%" maxSize="75%">{column(0)}</Panel>
    <Separator className={styles.columnSeparator} aria-label="Spaltenbreite verändern"/>
    <Panel id="right" defaultSize={`${100 - workspace.split}%`} minSize="25%">{column(1)}</Panel>
  </Group></div>;
}
