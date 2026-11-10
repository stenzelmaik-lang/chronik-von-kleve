"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Actor } from "@/domain/types";
import { api } from "./api-client";
import styles from "./xp-settlement-panel.module.css";

type Catalog = {
  playedSessions: Array<{id:string;title:string;playedOn:string;sessionRecordId:string;appointmentId:string|null;settlementStatus:"complete"|"partial"|"failed"|null;settlementRevision:number|null}>;
  sessionRecords:Array<{id:string;title:string}>;
  characters:Array<{id:string;title:string;ownerId:string;confirmed:true}>;
  storylines:Array<{id:string;title:string}>;
};
type RewardType = "session"|"story"|"mvp"|"sl_exception";
type ReceiptReward = {type:RewardType;scopeId:string;amount:number;reason:string;status:"pending"|"booked"|"failed";ledgerEntryId:string|null;bookedAt:string|null;errorCode:number|null};
type Receipt = {id:string;status:"complete"|"partial"|"failed";revision:number;session:{id:string;title:string;playedOn:string};participants:Array<{characterId:string;attended:boolean;rewards:ReceiptReward[]}>};
type ReceiptReply = {settlement:Receipt|null;reversedRewards:Array<{characterId:string;ledgerEntryId:string}>};
type StoryDraft = {storyId:string;amount:number;reason:string;locked:boolean};
type CharacterDraft = {
  attended:boolean;attendanceLocked:boolean;
  sessionAmount:number;sessionReason:string;sessionLocked:boolean;
  stories:StoryDraft[];
  exceptionAmount:number;exceptionReason:string;exceptionLocked:boolean;
};
type SettlementResult = {
  status:"complete"|"partial"|"failed";complete:boolean;
  receipt:{id:string;status:"complete"|"partial"|"failed";revision:number};
  totals:{booked:number;alreadyBooked:number;failed:number};
  characters:Array<{characterId:string;status:string;rewards:Array<{type:RewardType;status:string;error?:string;reversed?:boolean}>}>;
};
type RewardInput = {type:"session"|"story"|"sl_exception";storyId?:string;amount:number;reason:string};
type SettlementEntry = {characterId:string;attended:boolean;rewards:RewardInput[]};

const emptyDraft = ():CharacterDraft => ({
  attended:false,attendanceLocked:false,sessionAmount:0,sessionReason:"",sessionLocked:false,
  stories:[],exceptionAmount:0,exceptionReason:"",exceptionLocked:false,
});
function draftsFor(characters:Catalog["characters"],receipt:Receipt|null):Record<string,CharacterDraft> {
  const data:Record<string,CharacterDraft>={};
  for(const character of characters){
    const participant=receipt?.participants.find(p=>p.characterId===character.id);
    const rewards=participant?.rewards??[];
    const regular=rewards.find(r=>r.type==="session");
    const exception=rewards.find(r=>r.type==="sl_exception");
    data[character.id]={
      attended:participant?.attended??false,
      attendanceLocked:rewards.some(r=>r.status==="booked"),
      sessionAmount:regular?.amount??0,
      sessionReason:regular?.reason??"",
      sessionLocked:regular?.status==="booked",
      stories:rewards.filter(r=>r.type==="story").map(r=>({storyId:r.scopeId,amount:r.amount,reason:r.reason,locked:r.status==="booked"})),
      exceptionAmount:exception?.amount??0,
      exceptionReason:exception?.reason??"",
      exceptionLocked:exception?.status==="booked",
    };
  }
  return data;
}
function makeEntries(characters:Catalog["characters"],drafts:Record<string,CharacterDraft>):SettlementEntry[] {
  return characters.map(character=>{
    const row=drafts[character.id]??emptyDraft();
    const rewards:RewardInput[]=[];
    if(row.attended&&row.sessionAmount>0)rewards.push({type:"session",amount:row.sessionAmount,reason:row.sessionReason.trim()});
    if(row.attended)for(const story of row.stories)if(story.amount>0)rewards.push({type:"story",storyId:story.storyId,amount:story.amount,reason:story.reason.trim()});
    if(row.exceptionAmount>0)rewards.push({type:"sl_exception",amount:row.exceptionAmount,reason:row.exceptionReason.trim()});
    return {characterId:character.id,attended:row.attended,rewards};
  });
}
function invalidEntries(entries:SettlementEntry[]) {
  return entries.some(entry=>entry.rewards.some(reward=>reward.reason.length<3||!Number.isSafeInteger(reward.amount)||
    (reward.type==="session"&&reward.amount>5)||(reward.type==="story"&&reward.amount>3)||
    (reward.type==="sl_exception"&&reward.amount>1000)));
}
const dateDisplay=(value:string)=>new Date(value+"T12:00:00").toLocaleDateString("de-DE",{day:"2-digit",month:"short",year:"numeric"});

