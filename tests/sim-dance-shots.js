// 군무 시연 3D 장면 캡처(육안 확인용)
const { chromium } = require('playwright');
const path = require('path');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const OUT = path.join(__dirname, 'mc');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
  p.on('pageerror', e => console.log('pageerror', e.message));
  await p.goto(BASE + 'sim/?demo=0&tab=js');
  await p.waitForFunction(() => window.__sim && window.Babel);
  await p.click('#tab3d'); await p.waitForTimeout(1500);
  await p.click('#demoCards button[data-id="dance"]');
  const view = await p.$('#view3d');
  // 시연 시간표(대략): 준비 1.5s, 바운스 5s, 웨이브 ~6s, 불빛 ~3.3s, 표정 ~3.8s, 회전 6s, 물구나무 5s, 인사
  for (const [name, t] of [['ready', 1000], ['bounce', 1600], ['wave', 4600], ['lights', 6400], ['faces', 3600], ['rotate', 2600], ['handstand', 5800], ['hello', 5000]]) {
    await p.waitForTimeout(t);
    await view.screenshot({ path: path.join(OUT, `dance_${name}.png`) });
    console.log(name, (await p.textContent('#caption')).slice(0, 40));
  }
  await b.close();
})();
