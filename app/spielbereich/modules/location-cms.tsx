/* eslint-disable @next/next/no-img-element -- The preview uses temporary local blobs or an authenticated revision endpoint. */
"use client";
import type { Actor } from "@/domain/types";
import type { DiscoveryState,PlaceProjection } from "@/domain/location-types";
import { ELECTRIC_TABERNA_ID } from "@/domain/location-model";
import { locationCreationParent } from "@/domain/location-creation";
import { LocationConnections } from "./location-connections";
import { LocationKnowledgeSearch } from "./location-knowledge-search";
import { LocationChapters } from "./location-chapters";
import { LocationMediaManager } from "./location-media-manager";
import { invalidatePlayerData } from "./player-data-cache";
import { LocationTreeRelease } from "./location-tree-release";
import { LocationReleaseOverview } from "./location-release-overview";
import { LocationStructureControls } from "./location-structure-controls";
import libraryStyles from "./location-library.module.css";
import { Check,ChevronRight,ExternalLink,Eye,Plus,RefreshCw,Save,Search,Send,ShieldCheck,Slash } from "lucide-react";
import { type FormEvent,useCallback,useEffect,useMemo,useRef,useState } from "react";
import { toast } from "sonner";
import { api } from "./api-client";
import { useLocationDialog } from "./location-dialog";
import { DiscoverySteps } from "./location-discovery-steps";
import { LocationWorldState } from "./location-world-state";
import { LocationPreparedActions } from "./location-prepared-actions";
import { LocationMilestoneLink } from "./location-milestone-link";
import { WebsiteHint } from "./website-release";
import { openLocationPreviewChannel,type LocationPreviewMessage } from "./location-preview-channel";
import { WorldMapLibre } from "./world-maplibre";
import type { WorldMapMarker } from "./world-map-contract";
import mapStyles from "./world-experience.module.css";
import cmsStyles from "./location-cms.module.css";
import { RichTextEditor } from "./rich-text";
import { WorldExperience } from "./world-experience";

type Scope="gm"|"public"|"group"|"player";
type LocationOption={id:string;title:string;position:number;lifecycle?:string};
type NodeOption={id:string;locationId:string;parentId:string|null;level:"location"|"area"|"room"|"information";position:number;revision:number;groupDiscovery:string;groupPublication:string;lifecycle:string;title:string;visibility?:string;unlockMilestone?:string|null;showOnWebsite?:boolean};
type PlayerOption={id:string;name:string};
// Tree status for the group of players. A section never handled by the CMS (no release row) shows its original
// text (Grundfassung) once discovered; the server projection treats it the same way.
const treeReach=(item:NodeOption)=>item.visibility==="gm"?"sl":item.groupPublication==="publish"?(item.groupDiscovery==="hidden"?"draft":"table"):item.groupPublication==="draft"&&item.groupDiscovery!=="hidden"?"table":"draft";
const treeStatus=(item:NodeOption)=>item.visibility==="gm"?"nur für dich":item.groupPublication==="publish"?(item.groupDiscovery==="hidden"?"freigegeben, noch unentdeckt":"freigegeben"):item.groupPublication==="block"?"gesperrt":item.groupPublication==="revoke"?"verborgen":item.groupDiscovery!=="hidden"?"Grundfassung sichtbar":"noch nicht freigegeben";
type Draft={id:string;entity_id:string;revision_no:number;audience_scope:string;audience_key:string;audience_user_id:string|null;status:string;version:number;player_payload_json:string;gm_secret_json?:string;geography_json:string;hero_file_id?:string|null};
type ReleaseEntry={revision_id:string|null;transition:string;release_version:number};
type NewNodeDraft={level:"location"|"area"|"room"|"information";parentId:string|null;title:string};
type Geography={status:"unknown"}|{status:"exact";coordinates:[number,number];source:string;reference?:string;reviewedAt:string}|{status:"approximate";coordinates:[number,number];accuracyMeters:number;source:string;reference?:string;reviewedAt:string};
type DraftBaseline={payload:Record<string,unknown>;geography:Geography};
const discoveryLabels:Record<string,string>={hidden:"Unbekannt",rumored:"Gerücht",known:"Bekannt",visited:"Besucht",investigated:"Untersucht"};
type Preview={projection:PlaceProjection;preview:{scope:string;viewerId:string}};
type CmsState={locations:LocationOption[];players:PlayerOption[]};
const parse=(raw:string):Record<string,unknown>=>{try{const x:unknown=JSON.parse(raw);return x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:{};}catch{return {};}};
const stable=(value:unknown):string=>{
  if(Array.isArray(value))return `[${value.map(stable).join(",")}]`;
  if(value&&typeof value==="object")return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value)??"undefined";
};
const discovery:DiscoveryState[]=["rumored","known","visited","investigated"];

