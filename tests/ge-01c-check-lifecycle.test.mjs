import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkProgress,pendingChecks,pendingTargets,focusCheck,parsePreparedCheck,traitLine,isTablePlayer} from '../domain/live-checks.ts';
import {createInbox,ingestDice,dismissDice,showDice} from '../app/spielbereich/modules/spieltisch/dice-inbox.mjs';
// GE-01C: lifecycle of character checks and result views at the live table. A stored roll is final;
// a result view is only a per-client presentation and never makes a roll "open" again.
const check=(id,recipients=null,extra={})=>({id,title:'Probe '+id,difficulty:6,recipients,...extra});
const roll=(id,authorId,requestId,status='settled_open')=>({id,authorId,status,checkRef:requestId?{requestId,characterId:'c-'+authorId}:undefined});
const journal=(revision,events)=>({sessionId:'run-1',revision,events});
const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('a check stays pending per target until that player rolled; finished checks are done for GM and player alike',()=>{
 const c=check('k1',['a','b']);
 assert.deepEqual(checkProgress(c,[],['a','b','c']),{targets:[{playerId:'a',rollId:undefined},{playerId:'b',rollId:undefined}],rolled:0,done:false});
 const one=checkProgress(c,[roll('r1','a','k1')],['a','b']);
 assert.equal(one.rolled,1);assert.equal(one.done,false);
 assert.equal(checkProgress(c,[roll('r1','a','k1'),roll('r2','b','k1')],['a','b']).done,true);
 // "ganze Runde": every player at the table, plus anyone who rolled although they left.
 const all=checkProgress(check('k2'),[roll('r3','x','k2')],['a']);
 assert.deepEqual(all.targets.map(t=>t.playerId),['a','x']);
 assert.equal(pendingTargets([c,check('k2')],[roll('r1','a','k1')],['a','b']),3,'b owes k1, a and b owe k2');
});

test('pending checks are per player, oldest first; the focus falls back to the newest finished one',()=>{
 const checks=[check('k1',['a']),check('k2'),check('k3',['b'])],rolls=[roll('r1','a','k1')];
 assert.deepEqual(pendingChecks('a',checks,rolls).map(c=>c.id),['k2']);
 assert.deepEqual(pendingChecks('b',checks,rolls).map(c=>c.id),['k2','k3']);
 assert.equal(focusCheck('a',checks,rolls).id,'k2');
 assert.equal(focusCheck('a',[checks[0]],rolls).id,'k1','finished check stays reachable for "Ergebnis ansehen"');
 assert.equal(focusCheck('a',[],[]),undefined);
});

test('prepared scene checks fill traits and SG from their own wording, nothing is guessed',()=>{
 assert.deepEqual(parsePreparedCheck('Dienstbuch finden','Wahrnehmung + Nachforschung (6)'),{attributeId:'perception',abilityId:'investigation',difficulty:6});
 assert.deepEqual(parsePreparedCheck('Geschick + Diebstahl, SG 7'),{attributeId:'dexterity',abilityId:'larceny',difficulty:7});
 assert.deepEqual(parsePreparedCheck('Schlüsselbund','Geschick + Taschendiebstahl (7)'),{attributeId:'dexterity',abilityId:'larceny',difficulty:7});
 assert.deepEqual(parsePreparedCheck('Ein Gespräch mit dem Wirt','Die Stimmung kippt.'),{},'free text yields no traits');
 assert.deepEqual(parsePreparedCheck('Seite 12 (12)'),{},'SG outside 2–10 is ignored');
 assert.equal(traitLine({attributeId:'dexterity'}),'Geschick + Fähigkeit frei');
});

