import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { buildServer } from '../server.js';
import { blobStore } from '../reports.js';

const password = 'test-only-password';
// A 1x1 PNG, enough to pass the image check.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function start(t, options = {}) {
  const server = buildServer({ adminPassword: password, enforceSoon: false, ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { body, cookie = '', method = body === undefined ? 'GET' : 'POST', headers = {} } = {}) => {
    const response = await fetch(url + path, {
      method, body: body === undefined ? undefined : JSON.stringify(body),
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    });
    return response;
  };
  const login = await call('/api/admin/login', { body: { password } });
  const cookie = login.headers.getSetCookie()[0].split(';')[0];
  return { call, cookie };
}

const report = (extra = {}) => ({ message: 'The audio does not play after I answer in Guess the Song.', contact: 'fan@example.com', page: '/', ...extra });

test('players can send a bug report with a screenshot, and only the admin can read it', async t => {
  const { call, cookie } = await start(t);
  const sent = await call('/api/reports', { body: report({ screenshot: `data:image/png;base64,${PNG.toString('base64')}` }) });
  assert.equal(sent.status, 201);

  assert.equal((await call('/api/admin/reports')).status, 401, 'the list is private');
  const list = await (await call('/api/admin/reports', { cookie })).json();
  assert.equal(list.reports.length, 1);
  const [item] = list.reports;
  assert.equal(item.status, 'open');
  assert.equal(item.hasShot, true);
  assert.equal(item.contact, 'fan@example.com');
  assert.match(item.message, /audio does not play/);

  assert.equal((await call(`/api/admin/reports/${item.id}/screenshot`)).status, 401, 'screenshots are private too');
  const shot = await call(`/api/admin/reports/${item.id}/screenshot`, { cookie });
  assert.equal(shot.status, 200);
  assert.equal(shot.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await shot.arrayBuffer()), PNG);

  assert.equal((await call(`/api/admin/reports/${item.id}/status`, { body: { status: 'fixed' } })).status, 401);
  assert.equal((await call(`/api/admin/reports/${item.id}/status`, { body: { status: 'fixed' }, cookie })).status, 200);
  assert.equal((await (await call('/api/admin/reports', { cookie })).json()).reports[0].status, 'fixed');
  assert.equal((await call(`/api/admin/reports/${item.id}/status`, { body: { status: 'open' }, cookie })).status, 200);
  assert.equal((await call(`/api/admin/reports/${item.id}/delete`, { body: {}, cookie })).status, 200);
  assert.equal((await (await call('/api/admin/reports', { cookie })).json()).reports.length, 0);
  assert.equal((await call(`/api/admin/reports/${item.id}/delete`, { body: {}, cookie })).status, 404);
});

test('bad bug reports are refused, bots are ignored, and each visitor is rate limited', async t => {
  const { call, cookie } = await start(t);
  const count = async () => (await (await call('/api/admin/reports', { cookie })).json()).reports.length;
  assert.equal((await call('/api/reports', { body: report({ message: 'broken' }) })).status, 400, 'too short');
  assert.equal((await call('/api/reports', { body: report({ message: 'x'.repeat(2001) }) })).status, 400, 'too long');
  assert.equal((await call('/api/reports', { body: report({ screenshot: Buffer.from('not an image at all').toString('base64') }) })).status, 415, 'not a picture');
  assert.equal((await call('/api/reports', { body: report({ screenshot: '@@@' }) })).status, 400);
  const huge = Buffer.concat([PNG, Buffer.alloc(2.6 * 1024 * 1024)]).toString('base64');
  assert.equal((await call('/api/reports', { body: report({ screenshot: huge }) })).status, 413, 'screenshot too large');
  assert.equal((await call('/api/reports', { headers: { 'Content-Type': 'text/plain' }, method: 'POST', body: undefined })).status, 400);
  assert.equal(await count(), 0, 'nothing bad was stored');

  assert.equal((await call('/api/reports', { body: report({ website: 'http://spam.example' }) })).status, 200);
  assert.equal(await count(), 0, 'the hidden field catches bots without saving anything');

  for (let i = 0; i < 5; i++) assert.equal((await call('/api/reports', { body: report() })).status, 201);
  assert.equal((await call('/api/reports', { body: report() })).status, 429);
  assert.equal(await count(), 5);

  const text = await (await call('/api/admin/reports', { cookie })).json();
  assert.equal(text.durable, true, 'a local disk counts as durable');
  assert.equal(text.storage, 'local');
});

