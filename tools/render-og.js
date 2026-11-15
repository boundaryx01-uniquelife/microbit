// 공유 미리보기 그림(og:image) 만들기: bridge/assets/og/hub.html → bridge/assets/og/hub.png (1200×630)
// 실행: bridge/ 를 서버로 띄운 뒤  node tools/render-og.js [기본주소]
const { chromium } = require('playwright');
const path = require('path');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto(BASE + 'assets/og/hub.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(__dirname, '../bridge/assets/og/hub.png') });
  await b.close();
})();
