"use client";
/* eslint-disable @next/next/no-img-element -- Images are streamed through the private, authorization-checked media route. */
import type { Actor } from "@/domain/types";
import type { DiscoveryState,PlaceProjection } from "@/domain/location-types";
import { ELECTRIC_TABERNA_ID } from "@/domain/location-model";
import { Map as MapLibreMap,Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Check,Eye,MapPin,RefreshCw,Save,Send,ShieldCheck,Slash } from "lucide-react";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";
import { toast } from "sonner";
import { api } from "./api-client";

type Scope="public"|"group"|"player";
type LocationOption={id:string;title:string;position:number};
type NodeOption={id:string;locationId:string;parentId:string|null;level:"location"|"area"|"room"|"information";position:number;title:string};
type PlayerOption={id:string;name:string};
type Draft={id:string;revision_no:number;audience_scope:string;audience_key:string;audience_user_id:string|null;status:string;version:number;player_payload_json:string;geography_json:string;hero_file_id?:string|null};
type Geography={status:"unknown"}|{status:"exact";coordinates:[number,number];source:string;reference?:string;reviewedAt:string}|{status:"approximate";coordinates:[number,number];accuracyMeters:number;source:string;reference?:string;reviewedAt:string};
type Preview={projection:PlaceProjection;preview:{scope:string;viewerId:string}};
type CmsState={locations:LocationOption[];players:PlayerOption[]};
const parse=(raw:string):Record<string,unknown>=>{try{const x:unknown=JSON.parse(raw);return x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:{};}catch{return {};}};
const discovery:DiscoveryState[]=["rumored","known","visited","investigated"];
const inputClass="field";

