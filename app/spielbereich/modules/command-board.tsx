"use client";
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { BookOpen, Clapperboard, Users, MapPin, Send, NotebookPen, Feather, Library, Dices, Pin, PinOff, Maximize2, Minimize2, X, MoreHorizontal, ArrowUp, ArrowDown, ArrowLeftRight, GripHorizontal } from 'lucide-react';
import type { CommandPanel, CommandTool, CommandWorkspace } from '@/domain/command-workspace';
import styles from './command-workspace.module.css';
import { SceneToolDrawer } from './scene-tool-drawer';

export const commandToolLabels = {
  story: { label: 'Storybuch', icon: BookOpen }, scene: { label: 'Szenenregie', icon: Clapperboard },
  character: { label: 'Charakter', icon: Users }, places: { label: 'Ortsakte', icon: MapPin },
  dispatch: { label: 'Briefe & Freigaben', icon: Send }, notes: { label: 'Regienotizen', icon: NotebookPen },
  moments: { label: 'Sitzungsprotokoll', icon: Feather }, dossiers: { label: 'NSC & Akten', icon: Library }, dice: { label: 'Würfel', icon: Dices },
} satisfies Record<CommandTool, { label: string; icon: typeof BookOpen }>;
type Props = {
  focused?: boolean; arranging?: boolean; requestedTool?: CommandTool|null;
  workspace: CommandWorkspace; onChange: (update: (value: CommandWorkspace) => CommandWorkspace) => void;
  renderTool: (panel: CommandPanel) => ReactNode; title: (panel: CommandPanel) => string;
  onPin: (panel: CommandPanel) => void; onClose: (panel: CommandPanel) => void;
  onMove: (panel: CommandPanel, direction: 'up' | 'down' | 'column') => void;
};
export function CommandBoard({ requestedTool=null, focused = false, arranging = false, workspace, onChange, renderTool, title, onPin, onClose, onMove }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null), [menu, setMenu] = useState<string | null>(null), [narrow, setNarrow] = useState(false);
  const returnFocus=useRef<HTMLButtonElement|null>(null);
  useEffect(()=>{if(!expanded&&returnFocus.current){returnFocus.current.focus();returnFocus.current=null;}},[expanded]);
  const [expandedTop, setExpandedTop] = useState(160);
  useEffect(() => {
    if (!expanded) return;
    // Keep the return control below the real sticky navigation, including wrapped layouts.
    const navigation = document.querySelector('.player-nav');
    const update = () => setExpandedTop(Math.max(16, Math.ceil(navigation?.getBoundingClientRect().bottom ?? 0) + 8));
    const observer = new ResizeObserver(update);
    if (navigation) observer.observe(navigation);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update); };
  }, [expanded]);
  useEffect(() => { const media = window.matchMedia('(max-width: 850px)'); const update = () => setNarrow(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  useEffect(() => { const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setExpanded(null); setMenu(null); } }; window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape); }, []);
  const frame = (panel: CommandPanel) => {
    const tool = commandToolLabels[panel.tool], isExpanded = expanded === panel.id;
    return <section className={`${styles.panel} ${isExpanded ? styles.expanded : ''}`} style={isExpanded ? { '--command-expanded-top': `${expandedTop}px` } as CSSProperties : undefined} aria-label={tool.label + (panel.pinnedId ? ' · angeheftet' : '')}>
      <header className={styles.panelHeading}><tool.icon size={15}/><div><strong>{tool.label}</strong><small>{title(panel)}</small></div>
        {arranging && ['story', 'character', 'places', 'dossiers'].includes(panel.tool) && <button className={styles.iconButton} aria-label={tool.label + (panel.pinnedId ? ' lösen' : ' anheften')} aria-pressed={!!panel.pinnedId} onClick={() => onPin(panel)}>{panel.pinnedId ? <PinOff size={14}/> : <Pin size={14}/>}</button>}
        <button className={isExpanded ? styles.returnButton : styles.iconButton} title={isExpanded ? 'Zur Arbeitsfläche · Esc' : 'Vergrößern'} aria-label={tool.label + (isExpanded ? ' verkleinern' : ' vergrößern')} onClick={event => {if(!isExpanded)returnFocus.current=event.currentTarget;setExpanded(isExpanded ? null : panel.id);}}>{isExpanded ? <><Minimize2 size={14}/><span>Zur Arbeitsfläche</span></> : <Maximize2 size={14}/>}</button>
        {arranging && <button className={styles.iconButton} aria-label={tool.label + ' anordnen'} aria-expanded={menu === panel.id} onClick={() => setMenu(menu === panel.id ? null : panel.id)}><MoreHorizontal size={16}/></button>}
        {arranging && <button className={styles.iconButton} disabled={workspace.panels.length <= 1} aria-label={tool.label + ' schließen'} onClick={() => { onClose(panel); setMenu(null); }}><X size={15}/></button>}
        {arranging && menu === panel.id && <div className={styles.panelMenu}><button onClick={() => { onMove(panel, 'up'); setMenu(null); }}><ArrowUp size={13}/>Weiter nach oben</button><button onClick={() => { onMove(panel, 'down'); setMenu(null); }}><ArrowDown size={13}/>Weiter nach unten</button><button onClick={() => { onMove(panel, 'column'); setMenu(null); }}><ArrowLeftRight size={13}/>Andere Spalte</button></div>}
      </header>
      <div className={styles.panelBody}>{renderTool(panel)}</div>
    </section>;
  };
  function column(index: 0 | 1) {
    const panels = workspace.panels.filter(p => p.column === index), total = panels.reduce((sum, p) => sum + p.height, 0);
    if (!panels.length) return <div className={styles.emptyColumn}><BookOpen size={24}/><p>Platz für dein nächstes Werkzeug</p><small>Oben öffnen oder über „Anordnen“ hierher verschieben.</small></div>;
    return <Group id={'command-column-' + index} orientation="vertical" className={styles.column} defaultLayout={Object.fromEntries(panels.map(p => [p.id, p.height / total * 100]))} onLayoutChanged={(layout, meta) => { if (!arranging || !meta.isUserInteraction) return; onChange(w => ({ ...w, panels: w.panels.map(p => p.column === index && layout[p.id] != null ? { ...p, height: Math.max(15, Math.min(100, layout[p.id])) } : p) })); }}>
      {panels.map((p, i) => <Fragment key={p.id}>{i > 0 && <Separator disabled={!arranging} className={styles.rowSeparator} aria-label="Werkzeughöhe verändern"><GripHorizontal size={14}/></Separator>}<Panel id={p.id} defaultSize={`${p.height / total * 100}%`} minSize="15%">{frame(p)}</Panel></Fragment>)}
    </Group>;
  }
  // Presentation only: never mutate or persist the desktop panel order.
  const mobilePanels = [...workspace.panels].sort((a, b) => Number(b.tool === 'scene') - Number(a.tool === 'scene'));
  // A saved expert layout may omit scenes: live focus still needs one scene surface.
  if(focused&&!mobilePanels.some(panel=>panel.tool==='scene'))mobilePanels.unshift({id:'live-scene',tool:'scene',column:0,height:100,pinnedId:null});
  return narrow || focused ? <div className={styles.narrowBoard}>{mobilePanels.filter(p => p.tool === 'scene').slice(0,focused?1:undefined).map(p => <div key={p.id}>{frame(p)}</div>)}<SceneToolDrawer requestedId={mobilePanels.find(p => p.tool === requestedTool && p.tool !== 'scene')?.id} tools={mobilePanels.filter(p => p.tool !== 'scene').map(p => ({id:p.id,label:commandToolLabels[p.tool].label+' · '+title(p),icon:commandToolLabels[p.tool].icon,content:frame(p)}))}/></div> : <div className={styles.board}><Group id="command-board" orientation="horizontal" defaultLayout={{ left: workspace.split, right: 100 - workspace.split }} onLayoutChanged={(layout, meta) => { if (arranging && meta.isUserInteraction && layout.left != null) onChange(w => ({ ...w, split: Math.max(30, Math.min(75, layout.left)) })); }}>
    <Panel id="left" defaultSize={`${workspace.split}%`} minSize="30%" maxSize="75%">{column(0)}</Panel>
    <Separator disabled={!arranging} className={styles.columnSeparator} aria-label="Spaltenbreite verändern"/>
    <Panel id="right" defaultSize={`${100 - workspace.split}%`} minSize="25%">{column(1)}</Panel>
  </Group></div>;
}
