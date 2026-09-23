import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const output = resolve('outputs/visitor-shell-v1');
mkdirSync(output, { recursive: true });
// Reuse the existing project's CDP transport without its authenticated fixture setup.
const transport = readFileSync('scripts/capture-location-screenshots.mjs', 'utf8');
const Cdp = new Function(`return ${transport.slice(transport.indexOf('class Cdp {'), transport.indexOf('\nawait main();'))}`)();
const browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9232', `--user-data-dir=${resolve('work', `visitor-edge-${Date.now()}`)}`, 'about:blank',
], { stdio: 'ignore', windowsHide: true });
const pause = ms => new Promise(done => setTimeout(done, ms));
const results = [];
try {
  let version;
  for (let n = 0; n < 40; n++) {
    try { version = await fetch('http://127.0.0.1:9232/json/version').then(r => r.json()); break; } catch { await pause(250); }
  }
  const cdp = await Cdp.connect(version.webSocketDebuggerUrl);
  for (const [name, width, height, mobile] of [
    ['desktop-2560',2560,1440,false], ['desktop-1920',1920,1080,false],
    ['laptop',1366,768,false], ['tablet',820,1180,true], ['mobile',390,844,true],
  ]) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile }, sessionId);
    await cdp.send('Page.navigate', { url: process.env.CVK_VISITOR_URL || 'http://127.0.0.1:8794/' }, sessionId);
    await pause(2200);
    const evaluate = async expression => (await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)).result.value;
    const check = await evaluate(`(() => ({ title: document.title, h1: document.querySelector('h1')?.textContent,
      overflow: document.documentElement.scrollWidth > innerWidth,
      imagesLoaded: [...document.images].every(i => i.complete && i.naturalWidth > 0),
      home: document.querySelector('a[aria-label="Zur Startseite"]')?.getAttribute('href'),
      login: [...document.querySelectorAll('a')].some(a => a.textContent.includes('anmelden') && a.href.includes('/signin-with-chatgpt?return_to=%2Fspielbereich')),
      noSidebar: !document.querySelector('[data-sidebar]')
    }))()`);
    if (check.overflow || !check.imagesLoaded || check.home !== '/' || !check.h1) throw new Error(JSON.stringify({name,...check}));
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, sessionId);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, sessionId);
    check.keyboardFocus = await evaluate(`document.activeElement.tagName === 'A' && getComputedStyle(document.activeElement).outlineStyle !== 'none'`);
    if (mobile) {
      await evaluate(`document.querySelector('summary').click()`);
      check.mobileMenu = await evaluate(`document.querySelector('details').open && [...document.querySelectorAll('details a')].length === 4`);
      await evaluate(`document.querySelector('summary').click()`);
    }
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, sessionId);
    check.reducedMotion = await evaluate(`[...document.images].every(i => parseFloat(getComputedStyle(i).animationDuration) < 0.01)`);
    await evaluate(`document.activeElement.blur()`);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
    writeFileSync(resolve(output, `${name}.png`), Buffer.from(png.data, 'base64'));
    const full = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
    writeFileSync(resolve(output, `${name}-full.png`), Buffer.from(full.data, 'base64'));
    results.push({name,width,height,...check});
    await cdp.send('Target.closeTarget', {targetId});
  }
  cdp.close();
  writeFileSync(resolve(output, 'browser-results.json'), JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
} finally { browser.kill(); }