export function LocationCMS({a}:{a:Actor}){
  const publisher=a.status==="active"&&["campaign_owner","campaign_gm"].includes(a.role);
  const [catalog,setCatalog]=useState<CmsState>({locations:[],players:[]});
  const [placeId,setPlaceId]=useState("");
  const [nodes,setNodes]=useState<NodeOption[]>([]);
  const [nodeId,setNodeId]=useState("");
  const [scope,setScope]=useState<Scope>("group");
  const [playerId,setPlayerId]=useState("");
  const [drafts,setDrafts]=useState<Draft[]>([]);
  const [draftId,setDraftId]=useState("");
  const [payload,setPayload]=useState<Record<string,unknown>>({});
  const [geo,setGeo]=useState<Geography>({status:"unknown"});
  const [pickedCoordinates,setPickedCoordinates]=useState<[number,number]|null>(null);
  const [discoveryState,setDiscoveryState]=useState<DiscoveryState>("known");
  const [heroFileId,setHeroFileId]=useState<string|null>(null);
  const [release,setRelease]=useState<{currentVersion:number;currentTransition:string|null;history:unknown[]}>({currentVersion:0,currentTransition:null,history:[]});
  const [preview,setPreview]=useState<Preview|null>(null);
  const [reason,setReason]=useState("");
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [mapState,setMapState]=useState<"loading"|"ready"|"error">("loading");
  const uploadRef=useRef<HTMLInputElement>(null);
  const mapHost=useRef<HTMLDivElement>(null);
  const mapRef=useRef<MapLibreMap|null>(null);
  const markerRef=useRef<Marker|null>(null);
  const geoRef=useRef(geo);
  const setGeoRef=useRef(setGeo);
  const node=nodes.find(item=>item.id===nodeId)||null;
  const selectedDraft=drafts.find(item=>item.id===draftId)||null;
  const isRoot=node?.level==="location";
  const playerTarget=scope==="player"?playerId:"";
  const mediaUrl=useMemo(()=>heroFileId&&selectedDraft?`/api/cms/media?id=${encodeURIComponent(heroFileId)}&entityId=${encodeURIComponent(nodeId)}&revisionId=${encodeURIComponent(selectedDraft.id)}&preview=1`:"",[heroFileId,nodeId,selectedDraft]);

  useEffect(()=>{geoRef.current=geo;setGeoRef.current=setGeo;},[geo]);
  const loadCatalog=useCallback(async()=>{
    setLoading(true);
    try{
      const result=await api<{locations:LocationOption[];players?:PlayerOption[]}>('/api/cms/locations');
      const next={locations:result.locations,players:result.players||[]};setCatalog(next);
      setPlaceId(current=>current&&next.locations.some(item=>item.id===current)?current:next.locations.some(item=>item.id===ELECTRIC_TABERNA_ID)?ELECTRIC_TABERNA_ID:next.locations[0]?.id||"");
    }catch(error){toast.error((error as Error).message);}finally{setLoading(false);}
  },[]);
  useEffect(()=>{
    const timer=window.setTimeout(()=>{void loadCatalog();},0);
    return()=>window.clearTimeout(timer);
  },[loadCatalog]);
  useEffect(()=>{
    let alive=true;
    const timer=window.setTimeout(()=>{
      if(!placeId){setNodes([]);setNodeId("");return;}
      setLoading(true);
      api<{nodes:NodeOption[]}>(`/api/cms/locations?place=${encodeURIComponent(placeId)}`).then(result=>{
        if(!alive)return;setNodes(result.nodes);setNodeId(current=>result.nodes.some(row=>row.id===current)?current:result.nodes.find(row=>row.level==="location")?.id||"");
      }).catch(error=>{if(alive)toast.error((error as Error).message);}).finally(()=>{if(alive)setLoading(false);});
    },0);
    return()=>{alive=false;window.clearTimeout(timer);};
  },[placeId]);
  const refreshDrafts=useCallback(async(selectNewest=false)=>{
    if(!nodeId){setDrafts([]);setDraftId("");return;}
    const result=await api<{drafts:Draft[]}>(`/api/cms/drafts?entityId=${encodeURIComponent(nodeId)}`);
    const scoped=result.drafts.filter(item=>item.audience_scope===scope&&(scope!=="player"||item.audience_user_id===playerTarget));
    setDrafts(result.drafts);
    const current=selectNewest?"":draftId;
    const selected=scoped.find(item=>item.id===current)||scoped[0]||null;
    setDraftId(selected?.id||"");
    if(selected){setPayload(parse(selected.player_payload_json));const selectedGeo=(parse(selected.geography_json) as unknown as Geography)||{status:"unknown"};setGeo(selectedGeo);setPickedCoordinates(selectedGeo.status==="unknown"?null:selectedGeo.coordinates);setHeroFileId(selected.hero_file_id||null);}
    else {setPayload({});setGeo({status:"unknown"});setPickedCoordinates(null);setHeroFileId(null);setPreview(null);}
  },[nodeId,scope,playerTarget,draftId]);
  useEffect(()=>{
    const timer=window.setTimeout(()=>{void refreshDrafts(true).catch(error=>toast.error((error as Error).message));},0);
    return()=>window.clearTimeout(timer);
  },[refreshDrafts]);
  const refreshRelease=useCallback(async()=>{
    if(!publisher||!nodeId)return;
    if(scope==="player"&&!playerTarget){setRelease({currentVersion:0,currentTransition:null,history:[]});return;}
    try{const query=new URLSearchParams({entityId:nodeId,scope,...(scope==="player"&&playerTarget?{playerId:playerTarget}:{})});setRelease(await api<{currentVersion:number;currentTransition:string|null;history:unknown[]}>(`/api/cms/releases?${query}`));}catch(error){toast.error((error as Error).message);}
  },[nodeId,scope,playerTarget,publisher]);
  useEffect(()=>{
    const timer=window.setTimeout(()=>{void refreshRelease();},0);
    return()=>window.clearTimeout(timer);
  },[refreshRelease]);

  useEffect(()=>{
    const host=mapHost.current;if(!host||!isRoot)return;
    setMapState("loading");const map=new MapLibreMap({container:host,style:"https://tiles.openfreemap.org/styles/dark",center:[6.18,51.78],zoom:10,minZoom:5,maxZoom:18,attributionControl:{compact:false},dragRotate:false,pitchWithRotate:false});mapRef.current=map;
    map.once("load",()=>setMapState("ready"));map.on("error",event=>{if(event.error.message.toLowerCase().includes("style"))setMapState("error");});
    map.on("click",event=>{const current=geoRef.current;const coordinates:[number,number]=[Number(event.lngLat.lng.toFixed(6)),Number(event.lngLat.lat.toFixed(6))];
      if(current.status==="unknown")setPickedCoordinates(coordinates);
      else setGeoRef.current({...current,coordinates});
    });
    return()=>{markerRef.current?.remove();markerRef.current=null;map.remove();mapRef.current=null;};
  },[isRoot,nodeId]);
  useEffect(()=>{
    const map=mapRef.current;if(!map)return;
    if(geo.status==="unknown"){markerRef.current?.remove();markerRef.current=null;return;}
    if(markerRef.current)markerRef.current.setLngLat(geo.coordinates);
    else markerRef.current=new Marker({color:"#e2ba72"}).setLngLat(geo.coordinates).addTo(map);
    map.easeTo({center:geo.coordinates,duration:250});
  },[geo]);

  function setField(key:string,value:unknown){setPayload(current=>({...current,[key]:value}));setPreview(null);}
  async function createDraft(){
    if(!node)return;setBusy(true);
    try{
      const data=await api<{id:string;version:number;payload:Record<string,unknown>;geography:Geography}>('/api/cms/drafts','POST',{entityId:node.id,audience:scope,...(scope==="player"?{playerId:playerTarget}:{}),...(node.level==="location"?{geography:{status:"unknown"}}:{})});
      toast.success("Entwurf angelegt");await refreshDrafts(true);setDraftId(data.id);setPayload(data.payload);setGeo(data.geography);await refreshRelease();
    }catch(error){toast.error((error as Error).message);}finally{setBusy(false);}
  }
  async function saveDraft(){
    if(!selectedDraft||!node)return;setBusy(true);
    try{await api('/api/cms/drafts','PATCH',{revisionId:selectedDraft.id,expectedVersion:selectedDraft.version,payload,...(isRoot?{geography:geo}:{}),heroFileId});toast.success("Entwurf mit Versionsschutz gespeichert");setPreview(null);await refreshDrafts(true);await refreshRelease();}
    catch(error){toast.error((error as Error).message);if((error as {status?:number}).status===409)await refreshDrafts(true);}finally{setBusy(false);}
  }
  async function transition(action:"submit"|"approve"|"reject"){
    if(!selectedDraft)return;setBusy(true);
    try{await api('/api/cms/transitions','POST',{action,revisionId:selectedDraft.id,expectedVersion:selectedDraft.version,...(reason?{reason}:{})});toast.success(action==="submit"?"Zur Prüfung eingereicht":action==="approve"?"Entwurf genehmigt":"Entwurf zurückgegeben");setReason("");await refreshDrafts(true);}
    catch(error){toast.error((error as Error).message);if((error as {status?:number}).status===409)await refreshDrafts(true);}finally{setBusy(false);}
  }
  async function inspectPreview(){if(!selectedDraft)return;setBusy(true);try{const data=await api<Preview>('/api/cms/preview','POST',{revisionId:selectedDraft.id,...(scope==="group"&&playerId?{viewerId:playerId}:{})});setPreview(data);}catch(error){toast.error((error as Error).message);}finally{setBusy(false);}}
  async function changeRelease(action:"publish"|"revoke"|"block"){
    if(!node||!reason.trim())return;
    if(!window.confirm(action==="publish"?"Diesen genehmigten Stand genau für die gewählte Zielgruppe veröffentlichen?":action==="revoke"?"Die Freigabe zurückziehen? Danach greift gegebenenfalls die Freigabe einer niedrigeren Ebene.":"Diese Zielgruppe ausdrücklich sperren? Eine niedrigere Freigabe bleibt dadurch ebenfalls verborgen."))return;
    setBusy(true);
    try{await api('/api/cms/releases','POST',{action,entityId:node.id,scope,...(scope==="player"?{playerId:playerTarget}:{}),...(action==="publish"&&selectedDraft?{revisionId:selectedDraft.id}:{}),expectedReleaseVersion:release.currentVersion,...(action==="publish"&&scope!=="public"?{discoveryState:discoveryState}:{ }),reason:reason.trim()});toast.success(action==="publish"?"Gezielt veröffentlicht":action==="revoke"?"Freigabe zurückgezogen":"Zielgruppe gesperrt");setPreview(null);await refreshRelease();}
    catch(error){toast.error((error as Error).message);if((error as {status?:number}).status===409)await refreshRelease();}finally{setBusy(false);}
  }
  async function uploadHero(file:File){
    if(!selectedDraft)return;
    setBusy(true);try{const form=new FormData();form.set("file",file);const result=await api<{id:string}>('/api/cms/media','POST',form);setHeroFileId(result.id);toast.success("Bild sicher im privaten Speicher abgelegt. Speichere den Entwurf, um es anzuhängen.");}
    catch(error){toast.error((error as Error).message);}finally{setBusy(false);}
  }
  function updateCoordinates(index:0|1,value:string){const numeric=Number(value);if(!Number.isFinite(numeric)||geo.status==="unknown")return;const coordinates:[number,number]=[...geo.coordinates];coordinates[index]=numeric;setGeo({...geo,coordinates});}
  const visibleDrafts=drafts.filter(item=>item.audience_scope===scope&&(scope!=="player"||item.audience_user_id===playerTarget));

  return <div className="admin-stack" data-location-cms="phase-c">
    <section className="panel">
      <div className="section-title"><div><p className="eyebrow">SICHERE KAMPAGNENVERWALTUNG</p><h2>Orte kuratieren</h2><p className="muted">Bestehende Orts-IDs bearbeiten. Entwürfe werden erst nach Prüfung für ihr ausgewähltes Ziel sichtbar.</p></div><button type="button" className="button" onClick={()=>void loadCatalog()} disabled={loading}><RefreshCw size={15}/> Aktualisieren</button></div>
      {!catalog.locations.length?<p className="muted">{loading?"Orte werden geladen …":"Keine bestehenden Orte verfügbar."}</p>:<div className="entry-grid">
        <label className={inputClass}><span>Bestehender Ort</span><select value={placeId} onChange={event=>setPlaceId(event.target.value)}>{catalog.locations.map(place=><option key={place.id} value={place.id}>{place.title}</option>)}</select></label>
        <label className={inputClass}><span>Bereich, Raum oder Information</span><select value={nodeId} onChange={event=>setNodeId(event.target.value)}>{nodes.map(item=><option key={item.id} value={item.id}>{"　".repeat(item.level==="room"||item.level==="information"?2:item.level==="area"?1:0)}{item.title} · {item.level}</option>)}</select></label>
        <label className={inputClass}><span>Freigabeziel</span><select value={scope} onChange={event=>{setScope(event.target.value as Scope);setPlayerId("");setPreview(null);}}><option value="group">Aktive Spielgruppe</option>{publisher&&<><option value="public">Öffentlich</option><option value="player">Einzelner Spieler</option></>}</select></label>
        {scope==="player"&&publisher&&<label className={inputClass}><span>Spieler</span><select value={playerId} onChange={event=>{setPlayerId(event.target.value);setPreview(null);}}><option value="">Spieler wählen</option>{catalog.players.map(player=><option key={player.id} value={player.id}>{player.name}</option>)}</select></label>}
      </div>}
    </section>
    {node&&<>
      <section className="panel">
        <div className="section-title"><div><p className="eyebrow">{node.level.toUpperCase()} · {node.id}</p><h2>{node.title}</h2></div>{selectedDraft&&<span className="badge">{selectedDraft.status} · Revision {selectedDraft.revision_no} · Version {selectedDraft.version}</span>}</div>
        <div className="entry-grid">
          <label className={inputClass}><span>Vorhandener Entwurf für dieses Ziel</span><select value={draftId} onChange={event=>{const chosen=drafts.find(item=>item.id===event.target.value);setDraftId(event.target.value);setPayload(chosen?parse(chosen.player_payload_json):{});const chosenGeo=chosen?(parse(chosen.geography_json) as unknown as Geography):{status:"unknown" as const};setGeo(chosenGeo);setPickedCoordinates(chosenGeo.status==="unknown"?null:chosenGeo.coordinates);setHeroFileId(chosen?.hero_file_id||null);setPreview(null);}}><option value="">Kein Entwurf ausgewählt</option>{visibleDrafts.map(item=><option key={item.id} value={item.id}>#{item.revision_no} · {item.status} · V{item.version}</option>)}</select></label>
          {!selectedDraft&&<button type="button" className="button primary" onClick={()=>void createDraft()} disabled={busy||!node||scope==="player"&&!playerId}>Entwurf für dieses Ziel anlegen</button>}
        </div>
        {selectedDraft&&<>
          {node.level==="location"?<div className="entry-grid">
            <label className={inputClass}><span>Name</span><input value={String(payload.title||"")} onChange={event=>setField("title",event.target.value)}/></label>
            <label className={inputClass}><span>Untertitel</span><input value={String(payload.subtitle||"")} onChange={event=>setField("subtitle",event.target.value)}/></label>
            <label className={inputClass}><span>Stadtteil</span><input value={String(payload.district||"")} onChange={event=>setField("district",event.target.value)}/></label>
            <label className={inputClass}><span>Freigegebene Adresse</span><input value={String(payload.address||"")} onChange={event=>setField("address",event.target.value)}/></label>
            <label className={inputClass}><span>Kurze Beschreibung</span><textarea rows={4} value={String(payload.summary||"")} onChange={event=>setField("summary",event.target.value)}/></label>
            <label className={inputClass}><span>Atmosphäre</span><textarea rows={5} value={String(payload.atmosphere||"")} onChange={event=>setField("atmosphere",event.target.value)}/></label>
            <label className={inputClass}><span>Discovery bei Gruppen-/Einzelspielerfreigabe</span><select value={discoveryState} onChange={event=>setDiscoveryState(event.target.value as DiscoveryState)}>{discovery.map(state=><option key={state} value={state}>{state}</option>)}</select></label>
            <div className="field"><span>Privates Ortsbild</span><input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0];if(file)void uploadHero(file);}}/><small className="muted">JPG, PNG oder WebP bis 10 MB. Kein öffentlicher R2-Link.</small>{mediaUrl&&<img src={mediaUrl} alt="Entwurfsbild Electric Taberna" style={{width:"min(100%,420px)",height:180,objectFit:"cover",borderRadius:8,marginTop:8}}/>}</div>
            <div className="panel" style={{gridColumn:"1 / -1"}}><h3><MapPin size={17}/> Geodaten · aktueller Stand: {geo.status}</h3><p className="muted">Electric Taberna startet weiterhin ohne bestätigte Koordinaten. Die Karte erzeugt beim Öffnen keinen Ortsmarker. Wähle ausdrücklich einen Genauigkeitsstatus und dokumentiere die Herkunft.</p>
              {geo.status==="unknown"?<><label className={inputClass}><span>Geodatenstatus</span><select value="unknown" onChange={event=>{if(event.target.value==="unknown")return;if(!pickedCoordinates){toast.error("Klicke zuerst auf die Karte, um eine Position auszuwählen.");return;}const common={coordinates:pickedCoordinates,source:"",reviewedAt:new Date().toISOString()};if(event.target.value==="exact")setGeo({status:"exact",...common});else setGeo({status:"approximate",...common,accuracyMeters:500});}}><option value="unknown">Unbekannt (kein Marker)</option><option value="approximate">Ungefähres Gebiet</option><option value="exact">Exakt bestätigt</option></select></label><p className="muted">{pickedCoordinates?`Ausgewählte Kartenposition: ${pickedCoordinates[0]}, ${pickedCoordinates[1]}. Noch nicht gespeichert.`:"Klicke zuerst auf die Karte, um eine Position auszuwählen."}</p></>:<div className="entry-grid">
                <label className={inputClass}><span>Genauigkeit</span><select value={geo.status} onChange={event=>{const value=event.target.value;if(value==="unknown")setGeo({status:"unknown"});else if(value==="exact")setGeo({status:"exact",coordinates:geo.coordinates,source:geo.source,reference:geo.reference,reviewedAt:geo.reviewedAt});else setGeo({status:"approximate",coordinates:geo.coordinates,source:geo.source,reference:geo.reference,reviewedAt:geo.reviewedAt,accuracyMeters:geo.status==="approximate"?geo.accuracyMeters:500});}}><option value="approximate">Ungefähres Gebiet</option><option value="exact">Exakte Position</option><option value="unknown">Unbekannt</option></select></label>
                <label className={inputClass}><span>Längengrad</span><input type="number" step="0.000001" min="-180" max="180" value={geo.coordinates[0]} onChange={event=>updateCoordinates(0,event.target.value)}/></label><label className={inputClass}><span>Breitengrad</span><input type="number" step="0.000001" min="-90" max="90" value={geo.coordinates[1]} onChange={event=>updateCoordinates(1,event.target.value)}/></label>
                {geo.status==="approximate"&&<label className={inputClass}><span>Unschärfe in Metern</span><input type="number" min="1" max="1000000" value={geo.accuracyMeters} onChange={event=>setGeo({...geo,accuracyMeters:Number(event.target.value)})}/></label>}
                <label className={inputClass}><span>Herkunft</span><input required value={geo.source} onChange={event=>setGeo({...geo,source:event.target.value})}/></label><label className={inputClass}><span>Quellenverweis (optional)</span><input value={geo.reference||""} onChange={event=>setGeo({...geo,reference:event.target.value})}/></label>
              </div>}
              <div ref={mapHost} aria-label="MapLibre-Geodaten-Auswahl; Kartenklick setzt nur Koordinaten" style={{height:240,borderRadius:8,overflow:"hidden",marginTop:12,background:"#111820"}}/>{mapState==="error"&&<p className="muted" role="status">Die Basiskarte konnte nicht geladen werden. Manuelle Koordinaten bleiben verfügbar.</p>}{mapState==="loading"&&<p className="muted">MapLibre-Karte wird geladen …</p>}
            </div>
          </div>:<div className="entry-grid">
            <label className={inputClass}><span>Name</span><input value={String(payload.title||"")} onChange={event=>setField("title",event.target.value)}/></label>
            {node.level==="area"&&<label className={inputClass}><span>Freigegebener Bereichshinweis</span><textarea rows={4} value={String(payload.playerHint||"")} onChange={event=>setField("playerHint",event.target.value)}/></label>}
            {node.level==="room"&&<label className={inputClass}><span>Kurze freigegebene Beschreibung</span><textarea rows={4} value={String(payload.short||"")} onChange={event=>setField("short",event.target.value)}/></label>}
            {node.level==="information"&&<><label className={inputClass}><span>Freigegebener Text</span><textarea rows={6} value={String(payload.text||"")} onChange={event=>setField("text",event.target.value)}/></label><label className={inputClass}><span>Hinweistyp</span><select value={String(payload.noteType||"note")} onChange={event=>setField("noteType",event.target.value)}>{["note","suspicion","insight","question","task","memory","theory"].map(item=><option key={item}>{item}</option>)}</select></label></>}
            <label className={inputClass}><span>Discovery bei Freigabe</span><select value={discoveryState} onChange={event=>setDiscoveryState(event.target.value as DiscoveryState)}>{discovery.map(state=><option key={state}>{state}</option>)}</select></label>
          </div>}
          <label className={inputClass}><span>Änderungsgrund / Veröffentlichungshinweis</span><input value={reason} maxLength={500} onChange={event=>setReason(event.target.value)} placeholder="Wird im Prüf- oder Freigabeprotokoll festgehalten"/></label>
          <div className="entry-grid">
            <button className="button primary" type="button" disabled={busy||selectedDraft.status!=="draft"} onClick={()=>void saveDraft()}><Save size={16}/> Änderungen speichern</button>
            <button className="button" type="button" disabled={busy||selectedDraft.status!=="draft"} onClick={()=>void transition("submit")}><Send size={16}/> Zur Prüfung einreichen</button>
            {publisher&&selectedDraft.status==="in_review"&&<><button className="button primary" type="button" disabled={busy} onClick={()=>void transition("approve")}><ShieldCheck size={16}/> Genehmigen</button><button className="button" type="button" disabled={busy||!reason.trim()} onClick={()=>void transition("reject")}><Slash size={16}/> Zur Überarbeitung</button></>}
            <button className="button" type="button" disabled={busy} onClick={()=>void inspectPreview()}><Eye size={16}/> Zielgruppen-Vorschau</button>
          </div>
        </>}
      </section>
      {publisher&&<section className="panel"><div className="section-title"><div><p className="eyebrow">FREIGABEPROTOKOLL</p><h2>{scope==="player"?catalog.players.find(item=>item.id===playerId)?.name||"Spielerziel":scope==="public"?"Öffentliche Freigabe":"Aktive Spielgruppe"}</h2><p className="muted">Zielversion {release.currentVersion} · letzter Schritt: {release.currentTransition||"noch keine Freigabe"}</p></div><span className="badge">{release.history.length} letzte Schritte</span></div>
        <div className="entry-grid"><button className="button primary" disabled={busy||!selectedDraft||selectedDraft.status!=="approved"||!reason.trim()||scope==="player"&&!playerId} onClick={()=>void changeRelease("publish")}><Check size={16}/> Genehmigten Entwurf gezielt veröffentlichen</button><button className="button" disabled={busy||release.currentVersion===0||!reason.trim()||scope==="player"&&!playerId} onClick={()=>void changeRelease("revoke")}><Slash size={16}/> Freigabe zurückziehen</button><button className="button" disabled={busy||release.currentVersion===0||!reason.trim()||scope==="player"&&!playerId} onClick={()=>void changeRelease("block")}><ShieldCheck size={16}/> Ziel ausdrücklich sperren</button></div>
        <p className="muted">Zurückziehen erlaubt eine passende niedrigere Freigabe. Sperren unterdrückt niedrigere Freigaben ebenfalls. Beide Änderungen sind protokolliert und nicht löschbar.</p>
      </section>}
      {preview&&<section className="panel" aria-live="polite"><p className="eyebrow">SICHERE VORSCHAU · {preview.preview.scope}</p><h2>{preview.projection.location.title}</h2><p className="muted">{preview.projection.location.subtitle} · {preview.projection.location.district}</p><p>{preview.projection.location.summary}</p>{preview.projection.location.atmosphere&&<p>{preview.projection.location.atmosphere}</p>}{preview.projection.location.image&&<img src={preview.projection.location.image} alt="Freigegebenes Ortsbild" style={{maxWidth:"100%",maxHeight:360,objectFit:"cover",borderRadius:8}}/>}<p className="muted">Discovery: {preview.projection.location.discovery} · Geodaten: {preview.projection.location.geography?.status||"unknown"}. Bereiche: {preview.projection.location.areas.length} · Hinweise: {preview.projection.location.knownInformation.length}</p></section>}
    </>}
  </div>;
}
