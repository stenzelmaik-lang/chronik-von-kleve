import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Abenteuerjournal (AJ-01): the book as a free-standing 3D object on the table. Mechanics (cover opening at the spine,
// turning leaf bending along the spine, page-block depth, register tabs) follow the approved offline prototype.
// Look (v3) after the owner's reference photo of a worn leather journal: dark distressed brown leather with copper
// wear, blind-tooled gothic ornament inside a double frame, tan saddle stitching, raised spine bands, hammered antique
// brass corners with rivets on the fore edge, and a wrap strap with D-ring buckle, keeper and pointed, riveted end.
// The design is drawn procedurally at runtime (own artwork, no image files). Controls are parts of the book: on the shut
// book the buckle opens it and the strap end packs it away; on the open book the loosened strap lies beside it and
// carries three engraved brass conchos. Study materials under the AJ-04 quality stop.
// Readable and editable content is never drawn here: it stays a sharp HTML layer on the rectangles onLayout reports.

const INK = '#3a2717';
const LEATHER = [50, 30, 20];
// Engraved symbols (24×24 line drawings, same shapes as the HTML icon set).
const ICONS = {
  enlarge: 'M16 10.5a5.5 5.5 0 1 1-11 0a5.5 5.5 0 1 1 11 0M14.5 14.5l5 5M10.5 8v5M8 10.5h5',
  shrink: 'M16 10.5a5.5 5.5 0 1 1-11 0a5.5 5.5 0 1 1 11 0M14.5 14.5l5 5M8 10.5h5',
  clasp: 'M6.7 7h10.6a2.2 2.2 0 0 1 2.2 2.2v5.6a2.2 2.2 0 0 1-2.2 2.2H6.7a2.2 2.2 0 0 1-2.2-2.2V9.2A2.2 2.2 0 0 1 6.7 7zM8.5 7V5.6a3.5 3.5 0 0 1 7 0V7M13.6 12a1.6 1.6 0 1 1-3.2 0a1.6 1.6 0 1 1 3.2 0M12 13.6v1.6',
  satchel: 'M5 9.5h14l-1.2 9a1.6 1.6 0 0 1-1.6 1.4H7.8a1.6 1.6 0 0 1-1.6-1.4zM8.5 9.5V7.8a3.5 3.5 0 0 1 7 0v1.7M5 9.5c2 2.6 12 2.6 14 0M10.6 11.6h2.8v2.4h-2.8z',
};

function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

export function createBook(canvas, onLayout, options) {
  const tabDefs = options.tabs;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = .5;
  const book = new THREE.Group();
  scene.add(book);
  const camera = new THREE.OrthographicCamera(-4, 4, 2.6, -2.6, 0.1, 40);
  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x4a3a30, 1.1));
  const key = new THREE.DirectionalLight(0xffe0b8, 2.4);
  key.position.set(-5, 6, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfa894, .55);
  rim.position.set(6, -3, 4);
  scene.add(rim);

  const width = 3.24, height = 4.22, paperWidth = 3.11, paperHeight = 4.01, hinge = .075, floor = -.31;
  let size = { width: 1, height: 1 };
  let frame = { open: 0, index: 0, total: 5, turn: null, activeTab: 0 };
  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  function canvas2d(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function texture(image, color = true) { const t = new THREE.CanvasTexture(image); if (color) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; }
  function surface(w, h, paint, color = true) { const c = canvas2d(w, h); paint(c.getContext('2d'), w, h); return texture(c, color); }

  // ---- procedural helpers -----------------------------------------------------------------------------------------
  /** Fractal value noise by stacking upscaled random grids (cheap, smooth). */
  function fbm(ctx, w, h, seed, { from = 3, to = 7, alpha = .5, mode = 'overlay' } = {}) {
    const random = rng(seed);
    ctx.save(); ctx.globalCompositeOperation = mode; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    for (let o = from; o <= to; o++) {
      const gw = 2 ** o, gh = Math.max(2, Math.round(gw * h / w)), grid = canvas2d(gw, gh), g = grid.getContext('2d'), img = g.createImageData(gw, gh);
      for (let p = 0; p < img.data.length; p += 4) { const v = random() * 255; img.data[p] = img.data[p + 1] = img.data[p + 2] = v; img.data[p + 3] = 255; }
      g.putImageData(img, 0, 0);
      ctx.globalAlpha = alpha * (1.25 - (o - from) / (to - from + 1));
      ctx.drawImage(grid, 0, 0, w, h);
    }
    ctx.restore();
  }
  function grain(ctx, w, h, amount, seed) {
    const img = ctx.getImageData(0, 0, w, h), random = rng(seed);
    for (let p = 0; p < img.data.length; p += 4) { const d = (random() - .5) * amount; img.data[p] += d; img.data[p + 1] += d; img.data[p + 2] += d; }
    ctx.putImageData(img, 0, 0);
  }
  /** Worn leather: base, mottling, copper sheen, scratches, creases, lighter wear towards the edges. */
  function paintLeather(ctx, w, h, seed, { wear = 1, scratches = 1 } = {}) {
    ctx.fillStyle = `rgb(${LEATHER.join(',')})`; ctx.fillRect(0, 0, w, h);
    fbm(ctx, w, h, seed, { from: 1, to: 5, alpha: .3, mode: 'overlay' });
    fbm(ctx, w, h, seed + 7, { from: 5, to: 8, alpha: .08, mode: 'soft-light' });
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(150,84,42,.24)'; ctx.fillRect(0, 0, w, h); ctx.restore();
    const random = rng(seed + 3), unit = w / 1024;
    ctx.lineCap = 'round';
    for (let i = 0; i < 70 * scratches; i++) {
      const x = random() * w, y = random() * h, len = (30 + random() * 160) * unit, a = -.55 + random() * .5 + (random() < .3 ? Math.PI / 2 : 0);
      const bend = (random() - .5) * 40 * unit, light = random() < .62;
      ctx.strokeStyle = light ? `rgba(150,92,54,${.05 + random() * .1})` : `rgba(18,8,4,${.07 + random() * .12})`;
      ctx.lineWidth = (light ? .6 + random() * 1.4 : .5 + random()) * unit;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * len / 2 - Math.sin(a) * bend, y + Math.sin(a) * len / 2 + Math.cos(a) * bend, x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
    }
    const edge = 70 * unit * wear;
    for (const [x0, y0, x1, y1] of [[0, 0, edge, 0], [w, 0, w - edge, 0], [0, 0, 0, edge], [0, h, 0, h - edge]]) {
      const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(120,72,42,.42)'); g.addColorStop(.3, 'rgba(100,60,34,.16)'); g.addColorStop(1, 'rgba(100,60,34,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    const vignette = ctx.createRadialGradient(w * .48, h * .45, w * .2, w * .5, h * .5, h * .72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(14,6,3,.35)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 7, seed + 11);
  }
  /** Pebbled grain for bump maps (mid grey with soft cells). */
  function paintGrainBump(ctx, w, h, seed, strength = 1) {
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h);
    fbm(ctx, w, h, seed, { from: 6, to: 9, alpha: .26 * strength, mode: 'overlay' });
    grain(ctx, w, h, 16 * strength, seed + 1);
  }
  /** Blind tooling: a pressed groove. In the colour map dark with a soft light edge, in the bump map deep. */
  function tool(ctx, bump, draw, widthPx) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (bump) { ctx.strokeStyle = '#262626'; ctx.lineWidth = widthPx * 1.3; draw(); ctx.stroke(); }
    else {
      ctx.translate(widthPx * .45, widthPx * .45); ctx.strokeStyle = 'rgba(150,92,52,.45)'; ctx.lineWidth = widthPx; draw(); ctx.stroke();
      ctx.translate(-widthPx * .9, -widthPx * .9); ctx.strokeStyle = 'rgba(10,4,2,.55)'; ctx.lineWidth = widthPx * .8; draw(); ctx.stroke();
    }
    ctx.restore();
  }
  function toolFill(ctx, bump, draw) {
    ctx.save();
    if (bump) { ctx.fillStyle = '#2c2c2c'; draw(); ctx.fill(); }
    else { ctx.translate(1.5, 1.5); ctx.fillStyle = 'rgba(150,92,52,.4)'; draw(); ctx.fill(); ctx.translate(-2.5, -2.5); ctx.fillStyle = 'rgba(12,5,2,.55)'; draw(); ctx.fill(); }
    ctx.restore();
  }
  /** Saddle stitching along a rectangle or a line: thread in the colour map, holes and raised thread in the bump map. */
  function stitchRect(ctx, bump, x, y, w, h, step, len, thick) {
    const seg = (x0, y0, x1, y1) => { const d = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(d / step); for (let i = 0; i < n; i++) { const t0 = (i + .18) / n, t1 = (i + .18 + len / step) / n; const ax = x0 + (x1 - x0) * t0, ay = y0 + (y1 - y0) * t0, bx = x0 + (x1 - x0) * t1, by = y0 + (y1 - y0) * t1;
      if (bump) { ctx.fillStyle = '#383838'; ctx.beginPath(); ctx.arc(ax, ay, thick * .55, 0, 7); ctx.arc(bx, by, thick * .55, 0, 7); ctx.fill(); ctx.strokeStyle = '#c4c4c4'; ctx.lineWidth = thick; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
      else { ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = thick * 1.25; ctx.beginPath(); ctx.moveTo(ax + 1, ay + 1.4); ctx.lineTo(bx + 1, by + 1.4); ctx.stroke(); ctx.strokeStyle = '#b78a58'; ctx.lineWidth = thick; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.strokeStyle = 'rgba(255,230,190,.35)'; ctx.lineWidth = thick * .35; ctx.beginPath(); ctx.moveTo(ax, ay - thick * .2); ctx.lineTo(bx, by - thick * .2); ctx.stroke(); } } };
    ctx.save(); ctx.lineCap = 'round';
    if (h === 0) seg(x, y, x + w, y); else { seg(x, y, x + w, y); seg(x + w, y, x + w, y + h); seg(x + w, y + h, x, y + h); seg(x, y + h, x, y); }
    ctx.restore();
  }

  // ---- cover art: double frame, corner thorns, gothic stem ornament (own design) ---------------------------------
  function paintCover(ctx, w, h, bump, ornament) {
    if (bump) paintGrainBump(ctx, w, h, 501); else paintLeather(ctx, w, h, 314);
    const s = w / 1024;
    // a slightly raised panel: shallow bevel inside the stitching
    if (bump) { ctx.strokeStyle = '#9a9a9a'; ctx.lineWidth = 10 * s; ctx.strokeRect(58 * s, 58 * s, w - 116 * s, h - 116 * s); }
    stitchRect(ctx, bump, 40 * s, 40 * s, w - 80 * s, h - 80 * s, 17 * s, 9 * s, 3.2 * s);
    tool(ctx, bump, () => { ctx.beginPath(); ctx.rect(78 * s, 78 * s, w - 156 * s, h - 156 * s); }, 4 * s);
    tool(ctx, bump, () => { ctx.beginPath(); ctx.rect(96 * s, 96 * s, w - 192 * s, h - 192 * s); }, 2.6 * s);
    if (!ornament) return;
    // corner thorns: two curved arms from each inner corner
    for (const [cx, cy, sx, sy] of [[96, 96, 1, 1], [w / s - 96, 96, -1, 1], [96, h / s - 96, 1, -1], [w / s - 96, h / s - 96, -1, -1]]) {
      tool(ctx, bump, () => { ctx.beginPath();
        const X = v => (cx + sx * v) * s, Y = v => (cy + sy * v) * s;
        ctx.moveTo(X(0), Y(0)); ctx.bezierCurveTo(X(60), Y(18), X(110), Y(40), X(150), Y(100));
        ctx.moveTo(X(0), Y(0)); ctx.bezierCurveTo(X(18), Y(60), X(40), Y(110), X(100), Y(150));
        ctx.moveTo(X(22), Y(22)); ctx.bezierCurveTo(X(55), Y(30), X(70), Y(55), X(64), Y(64)); ctx.bezierCurveTo(X(55), Y(70), X(30), Y(55), X(22), Y(22)); }, 3 * s);
    }
    // gothic stem with spear tips and pointed wings
    const cx = w / 2, cy = h / 2;
    toolFill(ctx, bump, () => { ctx.beginPath(); ctx.moveTo(cx, 170 * s); ctx.quadraticCurveTo(cx + 13 * s, cy, cx, h - 170 * s); ctx.quadraticCurveTo(cx - 13 * s, cy, cx, 170 * s); });
    const wing = (y, spread, rise, inner) => toolFill(ctx, bump, () => { for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx, y - inner * s); ctx.bezierCurveTo(cx + d * spread * .35 * s, y - (inner + rise * .25) * s, cx + d * spread * .75 * s, y - rise * .1 * s, cx + d * spread * s, y + rise * .45 * s); ctx.bezierCurveTo(cx + d * spread * .7 * s, y + rise * .02 * s, cx + d * spread * .3 * s, y + inner * .4 * s, cx, y + inner * .5 * s); ctx.closePath(); ctx.fill(); } });
    wing(cy - 230 * s, 250, 120, 40);
    wing(cy - 330 * s, 120, 70, 22);
    // lower four-point star with long horizontal spikes
    const sy = cy + 250 * s;
    toolFill(ctx, bump, () => { ctx.beginPath(); ctx.moveTo(cx - 190 * s, sy); ctx.quadraticCurveTo(cx - 40 * s, sy - 18 * s, cx, sy - 70 * s); ctx.quadraticCurveTo(cx + 40 * s, sy - 18 * s, cx + 190 * s, sy); ctx.quadraticCurveTo(cx + 40 * s, sy + 18 * s, cx, sy + 110 * s); ctx.quadraticCurveTo(cx - 40 * s, sy + 18 * s, cx - 190 * s, sy); ctx.closePath(); });
    if (!bump) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(cx, cy, 6 * s, 0, 7); ctx.fill(); ctx.restore(); }
    tool(ctx, bump, () => { ctx.beginPath(); ctx.moveTo(cx - 34 * s, cy); ctx.lineTo(cx, cy - 34 * s); ctx.lineTo(cx + 34 * s, cy); ctx.lineTo(cx, cy + 34 * s); ctx.closePath(); }, 2.6 * s);
  }
  const COVER_W = 1024, COVER_H = 1334;
  const coverMap = surface(COVER_W, COVER_H, (ctx, w, h) => paintCover(ctx, w, h, false, true));
  const coverBump = surface(COVER_W, COVER_H, (ctx, w, h) => paintCover(ctx, w, h, true, true), false);
  const backMap = surface(512, 668, (ctx, w, h) => paintCover(ctx, w, h, false, false));
  const backBump = surface(512, 668, (ctx, w, h) => paintCover(ctx, w, h, true, false), false);
  const leatherMap = surface(512, 512, (ctx, w, h) => paintLeather(ctx, w, h, 77, { wear: 0, scratches: .6 }));
  const leatherBump = surface(512, 512, (ctx, w, h) => paintGrainBump(ctx, w, h, 78), false);
  for (const t of [leatherMap, leatherBump]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  // Inside boards: the same leather, darker, with a tooled frame (visible as the rim around the pages).
  const insideMap = surface(512, 668, (ctx, w, h) => { paintLeather(ctx, w, h, 91, { wear: .3, scratches: .4 }); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(0, 0, w, h); tool(ctx, false, () => { ctx.beginPath(); ctx.rect(9, 9, w - 18, h - 18); }, 2); });
  const leather = new THREE.MeshStandardMaterial({ map: leatherMap, roughness: .76, bumpMap: leatherBump, bumpScale: .8 });
  const face = new THREE.MeshStandardMaterial({ map: coverMap, roughness: .72, bumpMap: coverBump, bumpScale: 1.7 });
  const backFace = new THREE.MeshStandardMaterial({ map: backMap, roughness: .74, bumpMap: backBump, bumpScale: 1.4 });
  const inside = new THREE.MeshStandardMaterial({ map: insideMap, roughness: .84, bumpMap: leatherBump, bumpScale: 1 });

  // Strap leather: horizontal band, stitched along both edges, darkened burnished edges.
  function paintStrap(ctx, w, h, bump) {
    if (bump) paintGrainBump(ctx, w, h, 640, .8); else { paintLeather(ctx, w, h, 612, { wear: 0, scratches: .5 }); ctx.fillStyle = 'rgba(30,14,8,.12)'; ctx.fillRect(0, 0, w, h); }
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (bump) { g.addColorStop(0, '#5a5a5a'); g.addColorStop(.12, '#8a8a8a00'); g.addColorStop(.88, '#8a8a8a00'); g.addColorStop(1, '#5a5a5a'); }
    else { g.addColorStop(0, 'rgba(10,4,2,.7)'); g.addColorStop(.1, 'rgba(10,4,2,0)'); g.addColorStop(.9, 'rgba(10,4,2,0)'); g.addColorStop(1, 'rgba(10,4,2,.7)'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    stitchRect(ctx, bump, 0, h * .2, w, 0, 15, 8, 3);
    stitchRect(ctx, bump, 0, h * .8, w, 0, 15, 8, 3);
  }
  const strapMap = surface(1024, 128, (ctx, w, h) => paintStrap(ctx, w, h, false));
  const strapBump = surface(1024, 128, (ctx, w, h) => paintStrap(ctx, w, h, true), false);
  const strapLeather = new THREE.MeshStandardMaterial({ map: strapMap, roughness: .7, bumpMap: strapBump, bumpScale: 1 });
  const strapPlain = new THREE.MeshStandardMaterial({ map: leatherMap, roughness: .74, bumpMap: leatherBump, bumpScale: 1.2, color: 0xd8c8c0 });

  // Hammered antique brass with patina.
  function paintBrass(ctx, w, h, bump) {
    ctx.fillStyle = bump ? '#808080' : '#a5823f'; ctx.fillRect(0, 0, w, h);
    fbm(ctx, w, h, bump ? 811 : 801, { from: 2, to: 6, alpha: bump ? .25 : .45, mode: 'overlay' });
    const random = rng(bump ? 7 : 7);
    for (let i = 0; i < 520; i++) { const x = random() * w, y = random() * h, r = 3 + random() * 7, g = ctx.createRadialGradient(x - r * .3, y - r * .3, 0, x, y, r);
      if (bump) { g.addColorStop(0, 'rgba(40,40,40,.55)'); g.addColorStop(1, 'rgba(128,128,128,0)'); }
      else { g.addColorStop(0, 'rgba(255,236,180,.22)'); g.addColorStop(.6, 'rgba(90,64,24,.12)'); g.addColorStop(1, 'rgba(90,64,24,0)'); }
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
    if (!bump) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; fbm(ctx, w, h, 822, { from: 1, to: 4, alpha: .35, mode: 'multiply' }); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(70,72,40,.35)'; ctx.fillRect(0, 0, w, h); ctx.restore(); }
  }
  const brassMap = surface(256, 256, (ctx, w, h) => paintBrass(ctx, w, h, false));
  const brassBump = surface(256, 256, (ctx, w, h) => paintBrass(ctx, w, h, true), false);
  for (const t of [brassMap, brassBump]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const brass = new THREE.MeshStandardMaterial({ map: brassMap, bumpMap: brassBump, bumpScale: 1.4, roughness: .42, metalness: .86 });
  const rivetBrass = new THREE.MeshStandardMaterial({ map: brassMap, roughness: .32, metalness: .9, color: 0xfff2d8 });
  // Concho faces: brass with an engraved ring and symbol.
  function conchoFace(icon) {
    const c = canvas2d(256, 256), ctx = c.getContext('2d');
    paintBrass(ctx, 256, 256, false);
    const glow = ctx.createRadialGradient(96, 84, 10, 128, 128, 128); glow.addColorStop(0, 'rgba(255,240,200,.35)'); glow.addColorStop(1, 'rgba(40,26,8,.35)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, 256, 256);
    const ring = r => { ctx.beginPath(); ctx.arc(128, 128, r, 0, 7); };
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,232,170,.5)'; ring(100); ctx.stroke(); ctx.strokeStyle = 'rgba(40,24,6,.8)'; ctx.lineWidth = 2.2; ring(98); ctx.stroke();
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; ctx.fillStyle = 'rgba(40,24,6,.55)'; ctx.beginPath(); ctx.arc(128 + Math.cos(a) * 111, 128 + Math.sin(a) * 111, 2.4, 0, 7); ctx.fill(); }
    const path = new Path2D(ICONS[icon]);
    ctx.save(); ctx.translate(128, 128); ctx.rotate(-Math.PI / 2); ctx.scale(6.2, 6.2); ctx.translate(-12, -12); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.translate(.18, .18); ctx.strokeStyle = 'rgba(255,236,180,.6)'; ctx.lineWidth = 1.9; ctx.stroke(path);
    ctx.translate(-.3, -.3); ctx.strokeStyle = 'rgba(38,22,6,.92)'; ctx.lineWidth = 1.7; ctx.stroke(path);
    ctx.restore();
    return texture(c);
  }
  const faces = { enlarge: conchoFace('enlarge'), shrink: conchoFace('shrink'), clasp: conchoFace('clasp'), satchel: conchoFace('satchel') };

  // Paper: aged parchment, fibres, foxing, a stain, darker edges, a printed double frame and corner ornaments.
  function filigree(ctx, x, y, sx, sy, s, color, lw) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, s); ctx.lineTo(0, 0); ctx.lineTo(s, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * .12, s * .7); ctx.bezierCurveTo(s * .12, s * .25, s * .25, s * .12, s * .7, s * .12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * .2, s * .2); ctx.quadraticCurveTo(s * .45, s * .22, s * .38, s * .38); ctx.quadraticCurveTo(s * .22, s * .45, s * .2, s * .2); ctx.fill();
    ctx.restore();
  }
  const paperMap = surface(1024, 1320, (ctx, w, h) => {
    ctx.fillStyle = '#e8d3a8'; ctx.fillRect(0, 0, w, h);
    fbm(ctx, w, h, 142, { from: 2, to: 7, alpha: .22, mode: 'soft-light' });
    const random = rng(9);
    ctx.strokeStyle = 'rgba(138,106,68,.13)'; ctx.lineWidth = 1;
    for (let i = 0; i < 500; i++) { const x = random() * w, y = random() * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + random() * 8, y + random() * 8, x + random() * 14 - 7, y + random() * 14 - 7); ctx.stroke(); }
    for (let i = 0; i < 30; i++) { const x = random() * w, y = random() * h, r = 1 + random() * 4; ctx.fillStyle = 'rgba(150,100,50,.2)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
    ctx.strokeStyle = 'rgba(138,90,42,.1)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(w * .78, h * .86, 70, .3, 5.6); ctx.stroke();
    const edge = ctx.createRadialGradient(w * .5, h * .5, w * .3, w * .5, h * .5, h * .66);
    edge.addColorStop(0, 'rgba(122,82,42,0)'); edge.addColorStop(.75, 'rgba(122,82,42,.12)'); edge.addColorStop(1, 'rgba(90,54,24,.45)');
    ctx.fillStyle = edge; ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 10, 143);
    ctx.strokeStyle = 'rgba(110,77,51,.6)'; ctx.lineWidth = 2.2; ctx.strokeRect(46, 46, w - 92, h - 92);
    ctx.lineWidth = .9; ctx.strokeRect(56, 56, w - 112, h - 112);
    for (const [x, y, sx, sy] of [[60, 60, 1, 1], [w - 60, 60, -1, 1], [60, h - 60, 1, -1], [w - 60, h - 60, -1, -1]]) filigree(ctx, x, y, sx, sy, 90, 'rgba(110,77,48,.7)', 1.8);
  });
  const cutMap = surface(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#cdb184'; ctx.fillRect(0, 0, w, h);
    for (let y = 1; y < h; y += 2) { ctx.fillStyle = y % 4 === 1 ? 'rgba(96,66,40,.35)' : 'rgba(255,240,205,.35)'; ctx.fillRect(0, y, w, 1); }
    fbm(ctx, w, h, 26, { from: 2, to: 5, alpha: .35, mode: 'multiply' });
  });
  const paper = new THREE.MeshStandardMaterial({ map: paperMap, roughness: .96 });
  const cut = new THREE.MeshStandardMaterial({ map: cutMap, roughness: .92 });

  function roundBox(parent, w, h, depth, material, x, y, z, radius = .03) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, depth, 3, radius), material);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  function box(parent, w, h, depth, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), material);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  const rivetGeometry = new THREE.SphereGeometry(.034, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  function rivet(parent, x, y, z, up = 1, scale = 1) {
    const m = new THREE.Mesh(rivetGeometry, rivetBrass); m.rotation.x = up > 0 ? Math.PI / 2 : -Math.PI / 2; m.position.set(x, y, z); m.scale.setScalar(scale); parent.add(m); return m;
  }

  // Contact shadow so the book lies on the table.
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: surface(128, 128, (ctx, w, h) => { const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); g.addColorStop(0, '#000e'); g.addColorStop(.55, '#0009'); g.addColorStop(1, '#0000'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }),
    transparent: true, depthWrite: false,
  }));
  shadow.position.set(1.45, -.25, floor - .005);
  scene.add(shadow);

  // Spine with four raised, rounded bands.
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(.294, .294, height, 48, 1, false, Math.PI, Math.PI), leather);
  spine.position.set(-.008, 0, -.005);
  book.add(spine);
  const bandGeometry = new THREE.TorusGeometry(.297, .032, 10, 40, Math.PI);
  bandGeometry.rotateZ(Math.PI / 2); bandGeometry.rotateX(Math.PI / 2);
  const bands = [-1.55, -.62, .62, 1.55].map(y => { const b = new THREE.Mesh(bandGeometry, leather); b.position.set(-.008, y, -.005); book.add(b); return b; });

  // Covers: rounded leather boards; hammered brass corners with rivets on the fore edge (outside and inside).
  const front = new THREE.Group(), back = new THREE.Group();
  book.add(front, back);
  roundBox(front, width, height, .09, [leather, leather, leather, leather, face, inside], width / 2, 0, .27, .035);
  roundBox(back, width, height, .09, [leather, leather, leather, leather, inside, backFace], width / 2, 0, -.27, .035);
  const cornerShape = new THREE.Shape();
  cornerShape.moveTo(0, 0); cornerShape.lineTo(.62, 0); cornerShape.lineTo(.62, .1); cornerShape.quadraticCurveTo(.6, .15, .52, .16);
  cornerShape.bezierCurveTo(.3, .18, .18, .3, .16, .52); cornerShape.quadraticCurveTo(.15, .6, .1, .62); cornerShape.lineTo(0, .62); cornerShape.closePath();
  const cornerGeometry = new THREE.ExtrudeGeometry(cornerShape, { depth: .014, bevelEnabled: true, bevelThickness: .01, bevelSize: .014, bevelSegments: 3, curveSegments: 18 });
  { const uv = cornerGeometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.4, uv.getY(i) * 1.4); }
  function corners(group, zFace, outward) {
    for (const [x, y, sy] of [[width + .012, height / 2 + .012, -1], [width + .012, -height / 2 - .012, 1]]) {
      const c = new THREE.Mesh(cornerGeometry, brass);
      c.position.set(x, y, zFace); c.scale.set(-1, sy, outward); group.add(c);
      for (const [rx, ry] of [[.08, .48], [.08, .08], [.48, .08]]) rivet(group, x - rx, y + sy * ry, zFace + outward * .026, outward, 1);
    }
  }
  corners(front, .315, 1); corners(front, .225, -1); corners(back, -.225, 1); corners(back, -.315, -1);

  // Wrap strap (shut book): band across the cover and spine, D-ring buckle, keeper, pointed end with rivet.
  const strapY = 0, strapH = .44;
  const coverBand = roundBox(front, width + .05, strapH, .03, strapLeather, (width + .05) / 2 - .02, strapY, .332, .012);
  const spineBand = new THREE.Mesh(new THREE.CylinderGeometry(.326, .326, strapH, 40, 1, true, Math.PI, Math.PI), strapLeather);
  spineBand.position.set(-.008, strapY, -.005); book.add(spineBand);
  const edgeBand = box(book, .03, strapH, .69, strapPlain, width + .028, strapY, 0);
  const buckleX = width - 1.0;
  const ringGeometry = new THREE.TorusGeometry(.17, .028, 12, 36, Math.PI); ringGeometry.rotateZ(Math.PI / 2);
  const ring = new THREE.Mesh(ringGeometry, rivetBrass); ring.position.set(buckleX, strapY, .372); front.add(ring);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.024, .024, .36, 14), rivetBrass); bar.position.set(buckleX, strapY, .372); front.add(bar);
  const prong = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .2, 10), rivetBrass); prong.rotation.z = Math.PI / 2; prong.position.set(buckleX - .08, strapY, .38); front.add(prong);
  const tipShape = new THREE.Shape();
  tipShape.moveTo(0, -.17); tipShape.lineTo(.46, -.17); tipShape.quadraticCurveTo(.62, -.04, .66, 0); tipShape.quadraticCurveTo(.62, .04, .46, .17); tipShape.lineTo(0, .17); tipShape.closePath();
  const tipGeometry = new THREE.ExtrudeGeometry(tipShape, { depth: .02, bevelEnabled: true, bevelThickness: .008, bevelSize: .01, bevelSegments: 2 });
  { const uv = tipGeometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * .9, uv.getY(i) * .9 + .5); }
  const tip = new THREE.Mesh(tipGeometry, strapPlain); tip.position.set(buckleX + .04, strapY, .348); front.add(tip);
  roundBox(front, .19, .54, .07, strapLeather, buckleX + .3, strapY, .356, .025);
  const tipRivet = rivet(front, buckleX + .52, strapY, .378, 1, 1.25);
  const closedAnchors = [new THREE.Vector3(buckleX, strapY, .38), new THREE.Vector3(buckleX + .52, strapY, .38)];

  // Loosened strap (open book): lies beside the left cover with three engraved conchos.
  const loose = new THREE.Group(); book.add(loose);
  const looseLength = 1.24;
  roundBox(loose, looseLength + .1, .56, .032, strapLeather, -width - looseLength / 2 + .05, strapY, -.296, .014);
  const looseTip = new THREE.Mesh(tipGeometry, strapPlain); looseTip.rotation.z = Math.PI; looseTip.scale.set(.62, 1.62, 1); looseTip.position.set(-width - looseLength, strapY, -.31); loose.add(looseTip);
  rivet(loose, -width - looseLength - .22, strapY, -.27, 1, 1.3);
  const conchoGeometry = new THREE.CylinderGeometry(.158, .168, .05, 56); conchoGeometry.rotateX(Math.PI / 2);
  const conchoRimGeometry = new THREE.TorusGeometry(.16, .014, 10, 56);
  const conchoX = [.23, .61, .99].map(d => -width - d);
  const conchoMaterials = ['enlarge', 'clasp', 'satchel'].map(name => new THREE.MeshStandardMaterial({ map: faces[name], roughness: .36, metalness: .88, bumpMap: brassBump, bumpScale: .5 }));
  const conchos = conchoX.map((x, i) => {
    const m = new THREE.Mesh(conchoGeometry, [brass, conchoMaterials[i], brass]); m.position.set(x, strapY, -.256); loose.add(m);
    const r = new THREE.Mesh(conchoRimGeometry, rivetBrass); r.position.set(x, strapY, -.232); loose.add(r);
    return m;
  });
  function setSizeIcon(name) { conchoMaterials[0].map = faces[name === 'shrink' ? 'shrink' : 'enlarge']; conchoMaterials[0].needsUpdate = true; draw(); }

  // Page blocks with aged edges, fold and gutter shadow.
  const blockMaterial = [cut, cut, cut, cut, paper, paper];
  const leftBlock = box(book, paperWidth, paperHeight, 1, blockMaterial, -hinge - paperWidth / 2, 0, 0);
  const rightBlock = box(book, paperWidth, paperHeight, 1, blockMaterial, hinge + paperWidth / 2, 0, 0);
  const fold = new THREE.Mesh(new THREE.PlaneGeometry(.58, paperHeight, 24), paper);
  book.add(fold);
  const gutter = new THREE.Mesh(fold.geometry, new THREE.MeshBasicMaterial({
    map: surface(128, 4, (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#62412000'); g.addColorStop(.5, '#4d2b13d0'); g.addColorStop(1, '#62412000'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }),
    transparent: true, depthWrite: false,
  }));
  book.add(gutter);

  // Register tabs: stitched, burnished leather in muted dyes; symbol and name are a sharp HTML layer on top.
  const tabs = tabDefs.map((def, i) => {
    const rgb = def.color.match(/\w\w/g).map(v => parseInt(v, 16));
    const map = surface(256, 240, (ctx, w, h) => {
      ctx.fillStyle = `rgb(${rgb.join(',')})`; ctx.fillRect(0, 0, w, h);
      fbm(ctx, w, h, 100 + i, { from: 1, to: 4, alpha: .18, mode: 'overlay' });
      grain(ctx, w, h, 6, 120 + i);
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,240,220,.16)'); g.addColorStop(.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.4)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const e = ctx.createLinearGradient(w - 34, 0, w, 0); e.addColorStop(0, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = e; ctx.fillRect(w - 34, 0, 34, h);
      stitchRect(ctx, false, 76, 14, w - 92, h - 28, 14, 7, 2.6);
    });
    const bump = surface(256, 240, (ctx, w, h) => { paintGrainBump(ctx, w, h, 130 + i, .5); stitchRect(ctx, true, 76, 14, w - 92, h - 28, 14, 7, 2.6); }, false);
    const material = new THREE.MeshStandardMaterial({ map, roughness: .74, bumpMap: bump, bumpScale: .8 });
    const tab = roundBox(book, .69, .64, .045, [leather, leather, leather, leather, material, leather], 3.43, 1.45 - i * .74, 0, .025);
    return { tab, material };
  });

  // Turning leaf with separate front and back prints.
  const leafGeometry = new THREE.PlaneGeometry(paperWidth, paperHeight, 32, 12);
  const position = leafGeometry.attributes.position;
  const base = new Float32Array(position.array);
  const leafFront = new THREE.MeshStandardMaterial({ map: paperMap, side: THREE.FrontSide, roughness: .96 });
  const leafBack = new THREE.MeshStandardMaterial({ map: paperMap, side: THREE.BackSide, roughness: .96 });
  const leaf = new THREE.Group();
  leaf.add(new THREE.Mesh(leafGeometry, leafFront), new THREE.Mesh(leafGeometry, leafBack));
  leaf.children.forEach(mesh => { mesh.frustumCulled = false; });
  book.add(leaf);
  function movingPrint({ title, body }) {
    return surface(512, 660, (ctx, w, h) => {
      ctx.drawImage(paperMap.image, 0, 0, w, h);
      ctx.fillStyle = INK; ctx.font = '600 30px "Palatino Linotype", Palatino, Georgia, serif'; ctx.textAlign = 'center';
      ctx.fillText(title, w / 2, 120, w - 120);
      ctx.fillStyle = 'rgba(122,85,48,.8)'; ctx.fillRect(110, 140, w - 220, 1.5);
      ctx.font = 'italic 22px "Palatino Linotype", Palatino, Georgia, serif'; ctx.fillStyle = '#5d4630'; ctx.fillText(body, w / 2, 180, w - 120);
    });
  }
  function printTurn(first, second) {
    if (leafFront.map !== paperMap) leafFront.map.dispose();
    if (leafBack.map !== paperMap) leafBack.map.dispose();
    leafFront.map = movingPrint(first);
    leafBack.map = movingPrint(second);
    leafBack.map.repeat.x = -1;
    leafBack.map.offset.x = 1;
  }

  // Shaders compile in parallel before the first picture, so the running table never stalls (D3D compiles are slow).
  let compiled = false;
  for (const object of [leaf, leftBlock, fold, gutter, loose, spineBand, edgeBand, ...tabs.map(t => t.tab)]) object.visible = true;
  const ready = (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve(renderer.compile(scene, camera)))
    .catch(() => undefined).then(() => { compiled = true; draw(); });

  function point(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return [(v.x + 1) * size.width / 2, (1 - v.y) * size.height / 2];
  }
  const pxPerUnit = () => size.width / (camera.right - camera.left);
  function square(x, y, z, side, min = 0, max = Infinity) {
    const c = point(x, y, z), s = Math.min(max, Math.max(min, side * pxPerUnit()));
    return { left: c[0] - s / 2, top: c[1] - s / 2, width: s, height: s };
  }
  function rect(x, y, z, w, h) {
    const a = point(x, y, z), b = point(x + w, y - h, z);
    return { left: a[0], top: a[1], width: b[0] - a[0], height: b[1] - a[1] };
  }
  function draw(next = frame) {
    frame = next;
    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return;
    const { open, index, total, turn } = frame;
    const ratio = total > 1 ? index / (total - 1) : 0;
    const leftDepth = .075 + .31 * ratio, rightDepth = .075 + .31 * (1 - ratio);
    const baseZ = -.224, leftTop = baseZ + leftDepth, rightTop = baseZ + rightDepth;
    front.rotation.y = -Math.PI * open;
    back.rotation.y = -.07 * Math.sin(open * Math.PI);
    spine.scale.z = 1 - .79 * open;
    spine.position.z = -.005 - .217 * open;
    for (const b of [...bands, spineBand]) { b.scale.z = spine.scale.z; b.position.z = spine.position.z; }
    // The wrap strap is buckled while shut and lies loosened beside the book while open.
    spineBand.visible = edgeBand.visible = open < .04;
    coverBand.visible = true;
    loose.visible = open > .82;
    loose.position.x = -(1 - Math.min(1, (open - .82) / .18)) * .25;
    leftBlock.visible = open > .54;
    leftBlock.scale.z = leftDepth; leftBlock.position.z = baseZ + leftDepth / 2;
    rightBlock.scale.z = rightDepth; rightBlock.position.z = baseZ + rightDepth / 2;
    fold.visible = gutter.visible = open > .87;
    gutter.position.z = .003;
    if (fold.visible) {
      const vertices = fold.geometry.attributes.position, seam = Math.min(leftTop, rightTop) - .047;
      for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i), outer = x < 0 ? leftTop : rightTop, crease = Math.min(1, Math.abs(x) / .19);
        vertices.setZ(i, seam + (outer - seam) * Math.sin(crease * Math.PI / 2) + .003);
      }
      vertices.needsUpdate = true; fold.geometry.computeVertexNormals();
    }
    tabs.forEach(({ tab, material }, i) => {
      tab.visible = open > .6; tab.position.x = 3.43; tab.position.z = rightTop - .014 - i * .005;
      material.emissive.setRGB(frame.activeTab === i ? .1 : 0, frame.activeTab === i ? .07 : 0, frame.activeTab === i ? .03 : 0);
    });
    shadow.position.x = 1.4 - 1.5 * open;
    shadow.scale.set(4.75 + 4.6 * open, 5.48, 1);
    leaf.visible = Boolean(turn);
    if (turn) {
      const { progress, forward } = turn, arc = Math.sin(Math.PI * progress), phase = Math.PI * (forward ? progress : 1 - progress);
      const sourceZ = forward ? rightTop : leftTop, endZ = forward ? leftTop : rightTop;
      for (let i = 0; i < position.count; i++) {
        const x = base[i * 3] + paperWidth / 2, y = base[i * 3 + 1], u = x / paperWidth;
        const curl = phase - .54 * u * arc + .12 * y / paperHeight * arc;
        position.setXYZ(i, Math.cos(curl) * (x + hinge), y + .10 * arc * u, sourceZ + (endZ - sourceZ) * progress + .025 + Math.sin(curl) * x + .18 * arc * (1 - u));
      }
      position.needsUpdate = true; leafGeometry.computeVertexNormals();
    }
    // Shut: the cover lies slightly turned on the table. Open: strap, spread and tabs framed together.
    const units = Math.min(size.width / (4.45 + 4.3 * open), size.height / (5.0 - .08 * open));
    camera.left = -size.width / (2 * units); camera.right = -camera.left;
    camera.top = size.height / (2 * units); camera.bottom = -camera.top;
    const center = 1.74 - 2.24 * open;
    camera.position.set(center + .92 * (1 - open), -.63 - 2.43 * (1 - open) - .3 * open, 9.6);
    camera.lookAt(center, -.3 * open, 0);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(); book.updateMatrixWorld(true);
    if (compiled) renderer.render(scene, camera);
    const toWorld = (v, group) => v.clone().applyMatrix4(group.matrixWorld);
    onLayout({
      cover: rect(-.22, 2.12, .29, 3.65, 4.24),
      left: rect(-2.84, 1.66, leftTop, 2.43, 3.3),
      right: rect(.38, 1.66, rightTop, 2.47, 3.3),
      previous: square(-hinge - paperWidth + .17, -paperHeight / 2 + .17, leftTop, .34),
      next: square(hinge + paperWidth - .17, -paperHeight / 2 + .17, rightTop, .34),
      folioLeft: rect(-2.84, -1.66, leftTop, 2.43, .26),
      folioRight: rect(.38, -1.66, rightTop, 2.47, .26),
      tabs: tabs.map(({ tab }) => rect(3.19, tab.position.y + .3, tab.position.z, .57, .6)),
      tools: conchos.map(c => { const v = toWorld(new THREE.Vector3(), c); return square(v.x, v.y, v.z, .36, 32, 72); }),
      closedTools: [square(...toWorld(closedAnchors[0], front).toArray(), .46, 34, 90), square(...toWorld(closedAnchors[1], front).toArray(), .3, 28, 60)],
      edgeLeft: rect(-3.0, -paperHeight / 2 + .04, leftTop, 2.6, .02),
      edgeRight: rect(.4, -paperHeight / 2 + .04, rightTop, 2.6, .02),
      unit: pxPerUnit(),
    });
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    size = { width: w, height: h };
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    draw();
  }
  function dispose() {
    const textures = new Set();
    scene.traverse(object => {
      object.geometry?.dispose?.();
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      for (const material of materials) { for (const t of [material.map, material.bumpMap]) if (t) textures.add(t); material.dispose?.(); }
    });
    for (const t of [...textures, ...Object.values(faces)]) t.dispose();
    environment.dispose(); pmrem.dispose(); renderer.dispose(); renderer.forceContextLoss?.();
  }
  void tipRivet;
  return { draw, resize, printTurn, dispose, ready, setSizeIcon };
}

/** The table loads this module on demand, so Three.js only arrives when a player takes the book out. */
export function createJournalBook(canvas, onLayout, options) {
  return createBook(canvas, onLayout, options);
}
