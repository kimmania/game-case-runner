/** WebKit smoke test: serve dist, screenshot key screens to docs/smoke/.
 * Uses ?test=1 (skip tutorial, reduced motion) for stable screenshots. */
import { webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

const DIST = new URL('../dist', import.meta.url).pathname;
const OUT = new URL('../docs/smoke', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    p = p.replace(/^\/game-case-runner\//, '/'); // vite base path
    if (p === '/') p = '/index.html';
    let file = join(DIST, p);
    if (!(await stat(file).catch(() => null))?.isFile()) file = join(DIST, 'index.html');
    res.setHeader('content-type', MIME[extname(file)] ?? 'application/octet-stream');
    res.end(await readFile(file));
  } catch (e) { res.statusCode = 500; res.end(String(e)); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
await mkdir(OUT, { recursive: true });

const browser = await webkit.launch();
const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const shot = (name) => page.screenshot({ path: join(OUT, name) });

try {
  // (a) tier select
  await page.goto(`${base}/?test=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.tier-card');
  await shot('01-tier-select.png');

  // start Tier 1, pick a player case
  await page.locator('.tier-card:not(.locked)').first().click();
  await page.waitForSelector('.case-wall .case');
  await page.locator('.case:not([disabled])').first().click();

  // (b) case wall mid-game with clock ring — open a couple of cases
  await page.locator('.case:not([disabled])').first().click();
  await page.locator('.case:not([disabled])').first().click();
  await shot('02-case-wall-clock-ring.png');

  // finish round 1 (6 picks total) to trigger the offer panel
  for (let i = 0; i < 4; i++) {
    await page.locator('.case:not([disabled])').first().click();
  }

  // (c) offer panel with decay bar + split slider
  await page.waitForSelector('.offer-panel.visible', { timeout: 10000 });
  await page.locator('.offer-panel.visible').screenshot({ path: join(OUT, '03-offer-panel-split.png') });

  // (d) result screen via full deal
  await page.getByRole('button', { name: '🤝 DEAL' }).click();
  await page.waitForSelector('.result-card', { timeout: 10000 });
  await shot('04-result-chain.png');

  console.log('SMOKE OK — screenshots in docs/smoke/');
} finally {
  await browser.close();
  server.close();
}
