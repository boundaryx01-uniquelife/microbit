// 포니봇 '말로 코드 만들기' 예시 2가지: 문장 → 규칙 도우미가 코드 생성 → 시뮬레이터에서 실제로 그렇게 움직이는지
//  ① 옆으로 주차·대각선(메카넘)  ② 선 따라가다 초록에서 쉬고 빨강에서 멈춤, 앞이 막히면 기다림(라인·컬러·거리 센서)
// 실행: node tests/ponybot-say.js [기본주소]  (기본 http://127.0.0.1:8765/ — bridge/ 를 서버로 띄워 둘 것)
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const open = async (n) => { await p.goto(`${BASE}sim/?kit=ponybot&tab=js&say=${n}`); await p.waitForFunction(() => window.__pony, null, { timeout: 60000 }); await p.waitForFunction(() => !document.getElementById('askOut').classList.contains('hidden'), null, { timeout: 20000 }); };
  const state = () => p.evaluate(() => { const P = window.__pony, r = P.robot, s = P.world.start; return { dx: r.x - s.x, dy: r.y - s.y, h: r.heading, moving: r.pwm.some((v) => v), oled: document.getElementById('code').value.length }; });

  // ---- 첫 화면에서 두 예시로 가는 링크
  await p.goto(BASE + 'ponybot/'); await p.waitForSelector('.sayex');
  const links = await p.evaluate(() => [...document.querySelectorAll('.sayex a.btn')].map((a) => a.getAttribute('href')));
  check('포니봇 첫 화면: 예시 2가지와 [시뮬레이터에서 해 보기] 링크', links.length === 2 && /say=1$/.test(links[0]) && /say=2$/.test(links[1]), JSON.stringify(links));
  const quotes = await p.evaluate(() => [...document.querySelectorAll('.sayex blockquote')].map((q) => q.textContent.trim()));

  // ---- ① 옆으로 주차 · 대각선
  await open(1);
  const t1 = await p.evaluate(() => ({ text: document.getElementById('askText').value, code: (document.getElementById('askCode') || document.querySelector('#askOut pre')).textContent, mode: document.getElementById('askExpl').textContent.slice(0, 12) }));
  check('①: ?say=1 로 열면 문장이 들어가고 코드가 만들어짐(첫 화면의 문장과 같음)', t1.text === quotes[0] && /Mecanum\.Right/.test(t1.code) && /Mecanum\.LeftForward/.test(t1.code) && /showString\("PARK"/.test(t1.code), t1.mode);
  await p.click('#askRun'); await p.waitForFunction(() => window.__pony.runner.running, null, { timeout: 15000 }); await p.waitForTimeout(500);
  await p.click('.mbbtn[data-btn="A"]'); await p.waitForTimeout(4300);
  const a = await state();
  check('① A 버튼: 앞으로 간 뒤 오른쪽 옆으로(몸 방향 그대로) 가서 멈춤', a.dy < -8 && a.dx > 15 && Math.abs(a.h) < 2 && !a.moving, JSON.stringify({ dx: +a.dx.toFixed(1), dy: +a.dy.toFixed(1), h: +a.h.toFixed(1) }));
  check('① OLED에 PARK', await p.evaluate(() => { const o = window.__pony.oled; let n = 0; for (let y = 0; y < 8; y++) for (let x = 0; x < 30; x++) n += o.lit(x, y) ? 1 : 0; return n > 20; }));
  await p.click('.mbbtn[data-btn="B"]'); await p.waitForTimeout(3300);
  const c = await state();
  check('① B 버튼: 왼쪽 앞 대각선(↖)으로 나와 멈춤(몸 방향 그대로)', c.dx < a.dx - 8 && c.dy < a.dy - 8 && Math.abs(c.h) < 2 && !c.moving, JSON.stringify({ dx: +c.dx.toFixed(1), dy: +c.dy.toFixed(1) }));

  // ---- ② 선 따라가기 + 색 + 거리
  await open(2);
  const t2 = await p.evaluate(() => ({ text: document.getElementById('askText').value, code: (document.getElementById('askCode') || document.querySelector('#askOut pre')).textContent }));
  check('②: ?say=2 로 열면 문장이 들어가고 선·색·거리 코드가 한 반복으로 만들어짐', t2.text === quotes[1] && (t2.code.match(/basic\.forever/g) || []).length === 1 && /checkTwoLineState/.test(t2.code) && /DetectedColor\.Green/.test(t2.code) && /DetectedColor\.Red/.test(t2.code) && /거리 < 15/.test(t2.code));
  await p.click('#askRun'); await p.waitForFunction(() => window.__pony.runner.running, null, { timeout: 15000 }); await p.waitForTimeout(800);
  const scene = await p.evaluate(() => { const P = window.__pony.props; return { tracks: P.tracks.length, chips: P.chips.map((x) => x.color) }; });
  check('② 실행하면 검은 선과 초록·빨강 칩이 자동으로 놓임', scene.tracks >= 1 && scene.chips.includes('green') && scene.chips.includes('red'), JSON.stringify(scene));
  // 선 앞에 상자를 놓으면 기다림 → 치우면 다시 감
  const s0 = await p.evaluate(() => { const P = window.__pony, r = P.robot; P.editor.addAt('box', r.x, r.y - 22); return { x: r.x, y: r.y }; });
  await p.click('.mbbtn[data-btn="A"]'); await p.waitForTimeout(2500);
  const blocked = await p.evaluate(() => { const r = window.__pony.robot; return { y: r.y, moving: r.pwm.some((v) => v), ping: window.__pony.api.ping(1) }; });
  check('② 앞에 상자가 있으면 15cm 안에서 멈춰 기다림(부딪히지 않음)', !blocked.moving && blocked.ping < 15 && blocked.ping > 2 && !(await p.evaluate(() => window.__pony.robot.bumped)), JSON.stringify(blocked));
  await p.evaluate(() => { window.__pony.props.boxes.length = 0; });
  // 초록 칩에서 쉬었다가 다시 출발 → 빨강 칩에서 멈춤
  let sawGreenStop = false, moved = false, last = null;
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(500);
    last = await p.evaluate(() => { const P = window.__pony, r = P.robot, rgb = r.colorRGB(); return { moving: r.pwm.some((v) => v), green: rgb[1] > 120 && rgb[0] < 110 && rgb[2] < 130, red: rgb[0] > 170 && rgb[1] < 90, off: P.PROPS.distToTrack(P.props.tracks[0], r.x, r.y) }; });
    if (last.moving) moved = true;
    if (last.green && !last.moving) sawGreenStop = true;
    if (last.red && !last.moving) break;
  }
  check('② 상자를 치우면 다시 출발하고, 초록 칩 위에서 멈춰 쉼', moved && sawGreenStop);
  await p.waitForTimeout(1500);
  const end = await p.evaluate(() => { const P = window.__pony, r = P.robot, rgb = r.colorRGB(); return { moving: r.pwm.some((v) => v), red: rgb[0] > 170 && rgb[1] < 90, off: +P.PROPS.distToTrack(P.props.tracks[0], r.x, r.y).toFixed(1) }; });
  check('② 다시 출발해 빨강 칩 위에서 멈추고 더 가지 않음(선에서 4cm 이내)', end.red && !end.moving && end.off <= 4, JSON.stringify(end));
  check('② OLED에 RED', await p.evaluate(() => { const o = window.__pony.oled; let n = 0; for (let y = 0; y < 8; y++) for (let x = 0; x < 24; x++) n += o.lit(x, y) ? 1 : 0; return n > 15; }));
  check('페이지 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close();
  const pass = results.filter(Boolean).length;
  console.log(`\n결과: ${pass} 통과 / ${results.length - pass} 실패 (총 ${results.length})`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
