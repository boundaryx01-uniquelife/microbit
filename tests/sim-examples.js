// 예제 분류(본체 버튼 / 라디오 리모컨)와 '따라 하기' 안내, 새 예제 동작: node tests/sim-examples.js [기본주소]
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${ok ? '' : detail}`); };

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => { if (!/makecode\.(com|microbit\.org)|pxt\.json/.test((e.stack || '') + e.message)) errs.push(e.message); });
  p.on('dialog', d => d.accept());
  await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false}' }));
  await p.goto(BASE + 'sim/');
  await p.waitForFunction(() => window.__sim && window.__sim.view3d() && window.__sim.view3d().ready, null, { timeout: 30000 });

  const groups = await p.$$eval('#examples optgroup', gs => gs.map(g => ({ label: g.label, n: g.querySelectorAll('option').length, ids: [...g.querySelectorAll('option')].map(o => o.value) })));
  check('예제가 3묶음(본체 버튼 / 라디오 리모컨 / 점검)', groups.length === 3 && groups[0].label.includes('본체 버튼') && groups[1].label.includes('라디오 리모컨'), JSON.stringify(groups));
  check('본체 버튼 묶음 4개, 첫 예제는 가장 쉬운 것', groups[0].n === 4 && groups[0].ids[0] === '10_button-bark');
  check('라디오 묶음 5개, 첫 예제는 리모컨 쪽 코드', groups[1].n === 5 && groups[1].ids[0] === '20_remote-sender');

  const S = (f) => p.evaluate(f);
  const st = () => S(() => { const r = window.__sim.robot; return { h: r.heading, vel: r.vel, posture: r.posture, expr: r.expr, headMode: r.headMode, led: r.bodyLed.join(), bubble: r.bubble }; });
  const load = async (id) => { await p.click('#btnStop'); await p.click('#btnReset'); await p.selectOption('#examples', id); await p.waitForTimeout(150); };
  const run = async () => { await p.click('#btnRun'); await p.waitForTimeout(700); };
  const radio = async (n) => { await p.click(`#radioBtns button:nth-child(${n + 1})`); await p.waitForTimeout(400); };

  // 본체 버튼 ①: 멍멍
  await load('10_button-bark');
  check('예제를 고르면 따라 하기 상자가 보임', await p.isVisible('#howto'));
  const how = await p.textContent('#howto');
  check('따라 하기: [▶ 실행] 다음 본체 버튼 순서', how.indexOf('[▶ 실행]') > -1 && how.indexOf('본체 버튼 누르기') > how.indexOf('[▶ 실행]'), how);
  check('실물 따라 하기도 있음', (await p.$$('#howtoReal li')).length >= 2);
  await run();
  check('① 실행만 하면 가만히(버튼 기다림)', (await st()).headMode !== 2);
  await p.click('#btnRobot'); await p.waitForTimeout(500);
  const a1 = await st();
  check('① 본체 버튼 → 눈 반짝·멍멍', a1.headMode === 2 && a1.expr === 0 && !!a1.bubble, JSON.stringify(a1));

  // 본체 버튼 ④: 탐험
  await load('12_button-explore'); await run();
  const pos = () => S(() => [window.__sim.robot.x, window.__sim.robot.y]);
  const p0 = await pos();
  await p.click('#btnRobot'); await p.waitForTimeout(3000);
  const p1 = await pos(); await p.waitForTimeout(7000);
  const p2 = await pos();
  check('④ 두리번하는 동안은 제자리', Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 1, JSON.stringify([p0, p1]));
  check('④ 그다음 탐험(걸어서 이동)', Math.hypot(p2[0] - p0[0], p2[1] - p0[1]) > 5, JSON.stringify([p0, p2]));
  await p.click('#btnRobot'); await p.waitForTimeout(400);
  check('④ 다시 누르면 멈춤', (await st()).vel === 0);

  // 라디오 ①: 리모컨 쪽 A → "라디오 보냄: 1"
  await load('20_remote-sender'); await run();
  const ab = await p.$('.mbbtn[data-btn="A"]'); await ab.scrollIntoViewIfNeeded(); const bx = await ab.boundingBox();
  await p.mouse.move(bx.x + 10, bx.y + 10); await p.mouse.down(); await p.waitForTimeout(80); await p.mouse.up(); await p.waitForTimeout(400);
  check('리모컨 ① A 버튼 → "라디오 보냄: 1"', (await p.textContent('#log')).includes('라디오 보냄: 1'));

  // 라디오 ②: 리모컨으로 움직이기
  await load('21_remote-dog'); await run();
  await radio(1); const r1 = await st(); check('② 1 → 걷기·초록', r1.vel === 25 && r1.led === '0,255,0', JSON.stringify(r1));
  await radio(2); const r2 = await st(); check('② 2 → 멈춤·빨강', r2.vel === 0 && r2.led === '255,0,0', JSON.stringify(r2));
  const h0 = (await st()).h; await radio(3); await p.waitForTimeout(2500);
  const h1 = (await st()).h;
  check('② 3 → 오른쪽으로 약 90도 돌기', Math.abs(Math.abs(h1 - h0) - 90) < 15, `${h0} → ${h1}`);
  await radio(1); await p.click('#btnRobot'); await p.waitForTimeout(300);
  check('② 본체 버튼 → 언제든 멈춤', (await st()).vel === 0);

  // 라디오 ③: 재주
  await load('22_remote-tricks'); await run();
  await radio(2); await p.waitForTimeout(300);
  check('③ 2 → 앉기', (await st()).posture === 1, JSON.stringify(await st()));
  await radio(2); await p.waitForTimeout(300);
  check('③ 2 한 번 더 → 서기', (await st()).posture === 0, JSON.stringify(await st()));

  await p.click('#howtoClose');
  check('따라 하기 닫기', await p.isHidden('#howto'));
  check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close();
  const fail = results.filter(x => !x).length;
  console.log(`\n${results.length - fail}/${results.length} 통과${fail ? `, ${fail} 실패` : ''}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
