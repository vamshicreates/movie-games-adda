import { mkdirSync } from 'node:fs';
import { buildServer } from '../server.js';

// Vercel has no persistent disk: the SQLite file lives in /tmp and is re-seeded
// with the starter sets on every cold start. Fine for a demo; use a Node host
// with a persistent volume for real publishing.
const password = process.env.ADMIN_PASSWORD?.trim();
if (!password || password.length < 12) {
  throw new Error('Set ADMIN_PASSWORD (12+ characters) in the Vercel project settings.');
}
mkdirSync('/tmp/adda', { recursive: true });
const server = buildServer({ dbPath: '/tmp/adda/adda.sqlite', adminPassword: password });

export default function handler(req, res) {
  req.socket.encrypted ??= true;
  server.emit('request', req, res);
}
