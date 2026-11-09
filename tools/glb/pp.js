// Run a local page in headless Edge (puppeteer), wait for window.RESULT, screenshot it, optionally run an extractor.
// usage: node pp.js page.html outName [w h] [extract.js]
const path = require('path');
// puppeteer-core is not a game dependency: install it outside the repo and point PUPPETEER at it if needed
const puppeteer = require(process.env.PUPPETEER || 'puppeteer-core');
const fs = require('fs');
const [page0, name, w = 1950, h = 2070, extract] = process.argv.slice(2);
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new',
    args: ['--ignore-gpu-blocklist', '--allow-file-access-from-files', '--user-data-dir=F:/hb_tmp/edgeprof_pp'] });
  const page = await browser.newPage();
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.setViewport({ width: +w, height: +h });
  const url = 'file:///' + path.join(__dirname, page0).replace(/\\/g, '/');
  await page.goto(url);
  await page.waitForFunction('window.RESULT', { timeout: 120000 });
  console.log(JSON.stringify(await page.evaluate(() => window.RESULT)));
  await page.screenshot({ path: 'F:/hb_tmp/wx/' + name + '.png' });
  if (extract) await require(path.resolve(extract))(page);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