export function XpSettlementPanel({a}:{a:Actor}) {
  const [catalog,setCatalog]=useState<Catalog|null>(null);
  const [selected,setSelected]=useState("");
  const [receipt,setReceipt]=useState<Receipt|null>(null);
  const [reversals,setReversals]=useState<ReceiptReply["reversedRewards"]>([]);
  const [rows,setRows]=useState<Record<string,CharacterDraft>>({});
  const [recordId,setRecordId]=useState("");
  const [playedOn,setPlayedOn]=useState(()=>{
    const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  });
  const [loading,setLoading]=useState(true),[receiptLoading,setReceiptLoading]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [preview,setPreview]=useState(false),[result,setResult]=useState<SettlementResult|null>(null);

  const refreshCatalog=useCallback(async()=> {
    const data=await api<Catalog>("/api/character-engine?xpCatalog=1");
    setCatalog(data);return data;
  },[]);
  useEffect(()=>{
    let active=true;
    void api<Catalog>("/api/character-engine?xpCatalog=1").then(data=>{
      if(active){setCatalog(data);setSelected(old=>old||data.playedSessions[0]?.id||"");setError("");}
    }).catch(e=>{if(active)setError((e as Error).message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[a.campaignId]);
  useEffect(()=>{
    if(!catalog||!selected){setReceipt(null);setRows({});setReversals([]);return;}
    let active=true;setReceiptLoading(true);setPreview(false);
    void api<ReceiptReply>("/api/character-engine?settlement="+encodeURIComponent(selected)).then(reply=>{
      if(active){setReceipt(reply.settlement);setReversals(reply.reversedRewards??[]);setRows(draftsFor(catalog.characters,reply.settlement));setError("");}
    }).catch(e=>{if(active)setError((e as Error).message);}).finally(()=>{if(active)setReceiptLoading(false);});
    return()=>{active=false;};
  },[catalog,selected]);

  function change(id:string,patch:Partial<CharacterDraft>) {
    setRows(old=>({...old,[id]:{...(old[id]??emptyDraft()),...patch}}));
    setPreview(false);setResult(null);
  }
  const entries=useMemo(()=>makeEntries(catalog?.characters??[],rows),[catalog,rows]);
  const invalid=invalidEntries(entries);
  const total=entries.reduce((sum,entry)=>sum+entry.rewards.reduce((n,r)=>n+r.amount,0),0);
  const selectedSession=catalog?.playedSessions.find(s=>s.id===selected);

  async function register(event:FormEvent) {
    event.preventDefault();setBusy(true);setError("");setNotice("");
    try{
      const reply=await api<{session:{id:string};created:boolean}>("/api/character-engine","POST",
        {action:"played_session_register",sessionRecordId:recordId,playedOn});
      setSelected(reply.session.id);setResult(null);
      await refreshCatalog();
      setNotice(reply.created?"Gespielten Abend registriert.":"Dieser Abend war bereits registriert.");
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }

  async function book() {
    if(!selected||invalid||!catalog?.characters.length)return;
    setBusy(true);setError("");setNotice("");
    try{
      const response=await api<SettlementResult>("/api/character-engine","POST",{action:"xp_settlement",sessionId:selected,entries});
      setResult(response);setPreview(false);
      const [nextCatalog,nextReceipt]=await Promise.all([
        api<Catalog>("/api/character-engine?xpCatalog=1"),
        api<ReceiptReply>("/api/character-engine?settlement="+encodeURIComponent(selected)),
      ]);
      setCatalog(nextCatalog);setReceipt(nextReceipt.settlement);setReversals(nextReceipt.reversedRewards??[]);
      setRows(draftsFor(nextCatalog.characters,nextReceipt.settlement));
      setNotice(response.complete&&response.receipt.status==="complete"?"Alle angeforderten Vergaben sind gebucht; der Beleg ist vollständig.":"Achtung: Die angeforderte Abrechnung konnte nicht vollständig verarbeitet werden. Einzelne Fehler und den Beleg prüfen.");
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }

  if(!a.gm)return null;
  return <section className={styles.root} aria-label="EP-Sitzungsabrechnung">
    <header className={styles.head}>
      <div><p className={styles.eyebrow}>COMMAND CENTER · SPIELABENDE</p><h2>Erfahrung vergeben</h2>
        <p>Alle Charaktere gemeinsam abrechnen. Jede Vergabe bleibt im bestehenden EP-Ledger nachweisbar.</p></div>
      <button className="button" disabled={busy||loading} onClick={()=>void refreshCatalog().catch(e=>setError((e as Error).message))}>Aktualisieren</button>
    </header>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {notice&&<p role="status" className={styles.notice}>{notice}</p>}
    {loading?<p role="status">Abrechnungen werden geladen …</p>:<>
      <div className={styles.choices}>
        <section className={styles.card}>
          <h3>Gespielten Abend auswählen</h3>
          <label>Registrierte Spielabende
            <select value={selected} onChange={e=>{setSelected(e.target.value);setResult(null);setPreview(false);}}>
              {!catalog?.playedSessions.length&&<option value="">Noch kein Abend registriert</option>}
              {catalog?.playedSessions.map(s=><option key={s.id} value={s.id}>{dateDisplay(s.playedOn)} · {s.title}{s.settlementStatus?" · "+s.settlementStatus:""}</option>)}
            </select>
          </label>
          {selectedSession&&<p className={styles.subtle}>Abend vom {dateDisplay(selectedSession.playedOn)} · {selectedSession.settlementStatus==="complete"?"Beleg abgeschlossen":selectedSession.settlementStatus?"Beleg unvollständig":"Noch keine Abrechnung"}</p>}
        </section>
        <form className={styles.card} onSubmit={e=>void register(e)}>
          <h3>Weiteren Abend registrieren</h3>
          <label>Abgeschlossener Sitzungseintrag
            <select required value={recordId} onChange={e=>setRecordId(e.target.value)}>
              <option value="">Sitzung auswählen</option>
              {catalog?.sessionRecords.map(r=><option value={r.id} key={r.id}>{r.title}</option>)}
            </select>
          </label>
          <label>Tag des tatsächlich gespielten Abends
            <input required type="date" value={playedOn} onChange={e=>setPlayedOn(e.target.value)}/>
          </label>
          <button className="button" disabled={busy||!recordId||!playedOn}>Gespielten Abend registrieren</button>
          <p className={styles.hint}>Ein Kalendereintrag allein zählt nicht als gespielter Abend. Der Sitzungseintrag muss im alten System „Abgeschlossen“ oder im modernen Vorbereitungsbereich „completed“ sein.</p>
        </form>
      </div>
      {!selectedSession?<p className={styles.empty}>Bitte zuerst einen tatsächlich gespielten Abend registrieren.</p>:receiptLoading?
        <p role="status">Gespeicherter Abrechnungsbeleg wird geladen …</p>:<>
        <div className={styles.summary}>
          <div><strong>{catalog?.characters.length??0}</strong><span>abrechenbare Charaktere</span></div>
          <div><strong>{entries.filter(e=>e.attended).length}</strong><span>anwesend</span></div>
          <div><strong>{total}</strong><span>EP zur Prüfung (inkl. bestehender Angaben)</span></div>
          {receipt&&<div><strong>{receipt.status==="complete"?"Vollständig":"Offen"}</strong><span>dauerhafter Beleg · Revision {receipt.revision}</span></div>}
        </div>
        <p className={styles.hint}>Normalerweise 2–4 Sitzungs-EP, höchstens 5. Für abwesende Figuren 0 reguläre EP; eine begründete SL-Ausnahme ist möglich. Story-Abschluss: höchstens 3 EP pro Bogen und Figur. MVP wird in einem gesonderten Schritt ergänzt.</p>
        <div className={styles.roster}>
          {catalog?.characters.map(character=>{
            const row=rows[character.id]??emptyDraft();
            const availableStories=catalog.storylines.filter(s=>!row.stories.some(t=>t.storyId===s.id));
            return <article key={character.id} className={styles.character}>
              <header className={styles.characterHead}><div><h3>{character.title}</h3><small>Charakter-ID: {character.id}</small></div>
                <label className={styles.attendance}><input type="checkbox" checked={row.attended} disabled={busy||row.attendanceLocked} onChange={e=>change(character.id,{attended:e.target.checked,sessionAmount:e.target.checked?row.sessionAmount:0})}/>Anwesend</label></header>
              <div className={styles.rewardFields}>
                <div className={styles.rewardColumn}>
                  <label>Reguläre Sitzungs-EP (0–5)
                    <input type="number" min="0" max="5" step="1" value={row.sessionAmount} disabled={busy||!row.attended||row.sessionLocked} onChange={e=>change(character.id,{sessionAmount:Number(e.target.value)})}/>
                  </label>
                  <label>Begründung
                    <input maxLength={2000} placeholder="Rollenspiel, Rätsel, riskante Entscheidung …" value={row.sessionReason} disabled={busy||!row.attended||row.sessionLocked} onChange={e=>change(character.id,{sessionReason:e.target.value})}/>
                  </label>
                </div>
                <div className={styles.rewardColumn}>
                  <h4>Storybogen-Bonus</h4>
                  {row.stories.map((story,index)=><div key={story.storyId} className={styles.storyRow}>
                    <label>Handlungsstrang
                      <select value={story.storyId} disabled={busy||!row.attended||story.locked} onChange={e=>change(character.id,{stories:row.stories.map((s,i)=>i===index?{...s,storyId:e.target.value}:s)})}>
                        {!catalog.storylines.some(s=>s.id===story.storyId)&&<option value={story.storyId}>{story.storyId}</option>}
                        {catalog.storylines.filter(s=>s.id===story.storyId||!row.stories.some(other=>other.storyId===s.id)).map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
                      </select>
                    </label>
                    <label>EP (0–3)<input type="number" min="0" max="3" step="1" value={story.amount} disabled={busy||!row.attended||story.locked} onChange={e=>change(character.id,{stories:row.stories.map((s,i)=>i===index?{...s,amount:Number(e.target.value)}:s)})}/></label>
                    <label>Grund<input maxLength={2000} value={story.reason} disabled={busy||!row.attended||story.locked} onChange={e=>change(character.id,{stories:row.stories.map((s,i)=>i===index?{...s,reason:e.target.value}:s)})}/></label>
                    {!story.locked&&<button type="button" className="button" disabled={busy} onClick={()=>change(character.id,{stories:row.stories.filter((_,i)=>i!==index)})}>Entfernen</button>}
                  </div>)}
                  <button type="button" className="button" disabled={busy||!row.attended||!availableStories.length||row.stories.length>=8} onClick={()=>change(character.id,{stories:[...row.stories,{storyId:availableStories[0].id,amount:0,reason:"",locked:false}]})}>+ Handlungsstrang hinzufügen</button>
                </div>
              </div>
              <details className={styles.exception}>
                <summary>SL-Sondervergabe (auch bei wichtiger Abwesenheit)</summary>
                <div className={styles.rewardColumn}>
                  <label>EP (0 = keine)
                    <input type="number" min="0" max="1000" step="1" value={row.exceptionAmount} disabled={busy||row.exceptionLocked} onChange={e=>change(character.id,{exceptionAmount:Number(e.target.value)})}/>
                  </label>
                  <label>Begründung
                    <input maxLength={2000} value={row.exceptionReason} disabled={busy||row.exceptionLocked} onChange={e=>change(character.id,{exceptionReason:e.target.value})}/>
                  </label>
                </div>
              </details>
            </article>;
          })}
        </div>
        {catalog?.characters.length===0&&<p className={styles.empty}>Keine bestätigten, aktiven Charaktere mit EP-Konto vorhanden.</p>}
        <div className={styles.actions}>
          <button className="button" disabled={busy||invalid||!entries.length||receiptLoading} onClick={()=>setPreview(p=>!p)}>{preview?"Vorschau schließen":"Abrechnung prüfen"}</button>
          {invalid&&<p role="alert">Für jede Vergabe sind eine gültige Punktezahl und eine Begründung mit mindestens drei Zeichen erforderlich.</p>}
        </div>
        {preview&&!invalid&&<section className={styles.preview} aria-label="Vorschau der EP-Vergabe">
          <h3>Vor der endgültigen Buchung</h3>
          <p>Alle angegebenen Beträge sind einmalige Quellenbuchungen. Bereits gebuchte Beträge werden nicht erneut hinzugefügt.</p>
          <ul>{entries.map(entry=><li key={entry.characterId}><strong>{catalog.characters.find(c=>c.id===entry.characterId)?.title??entry.characterId}:</strong> {entry.attended?"anwesend":"abwesend"} · {entry.rewards.reduce((n,r)=>n+r.amount,0)} EP · {entry.rewards.length} Vergaben</li>)}</ul>
          <button className="button primary" disabled={busy||!entries.length} onClick={()=>void book()}>{busy?"Wird verbucht …":"EP für alle bestätigen"}</button>
        </section>}
        {result&&<section className={styles.card} role="status"><h3>Ergebnis der letzten Buchung</h3>
          <p>{result.complete&&result.receipt.status==="complete"?"Gesamter Beleg und letzter Aufruf vollständig.":"Nicht alle angeforderten Vergaben erfolgreich: aktuellen Aufruf und Beleg getrennt prüfen."} Neu: {result.totals.booked}, bereits vorhanden: {result.totals.alreadyBooked}, fehlgeschlagen: {result.totals.failed}.</p>
          {result.characters.filter(c=>c.status==="failed").map(c=><p key={c.characterId} className={styles.error}>{catalog?.characters.find(x=>x.id===c.characterId)?.title??c.characterId}: {c.rewards.filter(r=>r.error).map(r=>r.error).join("; ")}</p>)}
          {result.receipt.status!=="complete"&&<button className="button" disabled={busy} onClick={()=>{setPreview(true);setNotice("Bitte dieselbe Abrechnung erneut bestätigen, um fehlgeschlagene Buchungen sicher fortzusetzen.");}}>Erneut prüfen</button>}
        </section>}
        {receipt&&<section className={styles.card}><h3>Dauerhafter Abrechnungsbeleg</h3>
          <p className={styles.subtle}>Status: {receipt.status} · Revision {receipt.revision}. Gegenbuchungen werden im Ledger geführt und hier als „storniert“ markiert.</p>
          {receipt.participants.map(participant=><div className={styles.receiptRow} key={participant.characterId}>
            <strong>{catalog?.characters.find(c=>c.id===participant.characterId)?.title??participant.characterId}</strong>
            <small>{participant.attended?"Teilgenommen":"Nicht teilgenommen"}</small>
            {participant.rewards.map(r=>{
              const reversed=!!r.ledgerEntryId&&reversals.some(x=>x.characterId===participant.characterId&&x.ledgerEntryId===r.ledgerEntryId);
              return <p key={r.type+":"+r.scopeId}>{r.type==="session"?"Sitzung":r.type==="story"?"Storybogen":r.type==="mvp"?"MVP":"SL-Sondervergütung"} · {r.amount} EP · {reversed?"Storniert":r.status==="booked"?"Gebucht":r.status==="failed"?"Fehlgeschlagen":"Offen"} · {r.reason}</p>;
            })}
          </div>)}
        </section>}
      </>}
    </>}
  </section>;
}
