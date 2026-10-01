const fs = require('fs');
const vm = require('vm');
const path = require('path');

const files = ['js','p.js','plugin.js','online.js','u.js'];
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js'), 'utf8');
let failures = 0;
function check(name, ok, detail='') {
  console.log((ok ? 'PASS' : 'FAIL') + ': ' + name + (detail ? ' ('+detail+')' : ''));
  if (!ok) failures++;
}
check('version 1.3.0', src.includes('Sergey Online 1.3.0'));
check('stale backend migration', src.includes('SERGEY_OLD_BACKENDS') && src.includes('sergey_online_backend_custom') && src.includes('https://ab2024.ru'));
check('backend preflight before open', src.includes('openSergeyActivity') && src.includes('/version?type=hash&_='));
check('resetTemplates scope bridge', src.includes('var sergeyResetTemplates = null') && src.includes('sergeyResetTemplates = resetTemplates') && src.includes('if (sergeyResetTemplates) sergeyResetTemplates()'));
check('cloud backend default', src.includes("SERGEY_DEFAULT_BACKEND = 'https://sergey-online-backend.onrender.com'"));
check('LAN backends migrated', src.includes('http://10.129.1.174:18118') && src.includes('http://10.129.1.182:18118') && src.includes('10\\.129\\.1\\.\\d+:18118'));
check('cold start retry', src.includes('var attempts = 5') && src.includes('probe.timeout(15000)'));
check('no hostname/127 auto backend substitution', !src.includes('location.hostname') && !src.includes("SERGEY_DEFAULT_BACKEND = 'http://127.0.0.1'"));
check('separate Sergey Online button', src.includes('sergey-online--button') && src.includes("component: 'sergey_online'"));
check('native source picker', src.includes('new Lampa.Filter') && src.includes("filter.set('sort'"));
check('dynamic discovery', src.includes('lite/events?life=true') && src.includes('lifeevents?memkey='));
check('provider state preserved', src.includes('online_choice_') && src.includes('online_last_balanser'));
check('RCH loader preserved', src.includes('nws-client-es5.js') && src.includes('RchClient'));
check('no Internet Archive/Open JSON placeholders', !/archive\.org|open\s*json/i.test(src));
check('no Telegram/Showy marketing', !/t\.me\/|showybot|ShowyMarketingRuntime/i.test(src));
const m = src.match(/balansers_sync\s*=\s*\[([\s\S]*?)\]/);
if (m) {
  const a = [...m[1].matchAll(/["']([^"']+)["']/g)].map(x=>x[1]);
  check('provider seed inventory >= 70', a.length >= 70, 'count='+a.length);
  check('no exact duplicates in seed inventory', new Set(a).size === a.length, 'unique='+new Set(a).size);
  check('visible alias canonicalization', src.includes("'collaps-dash': 'collaps'") && src.includes("'rc/filmix': 'filmix'"));
} else check('balansers_sync found', false);
for (const f of files) {
  const other = fs.readFileSync(path.join(root, f), 'utf8');
  check('alias '+f+' identical', other === src);
}
try { new vm.Script(src); check('JavaScript parses', true); }
catch(e) { check('JavaScript parses', false, e.message); }
if (failures) process.exit(1);
console.log('\nPLUGIN STATIC PASS');
