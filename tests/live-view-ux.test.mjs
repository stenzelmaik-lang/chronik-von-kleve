import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../app/spielbereich/modules/'+name,import.meta.url),'utf8');
test('live board follows the scene session, never mounts outside or in group preview',()=>{
  assert.ok(!read('command-center.tsx').includes('<LiveTable'));
  const workspace=read('command-workspace.tsx');
  assert.ok(workspace.includes('!preparation&&snapshot&&!preview&&<LiveTable'));
  assert.ok(workspace.includes('selectedSessionId={focus.sessionId}'));
  assert.ok(workspace.indexOf('<CommandBoard')<workspace.indexOf('<LiveTable'));
  assert.ok(read('command-player-session.tsx').includes('!preview&&!loading&&!error&&<LiveTable'));
});
test('closed whiteboard remains discoverable without exposing stored drawings',()=>{
  const table=read('live-table.tsx');
  assert.ok(table.includes('!room?.open&&<div className={styles.closedBoard}'));
  assert.ok(table.includes('disabled={busy||!sessionId||unavailable}'));
  assert.ok(table.includes('selectedSessionId===undefined&&<label>'));
  assert.ok(table.includes("!sessions.some(session=>session.id===sessionId))return"));
  assert.ok(table.includes('room?.open&&<>'));
});
test('live focus renders one scene even if saved expert layout removed all scenes',()=>{
  const board=read('command-board.tsx');
  assert.ok(board.includes("if(focused&&!mobilePanels.some(panel=>panel.tool==='scene'))"));
  assert.ok(board.includes('.slice(0,focused?1:undefined)'));
  assert.ok(read('command-workspace.tsx').includes('open={toolsOpen}'));
});
test('switching sessions protects whiteboard drafts and resets scene selection, no second legacy hero',()=>{
  const workspace=read('command-workspace.tsx');
  assert.ok(workspace.includes("next={...next,sceneId:''}"));
  assert.ok(workspace.includes("dirtyPanels.current['live-whiteboard']=dirty"));
  assert.ok(workspace.includes('Object.keys(dirtyPanels.current)]:affected'));
  assert.ok(workspace.includes("if(!await allowDiscard(['live-whiteboard']))return"));
  assert.ok(read('live-table.tsx').includes("window.addEventListener('beforeunload',leave)"));
  assert.ok(read('command-player-session.tsx').includes('showStage={!visible.scenes?.length}'));
  assert.ok(read('command-player-session.tsx').includes('selectedSessionId={currentSession?.id'));
  assert.ok(read('story-scene-manager.tsx').includes('Gruppenszene bereits gestartet'));
});
