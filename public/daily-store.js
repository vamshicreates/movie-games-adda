// Browser-side memory for the daily games: results, streaks, stats and the language choice.
// Everything lives in localStorage under one key; if storage is blocked the games still work for the visit.
const KEY = 'mga:v1';
export const MAX = { frame: 6, dialogue: 6, clues: 10 };
export const GAME_EMOJI = { frame: '🎬', dialogue: '💬', clues: '🧩' };
export const GAME_NAME = { frame: 'Frame of the Day', dialogue: 'Dialogue of the Day', clues: 'Clue Tiles' };

function load() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    if (value && typeof value === 'object' && typeof value.games === 'object') return value;
  } catch {}
  return { prefs: {}, games: {} };
}
let data = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}
export const reset = (fresh = { prefs: {}, games: {} }) => { data = fresh; }; // for tests

export const getLang = () => (data.prefs?.lang === 'te' ? 'te' : 'en');
export function setLang(lang) {
  data.prefs = { ...data.prefs, lang: lang === 'te' ? 'te' : 'en' };
  save();
}
export const getRecord = (game, n) => data.games?.[game]?.[n] ?? null;
export function putRecord(game, n, record) {
  data.games[game] = { ...data.games[game], [n]: record };
  save();
}
export const isDone = record => record?.status === 'won' || record?.status === 'lost';

// Streaks only count puzzles solved on their own day ("live"), so the archive cannot inflate them.
export function stats(game, today) {
  const records = data.games?.[game] ?? {};
  const finished = Object.entries(records).filter(([, record]) => isDone(record));
  const max = MAX[game];
  const distribution = Array(max).fill(0);
  let wins = 0;
  for (const [, record] of finished) {
    if (record.status !== 'won') continue;
    wins++;
    const tries = Math.min(max, Math.max(1, record.guesses?.length ?? 1));
    distribution[tries - 1]++;
  }
  const liveWins = new Set(finished.filter(([, record]) => record.status === 'won' && record.live).map(([n]) => Number(n)));
  let current = 0;
  let k = today;
  if (!isDone(records[today])) k--; // today is still open, so yesterday's streak is not broken yet
  while (liveWins.has(k)) { current++; k--; }
  let best = 0;
  let run = 0;
  let previous = -2;
  for (const n of [...liveWins].sort((a, b) => a - b)) {
    run = n === previous + 1 ? run + 1 : 1;
    previous = n;
    best = Math.max(best, run);
  }
  return { played: finished.length, wins, winRate: finished.length ? Math.round((wins / finished.length) * 100) : 0, current, best, distribution };
}

// ----- sharing -----
const tileEmoji = { hit: '🟩', near: '🟨', miss: '⬛' };
export function score(game, record) {
  return record.status === 'won' ? `${record.guesses.length}/${MAX[game]}` : `X/${MAX[game]}`;
}
export function shareGrid(game, record) {
  if (game === 'clues') {
    return record.guesses.map(guess => (guess.tiles ? guess.tiles.map(tile => tileEmoji[tile.state]).join('') : '⬛⬛⬛⬛⬛⬛')).join('\n');
  }
  const max = MAX[game];
  const wrong = record.status === 'won' ? record.guesses.length - 1 : record.guesses.length;
  return Array.from({ length: max }, (_, i) => (i < wrong ? '🟥' : i === wrong && record.status === 'won' ? '🟩' : '⬜')).join('');
}
export function shareText(game, n, record, link) {
  return `${GAME_EMOJI[game]} Movie Games Adda · ${GAME_NAME[game]} #${n} ${score(game, record)}\n${shareGrid(game, record)}\n${link}`;
}
export const challengeLink = (origin, game, n, record) => `${origin}/play/${game}/${n}?s=${record.status === 'won' ? record.guesses.length : 'x'}`;
export function challengeText(game, n, record, link) {
  const line = record.status === 'won' ? `I got ${GAME_NAME[game]} #${n} in ${record.guesses.length}/${MAX[game]}. Can you beat me?` : `${GAME_NAME[game]} #${n} beat me. Can you solve it?`;
  return `${GAME_EMOJI[game]} ${line}\n${link}`;
}
// "?s=3" or "?s=x" from a friend's link, only valid for this game's guess range.
export function friendScore(game, search) {
  const raw = new URLSearchParams(search).get('s');
  if (raw === 'x') return { solved: false };
  const tries = Number(raw);
  return Number.isInteger(tries) && tries >= 1 && tries <= MAX[game] ? { solved: true, tries } : null;
}
