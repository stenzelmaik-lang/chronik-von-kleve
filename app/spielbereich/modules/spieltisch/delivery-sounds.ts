"use client";
/**
 * Built-in arrival sounds of personal messages, synthesised with Web Audio: no audio files, no licences, a few kB of code.
 * Fax: calling tone, answer tone, the V.21 warble of the handshake, the training hiss, then the printer feeding the page.
 * Letter: paper sliding in, a few crinkles, a soft landing. Both are short and moderately loud; they never loop.
 */
type Ctx = AudioContext;
let shared: Ctx | null = null;
let noise: AudioBuffer | null = null;

function context(): Ctx | null {
  if (typeof window === 'undefined') return null;
  const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  shared ??= new C();
  return shared;
}
function noiseBuffer(c: Ctx) {
  if (noise && noise.sampleRate === c.sampleRate) return noise;
  noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}
/** A gain envelope: silent, quick rise to `peak`, hold, fall. Avoids clicks at both ends. */
function envelope(c: Ctx, out: AudioNode, at: number, length: number, peak: number, rise = 0.01, fall = 0.03) {
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + rise);
  g.gain.setValueAtTime(peak, Math.max(at + rise, at + length - fall));
  g.gain.linearRampToValueAtTime(0, at + length);
  g.connect(out);
  return g;
}
function tone(c: Ctx, out: AudioNode, freq: number, at: number, length: number, peak: number, type: OscillatorType = 'sine') {
  const o = c.createOscillator();
  o.type = type; o.frequency.setValueAtTime(freq, at);
  o.connect(envelope(c, out, at, length, peak));
  o.start(at); o.stop(at + length + 0.02);
  return o;
}
function hiss(c: Ctx, out: AudioNode, at: number, length: number, peak: number, filter: BiquadFilterType, freq: number, q = 1, rise = 0.01, fall = 0.03) {
  const s = c.createBufferSource(); s.buffer = noiseBuffer(c); s.loop = true;
  const f = c.createBiquadFilter(); f.type = filter; f.frequency.setValueAtTime(freq, at); f.Q.value = q;
  s.connect(f); f.connect(envelope(c, out, at, length, peak, rise, fall));
  s.start(at, Math.random()); s.stop(at + length + 0.02);
  return f;
}

function fax(c: Ctx, out: AudioNode, t: number) {
  // the phone line: everything of the handshake sits in the narrow telephone band
  const line = c.createBiquadFilter(); line.type = 'bandpass'; line.frequency.value = 1700; line.Q.value = 0.55; line.connect(out);
  tone(c, line, 1100, t, 0.5, 0.32);                       // CNG: "I am a fax"
  tone(c, line, 2100, t + 0.75, 0.95, 0.28);               // CED: answer tone
  // V.21 handshake: 300 baud frequency shift keying between 1650 and 1850 Hz – the typical warble
  const fsk = c.createOscillator(); fsk.type = 'sine';
  const start = t + 1.85, end = start + 0.75;
  for (let k = start; k < end; k += 1 / 300) fsk.frequency.setValueAtTime(Math.random() < 0.5 ? 1650 : 1850, k);
  fsk.connect(envelope(c, line, start, end - start, 0.26)); fsk.start(start); fsk.stop(end + 0.02);
  // training: the harsh hiss with a buzzing carrier
  hiss(c, line, t + 2.7, 0.75, 0.42, 'bandpass', 1800, 0.9, 0.04, 0.08);
  const carrier = tone(c, line, 1800, t + 2.7, 0.75, 0.07, 'sawtooth');
  carrier.frequency.linearRampToValueAtTime(1500, t + 3.45);
  // printer: stepper ticks in short bursts with pauses (the page feeds in steps), a low motor hum underneath
  const print = t + 3.6;
  tone(c, out, 95, print, 2.3, 0.05, 'triangle');
  for (let burst = 0; burst < 4; burst++) {
    const b = print + burst * 0.58;
    for (let k = 0; k < 7; k++) hiss(c, out, b + k * 0.055, 0.03, 0.16, 'bandpass', 2600 + Math.random() * 900, 2.5, 0.003, 0.02);
  }
  return 6.1;
}

function letter(c: Ctx, out: AudioNode, t: number) {
  // paper slides in: a soft brushing sweep
  const slide = hiss(c, out, t, 0.75, 0.22, 'bandpass', 1300, 0.7, 0.18, 0.3);
  slide.frequency.linearRampToValueAtTime(3200, t + 0.75);
  // crinkles: short, bright, irregular
  for (let k = 0; k < 11; k++) {
    const at = t + 0.35 + Math.random() * 1.0;
    hiss(c, out, at, 0.025 + Math.random() * 0.05, 0.12 + Math.random() * 0.22, 'highpass', 2200 + Math.random() * 2600, 0.8, 0.002, 0.02);
  }
  // it lands on the table
  const land = t + 1.45;
  const thump = tone(c, out, 120, land, 0.16, 0.24);
  thump.frequency.exponentialRampToValueAtTime(55, land + 0.15);
  hiss(c, out, land, 0.12, 0.12, 'lowpass', 900, 0.7, 0.003, 0.08);
  return 1.8;
}

/** Plays the built-in sound once. Resolves false if the browser blocks sound until the player interacts with the page. */
export async function playArrivalSound(kind: 'fax' | 'letter', volume = 0.55): Promise<boolean> {
  const c = context();
  if (!c) return false;
  const running = () => c.state === 'running';
  if (!running()) {
    // without a prior click the browser may keep the context suspended; never wait for that
    await Promise.race([c.resume().catch(() => undefined), new Promise(resolve => setTimeout(resolve, 350))]);
    if (!running()) return false;
  }
  const out = c.createGain(); out.gain.value = volume; out.connect(c.destination);
  const length = (kind === 'fax' ? fax : letter)(c, out, c.currentTime + 0.05);
  setTimeout(() => out.disconnect(), (length + 0.5) * 1000);
  return true;
}
