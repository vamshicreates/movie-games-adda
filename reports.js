// Bug reports from players: a description, an optional contact and an optional screenshot.
//
// Where they are kept depends on the host. With a disk (local, or any Node host with a volume) they live in the
// SQLite file. On Vercel the disk is wiped on every cold start, so when a Vercel Blob store is connected
// (BLOB_READ_WRITE_TOKEN is set) they are kept there instead. Without it on Vercel, reports are still accepted and
// written to the function log, but the admin panel warns that they are not saved permanently.
import { createHash, randomBytes } from 'node:crypto';

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;
export const SHOT_MAX = 2.5 * 1024 * 1024;
const BODY_MAX = 4 * 1024 * 1024; // Vercel rejects larger bodies anyway
const PER_HOUR = 5;
const KEEP = 400; // most recent reports the admin list shows

const text = (value, max) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const imageType = bytes => {
  const head = bytes.subarray(0, 16).toString('latin1');
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (head.startsWith('\x89PNG\r\n\x1a\n')) return 'image/png';
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return 'image/webp';
  return '';
};

// ---- Storage backends. Both are async so the rest of the code does not care which one is in use. ----

export function sqliteStore(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS bug_reports (
    id TEXT PRIMARY KEY, created INTEGER NOT NULL, message TEXT NOT NULL, contact TEXT NOT NULL, page TEXT NOT NULL,
    agent TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', shot BLOB, shot_type TEXT)`);
  return {
    kind: 'local',
    async add(report) {
      db.prepare('INSERT INTO bug_reports (id, created, message, contact, page, agent, shot, shot_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(report.id, report.created, report.message, report.contact, report.page, report.agent, report.shot ?? null, report.shotType ?? null);
    },
    async list() {
      return db.prepare('SELECT id, created, message, contact, page, agent, status, shot IS NOT NULL AS hasShot FROM bug_reports ORDER BY created DESC LIMIT ?')
        .all(KEEP).map(row => ({ ...row, hasShot: Boolean(row.hasShot) }));
    },
    async count() { return db.prepare('SELECT COUNT(*) AS n FROM bug_reports').get().n; },
    async shot(id) {
      const row = db.prepare('SELECT shot, shot_type FROM bug_reports WHERE id = ?').get(id);
      return row?.shot ? { bytes: Buffer.from(row.shot), type: row.shot_type } : null;
    },
    async setStatus(id, status) { return db.prepare('UPDATE bug_reports SET status = ? WHERE id = ?').run(status, id).changes > 0; },
    async remove(id) { return db.prepare('DELETE FROM bug_reports WHERE id = ?').run(id).changes > 0; },
  };
}

// Vercel Blob keeps each report as three kinds of file under reports/<id>/:
//   report.json  the text (never changed after it is written)
//   shot         the screenshot, if there is one
//   fixed        an empty marker; its presence means the report is marked fixed
// Nothing is ever overwritten, so there is no stale cache to worry about, and the admin list comes from one listing.
// `access` must match the kind of store that was created in Vercel: private (the default, and the right choice for
// screenshots and contact details) or public.
export function blobStore({ sdk, token, access = 'private', read }) {
  const put = (pathname, body, contentType) => sdk.put(pathname, body, { access, addRandomSuffix: false, allowOverwrite: true, contentType, token });
  const fetchBlob = read ?? (async pathname => {
    const result = await sdk.get(pathname, { access, token, useCache: false });
    return result?.stream ? Buffer.from(await new Response(result.stream).arrayBuffer()) : null;
  });
  async function listAll() {
    const blobs = [];
    let cursor;
    do {
      const page = await sdk.list({ prefix: 'reports/', limit: 1000, cursor, token });
      blobs.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor && blobs.length < 6000);
    return blobs;
  }
  const group = blobs => {
    const byId = new Map();
    for (const blob of blobs) {
      const [, id, file] = blob.pathname.split('/');
      if (!id || !file) continue;
      const entry = byId.get(id) ?? { id };
      entry[file === 'report.json' ? 'json' : file] = blob;
      byId.set(id, entry);
    }
    return byId;
  };
  return {
    kind: 'blob',
    async add(report) {
      await put(`reports/${report.id}/report.json`, JSON.stringify({ id: report.id, created: report.created, message: report.message, contact: report.contact, page: report.page, agent: report.agent }), 'application/json');
      if (report.shot) await put(`reports/${report.id}/shot`, report.shot, report.shotType);
    },
    async list() {
      const entries = [...group(await listAll()).values()].filter(entry => entry.json)
        .sort((a, b) => new Date(b.json.uploadedAt) - new Date(a.json.uploadedAt)).slice(0, KEEP);
      const reports = await Promise.all(entries.map(async entry => {
        try {
          const data = JSON.parse((await fetchBlob(entry.json.pathname)).toString('utf8'));
          return { ...data, status: entry.fixed ? 'fixed' : 'open', hasShot: Boolean(entry.shot) };
        } catch { return null; }
      }));
      return reports.filter(Boolean).sort((a, b) => b.created - a.created);
    },
    async count() { return group(await listAll()).size; },
    async shot(id) {
      const bytes = await fetchBlob(`reports/${id}/shot`);
      return bytes ? { bytes, type: imageType(bytes) || 'image/jpeg' } : null;
    },
    async setStatus(id, status) {
      const entry = group((await sdk.list({ prefix: `reports/${id}/`, limit: 10, token })).blobs).get(id);
      if (!entry?.json) return false;
      if (status === 'fixed' && !entry.fixed) await put(`reports/${id}/fixed`, '1', 'text/plain');
      if (status === 'open' && entry.fixed) await sdk.del(entry.fixed.url, { token });
      return true;
    },
    async remove(id) {
      const found = (await sdk.list({ prefix: `reports/${id}/`, limit: 10, token })).blobs;
      if (!found.length) return false;
      await sdk.del(found.map(blob => blob.url), { token });
      return true;
    },
  };
}

async function chooseStore(db, env) {
  if (env.BLOB_READ_WRITE_TOKEN) {
    try { return blobStore({ sdk: await import('@vercel/blob'), token: env.BLOB_READ_WRITE_TOKEN, access: env.BLOB_ACCESS === 'public' ? 'public' : 'private' }); }
    catch (error) { console.error('[reports] Vercel Blob is configured but could not be loaded:', error.message); }
  }
  return sqliteStore(db);
}

// ---- HTTP routes ----

export function createReports({ db, readBody, RequestError, json, env = process.env, store: given }) {
  const fail = (status, message) => { throw new RequestError(status, message); };
  const ready = given ? Promise.resolve(given) : chooseStore(db, env);
  const recent = new Map();
  const onVercel = Boolean(env.VERCEL);

  async function submit(req, res, now) {
    let body;
    try { body = JSON.parse(await readBody(req, BODY_MAX)); } catch (error) { if (error instanceof RequestError) throw error; fail(400, 'Enter valid JSON.'); }
    if (!body || typeof body !== 'object') fail(400, 'Enter valid JSON.');
    if (typeof body.website === 'string' && body.website) return json(res, { ok: true }); // a bot filled the hidden field
    const message = text(body.message, MESSAGE_MAX + 1);
    if (message.length < MESSAGE_MIN) fail(400, `Tell us a little more about what went wrong (at least ${MESSAGE_MIN} characters).`);
    if (message.length > MESSAGE_MAX) fail(400, `Keep the description under ${MESSAGE_MAX} characters.`);
    const contact = text(body.contact, 120);
    const page = text(body.page, 200).replace(/^https?:\/\/[^/]+/i, '') || '/';
    const agent = text(req.headers['user-agent'], 200);

    let shot = null;
    let shotType = null;
    if (body.screenshot) {
      if (typeof body.screenshot !== 'string') fail(400, 'The screenshot could not be read.');
      const data = body.screenshot.replace(/^data:[^;,]*;base64,/, '');
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) fail(400, 'The screenshot could not be read.');
      shot = Buffer.from(data, 'base64');
      if (shot.length > SHOT_MAX) fail(413, 'That screenshot is too large. Try a smaller one (under 2.5 MB).');
      shotType = imageType(shot);
      if (!shotType) fail(415, 'Attach a JPG, PNG or WebP screenshot.');
    }

    const address = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
    const who = createHash('sha256').update(`mga-report:${address}`).digest('hex').slice(0, 16);
    const stamps = (recent.get(who) ?? []).filter(time => now - time < 3_600_000);
    if (stamps.length >= PER_HOUR) fail(429, 'You have sent a few reports already. Please try again in a while.');
    const store = await ready;
    if ((await store.count()) >= 3000) fail(503, 'Bug reports are full right now. Please try again later.');
    recent.set(who, [...stamps, now]);

    const report = { id: randomBytes(12).toString('hex'), created: now, message, contact, page, agent, shot, shotType };
    try { await store.add(report); }
    catch (error) {
      console.error('[bug-report] could not save:', error.message);
      fail(503, 'We could not save your report right now. Please try again in a moment.');
    }
    console.log('[bug-report]', JSON.stringify({ id: report.id, page, contact, message, screenshot: Boolean(shot) })); // the log survives when storage does not
    return json(res, { ok: true }, 201);
  }

  async function api(req, res, path, now = Date.now()) {
    if (req.method === 'POST' && path === '/api/reports') return submit(req, res, now);
    return false;
  }

  // Admin routes. The caller has already checked the admin sign-in.
  async function adminApi(req, res, path) {
    const store = await ready;
    if (req.method === 'GET' && path === '/api/admin/reports') {
      return json(res, { storage: store.kind, durable: store.kind === 'blob' || !onVercel, reports: await store.list() });
    }
    const match = /^\/api\/admin\/reports\/([a-f0-9]{24})(?:\/(screenshot|status|delete))?$/.exec(path);
    if (!match) return false;
    const [, id, action] = match;
    if (req.method === 'GET' && action === 'screenshot') {
      const shot = await store.shot(id);
      if (!shot) fail(404, 'There is no screenshot for that report.');
      res.writeHead(200, { 'Content-Type': shot.type, 'Content-Length': shot.bytes.length, 'Cache-Control': 'private, no-store' });
      return res.end(shot.bytes);
    }
    if (req.method === 'POST' && action === 'status') {
      let body;
      try { body = JSON.parse(await readBody(req, 4096)); } catch (error) { if (error instanceof RequestError) throw error; fail(400, 'Enter valid JSON.'); }
      if (body?.status !== 'open' && body?.status !== 'fixed') fail(400, 'Choose open or fixed.');
      if (!(await store.setStatus(id, body.status))) fail(404, 'That report no longer exists.');
      return json(res, { ok: true });
    }
    if (req.method === 'POST' && action === 'delete') {
      if (!(await store.remove(id))) fail(404, 'That report no longer exists.');
      return json(res, { ok: true });
    }
    return false;
  }

  return { api, adminApi };
}
