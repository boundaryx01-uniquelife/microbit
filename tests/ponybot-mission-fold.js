// 미션 칸 접기 — 사용자 피드백(2026-11-17): MakeCode 작업할 때 미션 칸 글이 코드 화면을 가림
// 펼친 미션 칸은 위에 붙지 않고(코드 위를 덮지 않음), 블록 편집기를 누르면 한 줄로 접히며, [펼치기]로 다시 열림
// 실행: node tests/ponybot-mission-fold.js [기본주소]  (bridge/ 를 서버로 띄워 둘 것)
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = []; const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${ok ? '' : d}`); };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/api/*-assistant', (r) => r.fulfill({ json: { configured: false } }));
  await p.goto(BASE + 'sim/?kit=ponybot&mission=p1-crab'); await p.waitForFunction(() => window.__mission && window.__pony, null, { timeout: 60000 }); await p.waitForTimeout(1500);
  const st = () => p.evaluate(() => { const m = document.getElementById('missionBox'); return { min: m.classList.contains('min'), pos: getComputedStyle(m).position, h: Math.round(m.getBoundingClientRect().height), mini: document.getElementById('mMin').textContent }; });
  let s = await st();
  check('처음엔 펼침, 위에 붙지 않음(코드 위를 덮지 않음)', !s.min && s.pos !== 'sticky', JSON.stringify(s));
  const tall = s.h;
  await p.click('#mcFrame', { position: { x: 300, y: 300 } }); await p.waitForTimeout(400);
  s = await st();
  check('블록 편집기를 누르면 한 줄로 접힘(높이 1/3 이하)', s.min && s.h <= tall / 3, JSON.stringify(s));
  check('접힌 줄에 확인 항목이 보임', /○|✓/.test(s.mini), s.mini);
  check('접힌 칸은 위에 붙음(목표·확인을 계속 볼 수 있음)', s.pos === 'sticky', s.pos);
  await p.click('#mFold'); await p.waitForTimeout(200); s = await st();
  check('[펼치기]로 다시 열림', !s.min && s.h > tall * 0.8, JSON.stringify(s));
  check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close(); const f = results.filter((x) => !x).length;
  console.log(`\n결과: ${results.length - f} 통과 / ${f} 실패 (총 ${results.length})`); process.exit(f ? 1 : 0);
})();
