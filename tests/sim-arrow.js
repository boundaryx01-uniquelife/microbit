// basic.showArrow 가 방향(ArrowNames)대로 그려지는지 — 사용자 피드백(2026-11-17): 슬라이드 13 미션에서 East로 바꿔도 북쪽으로 보임
// 실행: node tests/sim-arrow.js [기본주소]  (bridge/ 를 서버로 띄워 둘 것)
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = []; const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${ok ? '' : d}`); };
const WANT = { North: '00100 01110 10101 00100 00100', East: '00100 00010 11111 00010 00100', South: '00100 00100 10101 01110 00100', West: '00100 01000 11111 01000 00100', NorthEast: '00111 00011 00101 01000 10000' };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/api/*-assistant', (r) => r.fulfill({ json: { configured: false } }));
  for (const kit of ['ponybot', 'robodog']) {
    await p.goto(BASE + `sim/?kit=${kit}&tab=js&demo=0`); await p.waitForFunction(() => window.__sim && window.__sim.runner, null, { timeout: 60000 }); await p.waitForTimeout(800);
    for (const [dir, want] of Object.entries(WANT)) {
      await p.evaluate(async (c) => { const R = window.__sim.runner; R.stop(); document.getElementById('code').value = c; await R.start(c); }, `basic.showArrow(ArrowNames.${dir})\nbasic.forever(function () { basic.pause(100) })`);
      await p.waitForTimeout(500);
      const got = await p.evaluate(() => { const d = window.__sim.runner.display; return [0, 1, 2, 3, 4].map((y) => [0, 1, 2, 3, 4].map((x) => (d[y][x] ? 1 : 0)).join('')).join(' '); });
      check(`${kit}: ArrowNames.${dir} 모양`, got === want, got);
    }
  }
  check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close(); const f = results.filter((x) => !x).length;
  console.log(`\n결과: ${results.length - f} 통과 / ${f} 실패 (총 ${results.length})`); process.exit(f ? 1 : 0);
})();
