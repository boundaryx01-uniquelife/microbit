// 포니봇 센서 칸의 '이동 거리'·'작동 시간'(계산 활동용) — 사용자 피드백(2026-11-17)
// 앞으로 2초(속도 80) → 이동 거리가 로봇이 실제 움직인 거리와 같고, 바퀴가 돈 시간 ≈ 2초, 멈춘 뒤 기록 칸에 요약
// 실행: node tests/ponybot-trip.js [기본주소]  (bridge/ 를 서버로 띄워 둘 것)
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = []; const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${ok ? '' : d}`); };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/api/*-assistant', (r) => r.fulfill({ json: { configured: false } }));
  await p.goto(BASE + 'sim/?kit=ponybot&tab=js'); await p.waitForFunction(() => window.__pony, null, { timeout: 60000 }); await p.waitForTimeout(800);
  await p.evaluate(() => { window.__noAutoSetup = true; window.__pony.setScene('free'); document.getElementById('code').value = 'input.onButtonPressed(Button.A, function () {\n    aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 80)\n    basic.pause(2000)\n    aiPonybot.stopAllMotors()\n})'; });
  await p.click('#btnRun'); await p.waitForFunction(() => window.__pony.runner.running, null, { timeout: 15000 }); await p.waitForTimeout(500);
  const s0 = await p.evaluate(() => ({ x: window.__pony.robot.x, y: window.__pony.robot.y }));
  await p.click('.mbbtn[data-btn="A"]'); await p.waitForTimeout(3200);
  const mid = await p.evaluate(() => ({ trip: document.getElementById('psTrip').textContent, time: document.getElementById('psTime').textContent, x: window.__pony.robot.x, y: window.__pony.robot.y }));
  const real = Math.hypot(mid.x - s0.x, mid.y - s0.y), shown = parseFloat(mid.trip), wheel = parseFloat(mid.time.match(/바퀴 ([\d.]+)/)[1]);
  check('이동 거리 = 로봇이 실제로 움직인 거리(±0.5cm)', Math.abs(shown - real) <= 0.5 && real > 5, `${mid.trip} / 실제 ${real.toFixed(1)}`);
  check('바퀴가 돈 시간 ≈ 2초(±0.3)', Math.abs(wheel - 2) <= 0.3, mid.time);
  check('작동 시간은 실행 뒤 지난 시간(바퀴 시간보다 김)', parseFloat(mid.time) > wheel, mid.time);
  await p.click('#btnStop'); await p.waitForTimeout(500);
  const log = await p.evaluate(() => document.getElementById('log').textContent);
  check('멈추면 기록 칸에 이번 실행 요약(거리·시간·평균 속도)', /이번 실행: 이동 거리 [\d.]+cm · 작동 시간 [\d.]+초\(바퀴가 돈 시간 [\d.]+초\) → 평균 [\d.]+cm\/초/.test(log), log.slice(-200));
  await p.click('#btnRun'); await p.waitForTimeout(600);
  check('다시 실행하면 0부터', parseFloat(await p.textContent('#psTrip')) < 0.5, await p.textContent('#psTrip'));
  check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close(); const f = results.filter((x) => !x).length;
  console.log(`\n결과: ${results.length - f} 통과 / ${f} 실패 (총 ${results.length})`); process.exit(f ? 1 : 0);
})();
