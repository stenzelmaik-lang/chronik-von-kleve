"use client";
/* eslint-disable @next/next/no-img-element -- Images come from the authenticated gallery endpoint. */
import {useEffect,useState} from "react";
import {ArrowRight} from "lucide-react";
import {api} from "./api-client";
import styles from "./dashboard.module.css";

type Gallery={characters:{id:string;name:string;images:{url:string;caption:string}[]}[]};

/** Zuflucht: the newest shared images of the round as a small preview; the full gallery is its own page. */
export function GalleryPreview({onOpen}:{onOpen:()=>void}){
  const [images,setImages]=useState<{url:string;caption:string;name:string}[]|null>(null);
  useEffect(()=>{let on=true;api<Gallery>("/api/character-gallery").then(d=>{if(on)setImages(d.characters.flatMap(c=>c.images.map(i=>({...i,name:c.name}))).slice(0,4));}).catch(()=>{if(on)setImages([]);});return()=>{on=false;};},[]);
  if(images===null)return <p>Bilder werden geladen …</p>;
  return <>
    {images.length?<div className={styles.galleryPreview}>{images.map(i=><img key={i.url} src={i.url} alt={i.caption||i.name} loading="lazy"/>)}</div>:<p>Noch hat kein Charakter Bilder mit der Runde geteilt.</p>}
    <button type="button" className={styles.recapLink} onClick={onOpen}>Zur Galerie<ArrowRight size={15} aria-hidden="true"/></button>
  </>;
}
