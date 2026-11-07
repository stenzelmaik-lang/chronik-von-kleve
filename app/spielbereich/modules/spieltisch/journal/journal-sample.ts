import type {CharacterDetailProjection} from '../../character';

// Abenteuerjournal (AJ-01): sample copy for the SL without an own active figure. It shows how the players' book looks
// and where everything is (to test it, to improve it, to explain it at the table). Purely illustrative, lives only in
// the browser, never saved, and contains no data of any player.
export const SAMPLE_CHARACTER_ID='journal-sample';
const now='2026-11-07T20:00:00.000Z';
const note=(id:string,title:string,text:string,journalKind:'note'|'chronicle',playDate:string|null,updatedAt:string)=>({id,title,text,visibility:'private',version:1,createdAt:updatedAt,updatedAt,canEdit:true,journalKind,playDate});

export function sampleProjection():CharacterDetailProjection{
 return {
  identity:{id:SAMPLE_CHARACTER_ID,name:'Ansichtsexemplar – Beispielfigur',player:'Spielleitung',chronicle:'Chronik von Kleve',clan:'Toreador',generation:11,nature:'Kunstkennerin',demeanor:'Gastgeberin',concept:'Galeristin',sire:'unbekannt',portraitRef:null},
  sheet:{
   attributes:{Körperkraft:1,Geschick:3,Widerstandsfähigkeit:2,Charisma:4,Manipulation:3,Erscheinungsbild:4,Wahrnehmung:3,Intelligenz:2,Geistesschärfe:3},
   abilities:{Aufmerksamkeit:2,Ausdruck:3,Empathie:3,Ausflüchte:2,Etikette:3,Vortrag:2,Nachforschungen:1,Okkultismus:1},
   specialties:[],customAbilities:[],
   disciplines:[{name:'Auspex',value:2},{name:'Präsenz',value:3},{name:'Geschwindigkeit',value:1}],
   paths:[],backgrounds:[{name:'Ressourcen',value:3},{name:'Kontakte',value:2}],
   virtues:{Gewissen:3,Selbstbeherrschung:3,Mut:2},humanity:7,humanityPath:'',
   willpower:{permanent:6,temporary:4},health:{track:['bashing']},blood:{current:8,max:12,perRound:1},
   merits:[{name:'Gutes Gedächtnis',cost:1}],flaws:[{name:'Albträume',cost:1}],
   clanWeakness:'Toreador: Schönheit kann die Figur in Bann schlagen (Beispieltext).',individualInfo:'',
  },
  roleplay:{backgroundStory:'Hier steht die Hintergrundgeschichte der eigenen Figur. Spieler pflegen sie in der Charakterverwaltung; das Buch zeigt sie an.',playGuide:'Hier stehen Spielweise und Ziele der Figur.'},
  progression:{characterState:'legacy',freeXp:4,totalXp:31},
  permissions:{canEdit:false,canEditCompanion:false,canChangeRuntimeValues:false,canArchive:false,canCreateNotes:true},
  revision:{version:1,updatedAt:now},
  companion:{media:[],relationships:[],lastSession:null as never,notes:[
   note('sample-n1','Namen aus der Bar','Ilse – Barkeeperin im Electric Taberna, weiß mehr als sie sagt.','note',null,'2026-11-06T21:30:00.000Z'),
   note('sample-n2','Offene Fragen','Wer hat den Brief am Hafen hinterlegt? Warum fehlt die Seite im Register?','note',null,'2026-11-05T22:10:00.000Z'),
   note('sample-c1','Ankunft in Kleve','Die Domäne empfängt uns kühl. Erste Begegnung mit dem Hüter der Schwanenburg.','chronicle','1998-03-12','2026-11-01T20:00:00.000Z'),
   note('sample-c2','Begegnung im Hafen','Der Mann mit dem Hut. Er kannte meinen Namen.','chronicle','1998-03-14','2026-11-03T20:00:00.000Z'),
  ] as never},
 } as CharacterDetailProjection;
}
