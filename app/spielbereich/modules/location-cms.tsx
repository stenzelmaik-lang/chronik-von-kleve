"use client";
import type { Actor } from "@/domain/types";
import type { DiscoveryState,PlaceProjection } from "@/domain/location-types";
import { ELECTRIC_TABERNA_ID } from "@/domain/location-model";
import { locationCreationParent } from "@/domain/location-creation";
import { LocationConnections } from "./location-connections";
import { LocationKnowledgeSearch } from "./location-knowledge-search";
import { LocationChapters } from "./location-chapters";
import { LocationMediaManager } from "./location-media-manager";
import { LocationStructureControls } from "./location-structure-controls";
import libraryStyles from "./location-library.module.css";
import { Check,ChevronRight,Eye,FileImage,Plus,RefreshCw,Save,Search,Send,ShieldCheck,Slash } from "lucide-react";
import { type FormEvent,useCallback,useEffect,useMemo,useRef,useState } from "react";
import { toast } from "sonner";
import { api } from "./api-client";
import { WorldMapLibre } from "./world-maplibre";
import type { WorldMapMarker } from "./world-map-contract";
import mapStyles from "./world-experience.module.css";
import cmsStyles from "./location-cms.module.css";
import { RichTextEditor } from "./rich-text";
import { WorldExperience } from "./world-experience";

type Scope="gm"|"public"|"group"|"player";
type LocationOption={id:string;title:string;position:number};
type NodeOption={id:string;locationId:string;parentId:string|null;level:"location"|"area"|"room"|"information";position:number;revision:number;groupDiscovery:string;groupPublication:string;lifecycle:string;title:string;visibility?:string};
type PlayerOption={id:string;name:string};
type Draft={id:string;entity_id:string;revision_no:number;audience_scope:string;audience_key:string;audience_user_id:string|null;status:string;version:number;player_payload_json:string;gm_secret_json?:string;geography_json:string;hero_file_id?:string|null};
type ReleaseEntry={revision_id:string|null;transition:string;release_version:number};
type NewNodeDraft={level:"location"|"area"|"room"|"information";parentId:string|null;title:string};
type Geography={status:"unknown"}|{status:"exact";coordinates:[number,number];source:string;reference?:string;reviewedAt:string}|{status:"approximate";coordinates:[number,number];accuracyMeters:number;source:string;reference?:string;reviewedAt:string};
type Preview={projection:PlaceProjection;preview:{scope:string;viewerId:string}};
type CmsState={locations:LocationOption[];players:PlayerOption[]};
const parse=(raw:string):Record<string,unknown>=>{try{const x:unknown=JSON.parse(raw);return x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:{};}catch{return {};}};
const stable=(value:unknown):string=>{
  if(Array.isArray(value))return `[${value.map(stable).join(",")}]`;
  if(value&&typeof value==="object")return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value)??"undefined";
};
const discovery:DiscoveryState[]=["rumored","known","visited","investigated"];

