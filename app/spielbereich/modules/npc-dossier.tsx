/* eslint-disable @next/next/no-img-element -- Protected original images use the existing file API. */
"use client";
import { useEffect, useState } from 'react';
import { api } from './api-client';
import { loadEntityDossier } from './npc-data';
import { npcCardData } from './npc-card-data';
import { dossierSections, dossierRelations, blockKindNames, relationNames, entityTypeNames,npcReadingSections,npcIdentityFacts } from './npc-dossier-data';
import {npcFieldVisibility,hasNPCFieldVisibility} from '@/domain/npc-profile';
import { describeDataError } from './player-data-cache';
import { safeImage } from './shared';
import { RichTextView } from './rich-text';
import styles from './npc-dossier.module.css';

type Dossier = Awaited<ReturnType<typeof loadEntityDossier>>;
export function NPCDossier({ id, gm, onOpen, onDenied, onReady, onEdit }: { id: string; gm: boolean; onOpen: (id: string, title: string) => void; onDenied: () => void; onReady: () => void; onEdit?: (id:string)=>void }) {
  const [detail,setDetail]=useState<Dossier|null>(null);
  const [error,setError]=useState<Error|null>(null);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let alive=true;
    loadEntityDossier(api,id,gm).then(d=>{if(alive)setDetail(d);}).catch(e=>{if(alive){setError(e);if(describeDataError(e).permission)onDenied();}});
    return ()=>{alive=false;};
    // Parent render changes must not restart protected requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[id,gm,retry]);
  useEffect(()=>{if(detail)onReady();},[detail,onReady]);
  if(error)return <section role="alert" className="error-box"><h2>Akte nicht verfügbar</h2><p>{error.message}</p><button className="button" onClick={()=>{setError(null);setRetry(n=>n+1);}}>Erneut versuchen</button></section>;
  if(!detail)return <p role="status">Akte wird geladen …</p>;
  const {entity,blocks,relationships,relatedEntities}=detail;
  const card=npcCardData(entity,gm), image=safeImage(entity.content.image_primary)||safeImage(entity.content.image);
  const sections=dossierSections(entity,blocks,gm);
  const groups=dossierRelations(id,relationships,relatedEntities,gm);
  const publicGroups=groups.filter(g=>g.title!=='SL-INTERN'),secretGroups=groups.filter(g=>g.title==='SL-INTERN');
  const links=(items: typeof groups[number]['items'])=><div className={styles.links}>{items.map(({relation,entity:other,incoming})=><button type="button" key={relation.id} className={styles.link} onClick={()=>onOpen(other.id,other.title)}><span className={styles.linkType}>{entityTypeNames[other.type]??other.type}</span><strong>{other.title}</strong><span>{relationNames[relation.type]??relation.type}{incoming?' · eingehend':''} ↗</span></button>)}</div>;
  if(entity.type==='NPC'){
    const reading=npcReadingSections(blocks,gm),facts=npcIdentityFacts(entity),structured=hasNPCFieldVisibility(entity.content);
    const primary=image,secondary=safeImage(entity.content.image_secondary);
    const originalRelations=groups.flatMap(g=>g.items),npcRelations=originalRelations.filter(i=>i.entity.type==='NPC');
    const worldTypes=['PLACE','storyline','SCENE','SESSION'];
    const world=worldTypes.map(type=>({type,items:originalRelations.filter(i=>i.entity.type===type)})).filter(g=>g.items.length);
    const blockViews=(items:typeof blocks)=>items.map(b=><div className={styles.textBlock} key={b.id}>{gm&&b.visibility==='sl_secret'&&<span className={styles.visibility}>SL-INTERN</span>}<RichTextView value={b.content}/></div>);
    const relationViews=(items:typeof originalRelations)=><div className={styles.links}>{items.map(({relation,entity:other,secret})=><button type="button" key={relation.id} className={styles.link} onClick={()=>onOpen(other.id,other.title)}><strong>{other.title}</strong>{relation.note?.trim()&&<span>{relation.note}</span>}<span>{relationNames[relation.type]??relation.type} ↗</span>{gm&&secret&&<span className={styles.visibility}>SL-INTERN</span>}</button>)}</div>;
    const legacyBio=typeof entity.content.text==='string'?entity.content.text.trim():'';
    const legacySummary=typeof entity.content.summary==='string'?entity.content.summary.trim():'';
    return <article className={styles.dossier}>
      <header className={`${styles.hero} ${styles.npcHero}`}>
        <div className={styles.identity}><p className={styles.overline}>CHARAKTERAKTE{gm&&entity.defaultVisibility==='sl_secret'?' · SL-INTERN':''}</p><h1>{entity.title}</h1>{card.alias&&<p className={styles.alias}>{card.alias}</p>}
          <div className={styles.facts}>{facts.map(f=><div key={f.key}><span>{f.label}{gm&&structured&&npcFieldVisibility(entity.content,f.key)==='sl_secret'?' · SL-INTERN':''}</span><strong>{f.value}</strong></div>)}</div>
          {gm&&<p className={styles.admin}>Kanonstatus: {entity.canonStatus}{entity.playState?` · Spielstatus: ${entity.playState}`:''}</p>}
          {gm&&onEdit&&<button type="button" className="button" onClick={()=>onEdit(entity.id)}>Bearbeiten</button>}
        </div><div className={styles.portrait}>{primary?<img src={primary} alt={`Darstellung von ${entity.title}`}/>:<span aria-hidden="true">{card.initials}</span>}</div>
      </header>
      {(reading.short.length>0||legacySummary)&&<section className={styles.section} aria-label="Kurzprofil"><h2>Kurzprofil</h2>{blockViews(reading.short)}{!reading.short.length&&legacySummary&&<RichTextView value={legacySummary}/>}</section>}
      {(reading.biography.length>0||legacyBio)&&<section className={styles.section} aria-label="Biografie"><h2>Biografie</h2><div className={secondary?styles.biography:undefined}><div>{blockViews(reading.biography)}{!reading.biography.length&&legacyBio&&<RichTextView value={legacyBio}/>}</div>{secondary&&<img className={styles.secondary} src={secondary} alt={`Portrait von ${entity.title}`}/>}</div></section>}
      {reading.personality.length>0&&<section className={styles.section} aria-label="Persönlichkeit"><h2>Persönlichkeit</h2>{blockViews(reading.personality)}</section>}
      {npcRelations.length>0&&<section className={styles.section} aria-label="Beziehungen"><h2>Beziehungen</h2>{relationViews(npcRelations)}</section>}
      {world.length>0&&<section className={styles.section} aria-label="Weltverknüpfungen"><h2>Weltverknüpfungen</h2>{world.map(g=><section key={g.type}><h3>{entityTypeNames[g.type]}</h3>{relationViews(g.items)}</section>)}</section>}
      {gm&&(reading.internal.length>0||sections.gmBody.trim())&&<aside className={styles.secret} aria-label="SL-INTERN"><h2>SL-INTERN</h2>{reading.internal.map(b=><section key={b.id}><h3>{blockKindNames[b.kind]??b.kind}</h3><RichTextView value={b.content}/></section>)}{sections.gmBody.trim()&&<section><h3>Interne Notizen</h3><RichTextView value={sections.gmBody}/></section>}</aside>}
    </article>;
  }
  return <article className={styles.dossier}>
    <header className={styles.hero}>
      <div className={styles.portrait}>{image?<img src={image} alt={`Darstellung von ${entity.title}`} />:<span aria-hidden="true">{card.initials}</span>}</div>
      <div className={styles.identity}><p className={styles.overline}>{entityTypeNames[entity.type]??'ORIGINALAKTE'}{gm&&(entity.defaultVisibility==='sl_secret'||entity.canonStatus==='GM_SECRET')?' · SL-INTERN':''}</p><h1>{entity.title}</h1>{card.alias&&<p className={styles.alias}>{card.alias}</p>}<div className={styles.facts}>{card.facts.map(f=><div key={f.label}><span>{f.label}</span><strong>{f.value}</strong></div>)}</div></div>
    </header>
    <section className={styles.section} aria-label="Kurzprofil"><h2>Kurzprofil</h2>{typeof entity.content.summary==='string' && entity.content.summary ? <RichTextView value={entity.content.summary}/>:card.facts.length?<dl className={styles.profile}>{card.facts.map(f=><div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>:<p className="muted">Noch kein Kurzprofil hinterlegt.</p>}</section>
    <div className={styles.reading}>{sections.texts.filter(t=>t.key!=='summary').map(t=><section className={styles.section} key={t.key}><p className={styles.overline}>DIE AKTE</p><h2>{t.title}</h2><RichTextView value={t.content}/></section>)}
      {sections.publicBlocks.map(b=><section className={styles.section} key={b.id}><h2>{blockKindNames[b.kind]??b.kind}</h2><RichTextView value={b.content}/></section>)}
      {!sections.publicBlocks.length&&!sections.texts.some(t=>t.key!=='summary')&&<section className={styles.section}><h2>Hintergrund & Biografie</h2><p className="muted">Noch keine freigegebenen Lesebereiche vorhanden.</p></section>}
    </div>
    <section className={styles.section}><p className={styles.overline}>VERBINDUNGEN ZUR SPIELWELT</p><h2>Beziehungen & Weltbezüge</h2>{publicGroups.length?publicGroups.map(g=><section className={styles.group} key={g.title}><h3>{g.title}</h3>{links(g.items)}</section>):<p className="muted">Keine freigegebenen Beziehungen.</p>}</section>
    {gm&&(sections.gmBody||sections.secretBlocks.length||secretGroups.length>0)&&<aside className={styles.secret} aria-label="SL-INTERN"><p className={styles.overline}>NUR FÜR DIE SPIELLEITUNG</p><h2>SL-INTERN</h2><p className={styles.secretHint}>Diese Inhalte sind kein Spielerwissen.</p>{sections.gmBody&&<section><h3>Interne Notizen</h3><RichTextView value={sections.gmBody}/></section>}{sections.secretBlocks.map(b=><section key={b.id}><h3>{blockKindNames[b.kind]??b.kind}</h3><RichTextView value={b.content}/></section>)}{secretGroups.map(g=><section key={g.title}><h3>Vertrauliche Verknüpfungen</h3>{links(g.items)}</section>)}</aside>}
  </article>;
}
