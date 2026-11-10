import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { test } from 'node:test';
import { buildServer } from '../server.js';
import { starterSets } from '../seed.js';

const password = 'test-only-password';
function set(number, industry = 'tollywood') {
  return {
    title: `Set ${number}`, industry, mode: 'emoji',
    questions: Array.from({ length: 10 }, (_, i) => ({
      text: `🎬 🎭 ${number} ${i}`, options: ['Correct', 'Distractor 1', 'Distractor 2', 'Distractor 3'], correct: 0,
    })),
  };
}

async function fixture(t) {
  const server = buildServer({ adminPassword: password, enforceSoon: false });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  function client() {
    const cookies = new Map();
    return async (path, body, expected = 200, method = body === undefined ? 'GET' : 'POST') => {
      const binary = body instanceof Uint8Array;
      const response = await fetch(url + path, {
        method, body: binary ? body : JSON.stringify(body),
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': binary ? 'application/octet-stream' : 'application/json' }),
          Cookie: [...cookies.values()].join('; '),
        },
      });
      for (const header of response.headers.getSetCookie()) {
        const pair = header.split(';')[0];
        cookies.set(pair.split('=')[0], pair);
      }
      const result = await response.json();
      assert.equal(response.status, expected, JSON.stringify(result));
      return result;
    };
  }
  const admin = client();
  await admin('/api/admin/login', { password });
  return { client, admin, url };
}

test('seeds eight Tollywood games, keeps answers private, resumes a round, and scores ten picks', async t => {
  const { client, admin, url } = await fixture(t);
  const player = client();
  const catalog = await player('/api/catalog');
  assert.deepEqual(catalog.industries, [{ id: 'tollywood', name: 'Tollywood' }]);
  assert.deepEqual(catalog.counts.map(count => count.mode).sort(), ['emoji', 'frame', 'hero', 'heroine', 'lyric', 'meme', 'plot', 'song']);
  assert(catalog.counts.every(count => count.live === ({ hero: 3, heroine: 3, song: 9 }[count.mode] ?? 1)));
  const start = { industry: 'tollywood', mode: 'emoji' };
  let round = await player('/api/rounds', start, 201);
  const path = `/api/rounds/${round.id}`;
  assert.equal(round.question.correct, undefined);
  assert.equal(round.question.fingerprint, undefined);
  assert.equal((await player('/api/rounds', start, 201)).id, round.id);
  await client()(path, undefined, 404);
  await player(path + '/next', { questionId: round.question.id }, 409);
  const clues = new Set();
  let score = 0;
  for (let i = 0; i < 10; i++) {
    assert.equal(round.position, i);
    clues.add(round.question.text);
    const input = { questionId: round.question.id, picked: 0 };
    const answered = await player(path + '/answer', input);
    if (answered.feedback.correct) score++;
    assert.deepEqual((await player(path + '/answer', { ...input, picked: 1 })).feedback, answered.feedback);
    round = await player(path + '/next', input);
  }
  assert.equal(clues.size, 10);
  assert.equal(round.complete, true);
  assert.equal(round.score, score);
  await player('/api/rounds', start, 409);
  const upload = await fetch(url + '/media/audio-1.mp3', { headers: { Range: 'bytes=0-25' } });
  assert.equal(upload.status, 206);
  assert.equal((await upload.arrayBuffer()).byteLength, 26);
  const seedFrame = await readFile(new URL('../public/media/frame-1.webp', import.meta.url));
  const asset = await admin('/api/admin/media', seedFrame, 201);
  assert.equal(asset.type, 'image/webp');
  const bytes = await fetch(url + asset.url);
  assert.deepEqual(Buffer.from(await bytes.arrayBuffer()), seedFrame);
});

