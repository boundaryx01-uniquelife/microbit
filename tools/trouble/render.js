// 포니봇 '안 될 때' 설명 그림 → bridge/lessons/assets/trouble_download.png, trouble_bluetooth.png
// 실행: node tools/trouble/render.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 800, height: 1200 }, deviceScaleFactor: 2 });
  await p.goto('file://' + path.join(__dirname, 'trouble.html'));
  const out = path.join(__dirname, '..', '..', 'bridge', 'lessons', 'assets');
  await p.locator('#dl').screenshot({ path: path.join(out, 'trouble_download.png') });
  await p.locator('#bt').screenshot({ path: path.join(out, 'trouble_bluetooth.png') });
  await b.close();
  console.log('ok');
})();
