// 따라 하기 칸 접기(모든 시뮬레이터) — 사용자 요청(2026-11-17): 미션 칸 접기를 모든 시뮬레이터에
// 예제를 고르면 따라 하기 칸이 펼쳐지고, 블록 편집기를 누르면 한 줄로 접히며, [펼치기]로 다시 열림 — 로보독·포니봇
// 실행: node tests/sim-howto-fold.js [기본주소]  (bridge/ 를 서버로 띄워 둘 것)
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = []; const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${ok ? '' : d}`); };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/api/*-assistant', (r) => r.fulfill({ json: { configured: false } }));
  for (const [kit, ex] of [['robodog', '02_distance-rule'], ['ponybot', '02_distance-rule']]) {
    await p.goto(BASE + `sim/?${kit === 'ponybot' ? 'kit=ponybot&' : ''}ex=${ex}&demo=0`); await p.waitForFunction(() => window.__sim, null, { timeout: 60000 }); await p.waitForTimeout(2500);
    const st = () => p.evaluate(() => { const h = document.getElementById('howto'); return { shown: !h.hidden, min: h.classList.contains('min'), h: Math.round(h.getBoundingClientRect().height) }; });
    let s = await st(); const tall = s.h;
    check(`${kit}: 예제를 열면 따라 하기 칸이 펼쳐져 보임`, s.shown && !s.min && tall > 80, JSON.stringify(s));
    await p.click('#mcFrame', { position: { x: 300, y: 300 } }); await p.waitForTimeout(400); s = await st();
    check(`${kit}: 블록 편집기를 누르면 한 줄로 접힘`, s.min && s.h < tall / 2, JSON.stringify(s));
    await p.click('#howtoFold'); await p.waitForTimeout(200); s = await st();
    check(`${kit}: [펼치기]로 다시 열림`, !s.min && s.h > tall * 0.8, JSON.stringify(s));
  }
  check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close(); const f = results.filter((x) => !x).length;
  console.log(`\n결과: ${results.length - f} 통과 / ${f} 실패 (총 ${results.length})`); process.exit(f ? 1 : 0);
})();
