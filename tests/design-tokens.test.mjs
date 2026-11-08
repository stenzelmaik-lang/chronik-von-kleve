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
  assert.ok(app.size>=45,'enough tokens are defined: '+app.size);
  assert.deepEqual([...proof.entries()],[...app.entries()]);
});

test('every --cp-* token the app reads is defined', () => {
  const defined=new Set(tokens(read('app/globals.css')).keys());
  const missing=walk('app').filter(p=>/\.(css|tsx?)$/.test(p)).flatMap(p=>[...read(p).matchAll(/var\(\s*(--cp-[a-z0-9-]+)/g)].map(m=>m[1]+' in '+p)).filter(x=>!defined.has(x.split(' ')[0]));
  assert.deepEqual(missing,[]);
});

test('the chosen fonts are self-hosted with their licence and no proof fonts remain', () => {
  const css=read('app/globals.css');
  for (const [family,dir] of [['Spectral','spectral'],['IBM Plex Sans','ibm-plex-sans']]) {
    for (const w of [400,700]) {
      assert.ok(css.includes(`url('/fonts/${dir}/${dir}-latin-${w}-normal.woff2')`),family+' '+w);
      assert.ok(statSync(join(root,`public/fonts/${dir}/${dir}-latin-${w}-normal.woff2`)).size>10000);
    }
    assert.match(read(`public/fonts/${dir}/LICENSE`),/SIL Open Font License, Version 1\.1/);
  }
  assert.match(tokens(css).get('--cp-font-title'),/^'Spectral'/);
  assert.match(tokens(css).get('--cp-font-text'),/^'IBM Plex Sans'/);
  assert.ok(!/--cp-navy/.test(css),'the unchosen surface family is gone');
  assert.ok(!/fonts\.(googleapis|gstatic)|jsdelivr/.test(css),'no external font CDN');
});

test('text tokens reach WCAG AA on every frame surface and on paper', () => {
  const t=tokens(read('app/globals.css'));
  const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
  const ratio=(a,b)=>{const x=lum(t.get(a)),y=lum(t.get(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  for (const surface of ['--cp-bg','--cp-surface-1','--cp-surface-2','--cp-surface-3'])
    for (const text of ['--cp-text','--cp-text-muted','--cp-gold','--cp-blood-text'])
      assert.ok(ratio(text,surface)>=4.5,`${text} on ${surface}: ${ratio(text,surface).toFixed(2)}`);
  for (const surface of ['--cp-surface-1','--cp-surface-2'])
    assert.ok(ratio('--cp-text-faint',surface)>=4.5,'faint on '+surface);
  for (const ink of ['--cp-ink','--cp-ink-soft','--cp-ink-gold','--cp-blood']) assert.ok(ratio(ink,'--cp-paper')>=4.5,ink+' on paper');
});

test('the proof page stays local: no app code links it and it loads nothing from outside', () => {
  // The globals.css comment names the proof page; code must never import or link it.
  assert.deepEqual(walk('app').filter(p=>/\.(tsx?|mjs)$/.test(p)&&/designgrundlage|musterseite/.test(read(p))),[]);
  const proof=read('prototypes/designgrundlage/musterseite.html');
  assert.ok(!/https?:\/\/(?!127\.0\.0\.1)/.test(proof.replace(/http:\/\/www\.w3\.org\/2000\/svg/g,'')),'no external resources');
});
