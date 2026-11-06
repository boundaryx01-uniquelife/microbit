// 시뮬레이터 자세별 화면 캡처 (육안 확인용)
const { chromium } = require('playwright');
const path = require('path');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const OUT = path.join(__dirname, 'mc');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
  await p.goto(BASE + 'sim/');
  await p.waitForFunction(() => window.__sim && window.Babel);
  await p.selectOption('#examples', '05_motion-tour'); await p.click('#btnRun');
  await p.click('#tab3d'); await p.waitForTimeout(2000);
  const view = await p.$('#view3d');
  const press = async (btn) => { const el = await p.$(`.mbbtn[data-btn="${btn}"]`); const bx = await el.boundingBox(); await p.mouse.move(bx.x + 10, bx.y + 10); await p.mouse.down(); await p.waitForTimeout(60); await p.mouse.up(); };
  await view.screenshot({ path: path.join(OUT, '3d_ready.png') });
  await press('A');
  for (const [name, t] of [['sit', 1200], ['handstand', 2000], ['stretch', 2000], ['hello', 2200]]) {
    await p.waitForTimeout(t); await view.screenshot({ path: path.join(OUT, `3d_${name}.png`) });
  }
  await p.waitForTimeout(2000);
  await press('B'); await p.waitForTimeout(500); await view.screenshot({ path: path.join(OUT, '3d_walk.png') });
  await b.close();
})();
