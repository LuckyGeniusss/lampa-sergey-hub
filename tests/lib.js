// Shared test helpers. No external deps; uses Node 18+ built-in fetch.
const BACKEND = (process.env.SERGEY_BACKEND || 'https://sergey-online-backend.onrender.com').replace(/\/$/, '');
const TIMEOUT_MS = parseInt(process.env.SERGEY_TIMEOUT_MS || '30000', 10);

async function get(path, opts = {}) {
  const u = BACKEND + path;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(u, { ...opts, signal: c.signal, redirect: 'follow' });
    return r;
  } finally {
    clearTimeout(t);
  }
}

async function getJson(path) {
  const r = await get(path);
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch (e) { body = text; }
  return { status: r.status, ok: r.ok, body, headers: r.headers };
}

function logSection(name) {
  console.log('\n== ' + name + ' ==');
}

module.exports = { BACKEND, TIMEOUT_MS, get, getJson, logSection };
