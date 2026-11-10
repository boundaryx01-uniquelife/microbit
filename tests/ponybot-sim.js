// 포니봇 시뮬레이터 자동 시험 (Playwright, 헤드리스 크로미움)
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
    try { const r = await fetch(base + 'ponybot/sim/index.html'); if (r.ok) return { srv, base }; } catch (e) { /* 기다림 */ }
    await new Promise(r => setTimeout(r, 100));
  }
  srv.kill(); throw new Error('정적 서버가 안 떠요');
}

(async () => {
  let srv = null, BASE = process.argv[2];
  if (!BASE) { const s = await startServer(); srv = s.srv; BASE = s.base; }
  BASE = BASE.replace(/\/?$/, '/');
  const URL = BASE + 'ponybot/sim/index.html';

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/aiPonybot\.Mecanum/.test(m.text())) errs.push('console: ' + m.text()); });   // 일부러 낸 enum 오류는 제외
  p.on('requestfailed', r => errs.push('requestfailed: ' + r.url()));
  await p.goto(URL);
  await p.waitForFunction(() => window.__ponyReady && window.Babel, null, { timeout: 30000 });

  const S = (fn, arg) => p.evaluate(fn, arg);
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
  check('runNormal Clockwise 1초 → heading 증가(시계)·제자리', r.dh > 30 && near(r.dh, dhExp, 0.5) && Math.hypot(r.dx, r.dy) < 0.05, `dh=${f(r.dh)}° (예상 ${f(dhExp)}°) 위치변화=${f(Math.hypot(r.dx, r.dy))}`);
  r = await move(A, POSE, 'aiPonybot.runNormal(4, 80)', 1);
  check('runNormal CounterClockwise → heading 감소', r.dh < -30, `dh=${f(r.dh)}`);
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
  check('runMotor Clockwise: M1=RL, M2=FL, M3=FR, M4=RR 만 전진', mm[1] === 'RL' && mm[2] === 'FL' && mm[3] === 'FR' && mm[4] === 'RR', JSON.stringify(mm));
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
    P.setScene('relay'); P.setPose(60, 224, 0);                       // 책 앞면 y=22.5, 앞면 센서 y=216
    const wall = P.api.ping(1), inch = P.api.ping(2), us = P.api.ping(0);
    P.setScene('free'); P.setPose(150, 100, 0);
    const none = P.api.ping(1), noneUs = P.api.ping(0), noneMax = P.api.ping(1, 120);
    P.world.addBox(150, 40);                                          // 앞 상자: 앞면 y=46, 센서 y=92 → 46cm
    const box = P.api.ping(1);
    P.setPose(150, 100, 90); const side = P.api.ping(1);              // 오른쪽엔 아무것도 없음
    P.setScene('bowling'); P.setPose(70, 238, 0); const wallB = P.api.ping(1);   // 앞 핀(y=28±3.5) 맞음
    return { wall, inch, us, none, noneUs, noneMax, box, side, wallB };
  });
  check('벽(책) 앞 ping ≈ 참 거리(193.5cm)', near(pg.wall, 193.5, 1), `ping=${pg.wall} 인치=${pg.inch} µs=${pg.us}`);
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
    await p.click('#btnRun');
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
  const ids = await p.$$eval('#examples option', os => os.map(o => o.value));
  for (const id of ids) {
    await p.selectOption('#examples', id);
    await p.click('#btnRun'); await p.waitForTimeout(700);
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
  await p.click('#btnRun'); await p.waitForTimeout(400);
  await S(() => window.__pony.setPose(60, 70, 0));   // 실행 시 처음 자리로 돌아가므로, 실행 뒤에 책 가까이로 옮김
  await p.click('.mbbtn[data-btn="A"]'); await p.waitForTimeout(4500);
  const dr = await S(() => ({ y: window.__pony.robot.y, ping: window.__pony.api.ping(1), pwm: window.__pony.robot.pwm.slice(), row: window.__pony.oled.textRows() }));
  check('02 거리 규칙: 책 앞에서 멈춤(ping<20·정지)', dr.ping < 20 && dr.ping > 5 && dr.pwm.every(v => v === 0), `y=${f(dr.y)} ping=${dr.ping} ${dr.row[0]}`);
  await p.click('#btnStop');
  await S(() => window.__pony.loadExample('03_ai-traffic-ponybot'));
  await p.click('#btnRun'); await p.waitForTimeout(2800);   // 시작하면 'R1' 글자가 흐르는 동안은 라디오 핸들러가 아직 등록 전(실물도 같음)
  await p.click('#radioBtns button:nth-child(4)'); await p.waitForTimeout(1100);
  const g1 = await S(() => window.__pony.robot.pwm.slice());
  await p.click('#radioBtns button:nth-child(2)'); await p.waitForTimeout(500);
  const g2 = await S(() => window.__pony.robot.pwm.slice());
  check('03 신호등: 3 → 출발(4개 모터 전진), 1 → 정지', g1.every(v => v > 0) && g2.every(v => v === 0), `${g1} → ${g2} ` + JSON.stringify(await S(() => ({ ping: window.__pony.api.ping(1), h: Object.keys(window.__pony.runner.handlers), y: window.__pony.robot.y, log: document.getElementById('log').textContent.slice(0, 200), oled: window.__pony.oled.textRows()[0] }))));
  await p.click('#btnStop');
  await S(() => window.__pony.loadExample('S1_line-follow'));
  await p.click('#btnRun'); await p.waitForTimeout(400);
  await p.click('.mbbtn[data-btn="A"]'); await p.waitForTimeout(6000);
  const lf = await S(() => {
    const P = window.__pony, pts = P.world.floor.tracks[0].pts;
    const dist = (x, y) => { let best = 1e9; for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1e-9))); best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy)); } return best; };
    return { x: P.robot.x, y: P.robot.y, off: dist(P.robot.x, P.robot.y), moved: Math.hypot(P.robot.x - 40, P.robot.y - 104) };
  });
  check('S1 라인 따라가기: 6초 뒤에도 선 위(선에서 4cm 이내)이고 출발점에서 멀어짐', lf.off <= 4 && lf.moved > 15, `위치=(${f(lf.x)},${f(lf.y)}) 선에서 ${f(lf.off)}cm, 이동 ${f(lf.moved)}cm`);
  await p.screenshot({ path: path.join(OUT, 'ponybot_sim.png') });
  await p.click('#btnStop');

  // ---- 화면 ----
  const vis = await S(() => ({ img: !!document.querySelector('header img').naturalWidth, est: /추정/.test(document.body.innerText), assistant: !!document.getElementById('askGo') && !document.getElementById('assistant').hidden, scenes: document.querySelectorAll('#scene option').length }));
  check('제품 그림 로드·"추정" 표시·말로 코드 만들기 칸', vis.img && vis.est && vis.assistant && vis.scenes === 4, JSON.stringify(vis));

  // ---- 말로 코드 만들기 → 실행 → 움직임 (규칙 모드, 오프라인) ----
  await p.selectOption('#scene', 'free').catch(() => {});
  await p.fill('#askText', 'A 버튼을 누르면 오른쪽 옆으로 1초 동안 가'); await p.click('#askGo');
  await p.waitForFunction(() => /runMecanum\(aiPonybot\.Mecanum\.Right/.test(document.getElementById('code').value), null, { timeout: 15000 });
  await p.click('#btnRun'); await p.waitForTimeout(600);
  const a0 = await S(() => ({ x: window.__pony.robot.x, y: window.__pony.robot.y }));
  await p.click('.mbbtn[data-btn="A"]'); await p.waitForTimeout(1800);
  const a1 = await S(() => ({ x: window.__pony.robot.x, y: window.__pony.robot.y, h: window.__pony.robot.heading }));
  check('도우미 코드 실행: A → 오른쪽 옆 이동(y·방향 그대로) 뒤 멈춤', a1.x - a0.x > 5 && Math.abs(a1.y - a0.y) < 0.5 && Math.abs(a1.h) < 0.5, `dx=${f(a1.x - a0.x)} dy=${f(a1.y - a0.y)} heading=${f(a1.h)}`);
  await p.click('#btnStop');
  await p.fill('#askText', '날아서 하늘로 가'); await p.click('#askGo'); await p.waitForTimeout(300);
  const unk = await S(() => document.getElementById('askOut').innerText);
  check('도우미: 모르는 말은 코드 없이 경고', /알아듣지 못/.test(unk), unk.slice(0, 60));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.reload(); await p.waitForFunction(() => window.__ponyReady, null, { timeout: 30000 }); await p.waitForTimeout(300);
  const sw = await S(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, bw: document.body.scrollWidth }));
  check('390px 가로 스크롤 없음', sw.sw <= sw.iw && sw.bw <= sw.iw, JSON.stringify(sw));
  await p.screenshot({ path: path.join(OUT, 'ponybot_sim_390.png'), fullPage: true });

  check('페이지 오류·콘솔 오류 0', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  if (srv) srv.kill();
  const fail = results.filter(x => !x.ok).length;
  console.log(`\n결과: ${results.length - fail} 통과 / ${fail} 실패 (총 ${results.length})`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