test('scores typed guesses with aliases while hiding choices and preserving format on resume', async t => {
  const { client, admin, url } = await fixture(t);
  const player = client();
  await player('/api/catalog');
  await admin('/api/admin/industries', { name: 'Test industry' }, 201);
  const typedSet = set(1, 'test-industry');
  for (const question of typedSet.questions) question.aliases = ['Alternate Name', 'సమాధానం'];
  await admin('/api/admin/sets', { sets: [typedSet], status: 'live' }, 201);

  const start = { industry: 'test-industry', mode: 'emoji', answerFormat: 'typed' };
  await player('/api/rounds', { ...start, answerFormat: 'unsupported' }, 400);
  let round = await player('/api/rounds', start, 201);
  const path = `/api/rounds/${round.id}`;
  assert.equal(round.answerFormat, 'typed');
  const resumed = await player('/api/rounds', { ...start, answerFormat: 'multiple' }, 201);
  assert.equal(resumed.id, round.id);
  assert.equal(resumed.answerFormat, 'typed');
  assert.equal((await player('/api/catalog')).active[0].answerFormat, 'typed');
  await player(path + '/answer', { questionId: round.question.id, picked: 0 }, 400);
  await player(path + '/answer', { questionId: round.question.id, guess: '   ' }, 400);
  const guesses = [' correct! ', 'ALTERNATE-NAME', 'సమాధానం', 'incorrect'];
  for (let i = 0; i < 10; i++) {
    assert.deepEqual(Object.keys(round.question).sort(), ['alt', 'id', 'media', 'text']);
    const questionId = round.question.id;
    const guess = guesses[i] ?? 'Correct';
    const answered = await player(path + '/answer', { questionId, guess });
    assert.equal(answered.feedback.correct, i !== 3);
    assert.equal(answered.feedback.correctAnswer, 'Correct');
    assert.equal(answered.feedback.guess, guess.trim());
    assert.deepEqual((await player(path + '/answer', { questionId, guess: 'New guess' })).feedback, answered.feedback);
    round = await player(path + '/next', { questionId });
  }
  assert.equal(round.score, 9);
  assert.equal(round.review[3].picked, 'incorrect');
  await player('/api/rounds', { ...start, answerFormat: 'multiple' }, 409);

  const meme = await player('/api/rounds', { industry: 'tollywood', mode: 'meme', answerFormat: 'typed' }, 201);
  assert(meme.question.alt && meme.question.text);
  assert.match(meme.question.media, /^\/media\/meme-/);
  assert.equal((await fetch(url + meme.question.media)).headers.get('content-type'), 'image/webp');
});

test('publishes fresh sets without duplicate clues, supports 20 sets, and isolates industries', async t => {
  const { client, admin } = await fixture(t);
  const player = client();
  await player('/api/catalog');
  await player('/api/admin/library', undefined, 401);
  const start = { industry: 'tollywood', mode: 'emoji' };
  const initial = await player('/api/rounds', start, 201);
  const finish = async (round, expectedAnswer) => {
    const path = `/api/rounds/${round.id}`;
    const seen = new Set();
    for (let i = 0; i < 10; i++) {
      const { id: questionId, options, text } = round.question;
      seen.add(text);
      const picked = expectedAnswer ? options.indexOf(expectedAnswer) : 0;
      await player(path + '/answer', { questionId, picked });
      round = await player(path + '/next', { questionId });
    }
    return { seen, score: round.score };
  };
  const first = await finish(initial);
  const draft = await admin('/api/admin/sets', { sets: [set(1)], status: 'draft' }, 201);
  await player('/api/rounds', start, 409);
  await admin(`/api/admin/sets/${draft.ids[0]}/publish`, {});
  const next = await player('/api/rounds', start, 201);
  const second = await finish(next, 'Correct');
  assert.equal(second.score, 10);
  assert.equal(first.seen.intersection(second.seen).size, 0);

  await admin('/api/admin/sets', { sets: [set(2), set(1)], status: 'live' }, 409);
  await player('/api/rounds', start, 409);
  await admin('/api/admin/sets', { sets: Array.from({ length: 18 }, (_, i) => set(i + 2)), status: 'live' }, 201);
  const stats = (await player('/api/catalog')).counts.find(row => row.mode === 'emoji');
  assert.equal(stats.live, 20);
  assert.equal(stats.played, 2);

  await admin('/api/admin/industries', { name: 'Kollywood' }, 201);
  await admin('/api/admin/sets', { sets: [set(1, 'kollywood')], status: 'live' }, 201);
  assert.equal((await player('/api/rounds', { ...start, industry: 'kollywood' }, 201)).industryName, 'Kollywood');
});

