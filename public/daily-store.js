// Browser-side memory for the daily game: results, streaks, stats and the language choice.
// Everything lives in localStorage under one key; if storage is blocked the game still works for the visit.
const KEY = 'mga:v2';
export const QUESTIONS = 7;
export const TRIES = 3;

const blank = () => ({ prefs: {}, days: {} });
function load() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    if (value && typeof value === 'object' && typeof value.days === 'object') return value;
  } catch {}
  return blank();
}
let data = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}
export const reset = (fresh = blank()) => { data = fresh; }; // for tests

export const getLang = () => (data.prefs?.lang === 'te' ? 'te' : 'en');
export function setLang(lang) {
  data.prefs = { ...data.prefs, lang: lang === 'te' ? 'te' : 'en' };
  save();
}

// A day record: { items: [{ status: 'open' | 'won' | 'lost', guesses: [], clues: [], answer? }], live }
export const getDay = n => data.days?.[n] ?? null;
export function putDay(n, record) {
  data.days = { ...data.days, [n]: record };
  save();
}
export const newDay = questions => ({ live: false, mode: null, items: questions.map(question => ({ status: 'open', guesses: [], clues: question.clue ? [question.clue] : [], options: question.options ?? [] })) });
// How the player answers: 'pick' (four films to choose from) or 'type' (type the film name). The last choice is remembered.
export const getMode = () => (data.prefs?.mode === 'pick' || data.prefs?.mode === 'type' ? data.prefs.mode : null);
export function setMode(mode) {
  data.prefs = { ...data.prefs, mode: mode === 'pick' ? 'pick' : 'type' };
  save();
}
// A day started before the choice existed counts as typed; a day with no answers yet still asks.
export const modeOf = record => record.mode ?? (answered(record) > 0 ? 'type' : null);
export const isFinished = record => Boolean(record) && record.items.every(item => item.status !== 'open');
export const answered = record => record.items.filter(item => item.status !== 'open').length;
export const scoreOf = record => record.items.filter(item => item.status === 'won').length;
// first = solved with the first guess, later = solved after a miss, miss = out of guesses
export const grade = item => (item.status === 'won' ? (item.guesses.length === 1 ? 'first' : 'later') : item.status === 'lost' ? 'miss' : 'open');

// Streaks only count days finished on their own day ("live"), so the archive cannot inflate them.
export function stats(today) {
  const finished = Object.entries(data.days ?? {}).filter(([, record]) => isFinished(record));
  const distribution = Array(QUESTIONS + 1).fill(0);
  let total = 0;
  let best = 0;
  for (const [, record] of finished) {
    const score = scoreOf(record);
    distribution[score]++;
    total += score;
    best = Math.max(best, score);
  }
  const live = new Set(finished.filter(([, record]) => record.live).map(([n]) => Number(n)));
  let current = 0;
  let k = today;
  if (!live.has(today)) k--; // today is still open, so yesterday's streak is not broken yet
  while (live.has(k)) { current++; k--; }
  let longest = 0;
  let run = 0;
  let previous = -2;
  for (const n of [...live].sort((a, b) => a - b)) {
    run = n === previous + 1 ? run + 1 : 1;
    previous = n;
    longest = Math.max(longest, run);
  }
  return { played: finished.length, average: finished.length ? Math.round((total / finished.length) * 10) / 10 : 0, best, current, longest, distribution };
}

// ----- sharing -----
const squares = { first: '🟩', later: '🟨', miss: '🟥', open: '⬜' };
export const score = record => `${scoreOf(record)}/${QUESTIONS}`;
export function shareGrid(record) {
  const row = items => items.map(item => squares[grade(item)]).join('');
  return `${row(record.items.slice(0, 4))}\n${row(record.items.slice(4))}`;
}
export const shareText = (n, record, link) => `🎬 Movie Games Daily #${n} ${score(record)}${modeOf(record) === 'type' ? ' ⌨️' : ''}\n${shareGrid(record)}\n${link}`;
export const challengeLink = (origin, n, record) => `${origin}/play/${n}?s=${scoreOf(record)}`;
export const challengeText = (n, record, link) => `🎬 I scored ${score(record)} on Daily Telugu movie quiz #${n}. Can you beat me?\n${link}`;
// "?s=7" from a friend's link, only valid between 0 and the number of questions.
export function friendScore(search) {
  const raw = new URLSearchParams(search).get('s');
  if (raw === null || !/^\d{1,2}$/.test(raw)) return null;
  const value = Number(raw);
  return value >= 0 && value <= QUESTIONS ? value : null;
}
