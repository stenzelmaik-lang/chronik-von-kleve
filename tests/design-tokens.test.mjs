import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';

const root=new URL('..',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const read=p=>readFileSync(join(root,p),'utf8');
const block=s=>{const a=s.indexOf('/* cp-tokens:start */'),b=s.indexOf('/* cp-tokens:end */');assert.ok(a>=0&&b>a,'token markers present');return s.slice(a,b);};
const tokens=s=>new Map([...block(s).matchAll(/(--cp-[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
const walk=dir=>readdirSync(join(root,dir)).flatMap(name=>{const p=join(dir,name);return statSync(join(root,p)).isDirectory()?walk(p):[p];});

test('the design tokens on the proof page are exactly those in app/globals.css', () => {
  const app=tokens(read('app/globals.css')),proof=tokens(read('prototypes/designgrundlage/musterseite.html'));
  assert.ok(app.size>=50,'enough tokens are defined: '+app.size);
  assert.deepEqual([...proof.entries()],[...app.entries()]);
});

test('the tokens only add: no rule in the app reads a --cp-* token yet', () => {
  const users=walk('app').filter(p=>/\.(css|tsx?)$/.test(p)).filter(p=>{
    const text=read(p);
    const outside=p.replace(/\\/g,'/')==='app/globals.css'?text.replace(block(text),''):text;
    return /var\(\s*--cp-/.test(outside);
  });
  assert.deepEqual(users,[]);
});

test('text tokens reach WCAG AA on every frame surface of both families', () => {
  const t=tokens(read('app/globals.css'));
  const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
  const ratio=(a,b)=>{const x=lum(t.get(a)),y=lum(t.get(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  for (const surface of ['--cp-bg','--cp-surface-1','--cp-surface-2','--cp-surface-3','--cp-navy-surface-1','--cp-navy-surface-2','--cp-navy-surface-3'])
    for (const text of ['--cp-text','--cp-text-muted','--cp-gold','--cp-blood-text'])
      assert.ok(ratio(text,surface)>=4.5,`${text} on ${surface}: ${ratio(text,surface).toFixed(2)}`);
  for (const surface of ['--cp-surface-1','--cp-surface-2','--cp-navy-surface-1','--cp-navy-surface-2'])
    assert.ok(ratio('--cp-text-faint',surface)>=4.5,'faint on '+surface);
  for (const ink of ['--cp-ink','--cp-ink-soft','--cp-ink-gold','--cp-blood']) assert.ok(ratio(ink,'--cp-paper')>=4.5,ink+' on paper');
});

test('the proof page stays local: no app code links it, its fonts carry their licence', () => {
  // The globals.css comment names the proof page; code must never import or link it.
  assert.deepEqual(walk('app').filter(p=>/\.(tsx?|mjs)$/.test(p)&&/designgrundlage|musterseite/.test(read(p))),[]);
  const fonts=readdirSync(join(root,'prototypes/designgrundlage/fonts')).filter(n=>statSync(join(root,'prototypes/designgrundlage/fonts',n)).isDirectory());
  assert.equal(fonts.length,6);
  for (const f of fonts) assert.match(read(`prototypes/designgrundlage/fonts/${f}/LICENSE`),/SIL Open Font License, Version 1\.1/,f);
  const proof=read('prototypes/designgrundlage/musterseite.html');
  assert.ok(!/https?:\/\/(?!127\.0\.0\.1)/.test(proof.replace(/http:\/\/www\.w3\.org\/2000\/svg/g,'')),'no external resources');
});
