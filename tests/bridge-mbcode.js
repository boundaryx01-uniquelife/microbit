// AI 브리지(로보독)의 '마이크로비트 코드 받기' 칸과 시뮬레이터 ?ex= 예제 열기
// (사용자 피드백 2026-11-16: 브리지와 짝이 되는 마이크로비트 코드를 바로 받을 수 있게)
// 실행: node tests/bridge-mbcode.js [기본주소]  (bridge/ 를 서버로 띄워 둘 것)
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = []; const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${ok ? '' : d}`); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/api/*-assistant', (r) => r.fulfill({ json: { configured: false } }));
  await p.goto(BASE + 'ai.html'); await p.waitForTimeout(800);
  check('로보독 AI 브리지: 코드 받기 칸이 보임', await p.isVisible('#mbCode'));
  await p.click('#mbCode [data-copy]'); await p.waitForTimeout(500);
  const c1 = await p.evaluate(() => navigator.clipboard.readText());
  check('① USB 마이크로비트 코드 복사 = 시리얼 받기 → 라디오 전달, 로보독 확장 없음', /serial\.onDataReceived/.test(c1) && /radio\.sendNumber/.test(c1) && !/robodog\.(?!확장)[a-z]/.test(c1.replace(/\/\/.*$/gm, '')), c1.slice(0, 120));
  await p.click('#mbCode [data-copy-ex]'); await p.waitForTimeout(800);
  const c2 = await p.evaluate(() => navigator.clipboard.readText());
  check('② 로보독 코드 복사 = 라디오로 받아 움직임', /radio\.onReceivedNumber/.test(c2) && /robodog\.move/.test(c2));
  check('.ts 파일 링크가 열림', (await p.request.get(BASE + 'docs/makecode/00_bridge-receiver.ts')).status() === 200);
  const hrefs = await p.evaluate(() => [...document.querySelectorAll('#mbCode a')].map((a) => a.getAttribute('href')));
  check('시뮬레이터 링크 ?ex=03·04', hrefs.includes('sim/?ex=03_ai-traffic-dog') && hrefs.includes('sim/?ex=04_ai-team-template'), JSON.stringify(hrefs));
  await p.goto(BASE + 'ai.html?kit=ponybot'); await p.waitForTimeout(800);
  check('포니봇 브리지에서는 숨김(포니봇은 블루투스 웹앱)', !(await p.isVisible('#mbCode')));
  for (const q of ['', '&tab=js']) {
    await p.goto(BASE + 'sim/?ex=03_ai-traffic-dog' + q); await p.waitForTimeout(3000);
    check(`시뮬레이터 ?ex=03${q}: 그 예제 코드로 시작(자동 시연이 덮어쓰지 않음)`, await p.evaluate(() => /3\. AI 신호등 안내견/.test(document.getElementById('code').value)));
  }
  check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close(); const f = results.filter((x) => !x).length;
  console.log(`\n결과: ${results.length - f} 통과 / ${f} 실패 (총 ${results.length})`); process.exit(f ? 1 : 0);
})();
