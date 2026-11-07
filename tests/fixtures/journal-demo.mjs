// Abenteuerjournal (AJ-01): synthetic acceptance data for the isolated --journal instance only.
// Player A gets a second own figure with sheet special cases (long name, more than five dots, own abilities,
// specialties, current resources below maximum, damage) and pre-existing notes in the old shape. Never real data.
import {randomUUID} from 'node:crypto';

export const JOURNAL_SECOND_TITLE='TEST – Journalfigur Adelheid von Kleve-Brienen zu Schenkenschanz und Griethausen';
export const JOURNAL_MARKERS={legacy:'JOURNAL_LEGACY_NOTE',unbound:'JOURNAL_UNBOUND_NOTE',group:'JOURNAL_GROUP_NOTE'};

export async function seedJournalDemo({base,playerCookie,primaryCharacterId}){
 const headers={'Content-Type':'application/json',Origin:base,Cookie:playerCookie};
 const send=async(path,method,body)=>{const r=await fetch(base+path,{method,headers,body:JSON.stringify(body)});if(!r.ok)throw new Error('Synthetic journal fixture failed: '+path+' '+r.status+' '+await r.text());return r.json();};
 const crafts='cab_'+randomUUID(),brawlSpec='spec_'+randomUUID(),craftSpec='spec_'+randomUUID();
 const second=await send('/api/records','POST',{kind:'charaktere',title:JOURNAL_SECOND_TITLE,visibility:'sl',body:{
  player:'Demo Spieler A',chronicle:'Chronik von Kleve · Testdaten',nature:'Architektin',demeanor:'Konformistin',concept:'Alte Archivarin',clan:'Ventrue',generation:8,sire:'TEST – unbekannt',
  attributes:{Körperkraft:7,Geschick:3,Widerstandsfähigkeit:6,Charisma:4,Manipulation:5,Erscheinungsbild:0,Wahrnehmung:4,Intelligenz:5,Geistesschärfe:3},
  skills:{Aufmerksamkeit:3,Handgemenge:6,Ausdruck:0,Etikette:4,Nachforschungen:5,Okkultismus:2,'Heraldik (Altbestand)':2},
  customAbilities:[{id:crafts,name:'Buchbinderei',value:3,category:'Fertigkeit'},{id:'cab_'+randomUUID(),name:'Kanzleisprache',value:2,category:'Kenntnis',active:false}],
  specialties:[{id:brawlSpec,target:{kind:'ability',id:'brawl'},name:'Ringen'},{id:craftSpec,target:{kind:'customAbility',id:crafts},name:'Goldprägung'}],
  disciplines:[{name:'Beherrschung',value:6},{name:'Präsenz',value:3},{name:'Seelenstärke',value:2}],
  backgrounds:[{name:'Ressourcen',value:4},{name:'Herde',value:0}],
  virtues:{Gewissen:3,Selbstbeherrschung:4,Mut:2},humanity:6,humanityPath:'',willpower:7,willpowerTemporary:3,blood:6,bloodMax:15,bloodPerRound:3,
  health:{track:['lethal','bashing']},
  merits:[{name:'Eidetisches Gedächtnis',cost:2}],flaws:[{name:'Albträume',cost:1}],
  clanWeakness:'Ventrue: nur Blut einer bestimmten Herkunft (Testdaten).',
  text:'Synthetische Hintergrundgeschichte für die Journalabnahme. Kein Kanon.',playGuide:'Testziele: Werte im Buch mit der Charakterverwaltung vergleichen.',
 }});
 // Old shape: a character-bound private note without the journal marker, a shared note, and an unbound private note.
 await send('/api/character-companion','PATCH',{action:'note.create',characterId:primaryCharacterId,title:'Alte Notiz ohne Merkmal',text:JOURNAL_MARKERS.legacy+' – vor dem Journal angelegt.',visibility:'private'});
 await send('/api/character-companion','PATCH',{action:'note.create',characterId:primaryCharacterId,title:'Geteilte Notiz',text:JOURNAL_MARKERS.group+' – für die Gruppe sichtbar.',visibility:'group'});
 await send('/api/records','POST',{kind:'notizen',title:'Ungebundene Notiz',visibility:'private',body:{text:JOURNAL_MARKERS.unbound+' – ohne Figur.'}});
 await send('/api/character-selection','PATCH',{characterId:primaryCharacterId});
 return {secondCharacterId:second.id};
}
