const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LAMPA = process.env.SERGEY_LAMPA_URL || 'http://127.0.0.1:18118/lampa-main/';
const PLUGIN_URL = process.env.SERGEY_PLUGIN_URL || '';
const PLUGIN = PLUGIN_URL ? '' : fs.readFileSync(path.resolve(__dirname, '..', 'js'), 'utf8');

async function boot(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(LAMPA, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(600);

  if ((await page.locator('body').innerText()).includes('Выберите свой язык')) {
    const ru = page.getByText('Русский', { exact: true }).first();
    if (await ru.count()) await ru.click();
  }

  await page.waitForTimeout(1700);
  if (PLUGIN_URL) await page.addScriptTag({ url: PLUGIN_URL });
  else await page.addScriptTag({ content: PLUGIN });
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    window.__sergeyPlayed = [];
    Lampa.Player.play = function (item) {
      window.__sergeyPlayed.push(item);
    };
  });

  return { ctx, page };
}

async function openMovie(page, movie) {
  await page.evaluate((m) => {
    Lampa.Activity.push({
      url: '',
      title: 'Sergey Online',
      component: 'sergey_online',
      search: m.title || m.name,
      search_one: m.title || m.name,
      search_two: m.original_title || m.original_name || m.title || m.name,
      movie: m,
      page: 1,
      clarification: false
    });
  }, movie);

  await page.waitForTimeout(2500);
}

async function selectSource(page, prefix) {
  const sort = page.locator('.filter--sort').last();
  if (!(await sort.count())) throw new Error('Source filter missing');
  await sort.click();
  await page.waitForTimeout(250);

  const rows = page.locator('.selectbox .selector');
  const texts = await rows.allInnerTexts();

  const exact = texts.findIndex((t) =>
    t.trim().toLowerCase().startsWith(prefix.toLowerCase())
  );

  if (exact < 0) throw new Error('Source not found: ' + prefix);
  await rows.nth(exact).click();
  await page.waitForTimeout(1900);

  return texts;
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    {
      const { ctx, page } = await boot(browser);
      const matrix = {
        id: 603,
        tmdb_id: 603,
        title: 'The Matrix',
        original_title: 'The Matrix',
        release_date: '1999-03-30',
        original_language: 'en'
      };

      await openMovie(page, matrix);
      const sources = await selectSource(page, 'Collaps ');

      if (sources.some((x) => /^Collaps-dash\b/i.test(x.trim()))) {
        throw new Error('duplicate Collaps-dash is visible');
      }

      await page.waitForFunction(
        () => document.querySelectorAll('.online-prestige').length > 0,
        { timeout: 10000 }
      );

      const first = page.locator('.online-prestige--full').first();
      const label = (await first.innerText()).trim().split('\n')[0];
      const clickable = page.getByText(label, { exact: true }).last();
      if (!(await clickable.count())) throw new Error('Collaps playable label missing: ' + label);
      await clickable.click();
      await page.waitForTimeout(500);

      const played = await page.evaluate(() => window.__sergeyPlayed);
      if (!played.length) throw new Error('Collaps did not call Lampa.Player.play');
      if (!String(played[0].url || '').includes('/proxy/')) {
        throw new Error('Collaps did not return backend proxy media URL');
      }

      console.log('PASS Collaps playback:', label, String(played[0].url).slice(0, 85) + '...');
      await ctx.close();
    }

    {
      const { ctx, page } = await boot(browser);
      const loveMagic = {
        id: 0,
        tmdb_id: 0,
        title: 'Любовная магия',
        name: 'Любовная магия',
        original_title: 'Любовная магия',
        original_name: 'Любовная магия',
        first_air_date: '2021-01-01',
        number_of_seasons: 1,
        original_language: 'ru'
      };

      await openMovie(page, loveMagic);
      await selectSource(page, 'Filmix ');

      await page.waitForFunction(
        () => document.querySelectorAll('.online-prestige').length >= 2,
        { timeout: 20000 }
      );

      const count = await page.locator('.online-prestige').count();
      if (count < 2) throw new Error('Filmix returned too few rows for Любовная магия: ' + count);

      console.log('PASS Filmix Любовная магия rows=' + count);
      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  console.log('\nPLAYBACK SMOKE PASS');
})().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
