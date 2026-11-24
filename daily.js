// Daily puzzles for Movie Games Daily.
// Stateless on purpose: the puzzle for a day is a pure function of the IST date, so every visitor gets the
// same film and nothing has to live on the server (the Vercel deploy re-seeds its database on every cold start).
import { createHash, createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dailyFilms } from './daily-data.js';
import { guessIsCorrect } from './names.js';

const root = dirname(fileURLToPath(import.meta.url));
const mediaDir = resolve(root, 'public/media/daily');

export const EPOCH = '2026-10-16'; // puzzle #1
export const ARCHIVE_DAYS = 30;
export const QUESTIONS = 7; // one daily game: seven questions, alternating frame and dialogue (four frames, three dialogues)
export const TRIES = 3; // typed guesses per question
export const typeOf = q => (q % 2 === 1 ? 'frame' : 'dialogue');

const DAY = 86_400_000;
const IST_OFFSET = 330 * 60_000;
const SECRET = process.env.DAILY_SECRET ?? 'mga-daily-answer-images';

export const films = [...dailyFilms].sort((a, b) => (a.id < b.id ? -1 : 1));
const byId = new Map(films.map(film => [film.id, film]));

// ----- dates and numbering -----
export const istDate = (now = Date.now()) => new Date(now + IST_OFFSET).toISOString().slice(0, 10);
const dayIndex = date => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY);
export const todayNumber = (now = Date.now()) => Math.max(1, dayIndex(istDate(now)) - dayIndex(EPOCH) + 1);
export const dateOf = n => new Date((dayIndex(EPOCH) + n - 1) * DAY).toISOString().slice(0, 10);
export const firstArchive = (now = Date.now()) => Math.max(1, todayNumber(now) - ARCHIVE_DAYS + 1);

