// AI 브리지(ai.html) ↔ 로보독 시뮬레이터(sim/) 같은 컴퓨터 연결(BroadcastChannel 'robodog-ai-bridge')
// 사용자 제보(2026-11-20): ?ex=03_ai-traffic-dog 이 AI 브리지와 연결하면 제대로 안 움직임
//  - AI 브리지 탭만 열어 두고 인식을 시작하지 않으면 0 을 계속 보내 시뮬레이터 버튼·카메라 흉내를 덮어썼음 → 보내지 않음
//  - AI 브리지 탭이 가려지면(다른 탭) 안전상 0 을 보냄 → 시뮬레이터가 '두 창으로 나란히' 안내
// 실행: node tests/ai-sim-link.js [기본주소]  (bridge/ 를 서버로 띄워 둘 것)
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = []; const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${ok ? '' : d}`); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/api/*-assistant', (r) => r.fulfill({ json: { configured: false } }));
  await p.goto(BASE + 'sim/?ex=03_ai-traffic-dog&tab=js'); await p.waitForTimeout(3000);
  const logs = () => p.evaluate(() => [...document.querySelectorAll('#log > *')].map((e) => e.textContent));
  await p.getByRole('button', { name: /실행/ }).first().click().catch(() => {});
  const q = await c.newPage(); await q.goto(BASE + 'ai.html'); await q.waitForTimeout(2500);
  let L = await logs();
  check('AI 브리지 탭만 열어 둠(인식 전) → 시뮬레이터에 0을 보내지 않음', !L.some((t) => /AI 브리지에서 받음/.test(t)), JSON.stringify(L.slice(0, 4)));
  check('카메라 흉내는 계속 동작', L.some((t) => /카메라 흉내/.test(t)), JSON.stringify(L.slice(0, 4)));
  await q.evaluate(() => { document.getElementById('autoSend').checked = false; });
  for (const x of await q.$$('button')) { if ((await x.textContent()).trim() === '3' && await x.isVisible()) { await x.click(); break; } }
  await p.waitForTimeout(2000); L = await logs();
  check('AI 브리지에서 직접 보낸 3 → 시뮬레이터가 받음', L.some((t) => /AI 브리지에서 받음: 3/.test(t)), JSON.stringify(L.slice(0, 4)));
  await q.evaluate(() => { new BroadcastChannel('robodog-ai-bridge').postMessage({ n: 0, why: 'hidden' }); });
  await p.waitForTimeout(800); L = await logs();
  check('AI 브리지 탭이 가려져 0을 보내면 → 두 창으로 나란히 안내', L.some((t) => /두 창으로 나란히/.test(t)), JSON.stringify(L.slice(0, 4)));
  check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close(); const f = results.filter((x) => !x).length;
  console.log(`\n결과: ${results.length - f} 통과 / ${f} 실패 (총 ${results.length})`); process.exit(f ? 1 : 0);
})();
