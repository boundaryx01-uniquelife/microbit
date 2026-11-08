// 수업 슬라이드 아이콘 PNG 내보내기: tools/lesson-icons.html → bridge/lessons/assets/icon_*.png (그림 크기에 맞춰 자른 투명 PNG)
// 실행: (저장소 맨 위에서 정적 서버) node tools/render-icons.js http://127.0.0.1:8768/
const { chromium } = require('playwright');
const path = require('path');
const BASE = (process.argv[2] || 'http://127.0.0.1:8768/').replace(/\/?$/, '/');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  await p.goto(BASE + 'tools/lesson-icons.html');
  const names = await p.evaluate(() => window.__icons);
  for (const n of names) {
    await p.goto(BASE + 'tools/lesson-icons.html?icon=' + n);
    await p.evaluate(() => window.__ready); await p.waitForTimeout(150);
    // 빈 여백 없이 그림 크기에 맞춰 자름(슬라이드에서 아이콘이 작아 보이지 않게)
    const bb = await p.evaluate(() => { const r = document.querySelector('svg').getBBox(), pad = 14; const x = Math.max(0, Math.floor(r.x - pad)), y = Math.max(0, Math.floor(r.y - pad)); return { x, y, width: Math.min(800, Math.ceil(r.x + r.width + pad)) - x, height: Math.min(600, Math.ceil(r.y + r.height + pad)) - y }; });
    await p.screenshot({ path: path.join(__dirname, '../bridge/lessons/assets', n + '.png'), omitBackground: true, clip: bb });
    console.log('저장', n);
  }
  await b.close();
})();
