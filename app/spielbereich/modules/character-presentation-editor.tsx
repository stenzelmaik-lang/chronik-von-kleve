"use client";

/* eslint-disable @next/next/no-img-element -- Private gallery media is served by the authenticated file endpoint. */
import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowRight,Camera,Eye,ImagePlus,Lock,Trash2} from 'lucide-react';
import {api} from './api-client';
import styles from './character-presentation-editor.module.css';

type GalleryImage={fileId:string;caption:string};
type Presentation={published:boolean;tagline:string;introduction:string;gallery:GalleryImage[]};
type Draft={version:number;presentation:Presentation};
const empty:Presentation={published:false,tagline:'',introduction:'',gallery:[]};
const imageUrl=(fileId:string)=>'/api/files?id='+encodeURIComponent(fileId);

export function CharacterPresentationEditor({id,title,onChanged,onDirty}:{id:string;title:string;onChanged:()=>void;onDirty:(dirty:boolean)=>void}){
  const [draft,setDraft]=useState<Draft|null>(null);
  const [busy,setBusy]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{
    let current=true;
    api<{version:number;presentation:Presentation|null}>('/api/character-companion?id='+encodeURIComponent(id))
      .then(data=>{if(current)setDraft({...data,presentation:data.presentation??empty});})
      .catch(reason=>{if(current)setError((reason as Error).message);});
    return()=>{current=false;};
  },[id]);
  function change(update:(card:Presentation)=>Presentation){
    setDraft(previous=>previous&&{...previous,presentation:update(previous.presentation)});
    setDirty(true);
    onDirty(true);
    setFeedback('');
  }
  async function save(){
    if(!draft||busy)return;
    setBusy(true);
    setError('');
    try{
      const saved=await api<{version:number}>('/api/character-companion','PATCH',{action:'presentation',id,...draft});
      setDraft({...draft,version:saved.version});
      setDirty(false);
      onDirty(false);
      setFeedback(draft.presentation.published?'Für deine Kampagnenrunde freigegeben.':'Als privater Entwurf gespeichert.');
      onChanged();
    }catch(reason){setError((reason as Error).message);}
    finally{setBusy(false);}
  }
  async function upload(file:File|undefined){
    if(!file||!draft||busy||draft.presentation.gallery.length>=8)return;
    setError('');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){
      setError('Bitte JPG, PNG oder WebP bis 8 MB auswählen.');
      return;
    }
    setBusy(true);
    try{
      const form=new FormData();
      form.set('file',file);
      form.set('visibility','private');
      const uploaded=await api<{id:string}>('/api/files','POST',form);
      change(card=>({...card,gallery:[...card.gallery,{fileId:uploaded.id,caption:''}]}));
    }catch(reason){setError((reason as Error).message);}
    finally{setBusy(false);}
  }
  function move(index:number,offset:number){
    change(card=>{
      const gallery=[...card.gallery];
      const [item]=gallery.splice(index,1);
      gallery.splice(index+offset,0,item);
      return {...card,gallery};
    });
  }
  if(!draft)return <p role={error?'alert':'status'}>{error||'Figurenprofil wird geladen …'}</p>;
  const card=draft.presentation;
  return <section className={styles.editor} aria-label="Figurenprofil bearbeiten">
    <form onSubmit={event=>{event.preventDefault();void save();}}>
      <fieldset disabled={busy}>
        <legend>Auftritt deiner Figur</legend>
        <p>Gestalte die Vorstellung, die deine Runde am Spieltisch öffnen kann.</p>
        <label>Ein Satz, der hängen bleibt<input value={card.tagline} maxLength={100} onChange={event=>change(previous=>({...previous,tagline:event.target.value}))}/></label>
        <label>Vorstellung<textarea value={card.introduction} maxLength={1200} rows={5} onChange={event=>change(previous=>({...previous,introduction:event.target.value}))}/></label>
        <h3><Camera size={17} aria-hidden="true"/> Figuren-Galerie <small>{card.gallery.length}/8</small></h3>
        <p>Das erste Bild eröffnet deine Galerie. Mit den Pfeilen änderst du die Reihenfolge.</p>
        {card.gallery.map((item,index)=><div className={styles.imageRow} key={item.fileId}>
          <img src={imageUrl(item.fileId)} alt=""/>
          <label>Bildunterschrift {index+1}<input maxLength={160} value={item.caption} onChange={event=>change(previous=>({...previous,gallery:previous.gallery.map(image=>image.fileId===item.fileId?{...image,caption:event.target.value}:image)}))}/></label>
          <div className={styles.controls}>
            <button type="button" aria-label={'Bild '+(index+1)+' nach vorne'} disabled={index===0} onClick={()=>move(index,-1)}><ArrowLeft size={15}/></button>
            <button type="button" aria-label={'Bild '+(index+1)+' nach hinten'} disabled={index===card.gallery.length-1} onClick={()=>move(index,1)}><ArrowRight size={15}/></button>
            <button type="button" aria-label={'Bild '+(index+1)+' aus der Galerie entfernen'} onClick={()=>change(previous=>({...previous,gallery:previous.gallery.filter(image=>image.fileId!==item.fileId)}))}><Trash2 size={15}/></button>
          </div>
        </div>)}
        <label className={styles.upload}><ImagePlus size={17} aria-hidden="true"/> Bild hinzufügen<input type="file" accept="image/jpeg,image/png,image/webp" disabled={card.gallery.length>=8} onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';void upload(file);}}/></label>
        <label className={styles.release}><input type="checkbox" checked={card.published} onChange={event=>change(previous=>({...previous,published:event.target.checked}))}/> Vorstellung und Galerie für die Kampagnenrunde freigeben</label>
        <button type="submit" className={styles.save} disabled={!dirty}>{busy?'Speichert …':'Figurenprofil speichern'}</button>
      </fieldset>
      {error&&<p role="alert">{error}</p>}{feedback&&<p role="status">{feedback}</p>}
    </form>
    <article className={styles.preview} aria-label="Vorschau der Figur">
      {card.gallery[0]&&<img className={styles.hero} src={imageUrl(card.gallery[0].fileId)} alt={card.gallery[0].caption}/>}
      <div className={styles.previewBody}>
        <span className={styles.eyebrow}>{card.published?<Eye size={14}/>:<Lock size={14}/>} Vorschau · {card.published?'Für die Runde':'Privat'}</span>
        <h2>{title}</h2>
        {card.tagline&&<p className={styles.tagline}>{card.tagline}</p>}
        <p>{card.introduction||'Hier erscheint deine Vorstellung.'}</p>
        {!!card.gallery.length&&<div className={styles.contactSheet}>{card.gallery.map(item=><figure key={item.fileId}><img src={imageUrl(item.fileId)} alt={item.caption||'Galeriebild'}/>{item.caption&&<figcaption>{item.caption}</figcaption>}</figure>)}</div>}
      </div>
    </article>
  </section>;
}
