// Screenshot URLs at several viewports and log console/page errors.
// Usage: NODE_PATH=$(npm root -g) node shoot-pages.js --out <dir> --sizes 1366x768,390x844 <url1> <url2> ...
// Writes <dir>/<page>_<WxH>.png and <dir>/summary.json ({url: {shots, errors}}).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2); let out = 'shots', sizes = '1366x768'; const urls = [];
for (let i = 0; i < argv.length; i++) { if (argv[i] === '--out') out = argv[++i]; else if (argv[i] === '--sizes') sizes = argv[++i]; else urls.push(argv[i]); }
if (!urls.length) { console.error('no urls'); process.exit(1); }
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(), summary = {};
  for (const url of urls) {
    const slug = url.replace(/^https?:\/\//, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'root';
    const rec = summary[url] = { shots: [], errors: [] };
    for (const s of sizes.split(',')) {
      const [w, h] = s.split('x').map(Number);
      const p = await b.newPage({ viewport: { width: w, height: h } });
      p.on('console', (m) => { if (m.type() === 'error') rec.errors.push(`[${s}] console: ${m.text()}`); });
      p.on('pageerror', (e) => rec.errors.push(`[${s}] pageerror: ${e.message}`));
      p.on('requestfailed', (r) => rec.errors.push(`[${s}] requestfailed: ${r.url()}`));
      try { await p.goto(url, { waitUntil: 'load', timeout: 30000 }); await p.waitForTimeout(800); } catch (e) { rec.errors.push(`[${s}] goto: ${e.message}`); }
      const f = path.join(out, `${slug}_${s}.png`);
      await p.screenshot({ path: f }); rec.shots.push(f); await p.close();
    }
    console.log(url, rec.shots.length, 'shots,', rec.errors.length, 'errors');
  }
  await b.close();
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
})();