test('loading or reconnecting never turns stored rolls into open hints and never re-rolls',()=>{
 const old=[roll('r1','a'),roll('r2','b','k1'),roll('r3','a',null,'closed_shared')];
 let inbox=ingestDice(createInbox(),journal(3,old));
 assert.equal(inbox.selectedId,null,'no old result pops up on load');
 const waiting=i=>i.events.filter(e=>e.status==='settled_open'&&e.id!==i.selectedId&&!i.hidden.includes(e.id));
 assert.deepEqual(waiting(inbox),[],'backlog is known, not "open"');
 // A new roll arrives live: shown once with animation.
 inbox=ingestDice(inbox,journal(4,[...old,roll('r4','b','k2')]));
 assert.equal(inbox.selectedId,'r4');assert.equal(inbox.animate,true);
 // Another arrives while r4 is shown: it waits, exactly one hint.
 inbox=ingestDice(inbox,journal(5,[...old,roll('r4','b','k2'),roll('r5','a')]));
 assert.equal(inbox.selectedId,'r4');assert.deepEqual(waiting(inbox).map(e=>e.id),['r5']);
 inbox=showDice(inbox,'r5');assert.equal(inbox.animate,false,'opening from a hint replays without a new throw');
 inbox=dismissDice(inbox);assert.deepEqual(waiting(inbox),[],'closed views leave no hints');
 // Reload in the same tab keeps the closed state; a view still open in this tab comes back without animation.
 const reopened=ingestDice(createInbox(inbox.hidden,'r4'),journal(5,inbox.events));
 assert.equal(reopened.selectedId,'r4');assert.equal(reopened.animate,false);assert.deepEqual(waiting(reopened),[]);
 assert.deepEqual(reopened.events.find(e=>e.id==='r4'),inbox.events.find(e=>e.id==='r4'),'same stored event, same faces');
});

test('normal table UI shows player-facing terms instead of internal identifiers',()=>{
 const ui=['live-check-panel.tsx','check-issue-form.tsx','dice-effect.tsx','stage.tsx','character-readonly.tsx','participants.tsx','regie.tsx','regie-window.tsx'].map(f=>src('app/spielbereich/modules/spieltisch/'+f)).join('\n');
 const visible=ui.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'');
 assert.doesNotMatch(visible,/GE-0?1|lokaler Prototyp|Probenanforderung|Bogen-Version|Bleibt bis zur manuellen Aktion|Sitzungsprotokoll|Offener Wurf/);
 for(const term of ['Charakterprobe','Neue Probe','Probe ausstehend','Würfeln','Ergebnis ansehen','Wurf abgeschlossen','Würfelprotokoll'])assert.ok(visible.includes(term),term);
 assert.doesNotMatch(src('server/live-checks.ts'),/HttpError\([^)]*GE-01/,'server messages carry no internal codes');
});

test('the player check lives in the own character sheet; the Regie has its own "Proben" area',()=>{
 const stage=src('app/spielbereich/modules/spieltisch/stage.tsx'),people=src('app/spielbereich/modules/spieltisch/participants.tsx');
 assert.match(stage,/renderOwnSheet=\{[^}]*<PlayerCheck/,'check rendered through the own sheet of the top bar');
 assert.doesNotMatch(stage,/LiveCheckPanel/,'no second check panel in the dice drawer');
 assert.match(people,/memberId===a\.id&&action==='sheet'&&renderOwnSheet/,'only the own sheet hosts the check');
 assert.match(src('app/spielbereich/modules/spieltisch/regie-window.tsx'),/\['checks','Proben','text'\]/);
 assert.match(src('app/spielbereich/modules/spieltisch/regie.tsx'),/\['checks','Proben'\]/);
 // The client never sends a pool, faces or difficulty for a check roll; the server derives them.
 assert.doesNotMatch(src('app/spielbereich/modules/spieltisch/live-check-panel.tsx'),/action:'rollCheck'[^}]*(pool|faces|difficulty):/);
});

test('the Spielleitung never counts as a target of a check',()=>{
 // The stage labels the viewer's own crew entry; for the GM that is "Spielleitung", others are "Teilnehmer".
 const crew=[{id:'a',role:'Teilnehmer'},{id:'b',role:'Teilnehmer'},{id:'sl',role:'Spielleitung'},{id:'x',role:'campaign_gm'}];
 assert.deepEqual(crew.filter(isTablePlayer).map(m=>m.id),['a','b']);
 assert.equal(checkProgress(check('k'),[],crew.filter(isTablePlayer).map(m=>m.id)).targets.length,2);
});
