import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { buildServer } from '../server.js';
import * as D from '../daily.js';
import * as S from '../public/daily-store.js';

const NOW = Date.parse('2026-11-15T10:00:00Z'); // IST 15:30, puzzle #31
const TODAY = D.todayNumber(NOW);

async function fixture(t, clock = () => NOW) {
  const server = buildServer({ adminPassword: 'test-only-password', enforceSoon: false, clock });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, body) => {
    const response = await fetch(url + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const type = response.headers.get('content-type') ?? '';
    return { status: response.status, type, body: type.includes('json') ? await response.json() : await response.text(), headers: response.headers };
  };
  return { call, url };
}

test('puzzle numbers follow the IST day, not UTC', () => {
  assert.equal(D.istDate(Date.parse('2026-11-15T18:29:00Z')), '2026-11-15');
  assert.equal(D.istDate(Date.parse('2026-11-15T18:30:00Z')), '2026-11-16');
  assert.equal(D.todayNumber(Date.parse('2026-11-15T18:30:00Z')), D.todayNumber(NOW) + 1);
  assert.equal(D.dateOf(1), D.EPOCH);
  assert.equal(D.firstArchive(NOW), TODAY - D.ARCHIVE_DAYS + 1);
});

test('every day has seven different films, and every film gets used across the cycle', () => {
  for (let n = 1; n <= 40; n++) assert.equal(new Set(Array.from({ length: D.QUESTIONS }, (_, i) => D.filmFor(n, i + 1).id)).size, D.QUESTIONS, `day ${n}`);
  const seen = new Set();
  for (let n = 1; n <= Math.ceil(D.films.length / D.QUESTIONS); n++) for (let q = 1; q <= D.QUESTIONS; q++) seen.add(D.filmFor(n, q).id);
  assert.equal(seen.size, D.films.length);
  assert.deepEqual(Array.from({ length: 4 }, (_, i) => D.typeOf(i + 1)), ['frame', 'dialogue', 'frame', 'dialogue']);
});

test('every film has a complete clue ladder for every try', () => {
  for (let n = 1; n <= 10; n++) for (let q = 1; q <= D.QUESTIONS; q++) for (let stage = 0; stage < D.TRIES; stage++) assert.ok(D.clueAt(n, q, stage), `day ${n} question ${q} stage ${stage}`);
  for (const film of D.films) {
    assert.ok(film.year && film.hero && film.director && film.music && film.genres.length && film.te, film.title);
    assert.ok(D.safeLines(film).length >= 1);
  }
});

test('dialogue clues never contain the film name', () => {
  const squash = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const film of D.films) {
    if (D.safeLines(film).length === 0 || D.safeLines(film) === film.lines.slice(0, 1)) continue;
    for (const line of D.safeLines(film)) for (const name of [film.title, ...film.aliases].map(squash).filter(x => x.length >= 4)) assert.ok(!squash(line).includes(name), `${film.title}: ${line}`);
  }
});

test('typed names match English, Telugu, aliases and spelling variants, and reject nonsense', () => {
  assert.equal(D.matchFilm('pokiri').title, 'Pokiri');
  assert.equal(D.matchFilm('పోకిరి').title, 'Pokiri');
  assert.equal(D.matchFilm('AVPL').title, 'Ala Vaikunthapurramuloo');
  assert.equal(D.matchFilm('bahubali 2').title, 'Baahubali 2: The Conclusion');
  assert.equal(D.matchFilm('attarintiki daredhi').title, 'Attarintiki Daredi');
  assert.equal(D.matchFilm('F2').title, 'F2');
  assert.equal(D.matchFilm('qwertyuiop'), null);
  assert.equal(D.matchFilm(''), null);
});

test('API serves the same seven questions to everyone and reveals clues step by step', async t => {
  const { call } = await fixture(t);
  const meta = (await call('/api/daily/meta')).body;
  assert.equal(meta.today, TODAY);
  assert.equal(meta.questions, 7);
  assert.equal(meta.tries, 3);
  const first = await call(`/api/daily/puzzle?n=${TODAY}`);
  const again = await call('/api/daily/puzzle');
  assert.deepEqual(first.body, again.body);
  assert.equal(first.body.questions.length, 7);
  assert.deepEqual(first.body.questions.map(item => item.type), Array.from({ length: 7 }, (_, i) => (i % 2 === 0 ? 'frame' : 'dialogue')));
  assert.equal(first.body.questions[0].clue.type, 'frame');
  assert.equal(first.body.questions[1].clue.type, 'line');
  const text = JSON.stringify(first.body);
  for (let q = 1; q <= 7; q++) assert.ok(!text.includes(`"${D.filmFor(TODAY, q).id}"`), 'the opening clues must not leak a film id');

  const secret = D.filmFor(TODAY, 1);
  const wrong = D.films.find(f => f.id !== secret.id);
  const miss = await call('/api/daily/guess', { n: TODAY, q: 1, misses: 0, film: wrong.id });
  assert.equal(miss.body.correct, false);
  assert.equal(miss.body.clue.type, secret.frames.length > 1 ? 'frame' : 'hint');
  assert.equal(miss.body.answer, undefined);

  const win = await call('/api/daily/guess', { n: TODAY, q: 1, misses: 1, guess: secret.title });
  assert.equal(win.body.correct, true);
  assert.equal(win.body.answer.id, secret.id);
});

