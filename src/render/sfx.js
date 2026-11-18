// Tiny WebAudio sound effects. No audio files needed.
let ctx = null;
let muted = false;

export const isMuted = () => muted;
export function setMuted(v) { muted = v; }

function audio() {
  if (!ctx) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq = 440, to = freq, dur = 0.15, type = 'square', vol = 0.12, delay = 0 }) {
  const ac = audio();
  if (!ac || muted) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur = 0.3, vol = 0.2) {
  const ac = audio();
  if (!ac || muted) return;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  gain.gain.value = vol;
  src.buffer = buf;
  src.connect(gain).connect(ac.destination);
  src.start();
}

export const sfx = {
  click: () => tone({ freq: 660, to: 880, dur: 0.06, vol: 0.06 }),
  step: () => tone({ freq: 140, to: 90, dur: 0.05, type: 'triangle', vol: 0.06 }),
  laser: () => tone({ freq: 1400, to: 300, dur: 0.18, type: 'sawtooth', vol: 0.06 }),
  shoot: () => tone({ freq: 300, to: 80, dur: 0.2, vol: 0.1 }),
  punch: () => { tone({ freq: 160, to: 60, dur: 0.12, vol: 0.15 }); noise(0.08, 0.15); },
  hit: () => noise(0.12, 0.12),
  boom: () => { noise(0.5, 0.25); tone({ freq: 120, to: 30, dur: 0.5, type: 'sine', vol: 0.25 }); },
  heal: () => [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'sine', vol: 0.08, delay: i * 0.08 })),
  merge: () => [262, 330, 392, 523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.18, type: 'square', vol: 0.07, delay: i * 0.08 })),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.25, type: 'triangle', vol: 0.1, delay: i * 0.15 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.1, delay: i * 0.2 })),
  guard: () => tone({ freq: 500, to: 700, dur: 0.15, type: 'sine', vol: 0.08 }),
};