test('the Vercel Blob store keeps text, screenshot and fixed marker as separate files and never overwrites', async () => {
  const files = new Map();
  const sdk = {
    async put(pathname, body, options) { files.set(pathname, { body: Buffer.from(body), uploadedAt: new Date(files.size + 1).toISOString(), options }); return { pathname, url: `https://blob.test/${pathname}` }; },
    async list({ prefix }) { return { blobs: [...files].filter(([name]) => name.startsWith(prefix)).map(([pathname, file]) => ({ pathname, url: `https://blob.test/${pathname}`, uploadedAt: file.uploadedAt })), hasMore: false }; },
    async get(pathname) { const file = files.get(pathname); return file ? { stream: new Blob([file.body]).stream() } : null; },
    async del(target) { for (const url of [target].flat()) files.delete(url.replace('https://blob.test/', '')); },
  };
  const store = blobStore({ sdk, token: 'test-token' });
  await store.add({ id: 'a'.repeat(24), created: 1000, message: 'First problem here', contact: '', page: '/', agent: 'x', shot: PNG, shotType: 'image/png' });
  await store.add({ id: 'b'.repeat(24), created: 2000, message: 'Second problem here', contact: 'me', page: '/play', agent: 'x' });
  assert.deepEqual([...files.keys()].sort(), [`reports/${'a'.repeat(24)}/report.json`, `reports/${'a'.repeat(24)}/shot`, `reports/${'b'.repeat(24)}/report.json`]);

  let list = await store.list();
  assert.deepEqual(list.map(item => [item.message, item.status, item.hasShot]), [['Second problem here', 'open', false], ['First problem here', 'open', true]]);
  assert.equal((await store.shot('a'.repeat(24))).type, 'image/png');
  assert.equal(await store.shot('b'.repeat(24)), null);

  assert.equal(await store.setStatus('a'.repeat(24), 'fixed'), true);
  assert.equal((await store.list()).find(item => item.created === 1000).status, 'fixed');
  assert.equal(await store.setStatus('a'.repeat(24), 'open'), true);
  assert.equal((await store.list()).find(item => item.created === 1000).status, 'open');
  assert.equal(await store.setStatus('c'.repeat(24), 'fixed'), false);

  assert.equal(await store.remove('a'.repeat(24)), true);
  list = await store.list();
  assert.equal(list.length, 1);
  assert.equal(await store.remove('a'.repeat(24)), false);
  assert.equal(await store.count(), 1);
});

test('on Vercel without a Blob store the admin is warned that reports are temporary', async t => {
  process.env.VERCEL = '1';
  t.after(() => { delete process.env.VERCEL; });
  const { call, cookie } = await start(t);
  assert.equal((await call('/api/reports', { body: report() })).status, 201);
  const list = await (await call('/api/admin/reports', { cookie })).json();
  assert.equal(list.durable, false);
  assert.equal(list.reports.length, 1, 'it still works for the time the process lives');
});

test('every page carries the Beta notice and the bug report form', async t => {
  const { call } = await start(t);
  for (const path of ['/', '/play', '/how-to-play', '/privacy', '/updates']) {
    const html = await (await call(path)).text();
    assert.match(html, /src="\/beta\.js"/, path);
  }
  const script = await (await call('/beta.js')).text();
  assert.match(script, /Beta/);
  assert.match(script, /Found a bug\?/);
  assert.match(script, /\/api\/reports/);
});
