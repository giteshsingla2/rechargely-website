// Minimal backend: serves the static site and stores recharge requests.
// No dependencies — run with `npm start` (Node 18+).

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const DATA_FILE = path.join(DATA_DIR, 'recharge-requests.jsonl');
const PORT = Number(process.env.PORT) || 8090;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const MAX_BODY = 4 * 1024;
const CONSENT_VERSION = '2026-10-24';

// Reuse the same plan list the browser uses, so the server can reject unknown plans.
const { PLANS, OPERATORS } = vm.runInNewContext(
  fs.readFileSync(path.join(ROOT, 'assets/js/data.js'), 'utf8') + ';({ PLANS, OPERATORS })'
);

fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------- helpers ---------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

function json(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
}

function clientIp(req) {
  // Trust X-Forwarded-For only when running behind a proxy you control (e.g. CloudPanel's Nginx).
  // Use the last entry: that's the one our proxy added; earlier entries can be faked by the client.
  const fwd = process.env.TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '') : '';
  return (fwd ? fwd.split(',').pop() : req.socket.remoteAddress || '').trim();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) {
        // Stop buffering but drain the rest so we can still send a 413 response.
        req.removeAllListeners('data');
        req.resume();
        reject(Object.assign(new Error('Body too large'), { status: 413 }));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/* ---------- rate limit: 10 submissions per IP per 10 minutes ---------- */

const hits = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 10;

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_HITS;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, ts] of hits) if (ts.every(t => now - t >= WINDOW_MS)) hits.delete(ip);
}, WINDOW_MS).unref();

/* ---------- validation ---------- */

function validate(body) {
  const errors = {};
  const name = String(body.name ?? '').trim().replace(/\s+/g, ' ');
  const mobile = String(body.mobile ?? '').trim();
  const pin = String(body.pin ?? '').trim();
  const city = String(body.city ?? '').trim().replace(/\s+/g, ' ');
  const plan = PLANS.find(p => p.id === body.plan);

  if (name.length < 2 || name.length > 80) errors.name = 'Enter your name.';
  if (!/^[6-9]\d{9}$/.test(mobile)) errors.mobile = 'Enter a valid 10-digit mobile number.';
  if (!/^[1-9]\d{5}$/.test(pin)) errors.pin = 'Enter a 6-digit PIN.';
  if (city.length < 2 || city.length > 80) errors.city = 'Enter your city.';
  if (!plan) errors.plan = 'Unknown plan.';
  if (body.consent !== true) errors.consent = 'Consent is required.';

  return { errors, record: { name, mobile, pin, city, plan } };
}

/* ---------- storage (JSON Lines: one request per line) ---------- */

function saveRequest(rec) {
  fs.appendFileSync(DATA_FILE, JSON.stringify(rec) + '\n', { mode: 0o600 });
}

function loadRequests() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return fs.readFileSync(DATA_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean)
    .reverse(); // newest first
}

function toCsv(rows) {
  const cols = ['id', 'createdAt', 'operator', 'planId', 'price', 'name', 'mobile', 'pin', 'city', 'consentVersion'];
  // Prefix cells that start with formula characters so spreadsheets don't execute them.
  const cell = v => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n');
}

function isAdmin(req) {
  if (!ADMIN_TOKEN) return false;
  const given = Buffer.from(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  const expected = Buffer.from(ADMIN_TOKEN);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/* ---------- API ---------- */

async function handleCreate(req, res) {
  if (!String(req.headers['content-type'] || '').includes('application/json')) {
    return json(res, 415, { error: 'Send JSON.' });
  }
  if (rateLimited(clientIp(req))) {
    return json(res, 429, { error: 'Too many requests. Please try again in a few minutes.' });
  }

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (err) {
    return json(res, err.status || 400, { error: 'Invalid request.' });
  }
  if (!body || typeof body !== 'object') return json(res, 400, { error: 'Invalid request.' });

  // Honeypot: real users never fill this hidden field.
  if (body.website) return json(res, 201, { ok: true });

  const { errors, record } = validate(body);
  if (Object.keys(errors).length) return json(res, 422, { error: 'Please check your details.', fields: errors });

  const stored = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    operator: record.plan.op,
    planId: record.plan.id,
    price: record.plan.price,
    name: record.name,
    mobile: record.mobile,
    pin: record.pin,
    city: record.city,
    consentVersion: CONSENT_VERSION,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
  };
  saveRequest(stored);
  json(res, 201, { ok: true, id: stored.id });
}

function handleList(req, res, url) {
  if (!isAdmin(req)) return json(res, 401, { error: 'Unauthorized.' });
  let rows = loadRequests();
  const mobile = url.searchParams.get('mobile');
  if (mobile) rows = rows.filter(r => r.mobile === mobile);
  if (url.pathname.endsWith('.csv')) {
    return send(res, 200, toCsv(rows), {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="recharge-requests.csv"',
      'Cache-Control': 'no-store',
    });
  }
  json(res, 200, { count: rows.length, requests: rows });
}

/* ---------- static files ---------- */

// Never serve backend code, stored data, or dotfiles (.env, .claude, …).
const BLOCKED = /^\/(server|data|node_modules)(\/|$)|\/\.|^\/package(-lock)?\.json$/;

function redirect(res, location) {
  send(res, 301, null, { Location: location });
}

// Pages live at clean URLs: /best-jio-recharge-plans is served from best-jio-recharge-plans.html.
function serveStatic(req, res, url) {
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return send(res, 400, 'Bad request'); }
  if (BLOCKED.test(pathname)) return send(res, 404, 'Not found');

  // Old-style and duplicate URLs redirect to the one canonical URL.
  if (pathname === '/index.html') return redirect(res, '/' + url.search);
  if (pathname.endsWith('.html') && pathname !== '/404.html') return redirect(res, pathname.slice(0, -5) + url.search);
  if (pathname.length > 1 && pathname.endsWith('/')) return redirect(res, pathname.replace(/\/+$/, '') + url.search);

  if (pathname === '/') pathname = '/index.html';
  else if (!path.extname(pathname)) pathname += '.html';

  const file = path.join(ROOT, pathname);
  if (!file.startsWith(ROOT + path.sep)) return send(res, 404, 'Not found');

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      return fs.readFile(path.join(ROOT, '404.html'), (e, html) =>
        send(res, 404, e ? 'Not found' : html, { 'Content-Type': MIME['.html'] }));
    }
    const ext = path.extname(file).toLowerCase();
    // Revalidate every time (cheap 304s) so edits to CSS/JS show up immediately after a deploy.
    const lastModified = stat.mtime.toUTCString();
    const headers = { ...SECURITY_HEADERS, 'Cache-Control': 'no-cache', 'Last-Modified': lastModified };
    const since = Date.parse(req.headers['if-modified-since'] || '');
    if (since && Math.floor(stat.mtimeMs / 1000) <= Math.floor(since / 1000)) {
      return send(res, 304, null, headers);
    }
    res.writeHead(200, { ...headers, 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------- router ---------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/recharge-requests' && req.method === 'POST') return await handleCreate(req, res);
    if ((url.pathname === '/api/recharge-requests' || url.pathname === '/api/recharge-requests.csv') && req.method === 'GET') {
      return handleList(req, res, url);
    }
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Not found.' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: 'Something went wrong. Please try again.' });
  }
});

server.listen(PORT, () => {
  console.log(`Site running at http://localhost:${PORT}`);
  console.log(`Saving requests to ${DATA_FILE}`);
  if (!ADMIN_TOKEN) console.log('ADMIN_TOKEN not set: the admin list/export endpoints are disabled.');
});
