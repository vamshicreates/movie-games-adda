import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { answerFormats, modes } from './public/modes.js';
import { shuffle, starterAliases, starterSets } from './seed.js';

const root = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(root, 'public');
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const audioTypes = new Set(['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4']);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg',
};
const maxUpload = 8 * 1024 * 1024;
const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('hex');
const normalize = value => value.normalize('NFKC').replace(/[\uFE0E\uFE0F]/gu, '').trim().replace(/\s+/gu, ' ').toLowerCase();

const normalizeGuess = value => normalize(value).replace(/[^\p{L}\p{N}\p{M}]/gu, '');

class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function need(condition, status, message) {
  if (!condition) throw new RequestError(status, message);
}
function field(value, max) {
  return typeof value === 'string' && value.trim().length <= max ? value.trim() : '';
}
function assetType(bytes) {
  const head = bytes.subarray(0, 16).toString('latin1');
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (head.startsWith('\x89PNG\r\n\x1a\n')) return 'image/png';
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return 'image/webp';
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WAVE') return 'audio/wav';
  if (head.startsWith('OggS')) return 'audio/ogg';
  if (head.slice(4, 8) === 'ftyp' && /^(M4A |M4B |mp42|isom)$/.test(head.slice(8, 12))) return 'audio/mp4';
  if (head.startsWith('ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  return '';
}
async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) {
      req.resume();
      throw new RequestError(413, 'The file or request is too large.');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function readJson(req) {
  need(req.headers['content-type']?.split(';')[0] === 'application/json', 415, 'Send JSON for this request.');
  const bytes = await readBody(req, 2 * 1024 * 1024);
  try {
    const body = JSON.parse(bytes);
    if (body && typeof body === 'object' && !Array.isArray(body)) return body;
  } catch {}
  throw new RequestError(400, 'Enter valid JSON.');
}
function cookie(req, name) {
  return req.headers.cookie?.match(new RegExp(`(?:^|; *)${name}=([a-f0-9]{64})(?:;|$)`))?.[1];
}
function setCookie(req, res, name, value, age) {
  const secure = req.socket.encrypted || process.env.COOKIE_SECURE === '1';
  res.appendHeader('Set-Cookie', `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`);
}
function json(res, value, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
function bytesResponse(req, res, { type, length, stream, cache }) {
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  let start = 0;
  let end = length - 1;
  const partial = range && (range[1] || range[2]);
  const headers = { 'Content-Type': type, 'Cache-Control': cache, 'Accept-Ranges': 'bytes' };
  if (partial) {
    if (range[1]) start = Number(range[1]);
    if (range[1] && range[2]) end = Math.min(end, Number(range[2]));
    if (!range[1]) start = Math.max(0, length - Number(range[2]));
    if (start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${length}` });
      return res.end();
    }
    headers['Content-Range'] = `bytes ${start}-${end}/${length}`;
  }
  headers['Content-Length'] = end - start + 1;
  res.writeHead(partial ? 206 : 200, headers);
  if (req.method === 'HEAD') return res.end();
  stream(start, end);
}

export function buildServer({ dbPath = ':memory:', adminPassword, seed = true } = {}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS industries (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sets (
      id TEXT PRIMARY KEY, industry TEXT NOT NULL REFERENCES industries(id), mode TEXT NOT NULL,
      title TEXT NOT NULL, starter INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL,
      questions TEXT NOT NULL, created INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS published_clues (
      industry TEXT NOT NULL, mode TEXT NOT NULL, fingerprint TEXT NOT NULL,
      set_id TEXT NOT NULL REFERENCES sets(id), PRIMARY KEY (industry, mode, fingerprint)
    );
    CREATE TABLE IF NOT EXISTS rounds (
      id TEXT PRIMARY KEY, player TEXT NOT NULL, set_id TEXT NOT NULL REFERENCES sets(id),
      questions TEXT NOT NULL, answers TEXT NOT NULL DEFAULT '[]', position INTEGER NOT NULL DEFAULT 0,
      created INTEGER NOT NULL, answer_format TEXT NOT NULL DEFAULT 'multiple', UNIQUE (player, set_id)
    );
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, type TEXT NOT NULL, bytes BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    INSERT OR IGNORE INTO industries VALUES ('tollywood', 'Tollywood');
  `);
  const query = (sql, ...values) => db.prepare(sql).get(...values);
  const rows = (sql, ...values) => db.prepare(sql).all(...values);
  const run = (sql, ...values) => db.prepare(sql).run(...values);
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  transaction(() => {
    if (!rows('PRAGMA table_info(rounds)').some(column => column.name === 'answer_format')) {
      db.exec("ALTER TABLE rounds ADD COLUMN answer_format TEXT NOT NULL DEFAULT 'multiple'");
    }
  });

  function validateSet(input, starter = false) {
    need(input && typeof input === 'object', 400, 'Enter a question set.');
    const { industry, mode } = input;
    need(typeof industry === 'string' && query('SELECT id FROM industries WHERE id = ?', industry), 400, 'Choose a film industry.');
    need(typeof mode === 'string' && Object.hasOwn(modes, mode), 400, 'Choose a game.');
    const title = field(input.title, 100);
    need(title, 400, 'Give the set a title of 1–100 characters.');
    need(Array.isArray(input.questions) && input.questions.length === 10, 400, 'Each set needs exactly 10 questions.');
    const fingerprints = new Set();
    const questions = input.questions.map((question, i) => {
      const label = `Question ${i + 1}`;
      need(question && typeof question === 'object', 400, `${label} is missing.`);
      const options = Array.isArray(question.options) ? question.options.map(value => field(value, 120)) : [];
      need(options.length === 4 && options.every(Boolean) && new Set(options.map(normalize)).size === 4, 400, `${label} needs four distinct answers.`);
      const correct = question.correct;
      need(Number.isInteger(correct) && correct >= 0 && correct < 4, 400, `${label} needs a correct answer.`);
      const aliases = question.aliases ?? [];
      need(Array.isArray(aliases) && aliases.length <= 12 && aliases.every(alias => /[\p{L}\p{N}]/u.test(field(alias, 120))),
        400, `${label} can have up to 12 alternate answers of 120 characters each.`);
      const text = field(question.text, 350);
      const alt = field(question.alt, 350);
      const media = field(question.media, 2000);
      const rawDetails = question.details && typeof question.details === 'object' ? question.details : null;
      const details = rawDetails ? Object.fromEntries(['movie', 'year', 'composer', 'singers', 'lyricist', 'note']
        .map(key => [key, field(rawDetails[key], 350)]).filter(([, value]) => value)) : undefined;
      let fingerprint;
      const clue = modes[mode].clue;
      if (clue) {
        need(media && alt, 400, `${label} needs a media file and accessible clue text.`);
        const upload = /^\/uploads\/([a-f0-9]{64})$/.exec(media);
        if (upload) {
          const asset = query('SELECT type FROM media WHERE id = ?', upload[1]);
          const allowed = clue === 'image' ? imageTypes : audioTypes;
          need(asset && allowed.has(asset.type), 400, `${label} needs a valid ${clue} upload.`);
          fingerprint = upload[1];
        } else {
          need(starter && /^\/media\/((frame|meme)-\d+\.webp|(hero|heroine)-\d+\.jpg|song-\d+\.mp3|audio-\d+\.mp3)$/.test(media), 400, `${label} needs a valid upload.`);
          fingerprint = hash(readFileSync(resolve(publicDir, '.' + media)));
        }
      } else {
        need(text, 400, `${label} needs a clue.`);
        fingerprint = hash(normalize(text));
      }
      need(!fingerprints.has(fingerprint), 400, `${label} repeats a clue in this set.`);
      fingerprints.add(fingerprint);
      return { id: randomUUID(), text, alt, media, details, options, correct, aliases: aliases.map(alias => alias.trim()), fingerprint };
    });
    return { industry, mode, title, questions };
  }
  function publish(id, set) {
    for (const [index, question] of set.questions.entries()) {
      need(!query('SELECT 1 FROM published_clues WHERE industry = ? AND mode = ? AND fingerprint = ?', set.industry, set.mode, question.fingerprint),
        409, `“${set.title}”, question ${index + 1}, uses a clue from a previously published set.`);
      run('INSERT INTO published_clues VALUES (?, ?, ?, ?)', set.industry, set.mode, question.fingerprint, id);
    }
    run("UPDATE sets SET status = 'live' WHERE id = ?", id);
  }
  function insertSet(input, status, starter = false, id = randomUUID()) {
    const set = validateSet(input, starter);
    run("INSERT INTO sets VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)", id, set.industry, set.mode, set.title, Number(starter), JSON.stringify(set.questions), Date.now());
    if (status === 'live') publish(id, set);
    return id;
  }
  if (seed) transaction(() => {
    for (const set of starterSets()) {
      const id = set.id ?? `starter-${set.mode}`;
      if (!query('SELECT id FROM sets WHERE id = ?', id)) insertSet(set, 'live', true, id);
    }
  });

  function player(req, res) {
    const existing = cookie(req, 'mga_player');
    if (existing) return hash(existing);
    const value = token();
    setCookie(req, res, 'mga_player', value, 365 * 86400);
    return hash(value);
  }
  function requireAdmin(req) {
    const value = cookie(req, 'mga_admin');
    need(value && query('SELECT 1 FROM admins WHERE id = ? AND expires > ?', hash(value), Date.now()), 401, 'Sign in to continue.');
  }
  const attempts = new Map();
  function levelList(industry, mode, who) {
    const list = rows(`
      SELECT s.id, r.id AS round, r.position, r.answers FROM sets s
      LEFT JOIN rounds r ON r.set_id = s.id AND r.player = ?
      WHERE s.status = 'live' AND s.industry = ? AND s.mode = ? ORDER BY s.created, s.id
    `, who, industry, mode);
    let unlocked = true;
    return list.map((row, index) => {
      const done = row.round && row.position === 10;
      const state = done ? 'done' : row.round ? 'playing' : unlocked ? 'open' : 'locked';
      if (!done) unlocked = false;
      return { level: index + 1, id: row.id, round: row.round, state, score: done ? JSON.parse(row.answers).filter(answer => answer.correct).length : null };
    });
  }
  function catalog(who) {
    const industries = rows('SELECT id, name FROM industries ORDER BY name');
    const counts = rows(`
      SELECT s.industry, s.mode, COUNT(*) AS live, COUNT(r.id) AS played
      FROM sets s LEFT JOIN rounds r ON r.set_id = s.id AND r.player = ?
      WHERE s.status = 'live' GROUP BY s.industry, s.mode
    `, who);
    const active = rows(`
      SELECT r.id, r.answer_format AS answerFormat, s.industry, s.mode FROM rounds r JOIN sets s ON s.id = r.set_id
      WHERE r.player = ? AND r.position < 10 ORDER BY r.created DESC
    `, who);
    const levels = industries.flatMap(({ id: industry }) => Object.entries(modes).filter(([, mode]) => mode.levels)
      .flatMap(([mode]) => levelList(industry, mode, who).map(({ level, state, score }) => ({ industry, mode, level, state, score }))));
    return { industries, counts, active, levels };
  }
  function fetchRound(id, who) {
    const round = query(`
      SELECT r.*, s.industry, s.mode, s.starter, s.title, i.name AS industryName
      FROM rounds r JOIN sets s ON s.id = r.set_id JOIN industries i ON i.id = s.industry
      WHERE r.id = ? AND r.player = ?
    `, id, who);
    need(round, 404, 'This round is unavailable on this browser.');
    return round;
  }
  function publicRound(round) {
    const questions = JSON.parse(round.questions);
    const answers = JSON.parse(round.answers);
    const { id, title, industry, industryName, mode, starter, position, answer_format: answerFormat } = round;
    const header = { id, title, industry, industryName, mode, starter: !!starter, position, answerFormat, total: 10 };
    if (modes[mode].levels) {
      const live = rows("SELECT id FROM sets WHERE status = 'live' AND industry = ? AND mode = ? ORDER BY created, id", industry, mode);
      header.level = live.findIndex(set => set.id === round.set_id) + 1;
      header.levelTotal = live.length;
      header.nextLevel = header.level < live.length ? header.level + 1 : null;
    }
    if (position === 10) return {
      ...header, complete: true, score: answers.filter(answer => answer.correct).length,
      review: questions.map(({ options, correct }, i) => ({
        answer: options[correct], picked: answerFormat === 'reveal' ? 'Not recognised' : answers[i].guess ?? options[answers[i].picked], correct: answers[i].correct,
      })),
    };
    const { id: questionId, text, alt, media, details, options, correct } = questions[position];
    const question = { id: questionId, text, alt, media };
    if (answerFormat === 'multiple') question.options = options;
    if (answerFormat === 'reveal') { question.name = options[correct]; if (details) question.details = details; }
    const answer = answers[position];
    const feedback = answer ? { ...answer, correctAnswer: options[correct] } : null;
    if (feedback && answerFormat === 'multiple') feedback.correctIndex = correct;
    return { ...header, question, feedback };
  }

  async function api(req, res, path) {
    const get = req.method === 'GET';
    const post = req.method === 'POST';
    if (get && path === '/api/catalog') return json(res, catalog(player(req, res)));
    if (post && path === '/api/rounds') {
      let { industry, mode, answerFormat = 'multiple', level } = await readJson(req);
      need(typeof industry === 'string' && typeof mode === 'string' && Object.hasOwn(modes, mode), 400, 'Choose an industry and game.');
      need(typeof answerFormat === 'string' && Object.hasOwn(answerFormats, answerFormat), 400, 'Choose an answer format.');
      need(level === undefined || Number.isInteger(level), 400, 'Choose a level.');
      if (modes[mode].reveal) answerFormat = 'reveal';
      need(answerFormat !== 'reveal' || modes[mode].reveal, 400, 'Choose an answer format.');
      const who = player(req, res);
      const id = transaction(() => {
        if (modes[mode].levels) {
          const list = levelList(industry, mode, who);
          const wanted = level === undefined ? list.find(item => item.state === 'playing' || item.state === 'open') : list[level - 1];
          need(wanted, 409, 'You’ve finished every level. New levels will appear when more songs are published.');
          need(wanted.state !== 'locked', 409, 'Finish the earlier levels to unlock this one.');
          need(wanted.state !== 'done', 409, 'You’ve already finished this level.');
          if (wanted.round) return wanted.round;
          const set = query('SELECT id, questions, starter FROM sets WHERE id = ?', wanted.id);
          const id = randomUUID();
          const questions = shuffle(JSON.parse(set.questions)).map(question => {
            const options = shuffle(question.options);
            return { ...question, options, aliases: question.aliases ?? [], correct: options.indexOf(question.options[question.correct]) };
          });
          run('INSERT INTO rounds (id, player, set_id, questions, created, answer_format) VALUES (?, ?, ?, ?, ?, ?)',
            id, who, set.id, JSON.stringify(questions), Date.now(), answerFormat);
          return id;
        }
        const current = query(`
          SELECT r.id FROM rounds r JOIN sets s ON s.id = r.set_id
          WHERE r.player = ? AND s.industry = ? AND s.mode = ? AND r.position < 10 ORDER BY r.created DESC LIMIT 1
        `, who, industry, mode);
        if (current) return current.id;
        const set = query(`
          SELECT id, questions, starter FROM sets s
          WHERE industry = ? AND mode = ? AND status = 'live'
          AND NOT EXISTS (SELECT 1 FROM rounds r WHERE r.player = ? AND r.set_id = s.id)
          ORDER BY created, id LIMIT 1
        `, industry, mode, who);
        need(set, 409, 'You’re all caught up. A new round will appear when another set is published.');
        const id = randomUUID();
        const questions = shuffle(JSON.parse(set.questions)).map(question => {
          const options = shuffle(question.options);
          const answer = question.options[question.correct];
          const aliases = question.aliases ?? (set.starter ? starterAliases(answer) : []);
          return { ...question, options, aliases, correct: options.indexOf(answer) };
        });
        run('INSERT INTO rounds (id, player, set_id, questions, created, answer_format) VALUES (?, ?, ?, ?, ?, ?)',
          id, who, set.id, JSON.stringify(questions), Date.now(), answerFormat);
        return id;
      });
      return json(res, publicRound(fetchRound(id, who)), 201);
    }
    const roundRoute = /^\/api\/rounds\/([a-f0-9-]{36})(?:\/(answer|next))?$/.exec(path);
    if (roundRoute) {
      const [, id, action] = roundRoute;
      const who = player(req, res);
      if (get && !action) return json(res, publicRound(fetchRound(id, who)));
      if (post && action) {
        const { questionId, picked, guess: rawGuess } = await readJson(req);
        const result = transaction(() => {
          const round = fetchRound(id, who);
          const question = JSON.parse(round.questions)[round.position];
          if (!question || question.id !== questionId) return round;
          const answers = JSON.parse(round.answers);
          if (action === 'answer' && !answers[round.position]) {
            if (round.answer_format === 'reveal') {
              need(picked === 0 || picked === 1, 400, 'Choose Yes or No.');
              answers.push({ picked, correct: picked === 0 });
            } else if (round.answer_format === 'typed') {
              const guess = field(rawGuess, 120);
              need(/[\p{L}\p{N}]/u.test(guess), 400, 'Type your answer before submitting.');
              const accepted = [question.options[question.correct], ...question.aliases].map(normalizeGuess);
              answers.push({ guess, correct: accepted.includes(normalizeGuess(guess)) });
            } else {
              need(Number.isInteger(picked) && picked >= 0 && picked < question.options.length, 400, 'Choose an answer.');
              answers.push({ picked, correct: picked === question.correct });
            }
            run('UPDATE rounds SET answers = ? WHERE id = ?', JSON.stringify(answers), id);
          }
          if (action === 'next') {
            need(answers[round.position], 409, 'Answer the current question first.');
            run('UPDATE rounds SET position = position + 1 WHERE id = ?', id);
          }
          return fetchRound(id, who);
        });
        return json(res, publicRound(result));
      }
    }

    if (post && path === '/api/admin/login') {
      const address = req.socket.remoteAddress;
      const now = Date.now();
      for (const [ip, attempt] of attempts) if (attempt.until <= now) attempts.delete(ip);
      const attempt = attempts.get(address) ?? { count: 0, until: now + 15 * 60_000 };
      need(attempt.count < 12, 429, 'Too many sign-in attempts. Try again in 15 minutes.');
      const { password } = await readJson(req);
      const provided = field(password, 1000);
      const valid = adminPassword && timingSafeEqual(Buffer.from(hash(provided)), Buffer.from(hash(adminPassword)));
      if (!valid) {
        attempt.count++;
        attempts.set(address, attempt);
        throw new RequestError(401, 'That password did not match.');
      }
      attempts.delete(address);
      const value = token();
      const duration = 8 * 3600;
      run('DELETE FROM admins WHERE expires <= ?', now);
      run('INSERT INTO admins VALUES (?, ?)', hash(value), now + duration * 1000);
      setCookie(req, res, 'mga_admin', value, duration);
      return json(res, { ok: true });
    }
    if (path.startsWith('/api/admin/')) {
      requireAdmin(req);
      if (post && path === '/api/admin/logout') {
        run('DELETE FROM admins WHERE id = ?', hash(cookie(req, 'mga_admin')));
        setCookie(req, res, 'mga_admin', '', 0);
        return json(res, { ok: true });
      }
      if (get && path === '/api/admin/library') return json(res, {
        industries: rows('SELECT * FROM industries ORDER BY name'),
        sets: rows('SELECT id, industry, mode, title, status, starter FROM sets ORDER BY created DESC, title'),
      });
      if (post && path === '/api/admin/industries') {
        const { name: rawName } = await readJson(req);
        const name = field(rawName, 60);
        const id = normalize(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        need(id, 400, 'Enter an industry name containing a Latin letter or digit.');
        need(run('INSERT OR IGNORE INTO industries VALUES (?, ?)', id, name).changes, 409, 'That industry already exists.');
        return json(res, { id, name }, 201);
      }
      if (post && path === '/api/admin/media') {
        const bytes = await readBody(req, maxUpload);
        const type = assetType(bytes);
        need(type, 415, 'Choose a JPG, PNG, WebP, MP3, WAV, Ogg, or M4A file.');
        const id = hash(bytes);
        run('INSERT OR IGNORE INTO media VALUES (?, ?, ?)', id, type, bytes);
        return json(res, { url: `/uploads/${id}`, type }, 201);
      }
      if (post && path === '/api/admin/sets') {
        const { sets, status } = await readJson(req);
        need(Array.isArray(sets) && sets.length >= 1 && sets.length <= 80, 400, 'Send 1–80 complete sets per import.');
        need(status === 'draft' || status === 'live', 400, 'Choose Draft or Publish.');
        const ids = transaction(() => sets.map(set => insertSet(set, status)));
        return json(res, { ids }, 201);
      }
      const setRoute = /^\/api\/admin\/sets\/([a-z0-9-]+)(?:\/(publish|archive))?$/.exec(path);
      if (setRoute) {
        const [, id, action] = setRoute;
        const set = query('SELECT * FROM sets WHERE id = ?', id);
        need(set, 404, 'That set was not found.');
        if (get && !action) return json(res, { ...set, questions: JSON.parse(set.questions) });
        if (req.method === 'PUT' && !action) {
          const updated = validateSet(await readJson(req));
          const result = run("UPDATE sets SET industry = ?, mode = ?, title = ?, questions = ? WHERE id = ? AND status = 'draft'",
            updated.industry, updated.mode, updated.title, JSON.stringify(updated.questions), id);
          need(result.changes, 409, 'Only draft sets can be edited.');
          return json(res, { id });
        }
        if (post && action === 'publish') {
          transaction(() => {
            const latest = query('SELECT * FROM sets WHERE id = ?', id);
            if (latest.status === 'live') return;
            need(latest.status === 'draft', 409, 'Only draft sets can be published.');
            publish(id, { ...latest, questions: JSON.parse(latest.questions) });
          });
          return json(res, { id });
        }
        if (post && action === 'archive') {
          run("UPDATE sets SET status = 'archived' WHERE id = ? AND status = 'live'", id);
          return json(res, { id });
        }
      }
    }
    throw new RequestError(404, 'This page or action was not found.');
  }

  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (path.startsWith('/api/')) {
        need(req.headers['sec-fetch-site'] !== 'cross-site', 403, 'Open this action from Movie Games Adda.');
        return await api(req, res, path);
      }
      need(req.method === 'GET' || req.method === 'HEAD', 405, 'This action is not available.');
      const upload = /^\/uploads\/([a-f0-9]{64})$/.exec(path);
      if (upload) {
        const asset = query('SELECT type, bytes FROM media WHERE id = ?', upload[1]);
        need(asset, 404, 'This media file was not found.');
        return bytesResponse(req, res, { type: asset.type, length: asset.bytes.length, cache: 'public, max-age=31536000, immutable',
          stream: (start, end) => res.end(asset.bytes.subarray(start, end + 1)) });
      }
      const page = path === '/' || path === '/admin' || /^\/round\/[a-f0-9-]{36}$/.test(path);
      const file = resolve(publicDir, page ? 'index.html' : `.${path}`);
      const type = types[extname(file)];
      need(type && file.startsWith(publicDir + sep) && existsSync(file) && statSync(file).isFile(), 404, 'This page was not found.');
      return bytesResponse(req, res, { type, length: statSync(file).size, cache: path.startsWith('/media/') ? 'public, max-age=86400' : 'no-cache',
        stream: (start, end) => createReadStream(file, { start, end }).pipe(res) });
    } catch (error) {
      if (!(error instanceof RequestError)) console.error(error);
      if (res.headersSent) return res.end();
      return json(res, { error: error instanceof RequestError ? error.message : 'Something went wrong. Try again.' }, error.status ?? 500);
    }
  });
  server.on('close', () => db.close());
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT ?? 3000);
  const configuredPassword = process.env.ADMIN_PASSWORD?.trim();
  if ((configuredPassword && configuredPassword.length < 12) || (!configuredPassword && host !== '127.0.0.1')) {
    throw new Error('Set ADMIN_PASSWORD to at least 12 characters before starting a public instance.');
  }
  const adminPassword = configuredPassword ?? randomBytes(12).toString('base64url');
  const dbPath = resolve(process.env.DATA_DIR ?? resolve(root, 'data'), 'adda.sqlite');
  buildServer({ dbPath, adminPassword }).listen(port, host, () => {
    console.log(`Movie Games Adda is running at http://${host}:${port}`);
    if (!configuredPassword) console.log(`Local admin password: ${adminPassword}`);
  });
}
