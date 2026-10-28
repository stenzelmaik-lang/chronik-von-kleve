import {projectDice} from './shared-dice.mjs';
// Throwaway local UI simulation. Not a production entity or permission model.
export const scenes = [
  {id:'campaign',title:'Kampagnenmotiv',image:'campaign'},
  {id:'barracks',title:'Kaserne',image:'barracks'},
  {id:'taberna',title:'Electric Taberna',image:'taberna'},
];
export function constrainRect(rect){
  const w=Math.max(.1,Math.min(.65,Number(rect.w)||.2)),h=Math.max(.13,Math.min(.85,Number(rect.h)||.4));
  return {x:Math.max(0,Math.min(1-w,Number(rect.x)||0)),y:Math.max(0,Math.min(1-h,Number(rect.y)||0)),w,h};
}
// A readable personal rendering size; never writes a viewport resize into the shared note.
export function fitNoteRect(rect,bounds){return constrainRect({...rect,w:Math.max(rect.w,200/Math.max(1,bounds.w)),h:Math.max(rect.h,235/Math.max(1,bounds.h))});}
export function createStage(){return {version:1,scene:'campaign',draftScene:null,objects:[],board:[],boardEpoch:0};}
export function canSee(object,viewer){return viewer==='gm'||(object.kind==='note'?object.ownerId===viewer||object.visibility==='group':object.visibility==='group');}
export const NOTE_LIMIT=3000;
function noteText(value){if(typeof value!=='string'||value.length>NOTE_LIMIT)throw Error('Ein Notizzettel darf höchstens 3000 Zeichen enthalten.');return value;}
function ownedNote(state,viewer,command){
  const item=state.objects.find(o=>o.id===command.id&&o.kind==='note');
  if(!item||item.ownerId!==viewer)throw Object.assign(Error('Nur eigene Notizzettel können verändert werden.'),{status:403});
  if(command.expectedRevision!==item.revision)throw Object.assign(Error('Dieser Notizzettel wurde inzwischen geändert. Bitte die aktuelle Fassung erneut öffnen.'),{status:409});
  return item;
}
export function projectStage(state,viewer){
  const gm=viewer==='gm';
  return {dice:projectDice(state,viewer),version:state.version,scene:gm&&state.draftScene?state.draftScene:state.scene,sharedScene:state.scene,preview:gm&&!!state.draftScene,
    objects:state.objects.filter(o=>canSee(o,viewer)),board:state.board,boardEpoch:state.boardEpoch,
    crew:[{id:'demo-gm',name:'Demo Spielleitung',initials:'SL',role:'Spielleitung'},{id:'demo-a',name:'Demo Spieler A',initials:'A',role:'Spieler'},{id:'demo-b',name:'Demo Spieler B',initials:'B',role:'Spieler'}],
    scenes:scenes.filter(s=>gm||s.id===state.scene),
    catalog:gm?[{id:'npc',title:'Herr Schäfer',kind:'npc'},{id:'document',title:'Ankunft · Testdokument',kind:'document'}]:[],
    ...(gm?{privateNote:'SL-PROTOTYP-VERTRAULICH: Dieser Text ist ausschließlich ein synthetischer Geheimnisschutz-Test. Keine echte Orts- oder Personenakte.'}:{})};
}
export function changeStage(state,viewer,command){
  if(!['gm','a','b'].includes(viewer))throw Object.assign(Error('Unbekannte Simulationsansicht.'),{status:403});
  if(command.expectedVersion!==state.version)throw Object.assign(Error('Der Bühnenstand wurde geändert. Bitte erneut versuchen.'),{status:409});
  const noteCreation=command.action==='add'&&command.kind==='note';
  const noteMutation=['move','edit','visibility','remove'].includes(command.action)&&state.objects.some(o=>o.id===command.id&&o.kind==='note');
  if(viewer!=='gm'&&!['board'].includes(command.action)&&!noteCreation&&!noteMutation)throw Object.assign(Error('Diese Aktion ist in der Simulation der SL vorbehalten.'),{status:403});
  if(noteCreation){
    if(state.objects.filter(o=>o.kind==='note'&&o.ownerId===viewer).length>=30)throw Error('Im lokalen Test sind bis zu 30 eigene Notizzettel möglich.');
    const offset=state.objects.filter(o=>o.kind==='note'&&o.ownerId===viewer).length%6;
    state.objects.push({id:'note-'+globalThis.crypto.randomUUID(),kind:'note',title:'Notizzettel',ownerId:viewer,content:noteText(command.content??''),visibility:'private',revision:1,rect:{x:.14+offset*.035,y:.16+offset*.035,w:.16,h:.27}});
  }else if(noteMutation){
    const item=ownedNote(state,viewer,command);
    if(command.action==='edit')item.content=noteText(command.content);
    else if(command.action==='move')item.rect=constrainRect(command.rect);
    else if(command.action==='visibility'){
      if(!['private','group'].includes(command.visibility))throw Error('Unbekannte Notizsichtbarkeit.');
      item.visibility=command.visibility;
    }else state.objects=state.objects.filter(o=>o.id!==item.id);
    item.revision++;
  }else if(command.action==='scene'){
    if(!scenes.some(s=>s.id===command.id))throw Error('Unbekannte Testszene.');
    if(command.preview)state.draftScene=command.id;else{state.scene=command.id;state.draftScene=null;}
  }else if(command.action==='add'){
    if(!['npc','document'].includes(command.kind))throw Error('Unbekanntes Testobjekt.');
    if(!state.objects.some(o=>o.id===command.kind))state.objects.push({id:command.kind,kind:command.kind,title:command.kind==='npc'?'Herr Schäfer':'Ankunft · Testdokument',visibility:'sl',rect:command.kind==='npc'?{x:.57,y:.18,w:.25,h:.76}:{x:.14,y:.22,w:.23,h:.52}});
  }else if(command.action==='move'){
    const item=state.objects.find(o=>o.id===command.id);if(!item)throw Error('Objekt nicht auf der Bühne.');item.rect=constrainRect(command.rect);
  }else if(command.action==='visibility'){
    const item=state.objects.find(o=>o.id===command.id);if(!item)throw Error('Objekt nicht auf der Bühne.');item.visibility=command.visible?'group':'sl';
  }else if(command.action==='remove')state.objects=state.objects.filter(o=>o.id!==command.id);
  else if(command.action==='board'){
    const {operation,element,elementId,expectedRevision,epoch}=command;
    if(epoch!==state.boardEpoch)throw Object.assign(Error('Zeichenfläche wurde zurückgesetzt.'),{status:409});
    const i=state.board.findIndex(e=>e.id===elementId);
    if(operation==='draw'){
      if(!element?.id||state.board.some(e=>e.id===element.id)||!Array.isArray(element.points)||element.points.length>2000||state.board.length>=200)throw Error('Ungültiges lokales Zeichenobjekt.');
      state.board.push({...element,revision:1});
    }else if(operation==='edit'||operation==='remove'){
      if(i<0||state.board[i].revision!==expectedRevision)throw Object.assign(Error('Zeichenobjekt wurde geändert.'),{status:409});
      if(operation==='remove')state.board.splice(i,1);else state.board[i]={...element,revision:expectedRevision+1};
    }else throw Error('Unbekannte Zeichenaktion.');
  }else throw Error('Unbekannte Prototypaktion.');
  state.version++;return projectStage(state,viewer);
}