export function LocationCMS({a,dataScope}:{a:Actor;dataScope:string}){
  const publisher=a.status==="active"&&["campaign_owner","campaign_gm"].includes(a.role);
  const [catalog,setCatalog]=useState<CmsState>({locations:[],players:[]});
  const [placeId,setPlaceId]=useState("");
  const [nodes,setNodes]=useState<NodeOption[]>([]);
  const [nodeId,setNodeId]=useState("");
  const [scope,setScope]=useState<Scope>("group");
  const [playerId,setPlayerId]=useState("");
  const [drafts,setDrafts]=useState<Draft[]>([]);
  const [draftId,setDraftId]=useState("");
  const draftIdRef=useRef("");
  useEffect(()=>{draftIdRef.current=draftId;},[draftId]);
  const [payload,setPayload]=useState<Record<string,unknown>>({});
  const [gmSecret,setGmSecret]=useState<Record<string,unknown>>({});
  const [chapterDirty,setChapterDirty]=useState(false);
  const [mediaDirty,setMediaDirty]=useState(false);
  const [collapsed,setCollapsed]=useState<Set<string>>(new Set());
  const [geo,setGeo]=useState<Geography>({status:"unknown"});
  const [pickedCoordinates,setPickedCoordinates]=useState<[number,number]|null>(null);
  const [discoveryState,setDiscoveryState]=useState<DiscoveryState>("known");
  const [heroFileId,setHeroFileId]=useState<string|null>(null);
  const [pendingImageUrl,setPendingImageUrl]=useState<string|null>(null);
  const [release,setRelease]=useState<{currentVersion:number;currentTransition:string|null;history:ReleaseEntry[];discovery?:{state:string;version:number;history?:{createdAt:string;previousState:string;nextState:string;reason:string;administrativeCorrection:boolean}[]}}>({currentVersion:0,currentTransition:null,history:[]});
  const [preview,setPreview]=useState<Preview|null>(null);
  const [publishedProjection,setPublishedProjection]=useState<PlaceProjection|null>(null);
  const [previewMode,setPreviewMode]=useState<"draft"|"published"|null>(null);
  const [reason,setReason]=useState("");
  const [activeSection,setActiveSection]=useState<"content"|"media"|"map"|"release">("content");
  const [directorySearch,setDirectorySearch]=useState("");
  const [newNode,setNewNode]=useState<NewNodeDraft|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [mapState,setMapState]=useState<"loading"|"ready"|"error">("loading");
  const nodeRowRefs=useRef(new Map<string,HTMLButtonElement>());
  const node=nodes.find(item=>item.id===nodeId)||null;
  const areaParent=locationCreationParent("area",nodes,placeId,nodeId);
  const roomParent=locationCreationParent("room",nodes,placeId,nodeId);
  const selectedDraft=drafts.find(item=>item.id===draftId&&item.entity_id===nodeId&&item.audience_scope===scope&&(scope!=="player"||item.audience_user_id===playerId))||null;
  const isRoot=node?.level==="location";
  const editable=selectedDraft?.status==="draft";
  const selectedIsCurrentRelease=Boolean(selectedDraft&&release.history[0]?.transition==="publish"&&release.history[0]?.revision_id===selectedDraft.id);
  const playerTarget=scope==="player"?playerId:"";
  useEffect(()=>()=>{if(pendingImageUrl)URL.revokeObjectURL(pendingImageUrl);},[pendingImageUrl]);
  const dirty=useMemo(()=>{
    if(!selectedDraft||selectedDraft.status!=="draft")return false;
    return stable({payload,gmSecret,geography:geo,heroFileId})!==stable({
      payload:parse(selectedDraft.player_payload_json),
      gmSecret:parse(selectedDraft.gm_secret_json||"{}"),
      geography:parse(selectedDraft.geography_json),
      heroFileId:selectedDraft.hero_file_id||null,
    });
  },[geo,gmSecret,heroFileId,payload,selectedDraft]);
  const orderedNodes=useMemo(()=>{
    const children=new Map<string,NodeOption[]>();
    for(const item of nodes){if(item.parentId)children.set(item.parentId,[...(children.get(item.parentId)||[]),item]);}
    const rank={location:0,area:1,room:2,information:3} as const;
    const compare=(left:NodeOption,right:NodeOption)=>rank[left.level]-rank[right.level]||left.position-right.position||left.title.localeCompare(right.title,"de-DE");
    for(const values of children.values())values.sort(compare);
    const ordered:NodeOption[]=[],seen=new Set<string>();
    const visit=(item:NodeOption)=>{if(seen.has(item.id))return;seen.add(item.id);ordered.push(item);for(const child of children.get(item.id)||[])visit(child);};
    nodes.filter(item=>item.level==="location").sort(compare).forEach(visit);
    const remaining=nodes.filter(item=>!seen.has(item.id)).sort(compare);
    remaining.forEach(visit);
    return ordered;
  },[nodes]);
  const filteredNodes=useMemo(()=>{
    const needle=directorySearch.trim().toLocaleLowerCase("de-DE");
    if(!needle)return orderedNodes.filter(item=>{let parent=item.parentId;while(parent){if(collapsed.has(parent))return false;parent=orderedNodes.find(n=>n.id===parent)?.parentId||null;}return true;});
    const matches=new Set(orderedNodes.filter(item=>`${item.title} ${item.level} ${item.visibility||""}`.toLocaleLowerCase("de-DE").includes(needle)).map(item=>item.id));
    // Keep each matching node's parent chain visible so the directory retains context.
    for(const item of orderedNodes){if(matches.has(item.id)){let parent=item.parentId;while(parent){matches.add(parent);parent=orderedNodes.find(candidate=>candidate.id===parent)?.parentId||null;}}}
    return orderedNodes.filter(item=>matches.has(item.id));
  },[directorySearch,orderedNodes,collapsed]);
  const sections=[
    {id:"content" as const,label:isRoot?"Grunddaten":node?.level==="information"?"Erkenntnisse":"Inhalt"},

    ...(isRoot?[{id:"map" as const,label:"Karte & Geodaten"}]:[]),
    {id:"release" as const,label:"Vorschau & Freigabe"},
  ];

  function canLeaveEditor(){
    return !(dirty||chapterDirty||mediaDirty)||window.confirm("Es gibt ungespeicherte Änderungen. Wenn du fortfährst, werden diese Änderungen verworfen. Möchtest du weitergehen?");
  }

  function beginNodeCreation(level:NewNodeDraft["level"]){
    if(!publisher||!canLeaveEditor())return;
    const parent=locationCreationParent(level,nodes,placeId,nodeId);
    if(level!=="location"&&!parent)return;
    setNewNode({level,parentId:parent?.id??null,title:""});
  }

  async function submitNodeCreation(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!newNode||!newNode.title.trim()||!publisher)return;
    setBusy(true);
    try{
      const created=await api<{id:string;locationId:string;level:NewNodeDraft["level"]}>('/api/cms/locations','POST',{
        level:newNode.level,title:newNode.title.trim(),...(newNode.parentId?{parentId:newNode.parentId}:{}),
      });
      const [catalogResult,treeResult,draftResult]=await Promise.all([
        api<{locations:LocationOption[];players?:PlayerOption[]}>('/api/cms/locations'),
        api<{nodes:NodeOption[]}>(`/api/cms/locations?place=${encodeURIComponent(created.locationId)}`),
        api<{drafts:Draft[]}>(`/api/cms/drafts?entityId=${encodeURIComponent(created.id)}`),
      ]);
      const initialDraft=draftResult.drafts.find(item=>item.audience_scope==="group"&&item.audience_key==="@group")||null;
      setCatalog({locations:catalogResult.locations,players:catalogResult.players||[]});
      setPlaceId(created.locationId);setNodes(treeResult.nodes);setNodeId(created.id);setScope("group");setPlayerId("");
      setDrafts(draftResult.drafts);setDraftId(initialDraft?.id||"");
      setPayload(initialDraft?parse(initialDraft.player_payload_json):{});setGmSecret({});
      setGeo(initialDraft?parse(initialDraft.geography_json) as unknown as Geography:{status:"unknown"});
      setPickedCoordinates(null);setHeroFileId(initialDraft?.hero_file_id||null);setPendingImageUrl(null);
      setPreview(null);setPublishedProjection(null);setPreviewMode(null);setActiveSection("content");setDirectorySearch("");setNewNode(null);
      const kind=created.level==="location"?"Hauptort":created.level==="area"?"Bereich":created.level==="information"?"Erkenntnis":"Raum";
      toast.success(`${kind} gespeichert. Der erste Entwurf bleibt unveröffentlicht.`);
    }catch(error){toast.error((error as Error).message);}
    finally{setBusy(false);}
  }

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
  useEffect(()=>{nodeRowRefs.current.get(nodeId)?.scrollIntoView({block:"nearest"});},[nodeId,filteredNodes.length]);
  const refreshDrafts=useCallback(async(selectNewest=false,isCurrent:()=>boolean=()=>true)=>{
    if(!nodeId){setDrafts([]);setDraftId("");return;}
    const result=await api<{drafts:Draft[]}>(`/api/cms/drafts?entityId=${encodeURIComponent(nodeId)}`);
    if(!isCurrent())return;
    const scoped=result.drafts.filter(item=>item.audience_scope===scope&&(scope!=="player"||item.audience_user_id===playerTarget));
    setDrafts(result.drafts);
    const current=selectNewest?"":draftIdRef.current;
    const selected=scoped.find(item=>item.id===current)||scoped[0]||null;
    setDraftId(selected?.id||"");
    if(selected){setPayload(parse(selected.player_payload_json));setGmSecret(parse(selected.gm_secret_json||"{}"));const selectedGeo=(parse(selected.geography_json) as unknown as Geography)||{status:"unknown"};setGeo(selectedGeo);setPickedCoordinates(selectedGeo.status==="unknown"?null:selectedGeo.coordinates);setHeroFileId(selected.hero_file_id||null);}
    else {setPayload({});setGmSecret({});setGeo({status:"unknown"});setPickedCoordinates(null);setHeroFileId(null);setPreview(null);setPublishedProjection(null);setPreviewMode(null);}
  },[nodeId,scope,playerTarget]);
  useEffect(()=>{
    let active=true;
    const timer=window.setTimeout(()=>{void refreshDrafts(true,()=>active).catch(error=>{if(active)toast.error((error as Error).message);});},0);
    return()=>{active=false;window.clearTimeout(timer);};
  },[refreshDrafts]);
  const refreshRelease=useCallback(async()=>{
    if(!publisher||!nodeId||scope==="gm") {setRelease({currentVersion:0,currentTransition:null,history:[]});return;}
    if(scope==="player"&&!playerTarget){setRelease({currentVersion:0,currentTransition:null,history:[]});return;}
    try{const query=new URLSearchParams({entityId:nodeId,scope,...(scope==="player"&&playerTarget?{playerId:playerTarget}:{})});setRelease(await api<{currentVersion:number;currentTransition:string|null;history:ReleaseEntry[]}>(`/api/cms/releases?${query}`));}catch(error){toast.error((error as Error).message);}
  },[nodeId,scope,playerTarget,publisher]);
  useEffect(()=>{
    const timer=window.setTimeout(()=>{void refreshRelease();},0);
    return()=>window.clearTimeout(timer);
  },[refreshRelease]);
  const mapMarkerPlaces=useMemo<WorldMapMarker[]>(()=>{
    if(!isRoot)return [];
    const coordinates=geo.status==="unknown"?pickedCoordinates:geo.coordinates;
    if(!coordinates)return [];
    return [{
      id:`cms-marker:${nodeId}`,
      title:geo.status==="unknown"?"Nicht gespeicherte Auswahl":node?.title||"Ortsmarker",
      discovery:"known",
      worldState:"active",
      coordinates,
      precision:geo.status==="unknown"||geo.status==="approximate"&&(geo.accuracyMeters<1||!geo.source.trim())?"candidate":geo.status,
      source:geo.status==="unknown"?"Noch nicht gespeichert":geo.source,
      ...(geo.status==="approximate"?{accuracyMeters:geo.accuracyMeters}:{}),
      editorDraft:true,
    }];
  },[geo,isRoot,node?.title,nodeId,pickedCoordinates]);
  const mapMarkerIds=useMemo(()=>mapMarkerPlaces.map(marker=>marker.id),[mapMarkerPlaces]);
  const geographyValid=geo.status==="unknown"||(geo.source.trim().length>0&&Number.isFinite(geo.coordinates[0])&&geo.coordinates[0]>=-180&&geo.coordinates[0]<=180&&Number.isFinite(geo.coordinates[1])&&geo.coordinates[1]>=-90&&geo.coordinates[1]<=90&&(geo.status==="exact"||(Number.isInteger(geo.accuracyMeters)&&geo.accuracyMeters>=1&&geo.accuracyMeters<=1_000_000)));

  function clearDossierViews(){setPreview(null);setPublishedProjection(null);setPreviewMode(null);}
  function setField(key:string,value:unknown){setPayload(current=>({...current,[key]:value}));clearDossierViews();}
  async function createDraft(){
    if(!node||!canLeaveEditor())return;setBusy(true);
    try{
      const data=await api<{id:string;version:number;payload:Record<string,unknown>;gmSecret:Record<string,unknown>;geography:Geography;heroFileId:string|null}>('/api/cms/drafts','POST',{entityId:node.id,audience:scope,...(scope==="player"?{playerId:playerTarget}:{})});
      toast.success("Neuer Entwurf auf Basis des freigegebenen Stands angelegt");clearDossierViews();await refreshDrafts(true);setDraftId(data.id);setPayload(data.payload);setGmSecret(data.gmSecret||{});setGeo(data.geography);setHeroFileId(data.heroFileId||null);await refreshRelease();
    }catch(error){toast.error((error as Error).message);}finally{setBusy(false);}
  }
  async function saveDraft(){
    if(!selectedDraft||!node||!editable)return;
    if(isRoot&&!geographyValid){toast.error("Geodaten fehlen: ergänze eine nachvollziehbare Quelle und bei einem ungefähren Gebiet die Genauigkeit in Metern.");return;}
    setBusy(true);
    try{await api('/api/cms/drafts','PATCH',{revisionId:selectedDraft.id,expectedVersion:selectedDraft.version,payload,gmSecret,...(isRoot?{geography:geo}:{}),heroFileId});setPendingImageUrl(null);toast.success("Entwurf gespeichert und erneut aus der Datenbank geladen. Spieler sehen weiterhin nur den freigegebenen Stand.");clearDossierViews();await refreshDrafts(true);await refreshRelease();}
    catch(error){toast.error((error as Error).message);}finally{setBusy(false);}
  }
  async function transition(action:"submit"|"approve"|"reject"){
    if(!selectedDraft||dirty)return;setBusy(true);
    try{await api('/api/cms/transitions','POST',{action,revisionId:selectedDraft.id,expectedVersion:selectedDraft.version,...(reason?{reason}:{})});toast.success(action==="submit"?"Zur Prüfung eingereicht":action==="approve"?"Entwurf genehmigt":"Entwurf zurückgegeben");setReason("");await refreshDrafts(true);}
    catch(error){toast.error((error as Error).message);}finally{setBusy(false);}
  }
  async function inspectPreview(){if(!selectedDraft||scope==="gm"||dirty)return;setBusy(true);try{const data=await api<Preview>('/api/cms/preview','POST',{revisionId:selectedDraft.id,...(scope==="group"&&playerId?{viewerId:playerId}:{})});setPreview(data);setPublishedProjection(null);setPreviewMode("draft");}catch(error){toast.error((error as Error).message);}finally{setBusy(false);}}
  async function inspectPublished(){
    if(!node||!placeId||scope==="gm"||scope==="player"&&!playerTarget)return;
    setBusy(true);
    try{
      let projection:PlaceProjection;
      if(scope==="player"){
        const actual=await api<{projection:PlaceProjection}>(`/api/locations?place=${encodeURIComponent(placeId)}&view=player&target=player&viewerId=${encodeURIComponent(playerTarget)}`);
        projection=actual.projection;
      }else{
        const target=await api<{projection:PlaceProjection}>(`/api/locations?place=${encodeURIComponent(placeId)}&view=player&target=group`);
        projection=target.projection;
      }
      setPreview(null);setPublishedProjection(projection);setPreviewMode("published");
    }catch(error){toast.error((error as Error).message);}
    finally{setBusy(false);}
  }
  async function changeRelease(action:"publish"|"revoke"|"block"){
    if(!node||dirty)return;
    if(!window.confirm(action==="publish"?"Diesen genehmigten Stand genau für die gewählte Zielgruppe veröffentlichen?":action==="revoke"?"Die Freigabe zurückziehen? Danach greift gegebenenfalls die Freigabe einer niedrigeren Ebene.":"Diese Zielgruppe ausdrücklich sperren? Eine niedrigere Freigabe bleibt dadurch ebenfalls verborgen."))return;
    setBusy(true);
    try{await api('/api/cms/releases','POST',{action,entityId:node.id,scope,...(scope==="player"?{playerId:playerTarget}:{}),...(action==="publish"&&selectedDraft?{revisionId:selectedDraft.id}:{}),expectedReleaseVersion:release.currentVersion,grantDiscovery:false,reason:reason.trim()||"Freigabeänderung im SL-CMS"});toast.success(action==="publish"?"Gezielt veröffentlicht":action==="revoke"?"Freigabe zurückgezogen":"Zielgruppe gesperrt");clearDossierViews();await refreshRelease();}
    catch(error){toast.error((error as Error).message);if((error as {status?:number}).status===409)await refreshRelease();}finally{setBusy(false);}
  }
  async function saveAndPublish(){
    if(!publisher||!node||!selectedDraft||selectedDraft.status!=="draft"||scope==="gm"||scope==="player"&&!playerTarget)return;
    if(isRoot&&!geographyValid){toast.error("Die Ortsposition ist nicht prüfbar. Lass sie unbekannt oder ergänze nachvollziehbare Genauigkeit und Herkunft.");return;}
    const auditReason=reason.trim()||"Direktfreigabe im SL-CMS";
    const audience=scope==="group"?"die aktive Spielgruppe":scope==="public"?"das angemeldete Public-Lesemodell":catalog.players.find(item=>item.id===playerTarget)?.name||"den ausgewählten Spieler";
    if(!window.confirm(`Den aktuellen Inhalt für ${audience} speichern, zur Prüfung einreichen, genehmigen und gezielt freigeben? Zielumgebung: ${window.location.origin}. Dort sehen berechtigte Spieler anschließend diesen freigegebenen Stand.`))return;
    setBusy(true);let contentPersisted=!dirty;
    try{
      let version=selectedDraft.version;
      if(dirty){
        const saved=await api<{version:number}>('/api/cms/drafts','PATCH',{revisionId:selectedDraft.id,expectedVersion:version,payload,gmSecret,...(isRoot?{geography:geo}:{}),heroFileId});
        version=saved.version;contentPersisted=true;setPendingImageUrl(null);
      }
      const submitted=await api<{version:number}>('/api/cms/transitions','POST',{action:"submit",revisionId:selectedDraft.id,expectedVersion:version,reason:auditReason});
      await api<{version:number}>('/api/cms/transitions','POST',{action:"approve",revisionId:selectedDraft.id,expectedVersion:submitted.version,reason:auditReason});
      await api('/api/cms/releases','POST',{action:"publish",entityId:node.id,scope,...(scope==="player"?{playerId:playerTarget}:{}),revisionId:selectedDraft.id,expectedReleaseVersion:release.currentVersion,grantDiscovery:false,reason:auditReason});
      toast.success("Gespeichert, genehmigt und für das ausgewählte Ziel freigegeben.");
      setReason("");
      clearDossierViews();
      await Promise.all([refreshDrafts(true),refreshRelease()]);
    }catch(error){toast.error(`Der Ablauf wurde an der letzten erfolgreichen Stufe gestoppt: ${(error as Error).message}`);await Promise.all([...(contentPersisted?[refreshDrafts(true).catch(()=>{})]:[]),refreshRelease().catch(()=>{})]);}
    finally{setBusy(false);}
  }
  function updateCoordinates(index:0|1,value:string){const numeric=Number(value);if(!Number.isFinite(numeric)||geo.status==="unknown")return;const coordinates:[number,number]=[...geo.coordinates];coordinates[index]=numeric;setGeo({...geo,coordinates});}
  const visibleDrafts=drafts.filter(item=>item.audience_scope===scope&&(scope!=="player"||item.audience_user_id===playerTarget));

  return <div className={cmsStyles.cmsWorkspace} data-location-cms="phase-c">
    <header className={cmsStyles.cmsHero}><div><p className="eyebrow">CHRONIK VON KLEVE · SPIELLEITUNG · SL-CMS</p><h1>Ortsredaktion</h1><p>Orte, Bereiche und Freigaben in einer nachvollziehbaren Redaktion. Entwürfe werden erst nach Prüfung und gezielter Freigabe im aktuellen Spielbereich sichtbar.</p></div><span className={cmsStyles.campaignSeal}>AKTIVE CHRONIK<strong>DOMÄNE KLEVE</strong></span></header>

    <div className={cmsStyles.redactionLayout}>
      <aside className={"panel "+cmsStyles.directoryPanel} aria-label="Ortsverzeichnis" data-creating={Boolean(newNode)}>
        <div className={cmsStyles.directoryHead}><div><p className="eyebrow">BESTAND</p><h2>Ortsverzeichnis</h2></div><button type="button" className="button" aria-label="Ortsverzeichnis aktualisieren" onClick={()=>{if(canLeaveEditor())void loadCatalog();}} disabled={loading}><RefreshCw size={15}/></button></div>
        <label className={"field "+cmsStyles.locationSelect}><span>Hauptort</span><select value={placeId} onChange={event=>{if(canLeaveEditor()){setNewNode(null);setReason("");clearDossierViews();setPlaceId(event.target.value);}}} disabled={loading}>{catalog.locations.map(place=><option key={place.id} value={place.id}>{place.title}</option>)}</select></label>
        <label className={cmsStyles.directorySearch}><Search size={15}/><span className="sr-only">Orte, Bereiche und Räume suchen</span><input value={directorySearch} onChange={event=>setDirectorySearch(event.target.value)} placeholder="Im Bestand suchen"/></label>
        {publisher&&<div className={cmsStyles.directoryActions} role="group" aria-label="Ortseinträge hinzufügen">
          {areaParent&&<button type="button" className={`button ${cmsStyles.childCreateAction}`} onClick={()=>beginNodeCreation("area")} disabled={busy||loading}><Plus size={16} aria-hidden="true"/><span>Bereich hinzufügen<small>Hauptort: {areaParent.title}</small></span></button>}
          {roomParent&&<button type="button" className={`button ${cmsStyles.childCreateAction}`} onClick={()=>beginNodeCreation("room")} disabled={busy||loading}><Plus size={16} aria-hidden="true"/><span>Raum hinzufügen<small>Bereich: {roomParent.title}</small></span></button>}
          <button type="button" className="button" onClick={()=>beginNodeCreation("location")} disabled={busy||loading}><Plus size={14}/> Neuer Hauptort</button>
          {areaParent&&<button type="button" className="button" onClick={()=>beginNodeCreation("information")} disabled={busy||loading}><Plus size={14}/> Neue Erkenntnis</button>}
        </div>}
        {newNode&&<form className={cmsStyles.createNodeForm} onSubmit={event=>void submitNodeCreation(event)}>
          <label className="field"><span>{newNode.level==="location"?"Name des Hauptorts":newNode.level==="area"?"Name des Bereichs":newNode.level==="information"?"Titel der Erkenntnis":"Name des Raums"}</span><input autoFocus required maxLength={160} value={newNode.title} onChange={event=>setNewNode(current=>current?{...current,title:event.target.value}:current)} placeholder={newNode.level==="location"?"Zum Beispiel: Testort":newNode.level==="area"?"Zum Beispiel: Empfangshalle":newNode.level==="room"?"Zum Beispiel: Warteraum":"Zum Beispiel: Beobachtung"}/></label>
          <p><strong>{newNode.level==="location"?"Neuer eigenständiger Hauptort.":`${newNode.level==="room"?"Bereich":"Hauptort"}: „${nodes.find(item=>item.id===newNode.parentId)?.title||newNode.parentId}“.`}</strong> Der erste Entwurf bleibt unveröffentlicht und erscheint erst nach der bestehenden Freigabe für Spieler.</p>
          <div><button type="button" className="button" onClick={()=>setNewNode(null)} disabled={busy}>Abbrechen</button><button type="submit" className="button primary" disabled={busy||!newNode.title.trim()}><Plus size={14}/> {newNode.level==="location"?"Hauptort":newNode.level==="area"?"Bereich":newNode.level==="room"?"Raum":"Erkenntnis"} anlegen</button></div>
        </form>}
        <div className={cmsStyles.directoryScroll}>
          {loading&&!nodes.length?<p className="muted">Ortsbestand wird geladen …</p>:!filteredNodes.length?<p className="muted">Keine passenden Einträge.</p>:<nav className={cmsStyles.nodeTree} aria-label="Bereiche, Räume und Informationen">
            {filteredNodes.map(item=><div key={item.id} className={libraryStyles.treeRow}><button type="button" aria-label={(collapsed.has(item.id)?"Aufklappen: ":"Zuklappen: ")+item.title} aria-expanded={!collapsed.has(item.id)} disabled={!nodes.some(n=>n.parentId===item.id)} onClick={()=>setCollapsed(current=>{const next=new Set(current);if(next.has(item.id))next.delete(item.id);else next.add(item.id);return next;})}>{nodes.some(n=>n.parentId===item.id)?collapsed.has(item.id)?"▸":"▾":"·"}</button><button ref={element=>{if(element)nodeRowRefs.current.set(item.id,element);else nodeRowRefs.current.delete(item.id);}} type="button" className={cmsStyles.nodeRow} data-level={item.level} data-selected={item.id===nodeId} aria-current={item.id===nodeId?"page":undefined} onClick={()=>{if(item.id===nodeId||!canLeaveEditor())return;setNodeId(item.id);setReason("");setNewNode(null);clearDossierViews();setActiveSection("content");if(item.visibility==="gm")setScope("gm");else if(scope==="gm")setScope("group");}}>
              <span className={cmsStyles.nodeMarker} aria-hidden="true">{item.level==="location"?"⌖":item.level==="area"?"◇":item.level==="room"?"·":"✧"}</span><span className={cmsStyles.nodeCopy}><strong>{item.title}</strong><small>{item.lifecycle!=="active"?item.lifecycle+" · ":""}{item.level==="location"?"Hauptort":item.level==="area"?"Bereich":item.level==="room"?"Raum":"Erkenntnis"} · {item.groupDiscovery!=="hidden"?"Gruppe: entdeckt":item.groupPublication==="publish"?"Veröffentlicht · nicht sichtbar":item.groupPublication==="block"?"Gruppe gesperrt":"Unveröffentlicht"}</small></span>{item.visibility==="gm"&&<span className={cmsStyles.privateTag}>SL</span>}<ChevronRight className={cmsStyles.nodeArrow} size={15}/>
            </button></div>)}
          </nav>}
        </div>
        <div className={cmsStyles.creationNotice}><span>ORTSSTRUKTUR</span><p>Neue Orte, Bereiche und Räume erhalten eine stabile Identität. Inhalte bleiben Entwürfe, bis sie geprüft und gezielt freigegeben werden.</p></div>
      </aside>

      <div className={cmsStyles.redactionMain}>
        {!node?<section className={"panel "+cmsStyles.emptyEditor}><p className="eyebrow">ORTSREDAKTION</p><h2>{loading?"Ortsbestand wird geladen …":"Kein bestehender Ort ausgewählt"}</h2><p className="muted">Wähle links einen bestehenden Ort, Bereich, Raum oder eine Erkenntnis.</p></section>:<>
          <header className={cmsStyles.editorHeader}>
            <div><p className="eyebrow">{node.level==="location"?"ORT":node.level==="area"?"BEREICH":node.level==="room"?"RAUM":"ERKENNTNIS"} <span aria-hidden="true">/</span> {node.locationId}</p><h2>{node.title}</h2><p>{catalog.locations.find(item=>item.id===placeId)?.title||"Aktiver Schauplatz"} <ChevronRight size={13}/>{node.parentId?" Eingebettet im bestehenden Ortsverzeichnis":" Hauptort"}</p></div>
            <div className={cmsStyles.editorState}>{selectedDraft?<><span data-status={selectedDraft.status}>{dirty?"UNGESPEICHERT":selectedDraft.status==="draft"?"ENTWURF GESPEICHERT":selectedDraft.status==="in_review"?"IN PRÜFUNG":selectedIsCurrentRelease?"AKTUELL FREIGEGEBEN":selectedDraft.status==="approved"?"GENEHMIGT · NICHT FREIGEGEBEN":selectedDraft.status.toUpperCase()}</span><small>{selectedDraft.status==="draft"||selectedDraft.status==="in_review"||selectedDraft.status==="approved"&&!selectedIsCurrentRelease?"Spieler sehen weiterhin nur den zuletzt freigegebenen Stand.":("Ziel: "+(scope==="gm"?"nur Spielleitung":scope==="group"?"aktive Spielgruppe":scope==="public"?"Public · nur angemeldete Mitglieder":"einzelner Spieler"))}</small></>:<><span data-status="empty">KEIN ARBEITSSTAND</span><small>Lege eine Revision an, um Änderungen vorzunehmen.</small></>}</div>
          </header>

          <section className={"panel "+cmsStyles.editorControlPanel} aria-label="Arbeitsstand und Freigabeziel">
            <div className={cmsStyles.controlRow}>
              <label className="field"><span>{scope==="gm"?"Vertraulicher Arbeitsbereich":"Freigabeziel des Entwurfs"}</span><select value={scope} onChange={event=>{if(!canLeaveEditor())return;setScope(event.target.value as Scope);setPlayerId("");setReason("");clearDossierViews();}}>{publisher&&<option value="gm">Nur Spielleitung · vertraulich</option>}<option value="group">Aktive Spielgruppe</option>{publisher&&<><option value="public">Public · Anmeldung erforderlich</option><option value="player">Einzelner Spieler</option></>}</select></label>
              {scope==="player"&&publisher&&<label className="field"><span>Spielerziel</span><select value={playerId} onChange={event=>{if(canLeaveEditor()){setPlayerId(event.target.value);clearDossierViews();}}}><option value="">Spieler wählen</option>{catalog.players.map(player=><option key={player.id} value={player.id}>{player.name}</option>)}</select></label>}
              {selectedDraft&&<details className={cmsStyles.revisionDetails}><summary>Änderungsverlauf <span>{visibleDrafts.length} Revisionen</span></summary><label className="field"><span>Arbeitsstand auswählen</span><select value={draftId} onChange={event=>{if(!canLeaveEditor())return;const chosen=drafts.find(item=>item.id===event.target.value);setDraftId(event.target.value);setReason("");setPayload(chosen?parse(chosen.player_payload_json):{});setGmSecret(chosen?parse(chosen.gm_secret_json||"{}"):{});const chosenGeo=chosen?(parse(chosen.geography_json) as unknown as Geography):{status:"unknown" as const};setGeo(chosenGeo);setPickedCoordinates(chosenGeo.status==="unknown"?null:chosenGeo.coordinates);setHeroFileId(chosen?.hero_file_id||null);setPendingImageUrl(null);clearDossierViews();}}><option value="">Keinen Arbeitsstand auswählen</option>{visibleDrafts.map(item=><option key={item.id} value={item.id}>Revision {item.revision_no} · {item.status} · Version {item.version}</option>)}</select></label><button type="button" className="button" disabled={busy||dirty} onClick={async()=>{if(!selectedDraft||!window.confirm("Diesen früheren Stand als neuen Entwurf wiederherstellen? Veröffentlichung und Entdeckung bleiben unverändert."))return;setBusy(true);try{await api("/api/cms/drafts","POST",{entityId:node.id,audience:scope,...(scope==="player"?{playerId:playerTarget}:{}),sourceRevisionId:selectedDraft.id});await refreshDrafts(true);toast.success("Früherer Inhalt als neuer Entwurf wiederhergestellt.");}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}}>Diesen Stand als neuen Entwurf wiederherstellen</button></details>}
              {(!selectedDraft||selectedDraft.status!=="draft")&&<button type="button" className="button primary" onClick={()=>void createDraft()} disabled={busy||!node||scope==="player"&&!playerId}><FileImage size={15}/> Neue bearbeitbare Revision</button>}
            </div>
            {scope==="public"&&<p className={cmsStyles.inlineNotice}>Public-Freigaben sind im aktuellen Reader nur für angemeldete aktive Kampagnenmitglieder sichtbar. Eine anonyme Besucherausgabe gibt es hier nicht.</p>}
          </section>

          {publisher&&scope==="gm"&&<LocationChapters key={node.id} entityId={node.id} onDirty={setChapterDirty}/>}
          {publisher&&<details className={libraryStyles.chapter}><summary>Dauerhafte Verknüpfungen</summary><div className={libraryStyles.body}><LocationConnections key={node.id+":relations"} entityId={node.id} view="sl" editable/></div></details>}
          {publisher&&<details className={libraryStyles.chapter}><summary>Medien dieses Eintrags</summary><div className={libraryStyles.body}><LocationMediaManager key={node.id} entityId={node.id} onDirty={setMediaDirty}/></div></details>}
          {publisher&&<details className={libraryStyles.chapter}><summary>Ortswissen durchsuchen</summary><div className={libraryStyles.body}><LocationKnowledgeSearch placeId={placeId} view="sl"/></div></details>}
          {publisher&&<LocationStructureControls disabled={dirty||chapterDirty||mediaDirty} key={node.id+":"+node.revision} node={node} nodes={nodes} locations={catalog.locations} onChanged={async next=>{setPlaceId(next.locationId);const result=await api<{nodes:NodeOption[]}>(`/api/cms/locations?place=${encodeURIComponent(next.locationId)}`);setNodes(result.nodes);setNodeId(next.entityId);await loadCatalog();}}/>}
          {selectedDraft&&["public","group","player"].includes(scope)&&<>
            <nav className={cmsStyles.sectionTabs} aria-label="Redaktionsbereiche" role="tablist">
              {sections.map((section,index)=><button key={section.id} type="button" role="tab" aria-selected={activeSection===section.id} className={activeSection===section.id?cmsStyles.sectionTabActive:cmsStyles.sectionTab} onClick={()=>setActiveSection(section.id)}><span>{String(index+1).padStart(2,"0")}</span>{section.label}</button>)}
            </nav>

            {activeSection==="content"&&<section className={"panel "+cmsStyles.editorPanel} role="tabpanel">
              <div className={cmsStyles.panelIntro}><p className="eyebrow">{scope==="gm"?"INTERNER SPIELLEITUNGSINHALT":"BESTEHENDE ORTSINFORMATION"}</p><h3>{scope==="gm"?"Vertraulicher Vermerk":isRoot?"Grunddaten und Beschreibungen":node.level==="information"?"Erkenntnis und Handout":"Bereich und Raum"}</h3><p>{scope==="gm"?"Nur die Spielleitung kann diesen Inhalt sehen. Er kann nicht für Spieler freigegeben werden.":"Diese Angaben verwenden die vorhandene Ortsidentität und werden nur über eine passende Revision ausgespielt."}</p></div>
              <fieldset className={cmsStyles.editorFieldset} disabled={!editable||busy}>
                {scope==="gm"?<p>SL-Kapitel werden unabhängig von redaktionellen Revisionen gespeichert. Spieler können sie niemals freigeschaltet bekommen.</p>:node.level==="location"?<div className={cmsStyles.fieldStack}>
                  <div className={cmsStyles.fieldGrid}><label className="field"><span>Name</span><input value={String(payload.title||"")} onChange={event=>setField("title",event.target.value)}/></label><label className="field"><span>Untertitel</span><input value={String(payload.subtitle||"")} onChange={event=>setField("subtitle",event.target.value)} placeholder="Kurze Einordnung für die Ortsseite"/></label></div>
                  <div className={cmsStyles.fieldGrid}><label className="field"><span>Stadtteil</span><input value={String(payload.district||"")} onChange={event=>setField("district",event.target.value)}/></label><label className="field"><span>Freigegebene Adresse</span><input value={String(payload.address||"")} onChange={event=>setField("address",event.target.value)}/></label></div>
                  <RichTextEditor htmlSource disabled={!editable||busy} key={`${selectedDraft.id}:${selectedDraft.version}:summary`} value={String(payload.summary||"")} onChange={value=>setField("summary",value)} label="Kurze Beschreibung" maximumPlainLength={1600} placeholder="Was soll die Gruppe über diesen Ort wissen?"/>
                  <RichTextEditor htmlSource disabled={!editable||busy} key={`${selectedDraft.id}:${selectedDraft.version}:atmosphere`} value={String(payload.atmosphere||"")} onChange={value=>setField("atmosphere",value)} label="Ortsbeschreibung und Atmosphäre" maximumPlainLength={25000} placeholder="Wie wirkt dieser Ort auf die Sinne?"/>
                </div>:<div className={cmsStyles.fieldStack}>
                  <label className="field"><span>Name</span><input value={String(payload.title||"")} onChange={event=>setField("title",event.target.value)}/></label>
                  {node.level==="area"&&<RichTextEditor htmlSource disabled={!editable||busy} key={`${selectedDraft.id}:${selectedDraft.version}:playerHint`} value={String(payload.playerHint||"")} onChange={value=>setField("playerHint",value)} label="Beschreibung des Bereichs" maximumPlainLength={25000} placeholder="Ein freigegebener Eindruck oder Hinweis für diesen Bereich"/>}
                  {node.level==="room"&&<RichTextEditor htmlSource disabled={!editable||busy} key={`${selectedDraft.id}:${selectedDraft.version}:short`} value={String(payload.short||"")} onChange={value=>setField("short",value)} label="Raumbeschreibung" maximumPlainLength={25000} placeholder="Was ist in diesem Raum bereits bekannt?"/>}
                  {node.level==="information"&&<><RichTextEditor htmlSource disabled={!editable||busy} key={`${selectedDraft.id}:${selectedDraft.version}:text`} value={String(payload.text||"")} onChange={value=>setField("text",value)} label="Freigegebener Text" maximumPlainLength={25000} placeholder="Inhalt des freigegebenen Hinweises"/><label className="field"><span>Hinweistyp</span><select value={String(payload.noteType||"note")} onChange={event=>setField("noteType",event.target.value)}>{[["note","Hinweis"],["suspicion","Verdacht"],["insight","Erkenntnis"],["question","Frage"],["task","Aufgabe"],["memory","Erinnerung"],["theory","Theorie"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span><input type="checkbox" checked={payload.pinned===true} onChange={event=>setField("pinned",event.target.checked)}/> Als wichtig markieren</span></label><p className="muted">Jede Erkenntnis erhält einen eigenen Titel und Text. Sie bleibt bis zur gezielten Veröffentlichung ein Entwurf.</p></>}
                </div>}
              </fieldset>
              {!editable&&<p className={cmsStyles.readOnlyNote}>Dieser Stand ist {selectedDraft.status==="approved"?"genehmigt":"nicht mehr bearbeitbar"}. Lege eine neue Revision an, wenn du Änderungen vornehmen möchtest.</p>}
            </section>}

            {activeSection==="map"&&isRoot&&<section className={"panel "+cmsStyles.editorPanel} role="tabpanel">
              <div className={cmsStyles.panelIntro}><p className="eyebrow">KARTE & GEODATEN</p><h3>{geo.status==="unknown"?"Position unbekannt":"Ortsposition bearbeiten"}</h3><p>Eine Kartenwahl ist zunächst ein unverbindlicher Entwurf. Nur eine belegte und ausdrücklich als exakt oder ungefähr eingeordnete Position kann gespeichert werden. Für Electric Taberna bleiben kanonische Koordinaten unbekannt, bis eine Quelle vorliegt.</p></div>
              <fieldset className={cmsStyles.editorFieldset} disabled={!editable||busy}>
                <div className={cmsStyles.geoControls}>
                  <label className="field"><span>Ortswissen zur Position</span><select value={geo.status} onChange={event=>{const value=event.target.value;if(value==="unknown"){setGeo({status:"unknown"});return;}const coords=geo.status==="unknown"?pickedCoordinates:geo.coordinates;if(!coords){toast.error("Klicke zuerst auf die Karte, um eine Position vorzumerken.");return;}const common={coordinates:coords,source:geo.status==="unknown"?"":geo.source,reference:geo.status==="unknown"?undefined:geo.reference,reviewedAt:new Date().toISOString()};if(value==="exact")setGeo({status:"exact",...common});else setGeo({status:"approximate",...common,accuracyMeters:geo.status==="approximate"?geo.accuracyMeters:0});}}><option value="unknown">Unbekannt · kein Spieler-Marker</option><option value="approximate">Ungefähres Gebiet</option><option value="exact">Exakte Position bestätigt</option></select></label>
                  {geo.status==="approximate"&&<label className="field"><span>Unschärfe in Metern</span><input type="number" min="1" max="1000000" value={geo.accuracyMeters} onChange={event=>setGeo({...geo,accuracyMeters:Number(event.target.value)})}/></label>}
                  {geo.status!=="unknown"&&<><label className="field"><span>Längengrad</span><input type="number" step="0.000001" min="-180" max="180" value={geo.coordinates[0]} onChange={event=>updateCoordinates(0,event.target.value)}/></label><label className="field"><span>Breitengrad</span><input type="number" step="0.000001" min="-90" max="90" value={geo.coordinates[1]} onChange={event=>updateCoordinates(1,event.target.value)}/></label><label className="field"><span>Herkunft / Prüfbeleg</span><input required value={geo.source} onChange={event=>setGeo({...geo,source:event.target.value})} placeholder="Quelle für diesen Kartenpunkt"/></label><label className="field"><span>Quellenverweis (optional)</span><input value={geo.reference||""} onChange={event=>setGeo({...geo,reference:event.target.value})}/></label></>}
                </div>
              </fieldset>
              {geo.status==="unknown"&&<p className={cmsStyles.geoUnknown}>Unbekannte Position bleibt unbekannt. Eine Kartenauswahl wird nicht als bestätigter Ort ausgegeben.</p>}
              {pickedCoordinates&&geo.status==="unknown"&&<div className={cmsStyles.candidatePosition}><strong>Unbestätigte Kartenauswahl</strong><span>{pickedCoordinates[0].toFixed(5)}, {pickedCoordinates[1].toFixed(5)}</span><button type="button" className="button" disabled={!editable||busy} onClick={()=>setPickedCoordinates(null)}>Auswahl verwerfen</button></div>}
              <p className={cmsStyles.mapInstruction}>{editable?"Klicke auf die Karte, um einen Marker vorzumerken. Für eine Speicherung musst du danach die Genauigkeit und Herkunft bestätigen.":"Die Karte ist für diesen genehmigten Stand schreibgeschützt."} Eine Adresssuche ist in der vorhandenen Kartenintegration nicht vorhanden; es wird nichts automatisch geocodiert.</p>
              <div className={cmsStyles.editorMapStage} data-map-state={mapState} data-map-disabled={!editable||busy}>
                <div className={mapStyles.mapImage} aria-hidden="true"/><div className={mapStyles.mapVignette} aria-hidden="true"/>
                <WorldMapLibre places={mapMarkerPlaces} visibleIds={mapMarkerIds} selectedId={mapMarkerIds[0]||""} hoveredId={null} onSelect={()=>{}} onHover={()=>{}} onFocusPlace={()=>{}} onStateChange={setMapState} onMapClick={coordinates=>{if(!editable||busy)return;if(geo.status==="unknown")setPickedCoordinates(coordinates);else setGeo({...geo,coordinates,reviewedAt:new Date().toISOString()});}}/>
                {mapState!=="ready"&&<p className={cmsStyles.mapMessage} role="status">{mapState==="loading"?"Die OpenStreetMap wird geladen …":"Die Basiskarte ist gerade nicht erreichbar. Es wurde keine Position übernommen."}</p>}
              </div>
              {geo.status!=="unknown"&&!geographyValid&&<p className="error-box" role="alert">Vor dem Speichern bitte eine gültige Herkunft und Genauigkeit ergänzen. Ohne diese Angaben bleibt der Marker unbestätigt.</p>}
            </section>}

            {activeSection==="release"&&<section className={"panel "+cmsStyles.editorPanel} role="tabpanel">
              <div className={cmsStyles.panelIntro}><p className="eyebrow">VORSCHAU & VERÖFFENTLICHUNG</p><h3>{scope==="gm"?"Interne SL-Prüfung":"Das echte Ortsdossier prüfen"}</h3><p>Beide Ansichten verwenden dasselbe Ortsdossier wie Spielwelt → Orte. Der Entwurf ist nur für berechtigte Spielleitung sichtbar; die Spieleransicht liest ausschließlich den tatsächlich freigegebenen Stand. Freigaben gelten in der aktuell geöffneten Umgebung und für die ausdrücklich ausgewählte Zielgruppe.</p></div>
              {publisher&&(scope==="group"||scope==="player")&&<div className={libraryStyles.notice}><strong>Dauerhaftes Spielerwissen: {release.discovery?.state||"hidden"}</strong><p>Veröffentlichung und Entdeckung sind getrennt. Eine Veröffentlichung allein schaltet unbekannte Inhalte nicht frei.</p><div className={libraryStyles.tools}><label className="field"><span>Entdeckungsstand</span><select value={discoveryState} onChange={e=>setDiscoveryState(e.target.value as DiscoveryState)}>{["hidden",...discovery].map(state=><option key={state} value={state}>{state}</option>)}</select></label><button type="button" className="button" disabled={busy||scope==="player"&&!playerTarget} onClick={async()=>{const current=release.discovery?.state||"hidden",correction=["hidden",...discovery].indexOf(discoveryState)<["hidden",...discovery].indexOf(current as DiscoveryState);if(!window.confirm(correction?"Administrative Korrektur: Dieses Wissen für die gewählte Zielgruppe wieder verbergen? Andere Zielgruppen bleiben unverändert.":"Diesen Eintrag dauerhaft für die gewählte Zielgruppe entdecken? Unterbereiche werden nicht automatisch freigegeben."))return;const audit=correction?window.prompt("Grund für die administrative Korrektur"):"Gezielte Entdeckung im Ortsdossier";if(!audit?.trim())return;setBusy(true);try{await api('/api/locations/state','POST',{placeId,entityId:node.id,mode:"discovery",audience:scope,...(scope==="player"?{playerId:playerTarget}:{}),discoveryState,expectedRevision:release.discovery?.version||0,administrativeCorrection:correction,reason:audit});await refreshRelease();clearDossierViews();toast.success("Entdeckungsstand gespeichert.");}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}}>Entdeckungsstand speichern</button></div></div>}
              {!!release.discovery?.history?.length&&<details><summary>Entdeckungsprotokoll</summary><ul>{release.discovery.history.map((entry,index)=><li key={entry.createdAt+index}><time>{new Date(entry.createdAt).toLocaleString('de-DE')}</time> · {entry.previousState} → {entry.nextState}{entry.administrativeCorrection?' · Administrative Korrektur':''}<p>{entry.reason}</p></li>)}</ul></details>}
              <label className="field"><span>Prüf- oder Veröffentlichungsnotiz (optional)</span><input value={reason} maxLength={500} onChange={event=>setReason(event.target.value)} placeholder="Optionaler Zusatz für das Freigabeprotokoll"/><small>Ohne eigene Notiz wird „Direktfreigabe im SL-CMS“ protokolliert.</small></label>
              <div className={cmsStyles.releaseSummary}><span data-status={selectedDraft.status}>{selectedDraft.status.replaceAll("_"," ")}</span><strong>{scope==="gm"?"Nur Spielleitung":scope==="group"?"Aktive Spielgruppe":scope==="public"?"Public · Anmeldung erforderlich":catalog.players.find(item=>item.id===playerId)?.name||"Spieler wählen"}</strong><small>Freigabeversion {release.currentVersion} · {release.currentTransition||"noch keine Freigabe"} · {release.history.length} protokollierte Schritte</small></div>
              <div className={cmsStyles.releaseActions}>
                {scope!=="gm"&&<><button type="button" className="button" disabled={busy||!selectedDraft||dirty} onClick={()=>void inspectPreview()}><Eye size={16}/> Entwurf ansehen</button><button type="button" className="button" disabled={busy||!node||scope==="player"&&!playerTarget} onClick={()=>void inspectPublished()}><Eye size={16}/> Veröffentlichte Spieleransicht</button></>}
                {publisher&&scope!=="gm"&&<><button type="button" className="button primary" disabled={busy||!selectedDraft||selectedDraft.status!=="approved"||scope==="player"&&!playerId||dirty} onClick={()=>void changeRelease("publish")}><Check size={16}/> Genehmigten Stand freigeben</button><button type="button" className="button" disabled={busy||release.currentVersion===0||scope==="player"&&!playerId||dirty} onClick={()=>void changeRelease("revoke")}><Slash size={16}/> Freigabe zurückziehen</button><button type="button" className="button" disabled={busy||release.currentVersion===0||scope==="player"&&!playerId||dirty} onClick={()=>void changeRelease("block")}><ShieldCheck size={16}/> Zielgruppe sperren</button></>}
              </div>
              {previewMode&&scope!=="gm"&&<section className={cmsStyles.dossierPreview} aria-live="polite" aria-label={previewMode==="draft"?"Entwurf im echten Ortsdossier":"Veröffentlichte Spieleransicht im echten Ortsdossier"}>
                <div className={cmsStyles.dossierPreviewLabel}><span>{previewMode==="draft"?"ENTWURF ANSEHEN · NUR SPIELLEITUNG":"VERÖFFENTLICHTE SPIELERANSICHT · FREIGEGEBENER STAND"}</span><button type="button" className="button" onClick={()=>setPreviewMode(null)}>Ansicht schließen</button></div>
                <WorldExperience a={a} dataScope={dataScope} previewViewerId={scope==="player"?playerTarget:undefined} projectionOverride={previewMode==="draft"?preview?.projection:publishedProjection} embeddedLabel={previewMode==="draft"?"SL-Entwurf · nicht veröffentlicht":"Tatsächliche Spielerprojektion · veröffentlichter Stand"} onDossierBack={()=>setPreviewMode(null)}/>
              </section>}
              {publisher&&scope!=="gm"&&<p className={cmsStyles.inlineNotice}>Die Freigabe aktualisiert den Spielerstand in dieser Umgebung. Unveröffentlichte Entwürfe bleiben geschützt.</p>}
            </section>}

            <div className={cmsStyles.saveBar}>
              <div className={cmsStyles.saveStatus} aria-live="polite"><span data-dirty={dirty}>{dirty?"UNGESPEICHERTE ÄNDERUNGEN":selectedDraft.status==="draft"?"ENTWURF GESPEICHERT":selectedDraft.status==="in_review"?"IN PRÜFUNG":selectedIsCurrentRelease?"AKTUELL FREIGEGEBEN":selectedDraft.status==="approved"?"GENEHMIGT · NOCH NICHT FREIGEGEBEN":selectedDraft.status.toUpperCase()}</span><small>{dirty?"Noch nicht gespeichert. Spieler sehen den freigegebenen Stand.":selectedDraft.status==="draft"?"Aus der Datenbank bestätigt. Spieler sehen weiterhin nur den zuletzt freigegebenen Stand.":selectedDraft.status==="in_review"?"Zur Prüfung eingereicht. Der zuletzt freigegebene Stand bleibt für Spieler sichtbar.":selectedDraft.status==="approved"&&!selectedIsCurrentRelease?"Genehmigt, aber nicht veröffentlicht. Spieler sehen weiterhin den vorherigen freigegebenen Stand.":selectedIsCurrentRelease?"Diese genehmigte Revision ist für das gewählte Ziel freigegeben.":"Status des ausgewählten Arbeitsstands."}</small></div>
              <div className={cmsStyles.saveActions}>
                {selectedDraft.status==="draft"&&<><button type="button" className="button" disabled={busy||!dirty||!editable||isRoot&&!geographyValid} onClick={()=>void saveDraft()}><Save size={16}/> Entwurf speichern</button>{publisher?<button type="button" className="button primary" disabled={busy||!editable||scope==="gm"||scope==="player"&&!playerTarget||isRoot&&!geographyValid} onClick={()=>void saveAndPublish()}><Check size={16}/> Speichern und veröffentlichen</button>:<button type="button" className="button primary" disabled={busy||dirty||!editable} onClick={()=>void transition("submit")}><Send size={16}/> Zur Prüfung einreichen</button>}</>}
                {publisher&&selectedDraft.status==="in_review"&&<><button type="button" className="button primary" disabled={busy||dirty} onClick={()=>void transition("approve")}><ShieldCheck size={16}/> Genehmigen</button><button type="button" className="button" disabled={busy||dirty||!reason.trim()} onClick={()=>void transition("reject")}><Slash size={16}/> Zur Überarbeitung</button></>}
              </div>
            </div>
          </>}
          {!selectedDraft&&scope!=="gm"&&<section className={"panel "+cmsStyles.emptyEditor}><p className="eyebrow">KEIN ARBEITSSTAND AUSGEWÄHLT</p><h3>{scope==="player"&&!playerId?"Wähle zuerst ein Spielerziel":"Noch kein bearbeitbarer Entwurf"}</h3><p className="muted">Wähle eine vorhandene Revision oder lege eine neue an. So bleiben Entwurf und bereits freigegebener Spielerstand getrennt.</p>{node&&<button type="button" className="button primary" onClick={()=>void createDraft()} disabled={busy||scope==="player"&&!playerId}><FileImage size={15}/> Neue bearbeitbare Revision</button>}</section>}
        </>}
      </div>
    </div>
  </div>;
}