// ----- which film on which day -----
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function permutation(size) {
  const random = mulberry32(0x4d47_4144);
  const order = Array.from({ length: size }, (_, i) => i);
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
const order = permutation(films.length);
// Seven consecutive films from the shuffled list per day, so a day never repeats a film (the list has 95).
export function filmFor(n, q) {
  return films[order[((n - 1) * QUESTIONS + (q - 1)) % films.length]];
}

// ----- clues -----
const initials = name => name.split(/[\s.]+/).filter(Boolean).map(word => `${word[0].toUpperCase()}.`).join(' ');
const hintList = film => [
  { label: 'Genre', value: film.genres.join(' · ') },
  { label: 'Released in', value: String(film.year) },
  { label: 'Director initials', value: initials(film.director) },
  { label: 'Hero initials', value: initials(film.hero) },
  { label: 'Music director initials', value: initials(film.music) },
];
// Dialogue lines that say the film's own name would give the answer away, so the dialogue game skips them.
const squash = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
export function safeLines(film) {
  const names = [film.title, ...film.aliases].map(squash).filter(name => name.length >= 4);
  const safe = film.lines.filter(line => !names.some(name => squash(line).includes(name)));
  return safe.length ? safe : film.lines.slice(0, 1);
}
const frameSrc = (n, q, i) => `/api/daily/frame?n=${n}&q=${q}&i=${i}`;
const imageKey = (n, q) => createHmac('sha256', SECRET).update(`${n}:${q}`).digest('hex').slice(0, 16);

// The clue shown after `stage` wrong guesses (stage 0 is the opening clue).
export function clueAt(n, q, stage) {
  const film = filmFor(n, q);
  if (typeOf(q) === 'frame') {
    const frames = film.frames.length;
    if (stage < frames) return { type: 'frame', src: frameSrc(n, q, stage), label: `Frame ${stage + 1}` };
    const hint = hintList(film)[stage - frames];
    return hint && { type: 'hint', ...hint };
  }
  const lines = safeLines(film);
  if (stage < lines.length) return { type: 'line', text: lines[stage], label: stage ? 'Another line' : 'The dialogue' };
  const hint = hintList(film)[stage - lines.length];
  return hint && { type: 'hint', ...hint };
}
export const openingClue = (n, q) => clueAt(n, q, 0);

// Four film choices for the "pick the answer" mode: the right film plus three similar ones (same genre, language
// or era), chosen and ordered by a hash of the day and question so everyone sees the same four in the same order.
const hashOf = text => {
  let h = 2166136261;
  for (const ch of text) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
export function optionsFor(n, q) {
  const secret = filmFor(n, q);
  const closeness = film => (film.genres.some(genre => secret.genres.includes(genre)) ? 2 : 0) + (film.lang === secret.lang ? 1 : 0) + (Math.abs(film.year - secret.year) <= 6 ? 1 : 0);
  const similar = films.filter(film => film.id !== secret.id)
    .map(film => ({ film, close: closeness(film), key: hashOf(`${n}:${q}:${film.id}`) }))
    .sort((a, b) => b.close - a.close || a.key - b.key).slice(0, 8)
    .sort((a, b) => a.key - b.key).slice(0, 3).map(item => item.film);
  return [secret, ...similar].map(film => ({ film, key: hashOf(`${n}:${q}:order:${film.id}`) })).sort((a, b) => a.key - b.key).map(item => item.film.id);
}

// ----- turning typed text into a film -----
const plain = value => value.normalize('NFKC').toLowerCase().replace(/[\s‌‍]+/g, ' ').trim();
const letters = value => plain(value).replace(/[^\p{L}\p{N}\p{M}]/gu, '');
const everyTitle = films.map(film => film.title);
const extraNames = Object.fromEntries(films.map(film => [film.title, film.aliases]));
const spellings = films.map(film => ({ film, forms: [film.title, film.te, ...film.aliases].filter(Boolean).map(letters) }));

export function matchFilm(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 120) return null;
  const typed = letters(text);
  if (!typed) return null;
  const exact = spellings.find(item => item.forms.includes(typed));
  if (exact) return exact.film;
  // Sound-alike matching reuses the name matcher the other games use, judged against every film in the list.
  return films.find(film => guessIsCorrect(text, film.title, everyTitle, extraNames)) ?? null;
}
export const filmById = id => byId.get(id);

export function answerFor(n, q) {
  const film = filmFor(n, q);
  return { id: film.id, title: film.title, te: film.te, year: film.year, hero: film.hero, director: film.director, music: film.music,
    genres: film.genres, lang: film.lang, image: `${frameSrc(n, q, 0)}&k=${imageKey(n, q)}` };
}

// ----- HTTP -----
export function createDaily({ db, readJson, RequestError, json }) {
  const fail = (status, message) => { throw new RequestError(status, message); };
  db.exec(`CREATE TABLE IF NOT EXISTS film_suggestions (
    id INTEGER PRIMARY KEY, created INTEGER NOT NULL, title TEXT NOT NULL, note TEXT NOT NULL, who TEXT NOT NULL)`);
  const recent = new Map();

  function window(now) {
    return { today: todayNumber(now), from: firstArchive(now) };
  }
  function dayParam(url, now) {
    const { today, from } = window(now);
    const raw = url.searchParams.get('n');
    const n = raw === null ? today : Number(raw);
    if (!Number.isInteger(n) || n < 1) fail(400, 'That puzzle number is not valid.');
    if (n > today) fail(404, 'That puzzle is not out yet.');
    if (n < from) fail(404, 'That puzzle is older than the 30-day archive.');
    return { n, today };
  }
  const questionOf = value => {
    const q = Number(value);
    if (!Number.isInteger(q) || q < 1 || q > QUESTIONS) fail(400, 'That question is not valid.');
    return q;
  };

  async function api(req, res, path, now = Date.now()) {
    const url = new URL(req.url, 'http://localhost');
    const get = req.method === 'GET';
    const post = req.method === 'POST';

    if (get && path === '/api/daily/meta') {
      const { today, from } = window(now);
      return json(res, { today, date: dateOf(today), from, epoch: EPOCH, questions: QUESTIONS, tries: TRIES });
    }
    if (get && path === '/api/daily/films') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
      return res.end(JSON.stringify(films.map(film => ({ id: film.id, title: film.title, te: film.te, aliases: film.aliases }))));
    }
    if (get && path === '/api/daily/puzzle') {
      const { n, today } = dayParam(url, now);
      const questions = Array.from({ length: QUESTIONS }, (_, i) => ({ q: i + 1, type: typeOf(i + 1), clue: openingClue(n, i + 1), options: optionsFor(n, i + 1) }));
      return json(res, { n, date: dateOf(n), today, isToday: n === today, tries: TRIES, questions });
    }
    if (get && path === '/api/daily/frame') {
      const { n } = dayParam(url, now);
      const q = questionOf(url.searchParams.get('q'));
      // A dialogue question's film still is the answer image, so it needs the key that only a finished question receives.
      if (typeOf(q) === 'dialogue' && url.searchParams.get('k') !== imageKey(n, q)) fail(404, 'That frame was not found.');
      const film = filmFor(n, q);
      const i = Number(url.searchParams.get('i') ?? 0);
      if (!Number.isInteger(i) || i < 0 || i >= film.frames.length) fail(404, 'That frame was not found.');
      const file = resolve(mediaDir, film.frames[i]);
      if (!existsSync(file)) fail(404, 'That frame was not found.');
      const bytes = readFileSync(file);
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': bytes.length, 'Cache-Control': 'public, max-age=86400' });
      return res.end(bytes);
    }
    if (post && path === '/api/daily/guess') {
      const body = await readJson(req);
      const { today, from } = window(now);
      const n = body.n;
      if (!Number.isInteger(n) || n < from || n > today) fail(400, 'That puzzle is not available.');
      const q = questionOf(body.q);
      const misses = body.misses;
      if (!Number.isInteger(misses) || misses < 0 || misses >= TRIES) fail(400, 'That guess count is not valid.');
      const skip = body.skip === true; // "Skip" spends a guess without naming a film
      const guessed = skip ? null : typeof body.film === 'string' ? filmById(body.film) : matchFilm(body.guess);
      if (!skip && !guessed) return json(res, { unknown: true });
      const secret = filmFor(n, q);
      const correct = Boolean(guessed) && guessed.id === secret.id;
      const out = { correct, guessed: guessed ? { id: guessed.id, title: guessed.title } : null };
      if (correct) return json(res, { ...out, answer: answerFor(n, q) });
      const next = misses + 1;
      if (next >= TRIES) return json(res, { ...out, over: true, answer: answerFor(n, q) });
      out.clue = clueAt(n, q, next);
      return json(res, out);
    }
    if (post && path === '/api/daily/suggest') {
      const body = await readJson(req);
      if (typeof body.website === 'string' && body.website) return json(res, { ok: true }); // a bot filled the hidden field
      const title = typeof body.title === 'string' ? body.title.replace(/\s+/g, ' ').trim() : '';
      const note = typeof body.note === 'string' ? body.note.replace(/\s+/g, ' ').trim() : '';
      if (title.length < 2 || title.length > 120) fail(400, 'Enter the film name (2 to 120 characters).');
      if (note.length > 300) fail(400, 'Keep the note under 300 characters.');
      const address = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
      const who = createHash('sha256').update(`mga-suggest:${address}`).digest('hex').slice(0, 16);
      const stamps = (recent.get(who) ?? []).filter(time => now - time < 600_000);
      if (stamps.length >= 5) fail(429, 'That is a lot of suggestions. Try again in a few minutes.');
      recent.set(who, [...stamps, now]);
      if (db.prepare('SELECT COUNT(*) AS n FROM film_suggestions').get().n >= 3000) fail(503, 'Suggestions are full right now.');
      db.prepare('INSERT INTO film_suggestions (created, title, note, who) VALUES (?, ?, ?, ?)').run(now, title, note, who);
      console.log('[film-suggestion]', JSON.stringify({ title, note })); // Vercel's database is temporary, the logs are not
      return json(res, { ok: true });
    }
    return false;
  }
  const suggestions = () => db.prepare('SELECT id, created, title, note FROM film_suggestions ORDER BY id DESC LIMIT 500').all();
  return { api, suggestions };
}
