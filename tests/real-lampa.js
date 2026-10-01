const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LAMPA = process.env.SERGEY_LAMPA_URL || 'http://127.0.0.1:18118/lampa-main/';
const PLUGIN_URL = process.env.SERGEY_PLUGIN_URL || '';
const PLUGIN = PLUGIN_URL ? '' : fs.readFileSync(path.resolve(__dirname, '..', 'js'), 'utf8');
const FIRE_UA = 'Mozilla/5.0 (Linux; Android 7.1.2; AFTMM) AppleWebKit/537.36 (KHTML, like Gecko) Silk/130.4.6 Safari/537.36';

async function boot(browser, ua, staleBackend=false) {
  const ctx = await browser.newContext(ua ? {userAgent: ua} : {});
  const page = await ctx.newPage();
  const backend = [];
  page.on('response', r => {
    const u = r.url();
    if (/18118\/(lite|lifeevents|externalids)/.test(u)) backend.push([r.status(),u]);
  });
  await page.goto(LAMPA,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(700);
  if ((await page.locator('body').innerText()).includes('Выберите свой язык')) {
    const ru = page.getByText('Русский',{exact:true}).first();
    if (await ru.count()) await ru.click();
  }
  await page.waitForTimeout(2200);
  if (staleBackend) await page.evaluate(() => { Lampa.Storage.set('sergey_online_backend','https://ab2024.ru'); Lampa.Storage.set('sergey_online_backend_custom',false); });
  if (PLUGIN_URL) await page.addScriptTag({url:PLUGIN_URL});
  else await page.addScriptTag({content:PLUGIN});
  await page.waitForTimeout(500);
  return {ctx,page,backend};
}

async function checkCase(browser,label,ua,movie,minSources,staleBackend=false) {
  const {ctx,page,backend} = await boot(browser,ua,staleBackend);
  await page.evaluate(m => {
    Lampa.Activity.push({
      url:'', title:'Sergey Online', component:'sergey_online',
      search:m.title, search_one:m.title, search_two:m.original_title,
      movie:m, page:1, clarification:false
    });
  },movie);
  await page.waitForTimeout(2400);
  if (staleBackend) {
    const migrated = await page.evaluate(() => Lampa.Storage.get('sergey_online_backend',''));
    if (migrated !== 'https://sergey-online-backend.onrender.com') throw new Error(label+': stale backend not migrated: '+migrated);
  }
  const sort = page.locator('.filter--sort').last();
  if (!(await sort.count())) throw new Error(label+': Source filter missing');
  await sort.click();
  await page.waitForTimeout(400);
  const items = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.selectbox .selector'))
      .map(e=>e.innerText.trim()).filter(Boolean)
  );
  const unique = [...new Set(items)];
  const text = unique.join('\n').toLowerCase();
  for (const n of ['filmix','collaps','kodik','lumex','hdvb','uaflix']) {
    if (!text.includes(n)) throw new Error(label+': missing '+n);
  }
  if (unique.length < minSources) throw new Error(label+': only '+unique.length+' source rows');
  if (unique.length !== items.length) throw new Error(label+': duplicate source rows');
  const bad = backend.filter(x=>x[0] >= 400);
  if (bad.length) throw new Error(label+': backend HTTP errors '+JSON.stringify(bad.slice(0,5)));
  console.log('PASS',label,'sources='+unique.length,'backendCalls='+backend.length);
  console.log('  sample:',unique.slice(0,16).join(', '));
  await ctx.close();
}


async function checkManifestLaunch(browser,label,ua,movie) {
  const {ctx,page,backend} = await boot(browser,ua,true);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));

  await page.evaluate(m => {
    var list = Lampa.Manifest.plugins || [];
    var manifest = Array.isArray(list)
      ? list.find(x => x && x.component === 'sergey_online')
      : list;
    if (!manifest || typeof manifest.onContextLauch !== 'function') {
      throw new Error('Sergey manifest launch missing');
    }
    manifest.onContextLauch(m);
  },movie);

  await page.waitForTimeout(2600);
  const sort = page.locator('.filter--sort').last();
  if (!(await sort.count())) throw new Error(label+': Source filter missing after manifest launch');
  await sort.click();
  await page.waitForTimeout(400);
  const items = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.selectbox .selector'))
      .map(e=>e.innerText.trim()).filter(Boolean)
  );
  if (items.length < 50) throw new Error(label+': only '+items.length+' source rows after manifest launch');
  if (errors.some(e => /resetTemplates|ReferenceError/i.test(e))) {
    throw new Error(label+': page error '+errors.join(' | '));
  }
  const migrated = await page.evaluate(() => Lampa.Storage.get('sergey_online_backend',''));
  if (migrated !== 'https://sergey-online-backend.onrender.com') {
    throw new Error(label+': backend not migrated: '+migrated);
  }
  const bad = backend.filter(x=>x[0] >= 400);
  if (bad.length) throw new Error(label+': backend HTTP errors '+JSON.stringify(bad.slice(0,5)));
  console.log('PASS',label,'sources='+items.length,'errors='+errors.length);
  await ctx.close();
}

(async()=>{
  const browser = await chromium.launch({headless:true});
  try {
    const movie = {
      id:603,tmdb_id:603,title:'The Matrix',original_title:'The Matrix',
      release_date:'1999-03-30',original_language:'en'
    };
    await checkCase(browser,'Chrome movie',null,movie,50);
    await checkCase(browser,'FireTV/Silk movie',FIRE_UA,movie,50);
    await checkCase(browser,'FireTV/Silk stale-backend migration',FIRE_UA,movie,50,true);
    await checkManifestLaunch(browser,'FireTV/Silk manifest launch',FIRE_UA,movie);
  } finally { await browser.close(); }
  console.log('\nREAL LAMPA PLAYWRIGHT PASS');
})().catch(e=>{console.error('FAIL:',e.message);process.exit(1)});
