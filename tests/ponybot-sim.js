// 포니봇 시뮬레이터 자동 시험 (Playwright, 헤드리스 크로미움) — 통합 시뮬레이터 /sim/?kit=ponybot (옛 /ponybot/sim/ 은 이쪽으로 넘어감)
// 실행: node tests/ponybot-sim.js [기본주소]
//   기본주소를 안 주면 bridge/ 를 python3 -m http.server 로 직접 띄워 시험하고 끝나면 끕니다.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'mc');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const f = (v) => (Math.round(v * 100) / 100);

async function startServer() {
  const port = 8766 + Math.floor(Math.random() * 200);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(__dirname, '..', 'bridge'), stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 50; i++) {
    try { if (await new Promise((res) => require('http').get(base + 'sim/guide.js', (r) => { r.resume(); res(r.statusCode === 200); }).on('error', () => res(false)))) return { srv, base }; } catch (e) { /* 기다림 */ }
    await new Promise(r => setTimeout(r, 100));
  }
  srv.kill(); throw new Error('정적 서버가 안 떠요');
}

(async () => {
  let srv = null, BASE = process.argv[2];
  if (!BASE) { const s = await startServer(); srv = s.srv; BASE = s.base; }
  BASE = BASE.replace(/\/?$/, '/');
  const URL = BASE + 'sim/?kit=ponybot&tab=js';   // 글자 코드 탭으로 열어 MakeCode 창을 안 띄움(MakeCode 는 tests/sim-unified.js 가 시험)

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('dialog', d => d.accept());
  p.on('console', m => { if (m.type() === 'error' && !/aiPonybot\.Mecanum/.test(m.text())) errs.push('console: ' + m.text()); });   // 일부러 낸 enum 오류는 제외
  // 장면을 빨리 바꾸면 이전 그림 요청이 취소(ERR_ABORTED)됨 — 실패가 아니므로 제외. 다른 실패(404 등)는 그대로 잡음
  p.on('requestfailed', r => { const ft = (r.failure() && r.failure().errorText) || ''; if (!/ERR_ABORTED/.test(ft)) errs.push('requestfailed: ' + r.url() + ' ' + ft); });
  await p.goto(URL);
  await p.waitForFunction(() => window.__ponyReady && window.Babel, null, { timeout: 30000 });

  const S = (fn, arg) => p.evaluate(fn, arg);
  // 실행 버튼(기록은 실행마다 지워 '이번 실행의 경고'만 보게 함) / 말로 코드 만들기 → 코드 칸에 넣기
  const clickRun = async () => { await p.evaluate(() => { document.getElementById('log').textContent = ''; }); await p.click('#btnRun'); };
  const ask = async (text) => { await p.fill('#askText', text); await p.click('#askBtn'); await p.waitForSelector('#askUse:not([disabled])', { timeout: 15000 }); await p.click('#askUse'); };
  const EST = await S(() => ({ ...window.__pony.EST }));
  // 결정적 이동 시험: 바퀴 명령 → fastForward(물리만 진행). 가감속 포함 예상 이동거리 d = v·T − v²/(2a)
  const vOf = (speed) => speed * 16 / 16 / 255 * EST.maxCmPerSec;
  const expDist = (speed, T) => { const v = vOf(speed); return v * T - v * v / (2 * EST.accel); };
  // 몸 좌표 (오른쪽 u, 앞 v) 변위
  const move = async (scene, pose, fn, sec) => S(({ scene, pose, fn, sec }) => {
    const P = window.__pony; P.runner.stop(); P.setScene(scene); P.setPose(...pose);
    new Function('aiPonybot', fn)(P.api);
    P.fastForward(sec);
    const s = P.state(); P.api.stopAllMotors();
    return { dx: s.x - pose[0], dy: s.y - pose[1], dh: s.heading - pose[2] };
  }, { scene, pose, fn, sec });
  const A = 'free', POSE = [150, 100, 0];

  // ---- 1~4. 메카넘 운동학 ----
  let r = await move(A, POSE, 'aiPonybot.runMecanum(2, 80)', 1);
  const dF = expDist(80, 1);
  check('앞으로 1초 → y만 감소(화면 위)', near(r.dx, 0, 0.01) && near(r.dy, -dF, 0.05) && near(r.dh, 0, 0.01), `dx=${f(r.dx)} dy=${f(r.dy)} (예상 ${f(-dF)}) dh=${f(r.dh)}`);
  r = await move(A, POSE, 'aiPonybot.runMecanum(6, 80)', 1);
  check('오른쪽 옆 이동 → x 증가·heading 불변·y 불변', near(r.dx, dF, 0.05) && near(r.dy, 0, 0.01) && near(r.dh, 0, 0.01), `dx=${f(r.dx)} dy=${f(r.dy)} dh=${f(r.dh)}`);
  r = await move(A, POSE, 'aiPonybot.runMecanum(4, 80)', 1);
  check('왼쪽 옆 이동 → x 감소', near(r.dx, -dF, 0.05) && near(r.dy, 0, 0.01), `dx=${f(r.dx)}`);
  r = await move(A, POSE, 'aiPonybot.runMecanum(8, 80)', 1);
  check('뒤로 → y 증가', near(r.dy, dF, 0.05) && near(r.dx, 0, 0.01), `dy=${f(r.dy)}`);
  r = await move(A, POSE, 'aiPonybot.runNormal(3, 80)', 1);
  const wv = 80 / 255 * EST.maxCmPerSec, dhExp = (wv - wv * wv / (2 * EST.accel)) / EST.k * 180 / Math.PI;   // 가감속 포함 예상 회전각
  check('runNormal Clockwise(블록 화살표 ↶ = 반시계) 1초 → heading 감소·제자리', r.dh < -30 && near(r.dh, -dhExp, 0.5) && Math.hypot(r.dx, r.dy) < 0.05, `dh=${f(r.dh)}° (예상 ${f(dhExp)}°) 위치변화=${f(Math.hypot(r.dx, r.dy))}`);
  r = await move(A, POSE, 'aiPonybot.runNormal(4, 80)', 1);
  check('runNormal CounterClockwise(블록 화살표 ↷ = 시계) → heading 증가', r.dh > 30, `dh=${f(r.dh)}`);
  r = await move(A, POSE, 'aiPonybot.runMecanum(1, 80)', 1);
  check('대각선 ↖ → 왼쪽 위로, 성분이 앞 이동의 절반', r.dx < 0 && r.dy < 0 && near(-r.dy, dF / 2, 0.1) && near(-r.dx, dF / 2, 0.1) && near(r.dh, 0, 0.01), `dx=${f(r.dx)} dy=${f(r.dy)} (앞 ${f(dF)})`);
  r = await move(A, POSE, 'aiPonybot.runMecanum(3, 80)', 1);
  check('대각선 ↗ → 오른쪽 위', r.dx > 0 && r.dy < 0, `dx=${f(r.dx)} dy=${f(r.dy)}`);
  r = await move(A, POSE, 'aiPonybot.runMecanum(7, 80)', 1);
  check('대각선 ↙ → 왼쪽 아래', r.dx < 0 && r.dy > 0, `dx=${f(r.dx)} dy=${f(r.dy)}`);
  r = await move(A, POSE, 'aiPonybot.runMecanum(9, 80)', 1);
  check('대각선 ↘ → 오른쪽 아래', r.dx > 0 && r.dy > 0, `dx=${f(r.dx)} dy=${f(r.dy)}`);
  // 방향이 돌아간 뒤에도 몸 기준으로 움직이는가: 90°(오른쪽 향함)에서 앞으로 → x 증가
  r = await move(A, [150, 100, 90], 'aiPonybot.runMecanum(2, 80)', 1);
  check('heading 90°에서 앞으로 → x 증가(몸 기준)', r.dx > 8 && near(r.dy, 0, 0.05), `dx=${f(r.dx)} dy=${f(r.dy)}`);

  // ---- 5. 정지 ----
  const st = await S(() => {
    const P = window.__pony; P.runner.stop(); P.setScene('free'); P.setPose(150, 100, 0);
    P.api.runMecanum(2, 200); P.fastForward(1); P.api.stopAllMotors(); P.fastForward(0.6);
    const a = P.state(); P.fastForward(1); const b2 = P.state();
    return { moved: Math.hypot(b2.x - a.x, b2.y - a.y), pwm: b2.pwm, w: b2.w };
  });
  check('stopAllMotors → 바퀴·이동 모두 멈춤', st.moved < 1e-6 && st.pwm.every(v => v === 0) && Object.values(st.w).every(v => Math.abs(v) < 1e-6), `이동=${st.moved} pwm=${st.pwm}`);

  // ---- 모터 번호 → 바퀴 (runMotor) ----
  const mm = await S(() => {
    const P = window.__pony, out = {};
    for (const m of [1, 2, 3, 4]) {
      P.setScene('free'); P.setPose(150, 100, 0); P.api.stopAllMotors();
      P.api.runMotor(m, 1, 100); P.fastForward(0.5);
      out[m] = Object.entries(P.state().w).filter(([, v]) => v > 1).map(([k]) => k).join('');
      P.api.stopAllMotors(); P.fastForward(1);
    }
    return out;
  });
  check('runMotor Clockwise: M1=FR, M2=RR, M3=RL, M4=FL 만 전진(사진 근거)', mm[1] === 'FR' && mm[2] === 'RR' && mm[3] === 'RL' && mm[4] === 'FL', JSON.stringify(mm));
  const cl = await S(() => {
    const P = window.__pony; P.setScene('free'); P.setPose(150, 100, 0); P.api.stopAllMotors();
    P.api.runMecanum(2, 255); const p1 = P.state().pwm.slice(); P.api.runMecanum(2, 300); const p2 = P.state().pwm.slice();
    P.api.runMecanum(2, 80); P.api.runMecanum(5, 80); const p3 = P.state().pwm.slice(); P.api.runMotor(1, -1, 255); const p4 = P.state().pwm.slice(); P.api.stopAllMotors();
    return { p1, p2, p3, p4 };
  });
  check('값 자르기: 255→4080, 300→4095(확장 speed*16 후 4095), Stop=0, runMotor 역회전=음수', cl.p1[0] === 4080 && cl.p2[0] === 4095 && cl.p3.every(v => v === 0) && cl.p4[0] === -4080, JSON.stringify(cl));

  // ---- 6. 초음파 ----
  const pg = await S(() => {
    const P = window.__pony; P.runner.stop();
    P.setScene('relay'); P.setPose(60, 224, 0);                       // 책 앞면 y=22.5, 앞면 센서 y=224-sonarOffset(9.6)=214.4
    const wall = P.api.ping(1), inch = P.api.ping(2), us = P.api.ping(0);
    P.setScene('free'); P.setPose(150, 100, 0);
    const none = P.api.ping(1), noneUs = P.api.ping(0), noneMax = P.api.ping(1, 120);
    P.world.addBox(150, 40);                                          // 앞 상자: 앞면 y=46, 센서 y=92 → 46cm
    const box = P.api.ping(1);
    P.setPose(150, 100, 90); const side = P.api.ping(1);              // 오른쪽엔 아무것도 없음
    P.setScene('bowling'); P.setPose(70, 238, 0); const wallB = P.api.ping(1);   // 앞 핀(y=28±3.5) 맞음
    return { wall, inch, us, none, noneUs, noneMax, box, side, wallB };
  });
  check('벽(책) 앞 ping ≈ 참 거리(191.9cm)', near(pg.wall, 191.9, 1), `ping=${pg.wall} 인치=${pg.inch} µs=${pg.us}`);
  check('앞에 아무것도 없으면 ping = 500(최댓값, 0 아님)', pg.none === 500 && pg.side === 500, `none=${pg.none} side=${pg.side} µs=${pg.noneUs}`);
  check('maxCmDistance 인자 존중(120 → 없으면 120)', pg.noneMax === 120, `${pg.noneMax}`);
  check('상자 앞 ping ≈ 46cm', near(pg.box, 46, 1), `${pg.box}`);
  check('볼링 핀(원) 감지', pg.wallB > 150 && pg.wallB < 190, `${pg.wallB}`);

  // ---- 7. 라인·색 센서 ----
  const ln = await S(() => {
    const P = window.__pony; P.runner.stop(); P.setScene('circuit');
    const rd = () => [P.api.readLineSensor(1), P.api.readLineSensor(2)];
    P.setPose(40, 104, 0); const centered = rd();
    P.setPose(43, 104, 0); const lineAtLeft = rd();        // 선이 로봇 왼쪽으로 치우침 → 왼쪽 센서만 선 위
    P.setPose(37, 104, 0); const lineAtRight = rd();
    P.setPose(120, 80, 0); const off = rd(); const rgbOff = [P.api.getRed(), P.api.getGreen(), P.api.getBlue()];
    P.setPose(40, 104, 0); const rgbLine = [P.api.getRed(), P.api.getGreen(), P.api.getBlue()];
    P.setPose(110, 35 + 3, 90);                            // 빨간 칩(106..114, 31..39) 위. 컬러 센서는 중심 앞 3cm
    const red = { r: P.api.getRed(), isRed: P.api.isColorAdvanced(0), isGreen: P.api.isColorAdvanced(1), line: rd() };
    P.setPose(40, 104, 0);
    const two = { offoff: P.api.checkTwoLineState(0), onoff: P.api.checkTwoLineState(2) };
    P.setPose(43, 104, 0); const two2 = { onoff: P.api.checkTwoLineState(2), single: P.api.checkSingleLineSensor(1, 1) };
    return { centered, lineAtLeft, lineAtRight, off, rgbOff, rgbLine, red, two, two2 };
  });
  check('라인 센서: 선이 두 센서 사이 → 0,0 / 왼쪽으로 치우침 → 1,0 / 오른쪽 → 0,1', JSON.stringify(ln.centered) === '[0,0]' && JSON.stringify(ln.lineAtLeft) === '[1,0]' && JSON.stringify(ln.lineAtRight) === '[0,1]', JSON.stringify([ln.centered, ln.lineAtLeft, ln.lineAtRight]));
  check('선 밖 → 0,0 · 바닥색 밝음, 선 위 컬러센서 → 어두움', JSON.stringify(ln.off) === '[0,0]' && ln.rgbOff[0] > 200 && ln.rgbLine[0] < 60, `${ln.rgbOff} / ${ln.rgbLine}`);
  check('빨간 칩 위: 색 읽기·isColorAdvanced(빨강)=true, 초록=false, 칩 위에서도 선으로 읽음(추정)', ln.red.r > 180 && ln.red.isRed === true && ln.red.isGreen === false, JSON.stringify(ln.red));
  check('checkTwoLineState / checkSingleLineSensor', ln.two.offoff === true && ln.two.onoff === false && ln.two2.onoff === true && ln.two2.single === true, JSON.stringify([ln.two, ln.two2]));

  // ---- 핀 쓰러뜨리기 ----
  const pins = await S(() => {
    const P = window.__pony; P.runner.stop(); P.setScene('bowling'); P.setPose(70, 110, 0);
    P.api.runMecanum(2, 100); P.fastForward(6); P.api.stopAllMotors();
    return { down: P.world.pinsDown(), y: P.robot.y };
  });
  check('볼링: 똑바로 달리면 핀이 쓰러짐', pins.down >= 1, `쓰러진 핀 ${pins.down}/6, y=${f(pins.y)}`);

  // ---- 충돌(벽) ----
  const wl = await S(() => {
    const P = window.__pony; P.runner.stop(); P.setScene('relay'); P.setPose(60, 60, 0);
    P.api.runMecanum(2, 255); P.fastForward(8); const y = P.robot.y; P.api.stopAllMotors();
    return { y, minY: 22.5 + P.EST.radius };
  });
  check('책(장애물)을 뚫고 지나가지 않음', wl.y >= wl.minY - 0.01 && wl.y < wl.minY + 1, `y=${f(wl.y)} (한계 ${wl.minY})`);

  // ---- 코드 실행(실시간) ----
  const logs = (sel) => p.$$eval('#log ' + sel, els => els.map(e => e.textContent));
  const runSrc = async (src, scene = 'free') => {
    await S(({ src, scene }) => { window.__pony.setScene(scene); window.__pony.setPose(...[window.__pony.world.start.x, window.__pony.world.start.y, 0]); document.getElementById('code').value = src; }, { src, scene });
    await clickRun();
    await p.waitForTimeout(150);
  };
  await runSrc('aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 80)\nbasic.pause(1000)\naiPonybot.stopAllMotors()');
  const y0 = await S(() => window.__pony.world.start.y);
  await p.waitForTimeout(1600);
  const cy = await S(() => ({ y: window.__pony.robot.y, x: window.__pony.robot.x, h: window.__pony.robot.heading, running: window.__pony.runner.running }));
  check('코드: 앞으로 1초 뒤 정지 (실시간 ±25%)', near(y0 - cy.y, dF, dF * 0.25) && near(cy.x, 150, 0.01) && near(cy.h, 0, 0.01), `이동=${f(y0 - cy.y)} 예상≈${f(dF)}`);
  check('범위 안 값은 경고 없이 그대로(속도 경고·한도 없음)', (await logs('.warn')).length === 0 && (await logs('.error')).length === 0);
  await runSrc('aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 255)\nwhile (true) { basic.pause(50) }');
  await p.waitForTimeout(400);
  const fast = await S(() => window.__pony.robot.pwm[0]);
  check('속도 255 도 그대로 실행(경고 없음)', fast === 4080 && (await logs('.warn')).length === 0, `pwm=${fast}`);
  await p.click('#btnStop');
  const stopped = await S(() => ({ pwm: window.__pony.robot.pwm.slice(), run: window.__pony.runner.running }));
  check('정지 버튼 → 바퀴 명령도 0(Runner.stop 이 바퀴를 멈춤)', stopped.pwm.every(v => v === 0) && stopped.run === false, JSON.stringify(stopped));

  // OLED·5x5
  await runSrc('aiPonybot.clear()\naiPonybot.printString("LN")\naiPonybot.printNumber(7)\naiPonybot.showString("HELLO", 0, 3, 1)\naiPonybot.showNumber(42, 0, 5, 1)\naiPonybot.rectangle(100, 40, 120, 60, 1)\nbasic.showIcon(IconNames.Heart)');
  await p.waitForTimeout(500);
  const ol = await S(() => ({ rows: window.__pony.oled.textRows(), led: window.__pony.runner.display.flat().reduce((a, c) => a + c, 0) }));
  check('OLED: showString/showNumber/printString + 5x5 하트', ol.rows[0] === 'LN' && ol.rows[1] === '7' && ol.rows[3] === 'HELLO' && ol.rows[5].startsWith('42') && ol.led > 5, JSON.stringify(ol.rows) + ' led=' + ol.led);

  // 미지원·오류
  await runSrc('aiPonybot.parseFaceUnified("a", 0)\naiPonybot.runMecanum(aiPonybot.Mecanum.Stop, 0)\nneopixel.create(8, 4, 1).showColor(255)');
  await p.waitForTimeout(300);
  const w1 = await logs('.warn'), e1 = await logs('.error');
  check('미지원 블록 → 경고(크래시 아님)', w1.some(t => /지원하지 않는/.test(t)) && e1.length === 0, w1.join(' | ').slice(0, 120));
  await runSrc('Mecanum.Forward');
  await p.waitForTimeout(300);
  check('맨 이름 enum(Mecanum.Forward)은 오류로 안내', (await logs('.error')).some(t => /aiPonybot\.Mecanum/.test(t)), (await logs('.error')).join('|').slice(0, 100));
  await runSrc('let x = (');
  check('문법 오류 → "읽을 수 없어요"', (await logs('.error')).some(t => /읽을 수 없어요/.test(t)));

  // while(true){} 에도 응답
  await runSrc('let n = 0\nwhile (true) { n += 1 }');
  const alive = await Promise.race([S(() => 1 + 1), new Promise(res => setTimeout(() => res('freeze'), 2500))]);
  check('while(true){} 에도 페이지 응답', alive === 2, String(alive));
  await p.click('#btnStop');

  // ---- 예제 전부 ----
  const ids = await p.$$eval('#examples option', os => os.map(o => o.value).filter(Boolean));   // 첫 칸('예제 고르기…')은 빼고
  for (const id of ids) {
    await p.selectOption('#examples', id);
    await clickRun(); await p.waitForTimeout(700);
    await p.click('.mbbtn[data-btn="A"]'); await p.waitForTimeout(150);
    await p.click('.mbbtn[data-btn="B"]'); await p.waitForTimeout(150);
    await p.click('#radioBtns button:nth-child(4)'); await p.waitForTimeout(200);   // 3
    await p.click('#radioBtns button:nth-child(2)'); await p.waitForTimeout(200);   // 1
    const el = await logs('.error');
    check(`예제 실행 오류 0: ${id}`, el.length === 0, el.slice(0, 1).join(''));
    await p.click('#btnStop');
  }

  // ---- 예제 동작 ----
  await S(() => window.__pony.loadExample('02_distance-rule'));
  await clickRun(); await p.waitForTimeout(400);
  await S(() => window.__pony.setPose(60, 70, 0));   // 실행 시 처음 자리로 돌아가므로, 실행 뒤에 책 가까이로 옮김
  await p.click('.mbbtn[data-btn="A"]'); await p.waitForTimeout(4500);
  const dr = await S(() => ({ y: window.__pony.robot.y, ping: window.__pony.api.ping(1), pwm: window.__pony.robot.pwm.slice(), row: window.__pony.oled.textRows() }));
  check('02 거리 규칙: 책 앞에서 멈춤(ping<20·정지)', dr.ping < 20 && dr.ping > 5 && dr.pwm.every(v => v === 0), `y=${f(dr.y)} ping=${dr.ping} ${dr.row[0]}`);
  await p.click('#btnStop');
  await S(() => window.__pony.loadExample('03_ai-traffic-ponybot'));
  await clickRun(); await p.waitForTimeout(2800);   // 시작하면 'R1' 글자가 흐르는 동안은 라디오 핸들러가 아직 등록 전(실물도 같음)
  await p.click('#radioBtns button:nth-child(4)'); await p.waitForTimeout(1100);
  const g1 = await S(() => window.__pony.robot.pwm.slice());
  await p.click('#radioBtns button:nth-child(2)'); await p.waitForTimeout(500);
  const g2 = await S(() => window.__pony.robot.pwm.slice());
  check('03 신호등: 3 → 출발(4개 모터 전진), 1 → 정지', g1.every(v => v > 0) && g2.every(v => v === 0), `${g1} → ${g2} ` + JSON.stringify(await S(() => ({ ping: window.__pony.api.ping(1), h: Object.keys(window.__pony.runner.handlers), y: window.__pony.robot.y, log: document.getElementById('log').textContent.slice(0, 200), oled: window.__pony.oled.textRows()[0] }))));
  await p.click('#btnStop');
  await S(() => window.__pony.loadExample('S1_line-follow'));
  await clickRun(); await p.waitForTimeout(400);
  await p.click('.mbbtn[data-btn="A"]'); await p.waitForTimeout(6000);
  const lf = await S(() => {
    const P = window.__pony, pts = P.world.floor.tracks[0].pts;
    const dist = (x, y) => { let best = 1e9; for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1e-9))); best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy)); } return best; };
    return { x: P.robot.x, y: P.robot.y, off: dist(P.robot.x, P.robot.y), moved: Math.hypot(P.robot.x - 40, P.robot.y - 104) };
  });
  check('S1 라인 따라가기: 6초 뒤에도 선 위(선에서 4cm 이내)이고 출발점에서 멀어짐', lf.off <= 4 && lf.moved > 15, `위치=(${f(lf.x)},${f(lf.y)}) 선에서 ${f(lf.off)}cm, 이동 ${f(lf.moved)}cm`);
  await p.screenshot({ path: path.join(OUT, 'ponybot_sim.png') });
  await p.click('#btnStop');

  // ============================================================
  // 소품·편집기·지도 (props.js / maps.js / mapui.js)
  // ============================================================
  const SHOT = process.env.SHOT_DIR || OUT;
  fs.mkdirSync(SHOT, { recursive: true });
  const sc = (x, y) => S(({ x, y }) => window.__pony.view.toScreen(x, y), { x, y });
  const mouseAt = async (x, y, what) => { const s = await sc(x, y); await p.mouse.move(s.x, s.y); if (what === 'down') await p.mouse.down(); if (what === 'up') await p.mouse.up(); };
  const dragW = async (a, b) => { await mouseAt(a[0], a[1]); await p.mouse.down(); const A = await sc(a[0], a[1]), B = await sc(b[0], b[1]); for (let i = 1; i <= 8; i++) await p.mouse.move(A.x + (B.x - A.x) * i / 8, A.y + (B.y - A.y) * i / 8); await p.mouse.up(); };
  const clickW = async (x, y) => { await mouseAt(x, y); await p.mouse.down(); await p.mouse.up(); };
  const tool = async (t) => { await p.evaluate((t) => document.querySelector(`.pe-bar [data-tool="${t}"]`).click(), t); };
  const swatch = async (c) => { await p.evaluate((c) => document.querySelector(`.pe-colors [data-color="${c}"]`).click(), c); };
  const pc = async (fn, arg) => S(fn, arg);
  const reset = async (scene = 'free') => { await S((scene) => { const P = window.__pony; P.runner.stop(); P.setScene(scene); P.editor.setTool('select'); }, scene); };
  await S(() => document.getElementById('top2d').scrollIntoView({ block: 'center' }));

  // 1) 도우미 → 실행 → 빨간 칩이 앞에 생기고 로봇이 그 위에서 멈춤
  await reset('free');
  await ask('계속 앞으로 가다가 빨간색이 보이면 멈추고 OLED에 "RED"라고 써');
  await p.waitForFunction(() => /isColorAdvanced/.test(document.getElementById('code').value), null, { timeout: 15000 });
  await clickRun(); await p.waitForTimeout(3200);
  const rd = await S(() => { const P = window.__pony; return { chips: JSON.parse(JSON.stringify(P.props.chips)), pwm: P.robot.pwm.slice(), oled: P.oled.textRows()[0], y: P.robot.y, red: P.api.isColorAdvanced(0), log: document.getElementById('log').textContent }; });
  check('도우미 "빨간색이 보이면 멈추고" → 실행하면 빨간 칩이 앞에 생기고 로봇이 그 위에서 멈춰 RED', rd.chips.length === 1 && rd.chips[0].color === 'red' && rd.pwm.every(v => v === 0) && rd.oled === 'RED' && rd.red === true && /빨간 컬러칩을 앞 \d+cm에 놓았어요 — 끌어서 옮길 수 있어요/.test(rd.log), JSON.stringify(rd).slice(0, 240));
  // 2) 다시 실행해도 중복·이동 없음
  await S(() => { window.__pony.props.chips[0].x += 14; });
  const moved = await S(() => JSON.stringify(window.__pony.props.chips));
  await clickRun(); await p.waitForTimeout(500);
  const again = await S(() => ({ chips: JSON.stringify(window.__pony.props.chips), log: document.getElementById('log').textContent }));
  check('다시 실행: 사용자가 옮긴 칩은 그대로·중복 없음·같은 안내 안 나옴', again.chips === moved && !/놓았어요/.test(again.log), again.log.slice(0, 80));
  await p.click('#btnStop');
  // 3) 선 코드 + 빈 장면 → 선 생성 → 라인 따라가기 예제가 선 위에 머묾
  const s1 = await S(() => { window.__pony.loadExample('S1_line-follow'); const c = document.getElementById('code').value; window.__pony.setScene('free'); return c; });
  await S((c) => { document.getElementById('code').value = c; }, s1);
  await clickRun(); await p.waitForTimeout(400);
  const made = await S(() => { const P = window.__pony; return { tracks: P.props.tracks.length, onLine: P.PROPS.onLine(P.props, P.robot.x, P.robot.y), log: document.getElementById('log').textContent }; });
  await p.click('.mbbtn[data-btn="A"]'); await p.waitForTimeout(6000);
  const fl = await S(() => { const P = window.__pony, t = P.props.tracks[0]; return { off: P.PROPS.distToTrack(t, P.robot.x, P.robot.y), moved: Math.hypot(P.robot.x - P.world.start.x, P.robot.y - P.world.start.y) }; });
  check('선 코드 + 빈 장면 → 검은 선 자동 생성, 라인 따라가기가 6초 뒤에도 선 위(4cm 이내)', made.tracks === 1 && made.onLine && /검은 선 트랙/.test(made.log) && fl.off <= 4 && fl.moved > 15, JSON.stringify({ made, fl }));
  await p.click('#btnStop');
  // 4) 끌어서 옮기면 센서 값이 바뀜
  await reset('free');
  const drag0 = await S(() => { const P = window.__pony; P.setPose(150, 100, 0); const b = P.editor.addAt('box', 150, 40); return { ping: P.api.ping(1), y: b.y }; });
  await dragW([150, 40], [150, 8]);
  const drag1 = await S(() => { const P = window.__pony, b = P.props.boxes[0]; return { ping: P.api.ping(1), y: b.y }; });
  check('상자를 위로 끌어 옮김 → 위치가 바뀌고 ping 이 늘어남', drag0.ping < 50 && drag1.y < drag0.y - 20 && drag1.ping > drag0.ping + 25, JSON.stringify([drag0, drag1]));
  await dragW([150, 14], [150, 100]);   // 로봇 위로 끌기 → 막힘
  const onRobot = await S(() => { const P = window.__pony, b = P.props.boxes[0]; return Math.hypot(b.x + b.w / 2 - P.robot.x, b.y + b.h / 2 - P.robot.y); });
  check('로봇 위로는 끌어 놓을 수 없음(겹치지 않음)', onRobot > 9 + 3, `거리 ${f(onRobot)}`);
  // 실행 중에도 끌 수 있음
  await S(() => { window.__pony.props.boxes.length = 0; window.__pony.editor.addAt('box', 60, 40); document.getElementById('code').value = 'basic.forever(function () { basic.pause(50) })'; });
  await clickRun(); await p.waitForTimeout(200);
  await dragW([60, 40], [100, 60]);
  const runDrag = await S(() => ({ x: window.__pony.props.boxes[0].x, running: window.__pony.runner.running }));
  check('프로그램이 도는 중에도 소품을 끌어 옮길 수 있음', runDrag.running && runDrag.x > 80, JSON.stringify(runDrag));
  await p.click('#btnStop');
  // 5) 도구로 놓기·지우기·Delete
  await reset('free');
  await S(() => { const P = window.__pony; P.props.boxes.length = 0; P.props.objects.length = 0; P.props.chips.length = 0; P.props.tracks.length = 0; P.setPose(150, 100, 0); });
  await tool('box'); await clickW(50, 50);
  await tool('object'); await swatch('yellow'); await clickW(250, 50);
  await tool('chip'); await swatch('blue'); await clickW(250, 150);
  await tool('box'); await clickW(150, 100);   // 로봇 위: 거절
  let cnt = await S(() => { const P = window.__pony.props; return { b: P.boxes.length, o: P.objects.length, c: P.chips.length, oc: P.objects[0] && P.objects[0].color, cc: P.chips[0] && P.chips[0].color }; });
  check('도구로 놓기: 상자·노란 물체·파란 칩 추가, 로봇 위는 거절', cnt.b === 1 && cnt.o === 1 && cnt.c === 1 && cnt.oc === 'yellow' && cnt.cc === 'blue', JSON.stringify(cnt));
  await tool('erase'); await clickW(50, 50); await clickW(250, 50);
  await tool('select'); await clickW(250, 150); await p.keyboard.press('Delete');
  cnt = await S(() => { const P = window.__pony.props; return { b: P.boxes.length, o: P.objects.length, c: P.chips.length }; });
  check('지우개로 상자·물체 지우기, 선택 + Delete 로 칩 지우기', cnt.b === 0 && cnt.o === 0 && cnt.c === 0, JSON.stringify(cnt));
  // 6) 선 점 끌기·끼우기 → 라인 센서 값 변화, 프리셋 전환·굵기
  await reset('free');
  await S(() => { const P = window.__pony; P.editor.preset('straight'); });
  await tool('track');
  const line0 = await S(() => { const P = window.__pony; P.setPose(100, 102.5, 90); return [P.api.readLineSensor(1), P.api.readLineSensor(2), P.props.tracks[0].pts.length]; });
  await mouseAt(100, 100, 'down'); await mouseAt(100, 100, 'up'); await mouseAt(100, 100, 'down');   // 두 번 눌러 점 끼움 + 바로 끌기
  const B = await sc(100, 130); await p.mouse.move(B.x, B.y, { steps: 6 }); await p.mouse.up();
  const line1 = await S(() => { const P = window.__pony; return [P.api.readLineSensor(1), P.api.readLineSensor(2), P.props.tracks[0].pts.length, P.props.tracks[0].pts[1]]; });
  check('선 편집: 두 번 눌러 점 추가 후 끌기 → 점 3개·선이 휘고 라인 센서 값이 1,0 → 0,0', line0[0] === 1 && line0[1] === 0 && line0[2] === 2 && line1[2] === 3 && near(line1[3][1], 130, 3) && line1[0] === 0 && line1[1] === 0, JSON.stringify([line0, line1]));
  await tool('erase'); await mouseAt(line1[3][0], line1[3][1], 'down'); await mouseAt(line1[3][0], line1[3][1], 'up');
  check('지우개로 선의 점 하나 지움', (await S(() => window.__pony.props.tracks[0].pts.length)) === 2);
  await S(() => { const P = window.__pony; P.editor.setTool('select'); document.getElementById('mapSet').open = true; });
  await p.click('[data-preset="oval"]');
  const ov = await S(() => { const P = window.__pony, t = P.props.tracks[0]; return { closed: t.closed, n: t.pts.length, tracks: P.props.tracks.length, startOn: P.PROPS.onLine(P.props, P.world.start.x, P.world.start.y), robotOn: P.PROPS.onLine(P.props, P.robot.x, P.robot.y) }; });
  await p.click('[data-preset="figure8"]');
  const f8 = await S(() => { const t = window.__pony.props.tracks[0]; return { closed: t.closed, n: t.pts.length, tracks: window.__pony.props.tracks.length }; });
  await S(() => { const w = document.getElementById('pe-width'); w.value = '7'; w.dispatchEvent(new Event('input')); });
  const wd = await S(() => window.__pony.props.tracks[0].width);
  check('프리셋 전환: 타원(닫힘·선 위 시작) → 8자(32점, 선 1개) → 굵기 슬라이더 7cm', ov.closed && ov.n > 10 && ov.tracks === 1 && ov.startOn && ov.robotOn && f8.closed && f8.n === 32 && f8.tracks === 1 && wd === 7, JSON.stringify({ ov, f8, wd }));
  // 7) 저장 → 새로 고침 → 불러오기
  await S(() => { const P = window.__pony; P.editor.setTool('box'); });
  await S(() => document.getElementById('top2d').scrollIntoView({ block: 'center' }));   // 위 [프리셋] 누르며 화면이 움직였으므로 바닥을 다시 가운데로
  await tool('box'); await clickW(250, 30); await tool('object'); await swatch('green'); await clickW(40, 30); await tool('select');
  const saved = await S(() => { document.getElementById('pe-save').click(); return JSON.stringify(window.__pony.props); });
  await p.waitForLoadState('networkidle'); await p.reload(); await p.waitForFunction(() => window.__ponyReady && window.Babel, null, { timeout: 30000 });
  const preLoad = await S(() => JSON.stringify(window.__pony.props));
  await S(() => { window.__pony.setScene('free'); document.getElementById('pe-load').click(); });
  const restored = await S(() => JSON.stringify(window.__pony.props));
  check('장면 저장 → 새로 고침 → 불러오기: 소품이 그대로 복원', saved === restored && preLoad !== saved && JSON.parse(restored).objects[0].color === 'green' && JSON.parse(restored).tracks[0].width === 7, `${saved.length} vs ${restored.length}`);
  await S(() => document.getElementById('top2d').scrollIntoView({ block: 'center' }));

  // 8) 지도 라이브러리
  const mapIds = await S(() => [...document.querySelectorAll('#map-pick option')].map(o => o.value).filter(v => v && !v.startsWith('c:')));
  const mapRes = [];
  for (const id of mapIds) {
    const r = await S((id) => { const P = window.__pony; const ok = P.lib.loadBuiltin(id), m = P.PROPS ? null : null;
      return { id, ok, size: { ...P.world.size }, start: { ...P.world.start }, rx: P.robot.x, ry: P.robot.y, tracks: P.props.tracks.length, scene: document.getElementById('scene').value }; }, id);
    mapRes.push(r);
  }
  check(`내장 지도 ${mapIds.length}개 전부 로드: 크기·시작 자리·로봇 위치 반영, 오류 0`, mapIds.length >= 11 && mapRes.every(r => r.ok && r.tracks > 0 && near(r.rx, r.start.x, 0.01) && near(r.ry, r.start.y, 0.01) && r.scene === 'map'), JSON.stringify(mapRes.filter(r => !r.ok)));
  await S(() => { document.getElementById('mapSet').open = true; });
  await p.selectOption('#map-pick', 'l4-rcj-a');
  const banner = await S(() => ({ b: document.getElementById('map-banner').innerText, st: document.getElementById('map-status').innerText }));
  check('RCJ 지도: "공식 대회 맵 아님" 문구와 출처 링크 표시', /공식 대회 맵 아님/.test(banner.b) && /Rescue Line Entry 2025/.test(banner.b) && (await S(() => !!document.querySelector('#map-banner a[href*="robocupap.org/RCAP2025_Rules/Rescue-Line-Entry-Rules-2025.pdf"]'))), banner.b.slice(0, 80));
  // 타일 지도 중심선에서 라인 센서가 1
  const along = await S(() => {
    const P = window.__pony, E = P.EST, out = { n: 0, ok: 0 };
    for (const id of ['l4-rcj-a', 'l4-rcj-b', 'l4-rcj-c', 'l2-square']) {
      P.lib.loadBuiltin(id);
      for (const t of P.props.tracks) {
        const L = P.PROPS.trackLength(t);
        for (let s = 0; s <= L; s += 7) {
          const q = P.PROPS.pointAlong(t, s), h = q.heading * Math.PI / 180, c = Math.cos(h), sn = Math.sin(h), u = -E.lineHalfGap, v = E.lineForward;
          P.robot.heading = q.heading; P.robot.x = q.x - (u * c + v * sn); P.robot.y = q.y - (u * sn - v * c);
          out.n++; if (P.robot.lineRaw(0) === 1) out.ok++;
        }
      }
    }
    return out;
  });
  check(`타일·대회형 지도 중심선을 따라 샘플 ${along.n}곳 모두 라인 센서가 1을 읽음`, along.n > 100 && along.ok === along.n, JSON.stringify(along));
  // 끊긴 선
  const gp = await S(() => { const P = window.__pony; P.lib.loadBuiltin('l3-gaps'); const rd = (sy) => { P.robot.heading = 0; P.robot.x = 52.5; P.robot.y = sy + P.EST.lineForward; return P.robot.lineRaw(0); }; return { before: rd(240), gap1: rd(201), after: rd(150), gap2: rd(121), end: rd(60) }; });
  check('끊긴 선 지도: 선 위 1 · 틈 안 0 · 틈 뒤 다시 1', gp.before === 1 && gp.gap1 === 0 && gp.after === 1 && gp.gap2 === 0 && gp.end === 1, JSON.stringify(gp));
  // 초록 표식
  const gm = await S(() => {
    const P = window.__pony; P.lib.loadBuiltin('l4-rcj-b'); const ch = P.props.chips.find(c => c.color === 'green'), cx = ch.x + ch.w / 2, cy = ch.y + ch.h / 2;
    P.robot.heading = 90; P.robot.x = cx - P.EST.colorForward; P.robot.y = cy;
    return { green: P.api.isColorAdvanced(1), red: P.api.isColorAdvanced(0), g: P.api.getGreen(), r: P.api.getRed() };
  });
  check('초록 표식 칩 위 컬러 센서: isColorAdvanced(Green)=true · Red=false', gm.green === true && gm.red === false && gm.g > gm.r, JSON.stringify(gm));
  // 고치면 '내 지도'
  const ce = await S(() => {
    const P = window.__pony; P.lib.loadBuiltin('l1-oval'); const before = { custom: P.lib.cur.custom, title: P.lib.cur.title };
    P.editor.addAt('box', 120, 40); return { before, after: { custom: P.lib.cur.custom, title: P.lib.cur.title }, status: document.getElementById('map-status').innerText, fresh: P.PROPS && true };
  });
  check('프리셋을 불러온 뒤 고치면 "내 지도"로 바뀜(복사 후 편집)', ce.before.custom === false && ce.after.custom === true && /내 지도/.test(ce.after.title) && /내 지도/.test(ce.status), JSON.stringify(ce));
  // 타일 편집(화면 클릭 + API)
  const til = await S(() => {
    const P = window.__pony; P.lib.loadBuiltin('l1-straight'); P.lib.resizeTiles(4, 2);
    const g = (x, y, t, r) => P.lib.setTile(x, y, t, r);
    g(0, 0, 'start', 1); g(1, 0, 'line', 1); g(2, 0, 'curve', 2); g(2, 1, 'curve', 0); g(3, 1, 'goal', 3);
    const tr = P.props.tracks; let cont = true, n = 0;
    for (const t of tr) { const L = P.PROPS.trackLength(t); for (let s = 0; s <= L; s += 1.5) { const q = P.PROPS.pointAlong(t, s); n++; cont = cont && P.PROPS.onLine(P.props, q.x, q.y); } }
    return { size: { ...P.world.size }, start: { ...P.world.start }, tracks: tr.length, n, cont, robot: [P.robot.x, P.robot.y], custom: P.lib.cur.custom, chips: P.props.chips.map(c => c.color) };
  });
  check('타일 편집: 시작·직선·곡선 2개·도착 → 한 줄로 이어짐(120×60cm), 시작 자리·도착 칩', til.size.w === 120 && til.size.h === 60 && til.tracks === 1 && til.cont && til.start.heading === 90 && near(til.start.x, 15, 0.01) && near(til.robot[0], 15, 0.01) && til.custom && til.chips.join() === 'blue', JSON.stringify(til));
  await S(() => { document.getElementById('mapSet').open = true; document.getElementById('tile-det').open = true; });
  await p.click('#tile-box [data-tile="cross"]');
  const cb = await p.locator('#tile-canvas').boundingBox();
  await p.mouse.click(cb.x + cb.width * 0.12, cb.y + cb.height * 0.75);   // 칸 (0,1)
  const ct = await S(() => window.__pony.lib.grid.cells[1][0]);
  check('타일 격자 캔버스를 눌러 고른 타일(+ 교차로)을 놓음', ct.t === 'cross', JSON.stringify(ct));
  await S(() => window.__pony.lib.setTile(0, 1, 'rotate'));
  check('칸 돌리기 → 방향 +1', (await S(() => window.__pony.lib.grid.cells[1][0].r)) === 1);
  // 내 지도 이름으로 저장·불러오기, 내보내기·가져오기
  const named = await S(() => {
    const P = window.__pony; P.lib.loadBuiltin('l2-square'); P.editor.addAt('object', 100, 100, 'blue'); P.editor.addAt('chip', 150, 40, 'green');
    document.getElementById('map-name').value = '시험 지도'; document.getElementById('map-save').click();
    const a = JSON.stringify({ props: P.props, size: P.world.size, start: P.world.start });
    P.lib.loadBuiltin('l1-straight');
    const sel = document.getElementById('map-saved'); sel.value = '시험 지도'; document.getElementById('map-load').click();
    const b = JSON.stringify({ props: P.props, size: P.world.size, start: P.world.start });
    return { a, b, list: [...sel.options].map(o => o.value).join('|'), title: P.lib.cur.title, ls: !!localStorage.getItem('sim-maps.custom.v1') };
  });
  check('내 지도를 이름으로 저장 → 다른 지도로 바꿈 → 불러오기: 소품·크기·시작 자리 동일', named.a === named.b && /시험 지도/.test(named.list) && named.title === '시험 지도' && named.ls, named.list);
  const rt = await S(() => {
    const P = window.__pony; P.lib.loadBuiltin('l4-rcj-c'); const a = JSON.stringify({ props: P.props, size: P.world.size, start: P.world.start }), text = P.lib.exportText();
    P.lib.loadBuiltin('l1-oval'); const ok = P.lib.importText(text); const b = JSON.stringify({ props: P.props, size: P.world.size, start: P.world.start });
    const bad = P.lib.importText('{깨짐'); return { a, b, ok, bad, haveBox: P.props.boxes.length };
  });
  check('지도 내보내기(JSON) → 가져오기 왕복 동일, 깨진 글은 거절', rt.ok && rt.a === rt.b && rt.bad === false && rt.haveBox === 1);
  // 로봇 시작 자리로
  const ts = await S(() => { const P = window.__pony; P.lib.loadBuiltin('l3-zigzag'); P.setPose(200, 100, 70); document.getElementById('map-tostart').click(); return { x: P.robot.x, y: P.robot.y, h: P.robot.heading, s: { ...P.world.start } }; });
  check('"로봇 시작 자리로" → 지도의 시작 자리·방향', near(ts.x, ts.s.x, 0.01) && near(ts.y, ts.s.y, 0.01) && near(ts.h, ts.s.heading, 0.01), JSON.stringify(ts));
  // 화면 그림(데스크톱)
  await S(() => { const P = window.__pony; P.lib.loadBuiltin('l4-rcj-b'); document.getElementById('mapSet').open = true; document.getElementById('tile-det').open = true; });
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(SHOT, 'desktop.png'), fullPage: true });
  await S(() => window.__pony.setScene('free'));

  // ---- 화면 ----
  const vis = await S(() => ({ img: !!document.querySelector('.brand img').naturalWidth, est: /추정/.test(document.body.innerText), assistant: !!document.getElementById('askBtn') && !document.getElementById('assist').hidden, scenes: document.querySelectorAll('#scene option').length }));
  check('제품 그림 로드·"추정" 표시·말로 코드 만들기 칸', vis.img && vis.est && vis.assistant && vis.scenes === 4, JSON.stringify(vis));

  // ---- 말로 코드 만들기 → 실행 → 움직임 (규칙 모드, 오프라인) ----
  await p.selectOption('#scene', 'free').catch(() => {});
  await ask('A 버튼을 누르면 오른쪽 옆으로 1초 동안 가');
  await p.waitForFunction(() => /runMecanum\(aiPonybot\.Mecanum\.Right/.test(document.getElementById('code').value), null, { timeout: 15000 });
  await clickRun(); await p.waitForTimeout(600);
  const a0 = await S(() => ({ x: window.__pony.robot.x, y: window.__pony.robot.y }));
  await p.click('.mbbtn[data-btn="A"]'); await p.waitForTimeout(1800);
  const a1 = await S(() => ({ x: window.__pony.robot.x, y: window.__pony.robot.y, h: window.__pony.robot.heading }));
  check('도우미 코드 실행: A → 오른쪽 옆 이동(y·방향 그대로) 뒤 멈춤', a1.x - a0.x > 5 && Math.abs(a1.y - a0.y) < 0.5 && Math.abs(a1.h) < 0.5, `dx=${f(a1.x - a0.x)} dy=${f(a1.y - a0.y)} heading=${f(a1.h)}`);
  await p.click('#btnStop');
  await p.fill('#askText', '날아서 하늘로 가'); await p.click('#askBtn'); await p.waitForTimeout(300);
  const unk = await S(() => document.getElementById('askOut').innerText);
  check('도우미: 모르는 말은 코드 없이 경고', /알아듣지 못/.test(unk), unk.slice(0, 60));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.reload(); await p.waitForFunction(() => window.__ponyReady, null, { timeout: 30000 }); await p.waitForTimeout(300);
  await S(() => { window.__pony.lib.loadBuiltin('l4-rcj-b'); window.__pony.lib.resizeTiles(10, 4); document.getElementById('mapSet').open = true; document.getElementById('tile-det').open = true; });
  await p.waitForTimeout(300);
  const sw = await S(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, bw: document.body.scrollWidth }));
  check('390px 가로 스크롤 없음', sw.sw <= sw.iw && sw.bw <= sw.iw, JSON.stringify(sw));
  await p.screenshot({ path: path.join(OUT, 'ponybot_sim_390.png'), fullPage: true });
  await p.screenshot({ path: path.join(SHOT, 'mobile390.png'), fullPage: true });

  check('페이지 오류·콘솔 오류 0', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  if (srv) srv.kill();
  const fail = results.filter(x => !x.ok).length;
  console.log(`\n결과: ${results.length - fail} 통과 / ${fail} 실패 (총 ${results.length})`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