test('the answer arrives only on a win or on the third miss', async t => {
  const { call } = await fixture(t);
  const secret = D.filmFor(TODAY, 2);
  const wrong = D.films.find(f => f.id !== secret.id);
  const last = await call('/api/daily/guess', { n: TODAY, q: 2, misses: 2, film: wrong.id });
  assert.equal(last.body.over, true);
  assert.equal(last.body.answer.id, secret.id);
  const skip = await call('/api/daily/guess', { n: TODAY, q: 2, misses: 0, skip: true });
  assert.equal(skip.body.correct, false);
  assert.ok(skip.body.clue);
  assert.equal(skip.body.answer, undefined);
  const unknown = await call('/api/daily/guess', { n: TODAY, q: 2, misses: 0, guess: 'qwertyuiop' });
  assert.equal(unknown.body.unknown, true);
});

test('puzzles outside the 30-day window and bad input are refused', async t => {
  const { call } = await fixture(t);
  assert.equal((await call(`/api/daily/puzzle?n=${TODAY + 1}`)).status, 404);
  assert.equal((await call(`/api/daily/puzzle?n=${TODAY - 30}`)).status, 404);
  assert.equal((await call(`/api/daily/puzzle?n=${TODAY - 29}`)).status, 200);
  assert.equal((await call('/api/daily/puzzle?n=abc')).status, 400);
  assert.equal((await call('/api/daily/guess', { n: TODAY, q: 1, misses: 3, film: 'pokiri' })).status, 400);
  assert.equal((await call('/api/daily/guess', { n: TODAY, q: 11, misses: 0, film: 'pokiri' })).status, 400);
  assert.equal((await call('/api/daily/guess', { n: TODAY, q: 0, misses: 0, film: 'pokiri' })).status, 400);
  assert.equal((await call('/api/daily/guess', { n: TODAY, q: 1, misses: 0, film: 'nope' })).body.unknown, true);
});

test('the day rolls over at midnight IST', async t => {
  let now = Date.parse('2026-11-15T18:29:00Z');
  const { call } = await fixture(t, () => now);
  const before = (await call('/api/daily/meta')).body.today;
  now = Date.parse('2026-11-15T18:31:00Z');
  assert.equal((await call('/api/daily/meta')).body.today, before + 1);
});

test('frames are served through the API and the raw media folder is closed', async t => {
  const { call, url } = await fixture(t);
  const frame = await fetch(`${url}/api/daily/frame?n=${TODAY}&q=1&i=0`);
  assert.equal(frame.status, 200);
  assert.equal(frame.headers.get('content-type'), 'image/jpeg');
  const film = D.filmFor(TODAY, 1);
  assert.equal((await fetch(`${url}/media/daily/${film.frames[0]}`)).status, 404);
  assert.equal((await call(`/api/daily/frame?n=${TODAY}&q=1&i=99`)).status, 404);
  const list = (await call('/api/daily/films')).body;
  assert.equal(list.length, D.films.length);
  assert.ok(list.every(film => Object.keys(film).sort().join() === 'aliases,id,te,title'), 'the film list must carry no answers');
});

test('a dialogue question\'s film still is locked until its answer is revealed', async t => {
  const { call, url } = await fixture(t);
  assert.equal((await fetch(`${url}/api/daily/frame?n=${TODAY}&q=2&i=0`)).status, 404);
  assert.equal((await fetch(`${url}/api/daily/frame?n=${TODAY}&q=2&i=0&k=wrong`)).status, 404);
  const secret = D.filmFor(TODAY, 2);
  const win = await call('/api/daily/guess', { n: TODAY, q: 2, misses: 0, guess: secret.title });
  assert.equal(win.body.correct, true);
  assert.equal((await fetch(url + win.body.answer.image)).status, 200);
});

