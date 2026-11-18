// 포니봇 블루투스 예제(05_bt-handpose, 제조사 예제의 "ID45" → "ID5" 고친 것)를 시뮬레이터에서 열고,
// 🔵 블루투스 줄로 AI 웹앱 대신 글자를 보내 움직임 확인 + MakeCode 프로젝트에 bluetooth 확장(라디오 빼고)
// 실행: node tests/ponybot-bluetooth.js [기본주소]  (bridge/ 를 서버로 띄워 둘 것)
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = []; const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${ok ? '' : d}`); };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/api/*-assistant', (r) => r.fulfill({ json: { configured: false } }));
  await p.goto(BASE + 'sim/?kit=ponybot&tab=js&ex=05_bt-handpose'); await p.waitForFunction(() => window.__pony, null, { timeout: 60000 }); await p.waitForTimeout(1500);
  const code = await p.evaluate(() => document.getElementById('code').value);
  check('?ex=05_bt-handpose: 고친 예제(ID5)로 시작, ID45 없음', /데이터 == "ID5"/.test(code) && !/== "ID45"/.test(code));
  check('블루투스 코드면 🔵 블루투스 줄이 보이고 라디오 줄은 숨김', (await p.isVisible('#btStrip')) && !(await p.isVisible('#radioStrip')));
  await p.evaluate(() => { window.__noAutoSetup = true; window.__pony.setScene('free'); });
  await p.click('#btnRun'); await p.waitForFunction(() => window.__pony.runner.running, null, { timeout: 15000 }); await p.waitForTimeout(500);
  const pos = () => p.evaluate(() => { const r = window.__pony.robot, s = window.__pony.world.start; return { dx: r.x - s.x, dy: r.y - s.y, moving: r.pwm.some((v) => v) }; });
  const send = async (t, ms) => { await p.click(`#btBtns button[data-t="${t}"]`); await p.waitForTimeout(ms); return pos(); };
  const a = await send('ID2', 1200);
  check('ID2(보) → 앞으로', a.dy < -5 && a.moving, JSON.stringify(a));
  const c = await send('ID5', 1200);
  check('ID5(오른쪽 가리키기) → 오른쪽 옆으로(고친 코드)', c.dx > a.dx + 5 && c.moving, JSON.stringify(c));
  const d = await send('stop', 600);
  check('stop(손이 사라짐) → 멈춤', !d.moving, JSON.stringify(d));
  const oled = await p.evaluate(() => { const o = window.__pony.oled; let n = 0; for (let y = 8; y < 16; y++) for (let x = 0; x < 60; x++) n += o.lit(x, y) ? 1 : 0; return n; });
  check('OLED 둘째 줄에 data 값이 보임', oled > 10, String(oled));
  // MakeCode 프로젝트 구성(블루투스 확장, 라디오 없음)
  const src = await (await p.request.get(BASE + 'sim/index.html')).text();
  check('MakeCode 프로젝트: 블루투스 코드면 "페어링 필요 없음"(open:1) 설정', /bluetooth: \{ open: 1, whitelist: 0, security_level: null \}/.test(src) && /\.\.\.yotta/.test(src));
  check('MakeCode 프로젝트: 블루투스 코드면 radio 빼고 bluetooth 추가', /bluetooth\\\.\/\.test\(code\)\) \{ delete deps\.radio; deps\.bluetooth = '\*'; \}/.test(src) || /delete deps\.radio; deps\.bluetooth = '\*'/.test(src));
  check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close(); const f = results.filter((x) => !x).length;
  console.log(`\n결과: ${results.length - f} 통과 / ${f} 실패 (총 ${results.length})`); process.exit(f ? 1 : 0);
})();
