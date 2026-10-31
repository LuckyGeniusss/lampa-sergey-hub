// Shared test helpers. No external deps; uses Node 18+ built-in fetch.
const BACKEND = (process.env.SERGEY_BACKEND || 'https://sergey-online-backend.onrender.com').replace(/\/$/, '');
const TIMEOUT_MS = parseInt(process.env.SERGEY_TIMEOUT_MS || '30000', 10);

// Retry only idempotent GET requests on transient network/backend failures.
async function get(path, opts = {}) {
  const url = BACKEND + path;
  const retryable = !opts.method || String(opts.method).toUpperCase() === 'GET';
  const tries = retryable ? 3 : 1;
  for (let attempt = 1; attempt <= tries; attempt++) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, { ...opts, signal: c.signal, redirect: 'follow' });
      if (retryable && attempt < tries && [429, 502, 503, 504].includes(r.status)) {
        await r.body?.cancel().catch(() => {});
        console.warn('Transient HTTP ' + r.status + ' for ' + path + '; retry ' + attempt);
      } else {
        return r;
      }
    } catch (e) {
      if (attempt === tries) throw e;
      console.warn('Transient fetch error for ' + path + ' (' + e.message + '); retry ' + attempt);
    } finally {
      clearTimeout(t);
    }
    await new Promise(resolve => setTimeout(resolve, 900 * attempt));
  }
  throw new Error('GET retries exhausted: ' + path);
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
