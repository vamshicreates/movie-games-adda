// Quiz sounds, played with the Web Audio API so each tick lands on the frame the number changes.
const files = {
  appear: 'appear.wav', tick: 'tick.wav', 'tick-hi': 'tick-hi.wav', timesup: 'timesup.wav', win: 'win.mp3', lose: 'lose.mp3',
};
const KEY = 'mga-muted';
let muted = false;
try { muted = localStorage.getItem(KEY) === '1'; } catch { /* storage unavailable */ }

const AudioCtx = window.AudioContext ?? window.webkitAudioContext;
let ctx = null;
const buffers = {};
const playing = new Set();

// Browsers only start audio after a tap, so the context is created and loaded on the first one.
function start() {
  if (!AudioCtx) return null;
  if (!ctx) {
    ctx = new AudioCtx();
    Object.entries(files).forEach(async ([name, file]) => {
      try {
        const response = await fetch(`/sounds/${file}`);
        buffers[name] = await ctx.decodeAudioData(await response.arrayBuffer());
      } catch { /* a missing clip is skipped */ }
    });
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
['pointerdown', 'keydown', 'touchend'].forEach(type => window.addEventListener(type, start, { capture: true, passive: true }));

export const isMuted = () => muted;
export function setMuted(value) {
  muted = value;
  try { localStorage.setItem(KEY, value ? '1' : '0'); } catch { /* storage unavailable */ }
  if (muted) stop();
}

// Plays a clip now. Resolves when it has finished playing (immediately if it cannot play).
export function play(name) {
  const audio = muted ? null : start();
  const buffer = buffers[name];
  if (!audio || !buffer) return Promise.resolve();
  return new Promise(resolve => {
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    source.onended = () => { playing.delete(source); resolve(); };
    source.name = name;
    playing.add(source);
    source.start();
  });
}
export function stop(list) {
  playing.forEach(source => {
    if (list && !list.includes(source.name)) return;
    try { source.stop(); } catch { /* already stopped */ }
  });
}
// Reaction to a self-scored answer: resolves once the whole line has been heard.
export const react = correct => {
  stop();
  return play(correct ? 'win' : 'lose');
};
// One tick per number shown, 5 down to 1, a higher pitch for the last two, and a chime at zero.
export const tick = left => play(left <= 0 ? 'timesup' : left <= 2 ? 'tick-hi' : 'tick');