test('song levels unlock in order and reveal the song details after each self-scored answer', async t => {
  const { client } = await fixture(t);
  const player = client();
  const state = async () => (await player('/api/catalog')).levels.filter(level => level.mode === 'song');
  let levels = await state();
  assert.equal(levels.length, 9);
  assert.deepEqual(levels.map(level => level.state), ['open', ...Array(8).fill('locked')]);
  await player('/api/rounds', { industry: 'tollywood', mode: 'song', level: 2 }, 409);
  let round = await player('/api/rounds', { industry: 'tollywood', mode: 'song', level: 1 }, 201);
  assert.equal(round.level, 1);
  assert.equal(round.answerFormat, 'reveal');
  assert.equal(round.nextLevel, 2);
  assert(round.question.name && round.question.details.composer !== undefined && round.question.media.startsWith('/media/song-'));
  assert.equal((await state())[0].state, 'playing');
  await player('/api/rounds', { industry: 'tollywood', mode: 'song', level: 2 }, 409);
  for (let i = 0; i < 10; i++) {
    round = await player(`/api/rounds/${round.id}/answer`, { questionId: round.question.id, picked: i < 7 ? 0 : 1 });
    round = await player(`/api/rounds/${round.id}/next`, { questionId: round.question.id });
  }
  assert.equal(round.complete, true);
  assert.equal(round.score, 7);
  assert.equal(round.nextLevel, 2);
  levels = await state();
  assert.deepEqual(levels.slice(0, 3).map(level => level.state), ['done', 'open', 'locked']);
  assert.equal(levels[0].score, 7);
  await player('/api/rounds', { industry: 'tollywood', mode: 'song', level: 1 }, 409);
  const next = await player('/api/rounds', { industry: 'tollywood', mode: 'song', level: 2 }, 201);
  assert.equal(next.level, 2);
});

test('games marked coming soon cannot be started and the audio game is gone', async t => {
  const server = buildServer({ adminPassword: password });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const post = (mode) => fetch(`http://127.0.0.1:${server.address().port}/api/rounds`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ industry: 'tollywood', mode }),
  });
  for (const mode of ['frame', 'lyric', 'emoji', 'plot', 'meme']) assert.equal((await post(mode)).status, 409, mode);
  assert.equal((await post('audio')).status, 400);
  assert.equal((await post('hero')).status, 201);
});

test('hero and heroine rounds are typed levels: forgiving spelling, pass, and names stay hidden until answered', async t => {
  const { client } = await fixture(t);
  const player = client();
  const names = new Map(starterSets().flatMap(item => item.questions.map(q => [q.media, q.options[q.correct]])).filter(([media]) => media));
  for (const mode of ['hero', 'heroine']) {
    const levels = () => player('/api/catalog').then(c => c.levels.filter(l => l.mode === mode));
    assert.deepEqual((await levels()).map(l => l.state), ['open', 'locked', 'locked']);
    await player('/api/rounds', { industry: 'tollywood', mode, level: 2 }, 409);
    let round = await player('/api/rounds', { industry: 'tollywood', mode }, 201);
    assert.equal(round.level, 1);
    assert.equal(round.nextLevel, 2);
    for (let i = 0; i < 10; i++) {
      const name = names.get(round.question.media);
      assert.ok(name, round.question.media);
      assert.equal(round.question.name, undefined, 'the name is not sent before answering');
      assert.equal(round.question.options, undefined);
      assert.ok(!JSON.stringify(round).includes(name), 'the answer is not anywhere in the payload');
      const send = (body, expected) => player(`/api/rounds/${round.id}/answer`, { questionId: round.question.id, ...body }, expected);
      if (i === 0) {
        await send({}, 400);
        round = await send({ pass: true });
        assert.equal(round.feedback.passed, true);
        assert.equal(round.feedback.correct, false);
      } else if (i === 1) {
        round = await send({ guess: 'Zzyzx Qwerty' });
        assert.equal(round.feedback.correct, false);
      } else if (i === 2) {
        const slip = name.toLowerCase().replace(/h/g, '').replace(/(.)\1/g, '$1');
        round = await send({ guess: `  ${slip.toUpperCase()} ` });
        assert.equal(round.feedback.correct, true, `${slip} should count for ${name}`);
      } else {
        round = await send({ guess: name });
        assert.equal(round.feedback.correct, true);
      }
      assert.equal(round.question.name, name, 'the name is shown once answered');
      assert.equal(round.feedback.correctAnswer, name);
      round = await player(`/api/rounds/${round.id}/next`, { questionId: round.question.id });
    }
    assert.equal(round.score, 8);
    assert.deepEqual(round.review.slice(0, 2).map(item => item.picked), ['Passed', 'Zzyzx Qwerty']);
    assert.deepEqual((await levels()).map(l => l.state).slice(0, 2), ['done', 'open']);
    round = await player('/api/rounds', { industry: 'tollywood', mode, level: 2 }, 201);
    assert.equal(round.level, 2);
    assert.equal(round.nextLevel, 3);
  }
});
