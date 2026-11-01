import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checksAvailable,checksActive,isTablePlayer} from '../domain/live-checks.ts';
import {W10_MODIFIER_REGISTER} from '../domain/w10-modifier-register.ts';
// GE-02 release: protected live alpha gate, GM detection and frozen rule scope.
const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const local={GE01_CHECKS:'local-only',AUTH_ACCESS_ENVIRONMENT:'local-test'};
const prod=(campaigns)=>({AUTH_ACCESS_ENVIRONMENT:'production',GE01_ALPHA_CAMPAIGNS:campaigns});

test('outside the local instance checks exist only for explicitly listed campaigns',()=>{
 assert.equal(checksAvailable({},'kleve'),false,'no variable: off');
 assert.equal(checksAvailable(prod(''),'kleve'),false);
 assert.equal(checksAvailable(prod('*'),'kleve'),false,'no wildcard');
 assert.equal(checksAvailable(prod('other, kleve '),'kleve'),true);
 assert.equal(checksAvailable(prod('kleve2'),'kleve'),false,'exact id only');
 assert.equal(checksAvailable({GE01_CHECKS:'local-only',AUTH_ACCESS_ENVIRONMENT:'production'},'kleve'),false,'local flag alone never opens production');
});

test('the GM switch acts per evening; a new evening starts off; off never deletes anything',()=>{
 const room=(checks)=>({runId:'run-2',...(checks?{checks}:{})});
 assert.equal(checksActive(prod('kleve'),'kleve',room()),false,'allowlisted but not switched on');
 assert.equal(checksActive(prod('kleve'),'kleve',room({runId:'run-2',on:true})),true);
 assert.equal(checksActive(prod('kleve'),'kleve',room({runId:'run-1',on:true})),false,'switch of a previous evening does not carry over');
 assert.equal(checksActive(prod('kleve'),'kleve',room({runId:'run-2',on:false})),false);
 assert.equal(checksActive(prod(''),'kleve',room({runId:'run-2',on:true})),false,'removing the campaign from the list wins over the switch');
 assert.equal(checksActive(local,'any',room()),true,'local test instance: on by default');
 assert.equal(checksActive(local,'any',room({runId:'run-2',on:false})),false,'local: switchable off');
 assert.equal(checksActive(prod('kleve'),'kleve',{}),false,'no running evening');
 // Switching only writes the room's checks field; roll records are separate events and are never touched.
 const server=src('server/live-checks.ts'),body=server.slice(server.indexOf('async function setChecks'),server.indexOf('export async function liveCheckCommand'));
 assert.match(body,/json_set\(body,'\$\.checks',json\(\?\)\)/);
 assert.doesNotMatch(body,/DELETE|'roll'/);
});

test('a second GM is never a target; GM marks reach GM viewers only',()=>{
 assert.equal(isTablePlayer({role:'Teilnehmer',gm:true}),false);
 assert.equal(isTablePlayer({role:'Teilnehmer'}),true);
 const stage=src('server/live-stage.ts');
 assert.match(stage,/map\(\(\{membershipRole,\.\.\.m\}\)=>/,'membership role is stripped from the crew payload');
 assert.match(stage,/a\.gm&&isGmMembership\(membershipRole\)\?\{gm:true\}/);
 assert.match(src('server/live-checks.ts'),/!isGmMembership\(m\.membershipRole\)&&m\.id!==a\.id/);
});

test('frozen scope: hunger, stress, masquerade and other open mechanics stay unreleased; live checks preview only issued checks',()=>{
 for(const id of ['hunger','personal_stress','group_stress','masquerade','scene_condition','willpower'])assert.equal(W10_MODIFIER_REGISTER.find(e=>e.id===id)?.released,false,id);
 // The W10 draft preview route stays local-only (B09); live checks use their own read-only previewCheck on the gated path.
 assert.match(src('app/api/w10-preview/route.ts'),/if \(!w10PreviewEnabled\(\)\) throw new HttpError\(404/);
 assert.doesNotMatch(src('app/spielbereich/modules/spieltisch/live-check-panel.tsx'),/\/api\/w10-preview/);
 const checks=src('server/live-checks.ts'),preview=checks.slice(checks.indexOf('async function previewCheck'),checks.indexOf('const switchSchema'));
 assert.match(preview,/liveChecksActive\(a,room\)/);assert.match(preview,/addressedCheck\(/);assert.doesNotMatch(preview,/INSERT|UPDATE|DELETE/,'read-only');
});
