// Quiz sounds: countdown ticks, time's up, and the cheer / "better luck" reactions.
const names = ['appear', 'tick', 'tick-hi', 'timesup', 'win', 'lose'];
const KEY = 'mga-muted';
const clips = {};
let muted = false;
try { muted = localStorage.getItem(KEY) === '1'; } catch { /* storage unavailable */ }

const load = name => clips[name] ??= Object.assign(new Audio(`/sounds/${name}.mp3`), { preload: 'auto' });
names.forEach(load);

// Browsers only let audio start after a tap, so warm every clip on the first one.
let unlocked = false;
const unlock = () => {
  if (unlocked) return;
  unlocked = true;
  names.forEach(name => {
    const clip = load(name);
    clip.muted = true;
    clip.play().then(() => { clip.pause(); clip.currentTime = 0; clip.muted = false; }).catch(() => { clip.muted = false; });
  });
};
['pointerdown', 'keydown'].forEach(type => window.addEventListener(type, unlock, { once: true, capture: true }));

export const isMuted = () => muted;
export function setMuted(value) {
  muted = value;
  try { localStorage.setItem(KEY, value ? '1' : '0'); } catch { /* storage unavailable */ }
  if (muted) stop();
}
export function play(name) {
  if (muted) return;
  const clip = load(name);
  clip.currentTime = 0;
  clip.play().catch(() => {});
}
export function stop(list = names) {
  list.forEach(name => { const clip = load(name); clip.pause(); clip.currentTime = 0; });
}
// Reaction to a self-scored answer. Returns how long to hold before the next photo (0 when muted).
export function react(correct) {
  if (muted) return 0;
  stop();
  play(correct ? 'win' : 'lose');
  return correct ? 1500 : 2000;
}
// One tick per second; the last two seconds sound higher, and zero is the chime.
export const tick = left => play(left <= 0 ? 'timesup' : left <= 2 ? 'tick-hi' : 'tick');
