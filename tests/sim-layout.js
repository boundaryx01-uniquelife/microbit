// 시뮬레이터 칸 폭 조절 시험: node tests/sim-layout.js [기본주소]
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${ok ? '' : detail}`); };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; p.on('pageerror', e => { if (!/makecode\.(com|microbit\.org)/.test(e.stack || '')) errs.push(e.message); });   // MakeCode 내부 오류는 제외
  await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false}' }));
  await p.goto(BASE + 'sim/'); await p.waitForTimeout(1200);
  const w = () => p.evaluate(() => document.querySelector('main>section:last-of-type').getBoundingClientRect().width);
  const w0 = await w();
  const r = await p.locator('#splitter').boundingBox();
  await p.mouse.move(r.x + 6, 300); await p.mouse.down(); await p.mouse.move(r.x - 250, 300, { steps: 8 }); await p.mouse.up();
  const w1 = await w();
  check('막대를 왼쪽으로 끌면 로보독 칸이 넓어짐', w1 > w0 + 200, `${w0} → ${w1}`);
  await p.reload(); await p.waitForTimeout(800);
  check('새로고침해도 폭 유지', Math.abs((await w()) - w1) < 3);
  await p.locator('#splitter').focus(); await p.keyboard.press('ArrowRight');
  check('화살표 키로 조절', (await w()) < w1 - 30);
  await p.locator('#splitter').dblclick();
  check('두 번 누르면 원래대로', Math.abs((await w()) - w0) < 3);
  await p.mouse.move(r.x + 6, 300); await p.mouse.down(); await p.mouse.move(1360, 300, { steps: 5 }); await p.mouse.up();
  check('코딩 칸이 너무 좁아지지 않음(최소 폭)', (await w()) >= 260 && (await p.evaluate(() => document.querySelector('main>section').getBoundingClientRect().width)) >= 400);
  await p.setViewportSize({ width: 390, height: 844 });
  check('휴대폰 폭에서는 막대 숨김', await p.isHidden('#splitter'));
  check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close();
  const fail = results.filter(x => !x).length;
  console.log(`\n${results.length - fail}/${results.length} PASS`);
  process.exit(fail ? 1 : 0);
})();
