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

test('every film is used once per cycle and the three games never share a film on a day', () => {
  const size = D.films.length;
  for (const game of D.GAMES) assert.equal(new Set(Array.from({ length: size }, (_, i) => D.filmFor(game, i + 1).id)).size, size);
  for (let n = 1; n <= size; n++) assert.equal(new Set(D.GAMES.map(game => D.filmFor(game, n).id)).size, 3);
});

test('every film has a complete clue ladder', () => {
  for (let n = 1; n <= D.films.length; n++) {
    for (const game of ['frame', 'dialogue']) for (let stage = 0; stage < D.MAX_GUESSES[game]; stage++) assert.ok(D.clueAt(game, n, stage), `${game} #${n} stage ${stage}`);
  }
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

test('clue tiles compare hero, director, music, year, genre and language', () => {
  const a = D.films.find(f => f.title === 'Pokiri');
  const same = D.compareTiles(a, a);
  assert.ok(same.every(tile => tile.state === 'hit'));
  const b = D.films.find(f => f.title === 'Athadu'); // same hero and year-ish, different crew
  const tiles = Object.fromEntries(D.compareTiles(b, a).map(tile => [tile.k, tile]));
  assert.equal(tiles.hero.state, 'hit');
  assert.equal(tiles.director.state, 'miss');
  assert.equal(tiles.year.state, 'near');
  assert.equal(tiles.year.arrow, 'up');
  const robo = D.films.find(f => f.title === 'Robo');
  assert.equal(D.compareTiles(robo, a).find(tile => tile.k === 'lang').state, 'miss');
});

test('API serves the same puzzle to everyone and reveals clues step by step', async t => {
  const { call } = await fixture(t);
  const meta = (await call('/api/daily/meta')).body;
  assert.equal(meta.today, TODAY);
  const first = await call(`/api/daily/puzzle?game=frame&n=${TODAY}`);
  const again = await call(`/api/daily/puzzle?game=frame`);
  assert.deepEqual(first.body, again.body);
  assert.equal(first.body.clue.type, 'frame');
  assert.ok(!JSON.stringify(first.body).includes(D.filmFor('frame', TODAY).id), 'the opening clue must not leak the film id');

  const secret = D.filmFor('frame', TODAY);
  const wrong = D.films.find(f => f.id !== secret.id);
  const miss = await call('/api/daily/guess', { game: 'frame', n: TODAY, misses: 0, film: wrong.id });
  assert.equal(miss.body.correct, false);
  assert.equal(miss.body.clue.type, secret.frames.length > 1 ? 'frame' : 'hint');
  assert.equal(miss.body.answer, undefined);

  const win = await call('/api/daily/guess', { game: 'frame', n: TODAY, misses: 1, guess: secret.title });
  assert.equal(win.body.correct, true);
  assert.equal(win.body.answer.id, secret.id);
});

test('the answer arrives only on a win or on the last miss', async t => {
  const { call } = await fixture(t);
  const secret = D.filmFor('dialogue', TODAY);
  const wrong = D.films.find(f => f.id !== secret.id);
  const last = await call('/api/daily/guess', { game: 'dialogue', n: TODAY, misses: 5, film: wrong.id });
  assert.equal(last.body.over, true);
  assert.equal(last.body.answer.id, secret.id);
  const skip = await call('/api/daily/guess', { game: 'dialogue', n: TODAY, misses: 0, skip: true });
  assert.equal(skip.body.correct, false);
  assert.ok(skip.body.clue);
  const unknown = await call('/api/daily/guess', { game: 'dialogue', n: TODAY, misses: 0, guess: 'qwertyuiop' });
  assert.equal(unknown.body.unknown, true);
});

test('clue-tile guesses return tiles and hints after the fifth and eighth guess', async t => {
  const { call } = await fixture(t);
  const secret = D.filmFor('clues', TODAY);
  const wrong = D.films.filter(f => f.id !== secret.id);
  const guess = misses => call('/api/daily/guess', { game: 'clues', n: TODAY, misses, film: wrong[misses].id });
  const early = await guess(0);
  assert.equal(early.body.tiles.length, 6);
  assert.equal(early.body.hint, undefined);
  assert.ok((await guess(4)).body.hint.value);
  assert.ok((await guess(7)).body.hint.value.startsWith('Starts with'));
  assert.equal((await guess(9)).body.over, true);
});

test('puzzles outside the 30-day window and bad input are refused', async t => {
  const { call } = await fixture(t);
  assert.equal((await call(`/api/daily/puzzle?game=frame&n=${TODAY + 1}`)).status, 404);
  assert.equal((await call(`/api/daily/puzzle?game=frame&n=${TODAY - 30}`)).status, 404);
  assert.equal((await call(`/api/daily/puzzle?game=frame&n=abc`)).status, 400);
  assert.equal((await call(`/api/daily/puzzle?game=nope`)).status, 400);
  assert.equal((await call('/api/daily/guess', { game: 'frame', n: TODAY, misses: 6, film: 'pokiri' })).status, 400);
  assert.equal((await call('/api/daily/guess', { game: 'frame', n: TODAY, misses: 0 , film: 'nope' })).body.unknown, true);
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
  const frame = await fetch(`${url}/api/daily/frame?g=frame&n=${TODAY}&i=0`);
  assert.equal(frame.status, 200);
  assert.equal(frame.headers.get('content-type'), 'image/jpeg');
  const film = D.filmFor('frame', TODAY);
  assert.equal((await fetch(`${url}/media/daily/${film.frames[0]}`)).status, 404);
  assert.equal((await call(`/api/daily/frame?g=frame&n=${TODAY}&i=99`)).status, 404);
  const list = (await call('/api/daily/films')).body;
  assert.equal(list.length, D.films.length);
  assert.ok(list.every(film => Object.keys(film).sort().join() === 'aliases,id,te,title'), 'the film list must carry no answers');
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
  const { call } = await fixture(t);
  const frame = (await call('/play/frame')).body;
  assert.match(frame, /<title>Daily Telugu Movie Frame Game/);
  assert.match(frame, /rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/play\/frame"/);
  assert.match(frame, /og:image" content="http:\/\/127\.0\.0\.1:\d+\/og\.png"/);
  assert.match(frame, /name="twitter:card" content="summary_large_image"/);
  assert.notEqual((await call('/play/dialogue')).body.match(/<title>.*<\/title>/)[0], frame.match(/<title>.*<\/title>/)[0]);
  assert.match((await call('/play/frame/12')).body, /noindex/);
  assert.equal((await call('/play/frame/12abc')).status, 404);
  for (const path of ['/how-to-play', '/privacy', '/terms', '/contact', '/updates', '/credits']) {
    const res = await call(path);
    assert.equal(res.status, 200, path);
    assert.match(res.body, /rel="canonical"/);
  }
  assert.match((await call('/how-to-play')).body, /FAQPage/);
  assert.match((await call('/robots.txt')).body, /Sitemap: http:\/\/127\.0\.0\.1:\d+\/sitemap\.xml/);
  const map = (await call('/sitemap.xml')).body;
  assert.match(map, /\/play\/clues/);
  assert.doesNotMatch(map, /admin/);
  assert.match((await call('/')).body, /og:image/);
  assert.equal((await call('/og.png')).status, 200);
});

test('streaks count only same-day wins, and stats follow the results', () => {
  const win = (n, tries, live) => S.putRecord('frame', n, { status: 'won', guesses: Array.from({ length: tries }, () => ({ id: 'x' })), live });
  S.reset();
  win(28, 2, true); win(29, 3, true); win(30, 1, false); // 30 was played late from the archive
  let stat = S.stats('frame', 31);
  assert.equal(stat.current, 0);
  assert.equal(stat.best, 2);
  assert.equal(stat.played, 3);
  assert.deepEqual(stat.distribution.slice(0, 3), [1, 1, 1]);
  win(30, 1, true);
  stat = S.stats('frame', 31);
  assert.equal(stat.current, 3, 'yesterday still counts while today is open');
  win(31, 4, true);
  assert.equal(S.stats('frame', 31).current, 4);
  S.putRecord('frame', 31, { status: 'lost', guesses: Array(6).fill({ id: 'x' }), live: true });
  assert.equal(S.stats('frame', 31).current, 0);
  assert.equal(S.stats('frame', 31).best, 3);
});

test('share text hides the answer and challenge links carry the score', () => {
  const won = { status: 'won', guesses: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
  assert.equal(S.shareGrid('frame', won), '🟥🟥🟩⬜⬜⬜');
  assert.equal(S.score('frame', won), '3/6');
  const lost = { status: 'lost', guesses: Array(6).fill({ id: 'a' }) };
  assert.equal(S.score('frame', lost), 'X/6');
  assert.equal(S.shareGrid('frame', lost), '🟥🟥🟥🟥🟥🟥');
  const tiles = state => ({ id: 'a', tiles: Array(6).fill({ state }) });
  assert.equal(S.shareGrid('clues', { status: 'won', guesses: [tiles('miss'), tiles('hit')] }), '⬛⬛⬛⬛⬛⬛\n🟩🟩🟩🟩🟩🟩');
  const text = S.shareText('frame', 31, won, 'https://x.test/play/frame');
  assert.match(text, /Frame of the Day #31 3\/6/);
  assert.equal(S.challengeLink('https://x.test', 'frame', 31, won), 'https://x.test/play/frame/31?s=3');
  assert.deepEqual(S.friendScore('frame', '?s=3'), { solved: true, tries: 3 });
  assert.deepEqual(S.friendScore('frame', '?s=x'), { solved: false });
  assert.equal(S.friendScore('frame', '?s=9'), null);
  assert.equal(S.friendScore('frame', '?s=abc'), null);
});