test('suggestions are stored, rate limited and spam-trapped', async t => {
  const { call, url } = await fixture(t);
  assert.equal((await call('/api/daily/suggest', { title: 'Missing Film', note: 'a 2012 hit' })).status, 200);
  assert.equal((await call('/api/daily/suggest', { title: 'x' })).status, 400);
  assert.equal((await call('/api/daily/suggest', { title: 'Bot Film', website: 'spam.example' })).status, 200);
  for (let i = 0; i < 6; i++) await call('/api/daily/suggest', { title: `Film ${i}` });
  assert.equal((await call('/api/daily/suggest', { title: 'One more' })).status, 429);
  assert.equal((await fetch(`${url}/api/admin/suggestions`)).status, 401);
});

test('pages, SEO tags, robots and sitemap', async t => {
  const { call, url } = await fixture(t);
  const play = (await call('/play')).body;
  assert.match(play, /<title>Daily Telugu Movie Quiz/);
  assert.match(play, /rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/play"/);
  assert.match(play, /og:image" content="http:\/\/127\.0\.0\.1:\d+\/og\.png"/);
  assert.match(play, /name="twitter:card" content="summary_large_image"/);
  assert.match((await call('/play/12')).body, /noindex/);
  assert.equal((await call('/play/12abc')).status, 404);
  for (const old of ['/play/frame', '/play/dialogue', '/play/clues']) {
    const res = await fetch(url + old, { redirect: 'manual' });
    assert.equal(res.status, 301, old);
    assert.equal(res.headers.get('location'), '/play', old);
  }
  const archived = await fetch(`${url}/play/clues/12`, { redirect: 'manual' });
  assert.equal(archived.status, 301);
  assert.equal(archived.headers.get('location'), '/play/12');
  for (const path of ['/how-to-play', '/privacy', '/terms', '/contact', '/updates', '/credits']) {
    const res = await call(path);
    assert.equal(res.status, 200, path);
    assert.match(res.body, /rel="canonical"/);
  }
  assert.match((await call('/how-to-play')).body, /FAQPage/);
  assert.match((await call('/robots.txt')).body, /Sitemap: http:\/\/127\.0\.0\.1:\d+\/sitemap\.xml/);
  const map = (await call('/sitemap.xml')).body;
  assert.match(map, /\/play</);
  assert.doesNotMatch(map, /clues|admin/);
  assert.match((await call('/')).body, /og:image/);
  assert.equal((await call('/og.png')).status, 200);
});

const day = (...grades) => ({ live: true, items: grades.map(grade => ({ status: grade === 'miss' ? 'lost' : grade === 'open' ? 'open' : 'won', guesses: grade === 'first' ? [{ id: 'a' }] : [{ id: 'a' }, { id: 'b' }] })) });
const full = (wins, misses = 7 - wins) => [...Array(wins).fill('first'), ...Array(misses).fill('miss')];

test('streaks count only days finished on their own day, and stats follow the scores', () => {
  S.reset();
  S.putDay(28, day(...full(6)));
  S.putDay(29, day(...full(5)));
  S.putDay(30, { ...day(...full(7)), live: false }); // played late from the archive
  let stat = S.stats(31);
  assert.equal(stat.current, 0);
  assert.equal(stat.longest, 2);
  assert.equal(stat.played, 3);
  assert.equal(stat.best, 7);
  assert.equal(stat.average, 6);
  assert.equal(stat.distribution[5] + stat.distribution[6] + stat.distribution[7], 3);
  S.putDay(30, day(...full(7)));
  assert.equal(S.stats(31).current, 3, 'yesterday still counts while today is open');
  S.putDay(31, day('first', 'miss', 'open'));
  assert.equal(S.stats(31).current, 3, 'an unfinished day is not played yet');
  S.putDay(31, day(...full(4)));
  assert.equal(S.stats(31).current, 4);
  S.putDay(27, day(...full(1)));
  assert.equal(S.stats(31).longest, 5);
});

test('share text hides the answers and challenge links carry the score', () => {
  const record = day('first', 'later', 'miss', 'first', 'first', 'miss', 'miss');
  assert.equal(S.scoreOf(record), 4);
  assert.equal(S.score(record), '4/7');
  assert.equal(S.shareGrid(record), '🟩🟨🟥🟩\n🟩🟥🟥');
  const text = S.shareText(31, record, 'https://x.test/play');
  assert.match(text, /Movie Games Daily #31 4\/7/);
  assert.equal(S.challengeLink('https://x.test', 31, record), 'https://x.test/play/31?s=4');
  assert.equal(S.friendScore('?s=4'), 4);
  assert.equal(S.friendScore('?s=0'), 0);
  assert.equal(S.friendScore('?s=7'), 7);
  assert.equal(S.friendScore('?s=8'), null);
  assert.equal(S.friendScore('?s=abc'), null);
  assert.equal(S.friendScore(''), null);
  assert.equal(S.isFinished(day('first', 'open')), false);
  assert.equal(S.isFinished(record), true);
});
