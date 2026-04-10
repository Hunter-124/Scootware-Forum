const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-chromium');

(async ()=>{
  const url = process.argv[2] || 'https://scootware.us/products';
  const outDir = '/tmp/diag_playwright';
  try { fs.mkdirSync(outDir, { recursive: true }); } catch(e){}

  const consoleLines = [];
  const networkLines = [];

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  page.on('console', msg => {
    const text = `${msg.type()}: ${msg.text()}`;
    consoleLines.push(text);
    console.log(text);
  });
  page.on('pageerror', err => {
    const text = `PAGEERROR: ${err.toString()}`;
    consoleLines.push(text);
    console.error(text);
  });
  page.on('request', req => networkLines.push(`REQ ${req.method()} ${req.url()}`));
  page.on('response', res => networkLines.push(`RES ${res.status()} ${res.url()}`));

  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    networkLines.push(`GOTO_STATUS: ${resp ? resp.status() : 'NO_RESP'}`);
    await page.screenshot({ path: path.join(outDir, 'screenshot.png'), fullPage: true });
    await fs.promises.writeFile(path.join(outDir, 'console.log'), consoleLines.join('\n'));
    await fs.promises.writeFile(path.join(outDir, 'network.log'), networkLines.join('\n'));
    console.log('CAPTURE_COMPLETE');
  } catch (err) {
    console.error('CAPTURE_ERROR', err?.stack || err?.toString());
    try { await fs.promises.writeFile(path.join(outDir, 'console.log'), consoleLines.join('\n') + '\nERROR: ' + (err?.toString() || '')); } catch(e){}
  } finally {
    try { await browser.close(); } catch(e){}
  }
})();
