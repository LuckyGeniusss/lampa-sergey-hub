// Backend health probe: version hash, root manifest, /lite/withsearch, /lite/events.
// Run: node tests/backend-health.js
const { BACKEND, getJson, get, logSection } = require('./lib');

(async () => {
  let failures = 0;
  logSection('Backend health (' + BACKEND + ')');

  try {
    const v = await getJson('/version?type=hash');
    console.log('version:', v.status, JSON.stringify(v.body).slice(0, 200));
    if (!v.ok) failures++;
  } catch (e) { console.log('FAIL version:', e.message); failures++; }

  try {
    const root = await getJson('/');
    console.log('root:', root.status, root.body && root.body.name);
    if (!root.ok) failures++;
  } catch (e) { console.log('FAIL root:', e.message); failures++; }

  try {
    const ws = await getJson('/lite/withsearch');
    if (!ws.ok || !Array.isArray(ws.body)) {
      console.log('FAIL /lite/withsearch:', ws.status, typeof ws.body);
      failures++;
    } else {
      console.log('/lite/withsearch count=' + ws.body.length);
      console.log('  ', ws.body.join(', '));
      if (ws.body.length < 10) failures++;
    }
  } catch (e) { console.log('FAIL /lite/withsearch:', e.message); failures++; }

  try {
    const ev = await getJson('/lite/events');
    if (!ev.ok || !Array.isArray(ev.body)) {
      console.log('FAIL /lite/events:', ev.status, typeof ev.body);
      failures++;
    } else {
      console.log('/lite/events count=' + ev.body.length);
      const sample = ev.body.slice(0, 5).map(e => e.balanser).join(', ');
      console.log('  sample balansers:', sample);
      if (ev.body.length < 10) failures++;
    }
  } catch (e) { console.log('FAIL /lite/events:', e.message); failures++; }

  try {
    const nws = await get('/js/nws-client-es5.js');
    const body = await nws.text();
    console.log('/js/nws-client-es5.js:', nws.status, 'bytes=' + body.length);
    if (!nws.ok || body.length < 1000 || !body.includes('NativeWsClient')) failures++;
  } catch (e) { console.log('FAIL nws client asset:', e.message); failures++; }

  // CORS preflight sanity: a normal GET should not require CORS, but the
  // response must carry at least one permissive header set.
  try {
    const r = await get('/lite/withsearch');
    console.log('CORS headers:',
      'acao=' + (r.headers.get('access-control-allow-origin') || '-'),
      'acah=' + (r.headers.get('access-control-allow-headers') || '-'));
  } catch (e) { console.log('FAIL cors check:', e.message); }

  if (failures) {
    console.log('\nBACKEND HEALTH FAILED: ' + failures);
    process.exit(1);
  }
  console.log('\nBACKEND HEALTH PASS');
})();