function placeFirst(list:NodeOption[]){return [...list.filter(node=>node.level!=="information"),...list.filter(node=>node.level==="information")];}
export function LocationCMS({a,dataScope}:{a:Actor;dataScope:string}){
  const dlg=useLocationDialog();
  const publisher=a.status==="active"&&["campaign_owner","campaign_gm"].includes(a.role);
  const [catalog,setCatalog]=useState<CmsState>({locations:[],players:[]});
  const [placeId,setPlaceId]=useState("");
  const [includeInactive,setIncludeInactive]=useState(false);
  const [nodes,setNodes]=useState<NodeOption[]>([]);
  const [nodeId,setNodeId]=useState("");
  const [scope,setScope]=useState<Scope>("group");
  const [playerId,setPlayerId]=useState("");
  const [drafts,setDrafts]=useState<Draft[]>([]);
  const [draftId,setDraftId]=useState("");
  const [baseline,setBaseline]=useState<DraftBaseline|null>(null);
  const [loadedEditor,setLoadedEditor]=useState("");
  // The entry the text in `payload` belongs to. Saving is refused if it is not the open entry, so text can never
  // land in another Erkenntnis (or Bereich/Raum) after switching entries.
  const payloadOwner=useRef("");
  const editorKey=JSON.stringify([nodeId,scope,playerId]);
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
  const [activeSection,setActiveSection]=useState<"content"|"describe"|"map"|"release">("content");
  const [directorySearch,setDirectorySearch]=useState("");
  const [newNode,setNewNode]=useState<NewNodeDraft|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [mapState,setMapState]=useState<"loading"|"ready"|"error">("loading");
  const nodeRowRefs=useRef(new Map<string,HTMLButtonElement>());
  const node=nodes.find(item=>item.id===nodeId)||null;
  const areaParent=locationCreationParent("area",nodes,placeId,nodeId);
  const roomParent=locationCreationParent("room",nodes,placeId,nodeId);
  const creationParents=newNode?.level==="area"
    ?nodes.filter(item=>item.id===placeId&&item.level==="location"&&item.lifecycle==="active")
    :newNode?.level==="room"
      ?nodes.filter(item=>item.locationId===placeId&&item.level==="area"&&item.lifecycle==="active")
      :[];
  const selectedDraft=drafts.find(item=>item.id===draftId&&item.entity_id===nodeId&&item.audience_scope===scope&&(scope!=="player"||item.audience_user_id===playerId))||null;
  const isRoot=node?.level==="location";
  const currentEditor=loadedEditor===editorKey;
  const latestDraft=drafts.find(item=>item.entity_id===nodeId&&item.audience_scope===scope&&(scope!=="player"||item.audience_user_id===playerId));
  const inactiveNode=Boolean(node&&node.lifecycle!=="active");
  const hasWork=Boolean(!inactiveNode&&currentEditor&&(selectedDraft||baseline));
  const editable=!inactiveNode&&currentEditor&&(selectedDraft?selectedDraft.status==="draft"||selectedDraft.id===latestDraft?.id:Boolean(baseline));
  const selectedIsCurrentRelease=Boolean(selectedDraft&&release.history[0]?.transition==="publish"&&release.history[0]?.revision_id===selectedDraft.id);
  const playerTarget=scope==="player"?playerId:"";
  useEffect(()=>()=>{if(pendingImageUrl)URL.revokeObjectURL(pendingImageUrl);},[pendingImageUrl]);
  const dirty=useMemo(()=>{
    if(!editable)return false;
    if(!selectedDraft)return Boolean(baseline&&(heroFileId!==null||stable({payload,geography:geo})!==stable(baseline)));
    return stable({payload,gmSecret,geography:geo,heroFileId})!==stable({
      payload:parse(selectedDraft.player_payload_json),
      gmSecret:parse(selectedDraft.gm_secret_json||"{}"),
      geography:parse(selectedDraft.geography_json),
      heroFileId:selectedDraft.hero_file_id||null,
    });
  },[baseline,editable,geo,gmSecret,heroFileId,payload,selectedDraft]);
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
    if(!needle)return placeFirst(orderedNodes.filter(item=>{let parent=item.parentId;while(parent){if(collapsed.has(parent))return false;parent=orderedNodes.find(n=>n.id===parent)?.parentId||null;}return true;}));
    const matches=new Set(orderedNodes.filter(item=>`${item.title} ${item.level} ${item.visibility||""}`.toLocaleLowerCase("de-DE").includes(needle)).map(item=>item.id));
    // Keep each matching node's parent chain visible so the directory retains context.
    for(const item of orderedNodes){if(matches.has(item.id)){let parent=item.parentId;while(parent){matches.add(parent);parent=orderedNodes.find(candidate=>candidate.id===parent)?.parentId||null;}}}
    return placeFirst(orderedNodes.filter(item=>matches.has(item.id)));
  },[directorySearch,orderedNodes,collapsed]);
  const sections=[
    {id:"content" as const,label:isRoot?"Grunddaten":node?.level==="information"?"Hinweis":"Inhalt"},
    ...(isRoot?[{id:"describe" as const,label:"Ort beschreiben"}]:[]),
    ...(isRoot?[{id:"map" as const,label:"Karte & Geodaten"}]:[]),
    {id:"release" as const,label:"Für Spieler"},
  ];

  async function openSection(id:string,section:"content"|"release"){
    if(id===nodeId){setActiveSection(section);return;}
    if(!(await canLeaveEditor()))return;
    const item=nodes.find(row=>row.id===id);if(!item)return;
    setNodeId(id);setReason("");setNewNode(null);clearDossierViews();setActiveSection(section);
    if(item.visibility==="gm")setScope("gm");else if(scope==="gm")setScope("group");
  }

  // Second screen: the preview window follows the selected section and reloads after saves and releases.
  const previewChannel=useRef<ReturnType<typeof openLocationPreviewChannel>|null>(null);
  const previewState=useRef<LocationPreviewMessage|null>(null);
  const [previewTick,setPreviewTick]=useState(0);
  useEffect(()=>{
    const channel=openLocationPreviewChannel(message=>{if(message.type==="hello"&&previewState.current)channel.post(previewState.current);});
    previewChannel.current=channel;
    return()=>{channel.close();previewChannel.current=null;};
  },[]);
  const previewEntity=node?.id??"",previewTitle=node?.title??"",previewRevision=selectedDraft?.id??null,previewStatus=selectedDraft?.status??"",previewVersion=selectedDraft?.version??0;
  useEffect(()=>{
    if(!placeId||!previewEntity)return;
    const message:LocationPreviewMessage={type:"state",placeId,entityId:previewEntity,title:previewTitle,revisionId:previewRevision,previewable:scope!=="gm"&&!!previewRevision&&["draft","in_review","approved"].includes(previewStatus),stamp:[previewVersion,release.currentVersion,release.discovery?.version??0,previewTick].join(":")};
    previewState.current=message;previewChannel.current?.post(message);
  },[placeId,previewEntity,previewTitle,previewRevision,previewStatus,previewVersion,release.currentVersion,release.discovery?.version,previewTick,scope]);
  function openPreviewWindow(){
    const url=`/sl/orte-vorschau?ort=${encodeURIComponent(placeId)}${previewEntity?`&eintrag=${encodeURIComponent(previewEntity)}`:""}`;
    const opened=window.open(url,"chroniplay-orte-vorschau");
    if(!opened)toast.error("Das Vorschau-Fenster wurde blockiert. Bitte erlaube Pop-ups für ChroniPlay.");
    else if(previewState.current)window.setTimeout(()=>previewChannel.current?.post(previewState.current!),800);
  }

  async function canLeaveEditor(){
    if(busy)return false;
    if(!(dirty||chapterDirty||mediaDirty))return true;
    return dlg.ask("Es gibt ungespeicherte Änderungen. Wenn du fortfährst, werden diese Änderungen verworfen. Möchtest du weitergehen?","Änderungen verwerfen");
  }

  async function beginNodeCreation(level:NewNodeDraft["level"]){
    if(!publisher||!(await canLeaveEditor()))return;
    const parent=locationCreationParent(level,nodes,placeId,nodeId);
    if(level!=="location"&&!parent)return;
    setNewNode({level,parentId:parent?.id??null,title:""});
  }

  async function submitNodeCreation(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!newNode||!newNode.title.trim()||!publisher||(newNode.level!=="location"&&!newNode.parentId))return;
    setBusy(true);
    try{
      const created=await api<{id:string;locationId:string;level:NewNodeDraft["level"]}>('/api/cms/locations','POST',{
        level:newNode.level,title:newNode.title.trim(),...(newNode.parentId?{parentId:newNode.parentId}:{}),
      });
      const [catalogResult,treeResult,draftResult]=await Promise.all([
        api<{locations:LocationOption[];players?:PlayerOption[]}>('/api/cms/locations'+(includeInactive?'?includeInactive=1':'')),
        api<{nodes:NodeOption[]}>(`/api/cms/locations?place=${encodeURIComponent(created.locationId)}${includeInactive?'&includeInactive=1':''}`),
        api<{drafts:Draft[]}>(`/api/cms/drafts?entityId=${encodeURIComponent(created.id)}`),
      ]);
      const initialDraft=draftResult.drafts.find(item=>item.audience_scope==="group"&&item.audience_key==="@group")||null;
      setCatalog({locations:catalogResult.locations,players:catalogResult.players||[]});
      setPlaceId(created.locationId);setNodes(treeResult.nodes);setNodeId(created.id);setScope("group");setPlayerId("");
      setDrafts(draftResult.drafts);setDraftId(initialDraft?.id||"");
      setPayload(initialDraft?parse(initialDraft.player_payload_json):{});payloadOwner.current=created.id;setGmSecret({});
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
      const result=await api<{locations:LocationOption[];players?:PlayerOption[]}>('/api/cms/locations'+(includeInactive?'?includeInactive=1':''));
      const next={locations:result.locations,players:result.players||[]};setCatalog(next);
      setPlaceId(current=>current&&next.locations.some(item=>item.id===current)?current:next.locations.some(item=>item.id===ELECTRIC_TABERNA_ID)?ELECTRIC_TABERNA_ID:next.locations[0]?.id||"");
    }catch(error){toast.error((error as Error).message);}finally{setLoading(false);}
  },[includeInactive]);
  useEffect(()=>{
    const timer=window.setTimeout(()=>{void loadCatalog();},0);
    return()=>window.clearTimeout(timer);
  },[loadCatalog]);
  useEffect(()=>{
    let alive=true;
    const timer=window.setTimeout(()=>{
      if(!placeId){setNodes([]);setNodeId("");return;}
      setLoading(true);
      api<{nodes:NodeOption[]}>(`/api/cms/locations?place=${encodeURIComponent(placeId)}${includeInactive?'&includeInactive=1':''}`).then(result=>{
        if(!alive)return;setNodes(result.nodes);setNodeId(current=>result.nodes.some(row=>row.id===current)?current:result.nodes.find(row=>row.level==="location")?.id||"");
      }).catch(error=>{if(alive)toast.error((error as Error).message);}).finally(()=>{if(alive)setLoading(false);});
    },0);
    return()=>{alive=false;window.clearTimeout(timer);};
  },[placeId,includeInactive]);
  useEffect(()=>{nodeRowRefs.current.get(nodeId)?.scrollIntoView({block:"nearest"});},[nodeId,filteredNodes.length]);
  const refreshDrafts=useCallback(async(selectNewest=false,isCurrent:()=>boolean=()=>true)=>{
    if(!nodeId){setDrafts([]);setDraftId("");return;}
    const query=new URLSearchParams({entityId:nodeId,scope,...(playerTarget?{playerId:playerTarget}:{})});
    const result=await api<{drafts:Draft[];baseline:DraftBaseline|null}>(`/api/cms/drafts?${query}`);
    if(!isCurrent())return;
    const scoped=result.drafts.filter(item=>item.audience_scope===scope&&(scope!=="player"||item.audience_user_id===playerTarget));
    setDrafts(result.drafts);setBaseline(result.baseline);setPendingImageUrl(null);setLoadedEditor(editorKey);
    const current=selectNewest?"":draftIdRef.current;
    const selected=scoped.find(item=>item.id===current)||scoped[0]||null;
    setDraftId(selected?.id||"");
    payloadOwner.current=nodeId;
    if(selected){setPayload(parse(selected.player_payload_json));setGmSecret(parse(selected.gm_secret_json||"{}"));const selectedGeo=(parse(selected.geography_json) as unknown as Geography)||{status:"unknown"};setGeo(selectedGeo);setPickedCoordinates(selectedGeo.status==="unknown"?null:selectedGeo.coordinates);setHeroFileId(selected.hero_file_id||null);}
    else {setPayload(result.baseline?.payload??{});setGmSecret({});setGeo(result.baseline?.geography??{status:"unknown"});setPickedCoordinates(null);setHeroFileId(null);setPreview(null);setPublishedProjection(null);setPreviewMode(null);}
  },[editorKey,nodeId,scope,playerTarget]);
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

  async function verifyAddress(){
    const address=typeof payload.address==="string"?payload.address.trim():"";
    if(!editable||busy||!address)return;
    setBusy(true);
    try{
      const found=await api<{coordinates:[number,number];source:string;reference:string}>('/api/cms/location-address','POST',{address});
      setPickedCoordinates(found.coordinates);
      setGeo({status:"exact",...found,reviewedAt:new Date().toISOString()});
      clearDossierViews();
      toast.success("Amtliche Adresse gefunden. Die Position wird mit Speichern übernommen.");
    }catch(error){toast.error((error as Error).message);}
    finally{setBusy(false);}
  }

  function clearDossierViews(){setPreview(null);setPublishedProjection(null);setPreviewMode(null);}
  function setField(key:string,value:unknown){setPayload(current=>({...current,[key]:value}));clearDossierViews();}
  async function uploadTitleImage(file:File|undefined){
    if(!file||!editable||busy)return;
    setBusy(true);
    try{
      const form=new FormData();form.set("file",file);
      const response=await fetch("/api/cms/media",{method:"POST",body:form});
      const uploaded=await response.json() as {id?:string;error?:string};
      if(!response.ok||!uploaded.id)throw new Error(uploaded.error||"Bild konnte nicht hochgeladen werden.");
      setHeroFileId(uploaded.id);setPendingImageUrl(URL.createObjectURL(file));clearDossierViews();
      toast.success("Bild ausgewählt. Speichern übernimmt es in den Entwurf.");
    }catch(error){toast.error((error as Error).message);}finally{setBusy(false);}
  }
  async function saveDraft(){
    if(!node||!editable||!dirty)return;
    if(payloadOwner.current!==node.id){toast.error("Dieser Text gehört nicht zu „"+node.title+"“. Er wurde nicht gespeichert; der Eintrag wird neu geladen.");await refreshDrafts(true);return;}
    if(isRoot&&!geographyValid){toast.error("Ergänze die Quelle und bei einem ungefähren Gebiet die Genauigkeit in Metern.");return;}
    setBusy(true);
    try{
      const content={payload,gmSecret,...(heroFileId!==(selectedDraft?.hero_file_id??null)?{heroFileId}:{}),...(isRoot?{geography:geo}:{})};
      if(selectedDraft?.status==="draft"){
        await api('/api/cms/drafts','PATCH',{revisionId:selectedDraft.id,expectedVersion:selectedDraft.version,...content});
      }else{
        await api('/api/cms/drafts','POST',{entityId:node.id,audience:scope,...(playerTarget?{playerId:playerTarget}:{}),...(selectedDraft?{sourceRevisionId:selectedDraft.id}:{}),expectedLatest:latestDraft?`${latestDraft.id}:${latestDraft.version}`:"none",...content});
      }
      setPendingImageUrl(null);
      toast.success("Gespeichert. Der freigegebene Stand bleibt bestehen.");
      clearDossierViews();
      await refreshDrafts(true);await refreshRelease();
    }catch(error){toast.error((error as Error).message);}finally{setBusy(false);}
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
    if(!await dlg.ask(action==="publish"?"Diesen genehmigten Stand genau für die gewählte Zielgruppe veröffentlichen?":action==="revoke"?"Die Freigabe zurückziehen? Danach greift gegebenenfalls die Freigabe einer niedrigeren Ebene.":"Diese Zielgruppe ausdrücklich sperren? Eine niedrigere Freigabe bleibt dadurch ebenfalls verborgen."))return;
    setBusy(true);
    try{await api('/api/cms/releases','POST',{action,entityId:node.id,scope,...(scope==="player"?{playerId:playerTarget}:{}),...(action==="publish"&&selectedDraft?{revisionId:selectedDraft.id}:{}),expectedReleaseVersion:release.currentVersion,grantDiscovery:false,reason:reason.trim()||"Freigabeänderung im SL-CMS"});toast.success(action==="publish"?"Gezielt veröffentlicht":action==="revoke"?"Freigabe zurückgezogen":"Zielgruppe gesperrt");clearDossierViews();await refreshRelease();}
    catch(error){toast.error((error as Error).message);if((error as {status?:number}).status===409)await refreshRelease();}finally{setBusy(false);}
  }
  async function saveAndPublish(){
    if(!publisher||!node||!selectedDraft||selectedDraft.status!=="draft"||dirty||scope==="gm"||scope==="player"&&!playerTarget)return;
    if(selectedDraft.entity_id!==node.id||payloadOwner.current!==node.id){toast.error("Der Entwurf gehört nicht zu „"+node.title+"“. Bitte lade den Eintrag neu.");return;}
    if(isRoot&&!geographyValid){toast.error("Die Ortsposition ist nicht prüfbar. Lass sie unbekannt oder ergänze nachvollziehbare Genauigkeit und Herkunft.");return;}
    const auditReason=reason.trim()||"Direktfreigabe im SL-CMS";
    const audience=scope==="group"?"die aktive Spielgruppe":scope==="public"?"das angemeldete Public-Lesemodell":catalog.players.find(item=>item.id===playerTarget)?.name||"den ausgewählten Spieler";
    if(!await dlg.ask(`Den aktuellen Inhalt für ${audience} speichern, zur Prüfung einreichen, genehmigen und gezielt freigeben? Zielumgebung: ${window.location.origin}. Dort sehen berechtigte Spieler anschließend diesen freigegebenen Stand.`))return;
    setBusy(true);
    try{
      const submitted=await api<{version:number}>('/api/cms/transitions','POST',{action:"submit",revisionId:selectedDraft.id,expectedVersion:selectedDraft.version,reason:auditReason});
      await api<{version:number}>('/api/cms/transitions','POST',{action:"approve",revisionId:selectedDraft.id,expectedVersion:submitted.version,reason:auditReason});
      await api('/api/cms/releases','POST',{action:"publish",entityId:node.id,scope,...(scope==="player"?{playerId:playerTarget}:{}),revisionId:selectedDraft.id,expectedReleaseVersion:release.currentVersion,grantDiscovery:false,reason:auditReason});
      toast.success("Gespeichert, genehmigt und für das ausgewählte Ziel freigegeben.");
      setReason("");
      clearDossierViews();
      await Promise.all([refreshDrafts(true),refreshRelease()]);
    }catch(error){toast.error(`Der Ablauf wurde an der letzten erfolgreichen Stufe gestoppt: ${(error as Error).message}`);await Promise.all([refreshDrafts(true).catch(()=>{}),refreshRelease().catch(()=>{})]);}
    finally{setBusy(false);}
  }
  function updateCoordinates(index:0|1,value:string){const numeric=Number(value);if(!Number.isFinite(numeric)||geo.status==="unknown")return;const coordinates:[number,number]=[...geo.coordinates];coordinates[index]=numeric;setGeo({...geo,coordinates});}
  const visibleDrafts=drafts.filter(item=>item.audience_scope===scope&&(scope!=="player"||item.audience_user_id===playerTarget));

  return <div className={cmsStyles.cmsWorkspace} data-location-cms="phase-c">{dlg.dialog}

    <div className={cmsStyles.redactionLayout}>
      <aside className={"panel "+cmsStyles.directoryPanel} aria-label="Ortsverzeichnis" data-creating={Boolean(newNode)}>
        <div className={cmsStyles.directoryHead}><div><h2>Orte</h2><p className={cmsStyles.directoryLead}>Hauptort, Bereiche und Räume</p></div><button type="button" className="button" aria-label="Ortsverzeichnis aktualisieren" onClick={async()=>{if(await canLeaveEditor())void loadCatalog();}} disabled={loading}><RefreshCw size={15}/></button></div>
        <label className={"field "+cmsStyles.locationSelect}><span>Hauptort</span><select aria-label="Hauptort" value={placeId} onChange={async event=>{const next=event.target.value;/* read before the await: React resets the controlled select at once */if(await canLeaveEditor()){setNewNode(null);setReason("");clearDossierViews();setPlaceId(next);}}} disabled={loading}>{!catalog.locations.length&&<option value="">Keine Orte vorhanden</option>}{catalog.locations.map(place=><option key={place.id} value={place.id}>{place.title}{place.lifecycle==='deleted'?' · Papierkorb':place.lifecycle==='archived'?' · Archiv':''}</option>)}</select></label>
        {publisher&&<button type="button" className={"button "+cmsStyles.newPlaceButton} onClick={()=>beginNodeCreation("location")} disabled={busy||loading}><Plus size={14}/> Neuer Hauptort</button>}
        {publisher&&<label className={cmsStyles.inactiveToggle}><input type="checkbox" checked={includeInactive} disabled={busy||loading} onChange={async event=>{const next=event.target.checked;if(await canLeaveEditor()){setIncludeInactive(next);setNodes([]);setNodeId("");clearDossierViews();}}}/>Papierkorb und Archiv anzeigen</label>}
        <label className={cmsStyles.directorySearch}><Search size={15}/><span className="sr-only">Orte, Bereiche und Räume suchen</span><input value={directorySearch} onChange={event=>setDirectorySearch(event.target.value)} placeholder="Im Bestand suchen"/></label>
        {publisher&&<details className={cmsStyles.creationMenu}><summary><Plus size={16}/> Eintrag anlegen</summary>
          <div className={cmsStyles.directoryActions} role="group" aria-label="Ortseinträge hinzufügen">
            {areaParent&&<button type="button" className={`button ${cmsStyles.childCreateAction}`} onClick={()=>beginNodeCreation("area")} disabled={busy||loading}><span>Bereich hinzufügen<small>Unter {areaParent.title} · Ein Teil des Ortes, z. B. Hinterhof</small></span></button>}
            {roomParent&&<button type="button" className={`button ${cmsStyles.childCreateAction}`} onClick={()=>beginNodeCreation("room")} disabled={busy||loading}><span>Raum hinzufügen<small>Unter {roomParent.title} · Ein Raum im Bereich, z. B. Tresen</small></span></button>}
          </div>
        </details>}
        {newNode&&<form className={cmsStyles.createNodeForm} onSubmit={event=>void submitNodeCreation(event)}>
          <label className="field"><span>{newNode.level==="location"?"Name des Hauptorts":newNode.level==="area"?"Name des Bereichs":newNode.level==="information"?"Titel der Erkenntnis":"Name des Raums"}</span><input autoFocus required maxLength={160} value={newNode.title} onChange={event=>setNewNode(current=>current?{...current,title:event.target.value}:current)} placeholder={newNode.level==="location"?"Zum Beispiel: Testort":newNode.level==="area"?"Zum Beispiel: Empfangshalle":newNode.level==="room"?"Zum Beispiel: Warteraum":"Zum Beispiel: Beobachtung"}/></label>
          {(newNode.level==="area"||newNode.level==="room")&&<label className="field"><span>{newNode.level==="area"?"Hauptort auswählen":"Bereich auswählen"}</span><select required value={newNode.parentId??""} onChange={event=>setNewNode(current=>current?{...current,parentId:event.target.value||null}:current)}><option value="">Bitte auswählen …</option>{creationParents.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
          <p>{newNode.level==="information"?<><strong>Unter „{nodes.find(item=>item.id===newNode.parentId)?.title||newNode.parentId}“.</strong> Dieser Hinweis bleibt verborgen, bis du ihn für Spieler freigibst.</>:"Weitere Details bearbeitest du nach dem Anlegen im Ortsdossier. Der erste Entwurf bleibt unveröffentlicht."}</p>
          <div><button type="button" className="button" onClick={()=>setNewNode(null)} disabled={busy}>Abbrechen</button><button type="submit" className="button primary" disabled={busy||!newNode.title.trim()||(newNode.level!=="location"&&!newNode.parentId)}><Plus size={14}/> {newNode.level==="location"?"Hauptort":newNode.level==="area"?"Bereich":newNode.level==="room"?"Raum":"Erkenntnis"} anlegen</button></div>
        </form>}
        <div className={cmsStyles.directoryScroll}>
          {loading&&!nodes.length?<p className="muted">Ortsbestand wird geladen …</p>:!filteredNodes.length?<p className="muted">Keine passenden Einträge.</p>:<nav className={cmsStyles.nodeTree} aria-label="Bereiche, Räume und Informationen">
            {filteredNodes.flatMap((item,index)=>[item.level==="information"&&(index===0||filteredNodes[index-1].level!=="information")?<h4 key={"info-"+item.id} className={cmsStyles.treeHeading}><span>Erkenntnisse</span>{areaParent&&<button type="button" className="button" aria-label="Neue Erkenntnis" title="Neue Erkenntnis" onClick={()=>beginNodeCreation("information")} disabled={busy||loading}><Plus size={13} aria-hidden="true"/>Neu</button>}</h4>:null,<div key={item.id} className={libraryStyles.treeRow} data-level={item.level}>{nodes.some(n=>n.parentId===item.id)?<button type="button" className={cmsStyles.treeToggle} aria-label={(collapsed.has(item.id)?"Aufklappen: ":"Zuklappen: ")+item.title} aria-expanded={!collapsed.has(item.id)} onClick={()=>setCollapsed(current=>{const next=new Set(current);if(next.has(item.id))next.delete(item.id);else next.add(item.id);return next;})}>{collapsed.has(item.id)?"▸":"▾"}</button>:<span className={cmsStyles.treeSpacer} aria-hidden="true"/>}<button ref={element=>{if(element)nodeRowRefs.current.set(item.id,element);else nodeRowRefs.current.delete(item.id);}} type="button" className={cmsStyles.nodeRow} data-level={item.level} data-selected={item.id===nodeId} aria-current={item.id===nodeId?"page":undefined} onClick={async()=>{if(item.id===nodeId||!(await canLeaveEditor()))return;setNodeId(item.id);setReason("");setNewNode(null);clearDossierViews();setActiveSection("content");if(item.visibility==="gm")setScope("gm");else if(scope==="gm")setScope("group");}}>
              <i className={cmsStyles.reachDot} data-reach={treeReach(item)} title={treeReach(item)==="sl"?"Nur für dich":treeReach(item)==="table"?"Spieler sehen das":"Spieler sehen das nicht"} aria-hidden="true"/><span className={cmsStyles.nodeCopy} title={item.visibility==="gm"?undefined:"Spielerwissen: "+(discoveryLabels[item.groupDiscovery]??"Unbekannt")}><strong>{item.title}</strong><small><span>{item.lifecycle==='deleted'?'Papierkorb · ':item.lifecycle==='archived'?'Archiviert · ':''}{item.level==="location"?"Hauptort":item.level==="area"?"Bereich":item.level==="room"?"Raum":"Erkenntnis"}</span><em className={cmsStyles.treeState} data-reach={treeReach(item)}>{treeStatus(item)}</em></small></span>
            </button></div>])}
          {!filteredNodes.some(node=>node.level==="information")&&areaParent&&<h4 className={cmsStyles.treeHeading}><span>Erkenntnisse</span><button type="button" className="button" aria-label="Neue Erkenntnis" title="Neue Erkenntnis" onClick={()=>beginNodeCreation("information")} disabled={busy||loading}><Plus size={13} aria-hidden="true"/>Neu</button></h4>}
          </nav>}
        </div>
      </aside>

      <div className={cmsStyles.redactionMain}>
        {!node?<section className={"panel "+cmsStyles.emptyEditor}><h2>{loading?"Ortsbestand wird geladen …":"Kein bestehender Ort ausgewählt"}</h2><p className="muted">Wähle links einen bestehenden Ort, Bereich, Raum oder eine Erkenntnis.</p></section>:<>
          <header className={cmsStyles.editorHeader}>
            <div><p className={cmsStyles.levelName}>{node.level==="location"?"Hauptort":node.level==="area"?"Bereich":node.level==="room"?"Raum":"Erkenntnis"}</p><h2>{node.title}</h2><p>{catalog.locations.find(item=>item.id===placeId)?.title||"Aktiver Schauplatz"} <ChevronRight size={13}/>{node.parentId?" Eingebettet im bestehenden Ortsverzeichnis":" Hauptort"}</p></div>
            <div className={cmsStyles.editorState}>{selectedDraft?<><span data-status={selectedDraft.status} data-released={selectedIsCurrentRelease||undefined} title={selectedDraft.status==="draft"||selectedDraft.status==="in_review"||selectedDraft.status==="approved"&&!selectedIsCurrentRelease?"Spieler sehen weiterhin nur den zuletzt freigegebenen Stand.":("Ziel: "+(scope==="gm"?"nur Spielleitung":scope==="group"?"aktive Spielgruppe":scope==="public"?"Public · nur angemeldete Mitglieder":"einzelner Spieler"))}><i className={cmsStyles.reachDot} data-reach={selectedIsCurrentRelease?"table":"draft"} aria-hidden="true"/>{dirty?"Ungespeichert":selectedDraft.status==="draft"?"Entwurf gespeichert":selectedDraft.status==="in_review"?"In Prüfung":selectedIsCurrentRelease?"Für Spieler freigegeben":selectedDraft.status==="approved"?"Genehmigt, noch nicht freigegeben":selectedDraft.status}</span></>:<><span data-status="empty" title="Eine neue Arbeitsfassung entsteht beim Speichern.">Noch kein Entwurf</span></>}<div className={cmsStyles.headerActions}><button type="button" className="button" onClick={openPreviewWindow} title="Öffnet die Spieleransicht in einem eigenen Fenster, zum Beispiel für den zweiten Bildschirm"><ExternalLink size={16}/> Vorschau-Fenster</button>{hasWork&&["public","group","player"].includes(scope)&&<>{publisher&&selectedDraft?.status==="in_review"&&<><button type="button" className="button" disabled={busy||dirty} onClick={()=>void transition("approve")}><ShieldCheck size={16}/> Genehmigen</button><button type="button" className="button" disabled={busy||dirty||!reason.trim()} onClick={()=>void transition("reject")}><Slash size={16}/> Zur Überarbeitung</button></>}<button type="button" className="button primary" disabled={busy||!dirty||!editable||isRoot&&!geographyValid} onClick={()=>void saveDraft()}><Save size={16}/> {dirty?"Speichern":"Gespeichert"}</button></>}</div></div>
          </header>

          {inactiveNode&&<p className={cmsStyles.inlineNotice} role="status">Dieser Eintrag liegt {node.lifecycle==="deleted"?"im Papierkorb":"im Archiv"}. Zum Bearbeiten kannst du ihn unter „Weitere Einstellungen“ und „Archiv, Papierkorb & Struktur“ wiederherstellen.</p>}
          {!inactiveNode&&publisher&&scope==="gm"&&node.visibility==="gm"&&<p className={cmsStyles.inlineNotice}>Dieser {node.level==="area"?"Bereich":node.level==="room"?"Raum":"Eintrag"} gehört nur dir. Die Spieler sehen ihn nicht und haben dafür keinen eigenen Text. Unten legst du deine Notizen an.</p>}{!inactiveNode&&publisher&&scope==="gm"&&node.level!=="information"&&<LocationWorldState key={node.id+":"+node.revision} placeId={placeId} entry={node} onChanged={async()=>{const tree=await api<{nodes:NodeOption[]}>(`/api/cms/locations?place=${encodeURIComponent(placeId)}${includeInactive?"&includeInactive=1":""}`);setNodes(tree.nodes);setPreviewTick(tick=>tick+1);}}/>}{!inactiveNode&&publisher&&scope==="gm"&&isRoot&&<LocationPreparedActions key={placeId} placeId={placeId} disabled={busy}/>}{!inactiveNode&&publisher&&scope==="gm"&&<LocationChapters key={node.id} entityId={node.id} onDirty={setChapterDirty}/>}
          {hasWork&&["public","group","player"].includes(scope)&&<>
            <nav className={cmsStyles.sectionTabs} aria-label="Redaktionsbereiche" role="tablist">
              {sections.map(section=><button key={section.id} type="button" role="tab" aria-selected={activeSection===section.id} className={activeSection===section.id?cmsStyles.sectionTabActive:cmsStyles.sectionTab} onClick={()=>setActiveSection(section.id)}>{section.label}</button>)}
            </nav>

            {activeSection==="content"&&<section className={"panel "+cmsStyles.editorPanel} role="tabpanel">
              <div className={cmsStyles.panelIntro}><h3>{scope==="gm"?"Vertraulicher Vermerk":isRoot?"Grunddaten und Beschreibungen":node.level==="information"?"Erkenntnis und Handout":"Bereich und Raum"}</h3><p>{scope==="gm"?"Nur du siehst diesen Inhalt. Er kann nicht für Spieler freigegeben werden.":"Das sehen die Spieler, sobald du diesen Stand freigibst."}</p></div>
              <fieldset className={cmsStyles.editorFieldset} disabled={!editable||busy}>
                {scope==="gm"?<p>SL-Kapitel werden unabhängig von redaktionellen Revisionen gespeichert. Spieler können sie niemals freigeschaltet bekommen.</p>:node.level==="location"?<div className={cmsStyles.fieldStack}>
                  <div className={cmsStyles.fieldGrid}><label className="field"><span>Name</span><input value={String(payload.title||"")} onChange={event=>setField("title",event.target.value)}/></label><label className="field"><span>Untertitel</span><input value={String(payload.subtitle||"")} onChange={event=>setField("subtitle",event.target.value)} placeholder="Kurze Einordnung für die Ortsseite"/></label></div>
                  <div className={cmsStyles.fieldGrid}><label className="field"><span>Stadtteil</span><input value={String(payload.district||"")} onChange={event=>setField("district",event.target.value)}/></label><label className="field"><span>Freigegebene Adresse</span><input value={String(payload.address||"")} onChange={event=>setField("address",event.target.value)}/></label></div>
                  <RichTextEditor htmlSource disabled={!editable||busy} key={`${node.id}:${selectedDraft?.id??editorKey}:${selectedDraft?.version??0}:summary`} value={String(payload.summary||"")} onChange={value=>setField("summary",value)} label="Kurze Beschreibung" maximumPlainLength={1600} placeholder="Was soll die Gruppe über diesen Ort wissen?"/>
                </div>:<div className={cmsStyles.fieldStack}>
                  <label className="field"><span>Name</span><input value={String(payload.title||"")} onChange={event=>setField("title",event.target.value)}/></label>
                  {node.level==="information"&&<LocationMilestoneLink key={node.id+":"+node.revision} node={node} disabled={!editable||busy} onSaved={async()=>{const tree=await api<{nodes:NodeOption[]}>(`/api/cms/locations?place=${encodeURIComponent(placeId)}${includeInactive?"&includeInactive=1":""}`);setNodes(tree.nodes);}}/>}
                  {node.level==="area"&&<RichTextEditor htmlSource disabled={!editable||busy} key={`${node.id}:${selectedDraft?.id??editorKey}:${selectedDraft?.version??0}:playerHint`} value={String(payload.playerHint||"")} onChange={value=>setField("playerHint",value)} label="Beschreibung des Bereichs" maximumPlainLength={25000} placeholder="Ein freigegebener Eindruck oder Hinweis für diesen Bereich"/>}
                  {node.level==="room"&&<RichTextEditor htmlSource disabled={!editable||busy} key={`${node.id}:${selectedDraft?.id??editorKey}:${selectedDraft?.version??0}:short`} value={String(payload.short||"")} onChange={value=>setField("short",value)} label="Raumbeschreibung" maximumPlainLength={25000} placeholder="Was ist in diesem Raum bereits bekannt?"/>}
                  {node.level==="information"&&<><RichTextEditor htmlSource disabled={!editable||busy} key={`${node.id}:${selectedDraft?.id??editorKey}:${selectedDraft?.version??0}:text`} value={String(payload.text||"")} onChange={value=>setField("text",value)} label="Freigegebener Text" maximumPlainLength={25000} placeholder="Inhalt des freigegebenen Hinweises"/><label className="field"><span>Hinweistyp</span><select value={String(payload.noteType||"note")} onChange={event=>setField("noteType",event.target.value)}>{[["note","Hinweis"],["suspicion","Verdacht"],["insight","Erkenntnis"],["question","Frage"],["task","Aufgabe"],["memory","Erinnerung"],["theory","Theorie"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span><input type="checkbox" checked={payload.pinned===true} onChange={event=>setField("pinned",event.target.checked)}/> Als wichtig markieren</span></label><p className="muted">Diesen Hinweis legst du als Spielleitung an. Die privaten Notizen der Spieler bleiben im eigenen Spielerbereich.</p></>}
                </div>}
              </fieldset>
              {(isRoot||node.level==="area")&&<section className={cmsStyles.titleImage} aria-label="Titelbild">
                <h4>{isRoot?"Ortsbild":"Titelbild des Bereichs"}</h4>
                {heroFileId&&(pendingImageUrl||selectedDraft)&&<img alt="Vorschau des Titelbildes" src={pendingImageUrl??('/api/cms/media?'+new URLSearchParams({id:heroFileId,entityId:node.id,revisionId:selectedDraft!.id,preview:"1"}))}/>}
                <label className="field"><span>{heroFileId?"Bild ersetzen":"Bild hochladen"}</span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={!editable||busy} onChange={event=>{const file=event.target.files?.[0];event.target.value="";void uploadTitleImage(file);}}/></label>
                <small>JPG, PNG oder WebP bis 10 MB. Das Bild wird mit dieser Arbeitsfassung gespeichert.</small>
              </section>}
              {!editable&&<p className={cmsStyles.readOnlyNote}>Dieser Stand ist {selectedDraft?.status==="approved"?"genehmigt":"nicht mehr bearbeitbar"}. Wähle den neuesten Stand im Versionsverlauf, um Änderungen zu speichern.</p>}
            </section>}

            {activeSection==="describe"&&isRoot&&node.level==="location"&&scope!=="gm"&&<section className={"panel "+cmsStyles.editorPanel} role="tabpanel">
              <div className={cmsStyles.panelIntro}><h3>Ort beschreiben</h3><p>Eindruck, Atmosphäre und Sinneseindrücke. Das sehen die Spieler im Ortsdossier, sobald du diesen Stand freigibst.</p></div>
              <fieldset className={cmsStyles.editorFieldset} disabled={!editable||busy}>
                <div className={cmsStyles.fieldStack}>
                  <RichTextEditor htmlSource disabled={!editable||busy} key={`${node.id}:${selectedDraft?.id??editorKey}:${selectedDraft?.version??0}:atmosphere`} value={String(payload.atmosphere||"")} onChange={value=>setField("atmosphere",value)} label="Ortsbeschreibung und Atmosphäre" maximumPlainLength={25000} placeholder="Wie wirkt dieser Ort auf die Sinne?"/>
                </div>
              </fieldset>
            </section>}
            {activeSection==="map"&&isRoot&&<section className={"panel "+cmsStyles.editorPanel} role="tabpanel">
              <div className={cmsStyles.panelIntro}><h3>{geo.status==="unknown"?"Position unbekannt":"Ortsposition bearbeiten"}</h3><p>Eine Kartenwahl ist zunächst ein unverbindlicher Entwurf. Nur eine belegte und ausdrücklich als exakt oder ungefähr eingeordnete Position kann gespeichert werden. </p></div>
              <button type="button" className="button" disabled={!editable||busy||!String(payload.address??"").trim()} onClick={()=>void verifyAddress()}>Adresse amtlich prüfen</button>
              <fieldset className={cmsStyles.editorFieldset} disabled={!editable||busy}>
                <label className="field"><span>Kartenfarbe</span><select value={String(payload.mapRisk??"")} onChange={e=>setField("mapRisk",e.target.value||undefined)}>
                 <option value="">Nur Wissenssymbol</option><option value="peaceful">Friedlich · Grün</option><option value="neutral">Neutral · Gold</option><option value="dangerous">Gefährlich · Orange</option><option value="hostile">Feindesgebiet · Rot</option>
                </select></label>
                <div className={cmsStyles.geoControls}>
                  <label className="field"><span>Ortswissen zur Position</span><select value={geo.status} onChange={event=>{const value=event.target.value;if(value==="unknown"){setGeo({status:"unknown"});return;}const coords=geo.status==="unknown"?pickedCoordinates:geo.coordinates;if(!coords){toast.error("Klicke zuerst auf die Karte, um eine Position vorzumerken.");return;}const common={coordinates:coords,source:geo.status==="unknown"?"":geo.source,reference:geo.status==="unknown"?undefined:geo.reference,reviewedAt:new Date().toISOString()};if(value==="exact")setGeo({status:"exact",...common});else setGeo({status:"approximate",...common,accuracyMeters:geo.status==="approximate"?geo.accuracyMeters:0});}}><option value="unknown">Unbekannt · kein Spieler-Marker</option><option value="approximate">Ungefähres Gebiet</option><option value="exact">Exakte Position bestätigt</option></select></label>
                  {geo.status!=="unknown"&&<button className="button" type="button" onClick={()=>{const [lon,lat]=geo.coordinates;setGeo({status:"approximate",coordinates:[Math.floor(lon*2)/2+.25,Math.floor(lat*4)/4+.125],accuracyMeters:50000,source:"Grob gerastertes Suchgebiet",reviewedAt:new Date().toISOString()});}}>50 km Suchgebiet mit grobem Mittelpunkt</button>}
                  {geo.status==="approximate"&&<label className="field"><span>Unschärfe in Metern</span><input type="number" min="1" max="1000000" value={geo.accuracyMeters} onChange={event=>setGeo({...geo,accuracyMeters:Number(event.target.value)})}/></label>}
                  {geo.status!=="unknown"&&<><label className="field"><span>Längengrad</span><input type="number" step="0.000001" min="-180" max="180" value={geo.coordinates[0]} onChange={event=>updateCoordinates(0,event.target.value)}/></label><label className="field"><span>Breitengrad</span><input type="number" step="0.000001" min="-90" max="90" value={geo.coordinates[1]} onChange={event=>updateCoordinates(1,event.target.value)}/></label><label className="field"><span>Herkunft / Prüfbeleg</span><input required value={geo.source} onChange={event=>setGeo({...geo,source:event.target.value})} placeholder="Quelle für diesen Kartenpunkt"/></label><label className="field"><span>Quellenverweis (optional)</span><input value={geo.reference||""} onChange={event=>setGeo({...geo,reference:event.target.value})}/></label></>}
                </div>
              </fieldset>
              {geo.status==="unknown"&&<p className={cmsStyles.geoUnknown}>Unbekannte Position bleibt unbekannt. Eine Kartenauswahl wird nicht als bestätigter Ort ausgegeben.</p>}
              {pickedCoordinates&&geo.status==="unknown"&&<div className={cmsStyles.candidatePosition}><strong>Unbestätigte Kartenauswahl</strong><span>{pickedCoordinates[0].toFixed(5)}, {pickedCoordinates[1].toFixed(5)}</span><button type="button" className="button" disabled={!editable||busy} onClick={()=>setPickedCoordinates(null)}>Auswahl verwerfen</button></div>}
              <p className={cmsStyles.mapInstruction}>{editable?"Klicke auf die Karte, um einen Marker vorzumerken. Für eine Speicherung musst du danach die Genauigkeit und Herkunft bestätigen.":"Die Karte ist für diesen genehmigten Stand schreibgeschützt."}</p>
              <div className={cmsStyles.editorMapStage} data-map-state={mapState} data-map-disabled={!editable||busy}>
                <div className={mapStyles.mapImage} aria-hidden="true"/><div className={mapStyles.mapVignette} aria-hidden="true"/>
                <WorldMapLibre places={mapMarkerPlaces} visibleIds={mapMarkerIds} selectedId={mapMarkerIds[0]||""} hoveredId={null} onSelect={()=>{}} onHover={()=>{}} onFocusPlace={()=>{}} onStateChange={setMapState} onMapClick={coordinates=>{if(!editable||busy)return;if(geo.status==="unknown")setPickedCoordinates(coordinates);else setGeo({...geo,coordinates,reviewedAt:new Date().toISOString()});}}/>
                {mapState!=="ready"&&<p className={cmsStyles.mapMessage} role="status">{mapState==="loading"?"Die OpenStreetMap wird geladen …":"Die Basiskarte ist gerade nicht erreichbar. Es wurde keine Position übernommen."}</p>}
              </div>
              {geo.status!=="unknown"&&!geographyValid&&<p className="error-box" role="alert">Vor dem Speichern bitte eine gültige Herkunft und Genauigkeit ergänzen. Ohne diese Angaben bleibt der Marker unbestätigt.</p>}
            </section>}

            {activeSection==="release"&&<section className={"panel "+cmsStyles.editorPanel} role="tabpanel">
              <div className={cmsStyles.panelIntro}><h3>{scope==="gm"?"Interne SL-Prüfung":"So sehen es die Spieler"}</h3><p>{publisher&&scope==="group"?"Jeder Abschnitt lässt sich einzeln freischalten. Gold heißt: Die Spieler sehen ihn.":"Die Vorschau zeigt den Ort genau so wie im Spielerbereich. Spieler sehen nur den freigegebenen Stand."}</p></div>
              {publisher&&scope==="group"&&isRoot&&node.level==="location"&&!inactiveNode&&<WebsiteHint/>}
              {publisher&&scope==="group"&&placeId&&<LocationReleaseOverview key={placeId+":"+release.currentVersion+":"+(release.discovery?.version??0)} placeId={placeId} selectedId={node.id} nodes={orderedNodes} disabled={busy||dirty} onOpen={id=>openSection(id,"content")} onFinish={id=>openSection(id,"release")} onShowPlayers={()=>void inspectPublished()} onChanged={async()=>{invalidatePlayerData(dataScope);clearDossierViews();setPreviewTick(tick=>tick+1);const tree=await api<{nodes:NodeOption[]}>(`/api/cms/locations?place=${encodeURIComponent(placeId)}${includeInactive?'&includeInactive=1':''}`);setNodes(tree.nodes);await refreshRelease();}}/>}
              {publisher&&scope==="group"&&node.visibility!=="gm"&&selectedDraft?.status==="draft"&&<div className={cmsStyles.releaseCurrent}><p>„{node.title}“ hat einen gespeicherten Entwurf, den die Spieler noch nicht sehen.</p><button type="button" className="button primary" disabled={busy||dirty} onClick={()=>void saveAndPublish()}><Check size={16}/> Entwurf fertigstellen und freigeben</button></div>}
              {publisher&&scope==="group"&&node.visibility!=="gm"&&!selectedDraft&&<p className={cmsStyles.releaseCurrent}>Für „{node.title}“ gibt es noch keinen Text. Schreib ihn unter „{isRoot?"Grunddaten":node.level==="information"?"Hinweis":"Inhalt"}“ und speichere ihn.</p>}
              {previewMode&&scope!=="gm"&&<section className={cmsStyles.dossierPreview} aria-live="polite" aria-label={previewMode==="draft"?"Entwurf im echten Ortsdossier":"Veröffentlichte Spieleransicht im echten Ortsdossier"}>
                <div className={cmsStyles.dossierPreviewLabel}><span>{previewMode==="draft"?"Entwurf – nur für dich":"So sehen es die Spieler – freigegebener Stand"}</span><button type="button" className="button" onClick={()=>setPreviewMode(null)}>Ansicht schließen</button></div>
                <WorldExperience a={a} dataScope={dataScope} previewViewerId={scope==="player"?playerTarget:undefined} projectionOverride={previewMode==="draft"?preview?.projection:publishedProjection} embeddedLabel={previewMode==="draft"?"SL-Entwurf · nicht veröffentlicht":"Tatsächliche Spielerprojektion · veröffentlichter Stand"} onDossierBack={()=>setPreviewMode(null)}/>
              </section>}
              <details className={cmsStyles.releaseDetails} open={!publisher||scope!=="group"}>
                <summary>Einzelheiten zu „{node.title}“<small>Zielgruppe, Wissensstand, Protokoll, mehrere Abschnitte auf einmal</small></summary>
                {isRoot&&publisher&&scope==="group"&&<LocationTreeRelease key={placeId} placeId={placeId} nodes={nodes} disabled={busy||dirty} onPublished={async()=>{invalidatePlayerData(dataScope);await refreshRelease();await loadCatalog();}}/>}
                {publisher&&(scope==="group"||scope==="player")&&<div className={libraryStyles.notice}><strong>Spielerwissen: {discoveryLabels[release.discovery?.state??"hidden"]??"Unbekannt"}</strong><p>Veröffentlichung und Entdeckung sind getrennt. Eine Veröffentlichung allein schaltet unbekannte Inhalte nicht frei.</p><div className={libraryStyles.tools}><DiscoverySteps label="Was wissen die Spieler?" withHidden value={discoveryState} current={(release.discovery?.state??"hidden") as DiscoveryState} onChange={setDiscoveryState}/><button type="button" className="button" disabled={busy||scope==="player"&&!playerTarget} onClick={async()=>{const current=release.discovery?.state||"hidden",correction=["hidden",...discovery].indexOf(discoveryState)<["hidden",...discovery].indexOf(current as DiscoveryState);if(!await dlg.ask(correction?"Administrative Korrektur: Dieses Wissen für die gewählte Zielgruppe wieder verbergen? Andere Zielgruppen bleiben unverändert.":"Diesen Eintrag dauerhaft für die gewählte Zielgruppe entdecken? Unterbereiche werden nicht automatisch freigegeben."))return;const audit=correction?await dlg.askText("Bitte nenne den Grund für die administrative Korrektur. Er wird protokolliert.","Grund","Korrektur speichern"):"Gezielte Entdeckung im Ortsdossier";if(!audit?.trim())return;setBusy(true);try{await api('/api/locations/state','POST',{placeId,entityId:node.id,mode:"discovery",audience:scope,...(scope==="player"?{playerId:playerTarget}:{}),discoveryState,expectedRevision:release.discovery?.version||0,administrativeCorrection:correction,reason:audit});await refreshRelease();clearDossierViews();toast.success("Entdeckungsstand gespeichert.");}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}}>Entdeckungsstand speichern</button></div></div>}
                {!!release.discovery?.history?.length&&<details><summary>Entdeckungsprotokoll</summary><ul>{release.discovery.history.map((entry,index)=><li key={entry.createdAt+index}><time>{new Date(entry.createdAt).toLocaleString('de-DE')}</time> · {entry.previousState} → {entry.nextState}{entry.administrativeCorrection?' · Administrative Korrektur':''}<p>{entry.reason}</p></li>)}</ul></details>}
                <label className="field"><span>Prüf- oder Veröffentlichungsnotiz (optional)</span><input value={reason} maxLength={500} onChange={event=>setReason(event.target.value)} placeholder="Optionaler Zusatz für das Freigabeprotokoll"/><small>Ohne eigene Notiz wird „Direktfreigabe im SL-CMS“ protokolliert.</small></label>
                <div className={cmsStyles.releaseSummary}><span data-status={selectedDraft?.status??"empty"}>{selectedDraft?.status.replaceAll("_"," ")??"Noch kein Entwurf"}</span><strong>{scope==="gm"?"Nur Spielleitung":scope==="group"?"Aktive Spielgruppe":scope==="public"?"Public · Anmeldung erforderlich":catalog.players.find(item=>item.id===playerId)?.name||"Spieler wählen"}</strong><small>Freigabeversion {release.currentVersion} · {release.currentTransition||"noch keine Freigabe"} · {release.history.length} protokollierte Schritte</small></div>
                <div className={cmsStyles.releaseActions}>
                  {selectedDraft?.status==="draft"&&(publisher?<button type="button" className="button" disabled={busy||dirty} onClick={()=>void saveAndPublish()}><Check size={16}/> Gespeicherten Entwurf freigeben</button>:<button type="button" className="button" disabled={busy||dirty} onClick={()=>void transition("submit")}><Send size={16}/> Zur Prüfung einreichen</button>)}
                  {scope!=="gm"&&<><button type="button" className="button" disabled={busy||!selectedDraft||dirty} onClick={()=>void inspectPreview()}><Eye size={16}/> Entwurf ansehen</button><button type="button" className="button" disabled={busy||!node||scope==="player"&&!playerTarget} onClick={()=>void inspectPublished()}><Eye size={16}/> Veröffentlichte Spieleransicht</button></>}
                  {publisher&&scope!=="gm"&&<><button type="button" className="button primary" disabled={busy||!selectedDraft||selectedDraft.status!=="approved"||scope==="player"&&!playerId||dirty} onClick={()=>void changeRelease("publish")}><Check size={16}/> Genehmigten Stand freigeben</button><button type="button" className="button" disabled={busy||release.currentVersion===0||scope==="player"&&!playerId||dirty} onClick={()=>void changeRelease("revoke")}><Slash size={16}/> Freigabe zurückziehen</button><button type="button" className="button" disabled={busy||release.currentVersion===0||scope==="player"&&!playerId||dirty} onClick={()=>void changeRelease("block")}><ShieldCheck size={16}/> Zielgruppe sperren</button></>}
                </div>
                {publisher&&scope!=="gm"&&<p className={cmsStyles.inlineNotice}>Die Freigabe aktualisiert den Spielerstand in dieser Umgebung. Unveröffentlichte Entwürfe bleiben geschützt.</p>}
              </details>
            </section>}

          </>}
          {!hasWork&&!inactiveNode&&scope!=="gm"&&<p role="status">{scope==="player"&&!playerTarget?"Wähle unter „Weitere Einstellungen“ ein Spielerziel.":"Arbeitsfassung wird geladen …"}</p>}
        {node&&<details className={"panel "+cmsStyles.editorControlPanel+" "+cmsStyles.moreSettings}>
            <summary>Weitere Einstellungen<small>Zielgruppe, frühere Fassungen, Verknüpfungen, Medien, Archiv</small></summary>
            <p className="muted">Hier findest du Einstellungen zum ausgewählten Eintrag, frühere Fassungen und die wiederherstellbare Ablage.</p>
          <details className={"panel "+cmsStyles.editorControlPanel}><summary>Bearbeitungsziel und frühere Fassungen</summary><p className="muted">Hier wechselst du die Zielgruppe der Arbeitsfassung oder stellst einen früheren Entwurf wieder her.</p>
            <div className={cmsStyles.controlRow}>
              <label className="field"><span>{scope==="gm"?"Vertraulicher Arbeitsbereich":"Zielgruppe der Arbeitsfassung"}</span><select value={scope} onChange={async event=>{const next=event.target.value as Scope;if(!(await canLeaveEditor()))return;setScope(next);setPlayerId("");setReason("");clearDossierViews();}}>{publisher&&<option value="gm">Nur Spielleitung · vertraulich</option>}<option value="group">Aktive Spielgruppe</option>{publisher&&<><option value="public">Public · Anmeldung erforderlich</option><option value="player">Einzelner Spieler</option></>}</select></label>
              {scope==="player"&&publisher&&<label className="field"><span>Spielerziel</span><select value={playerId} onChange={async event=>{const next=event.target.value;if(await canLeaveEditor()){setPlayerId(next);clearDossierViews();}}}><option value="">Spieler wählen</option>{catalog.players.map(player=><option key={player.id} value={player.id}>{player.name}</option>)}</select></label>}
              {selectedDraft&&<details className={cmsStyles.revisionDetails}><summary>Änderungsverlauf <span>{visibleDrafts.length} Revisionen</span></summary><label className="field"><span>Arbeitsstand auswählen</span><select value={draftId} onChange={async event=>{const nextDraft=event.target.value;if(!(await canLeaveEditor()))return;const chosen=drafts.find(item=>item.id===nextDraft);setDraftId(nextDraft);setReason("");setPayload(chosen?parse(chosen.player_payload_json):{});payloadOwner.current=nodeId;setGmSecret(chosen?parse(chosen.gm_secret_json||"{}"):{});const chosenGeo=chosen?(parse(chosen.geography_json) as unknown as Geography):{status:"unknown" as const};setGeo(chosenGeo);setPickedCoordinates(chosenGeo.status==="unknown"?null:chosenGeo.coordinates);setHeroFileId(chosen?.hero_file_id||null);setPendingImageUrl(null);clearDossierViews();}}>{visibleDrafts.map(item=><option key={item.id} value={item.id}>Revision {item.revision_no} · {item.status} · Version {item.version}</option>)}</select></label><button type="button" className="button" disabled={busy||dirty} onClick={async()=>{if(!selectedDraft||!await dlg.ask("Diesen früheren Stand als neuen Entwurf wiederherstellen? Veröffentlichung und Entdeckung bleiben unverändert."))return;setBusy(true);try{await api("/api/cms/drafts","POST",{entityId:node.id,audience:scope,...(scope==="player"?{playerId:playerTarget}:{}),sourceRevisionId:selectedDraft.id});await refreshDrafts(true);toast.success("Früherer Inhalt als neuer Entwurf wiederhergestellt.");}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}}>Diesen Stand als neuen Entwurf wiederherstellen</button></details>}
            </div>
            {scope==="public"&&<p className={cmsStyles.inlineNotice}>Public-Freigaben sind im aktuellen Reader nur für angemeldete aktive Kampagnenmitglieder sichtbar. Eine anonyme Besucherausgabe gibt es hier nicht.</p>}
          </details>

          {publisher&&<details className={"panel "+cmsStyles.editorControlPanel}><summary>Medien, Verknüpfungen und Suche</summary><div className={cmsStyles.supportTools}>
          <details className={libraryStyles.chapter}><summary>Dauerhafte Verknüpfungen</summary><div className={libraryStyles.body}><LocationConnections key={node.id+":relations"} entityId={node.id} view="sl" editable/></div></details>
          <details className={libraryStyles.chapter}><summary>Medienbestand dieses Eintrags</summary><div className={libraryStyles.body}><LocationMediaManager key={node.id} entityId={node.id} onDirty={setMediaDirty}/></div></details>
          <details className={libraryStyles.chapter}><summary>Ortswissen durchsuchen</summary><div className={libraryStyles.body}><LocationKnowledgeSearch placeId={placeId} view="sl"/></div></details>

          </div></details>}
          {publisher&&<LocationStructureControls disabled={dirty||chapterDirty||mediaDirty} key={node.id+":"+node.revision} node={node} nodes={nodes} locations={catalog.locations} onChanged={async next=>{setPlaceId(next.locationId);const result=await api<{nodes:NodeOption[]}>(`/api/cms/locations?place=${encodeURIComponent(next.locationId)}${includeInactive?'&includeInactive=1':''}`);setNodes(result.nodes);setNodeId(result.nodes.some(item=>item.id===next.entityId)?next.entityId:result.nodes.find(item=>item.level==='location')?.id||'');clearDossierViews();await loadCatalog();}}/>}
          </details>}
        </>}
      </div>
    </div>
  </div>;
}
