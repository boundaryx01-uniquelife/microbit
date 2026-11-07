// 로보독 시뮬레이터 자동 시험
// 실행: cd bridge && python3 -m http.server 8765  →  node tests/sim-e2e.js [기본주소]
const { chromium } = require('playwright');
const path = require('path');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const OUT = path.join(__dirname, 'mc');
require('fs').mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); };

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  const p = await ctx.newPage();
  // 로컬 정적 서버에는 도우미 서버 함수가 없으므로 '키 없음' 응답으로 대신함
  await p.route('**/api/robodog-assistant', r => r.fulfill({ json: { ok: true, configured: false, needsCode: false } }));
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  // 0. 처음 열면 자동 시연이 시작되는지
  await p.goto(BASE + 'sim/?demo=1');   // 블록 코딩 첫 화면은 자동 시연을 하지 않으므로 ?demo=1 로 켬
  await p.waitForFunction(() => window.__sim && window.Babel, null, { timeout: 30000 });
  await p.waitForTimeout(4000);
  const cap0 = await p.textContent('#caption');
  const st0 = await p.evaluate(() => ({ mode: window.__sim.robot.mode, posture: window.__sim.robot.posture, code: document.getElementById('code').value.includes('동작 둘러보기') }));
  check('처음 열면 "동작 둘러보기" 자동 시연', st0.code && /A 버튼/.test(cap0) && st0.mode === 4, `${cap0.slice(0, 30)} mode=${st0.mode}`);
  await p.screenshot({ path: path.join(OUT, 'sim_demo_auto.png') });
  check('편집기 화면에서는 시연 카드 접힘 + 자막은 보임', await p.evaluate(() => !document.getElementById('demoBox').open) && await p.isVisible('#caption'));
  await p.click('#demoBox > summary');   // 시연 펼치기
  // 신호등 카드 → 라디오 자동 → 출발
  await p.click('#demoCards button[data-id="03_ai-traffic-dog"]');
  let walked = false;
  for (let i = 0; i < 40 && !walked; i++) { await p.waitForTimeout(150); walked = (await p.evaluate(() => window.__sim.robot.vel)) === 25; }
  check('신호등 카드 → 라디오 3 자동 전송 → 출발', walked, await p.textContent('#caption'));
  await p.waitForTimeout(3500);
  const led1 = await p.evaluate(() => window.__sim.robot.bodyLed.join(','));
  check('… → 노랑(2) 받으면 주황 불·정지', led1 === '255,160,0' && (await p.evaluate(() => window.__sim.robot.vel)) === 0, led1);
  await p.screenshot({ path: path.join(OUT, 'sim_demo_traffic.png') });
  await p.click('#btnDemoStop');
  check('시연 멈추기', (await p.textContent('#caption')).includes('직접'));
  check('처음 화면은 블록 코딩(MakeCode) 탭', await p.evaluate(() => document.getElementById('tabEditor').getAttribute('aria-selected') === 'true' && document.body.classList.contains('mc-mode')));
  check('블록으로 보기 탭은 없음(편집기와 중복)', (await p.$$('#tabBlocks')).length === 0);
  // 이후 시험은 자동 시연 없이, JavaScript 탭에서
  await p.goto(BASE + 'sim/?demo=0&tab=js');
  await p.waitForFunction(() => window.__sim && window.Babel, null, { timeout: 30000 });
  const S = (fn, arg) => p.evaluate(fn, arg);
  const errorLogs = () => p.$$eval('#log .error', els => els.map(e => e.textContent));
  const loadExample = async (id) => { await p.selectOption('#examples', id); await p.waitForTimeout(100); };
  const run = async () => { await p.click('#btnRun'); await p.waitForTimeout(300); };
  const state = () => S(() => { const r = window.__sim.robot; return { x: r.x, y: r.y, h: r.heading, vel: r.vel, mode: r.mode, posture: r.posture, led: r.bodyLed.slice(), fallen: r.fallen, expr: r.expr, headMode: r.headMode }; });
  const pressMb = async (btn) => { const el = await p.$(`.mbbtn[data-btn="${btn}"]`); await el.scrollIntoViewIfNeeded(); const bx = await el.boundingBox(); await p.mouse.move(bx.x + 10, bx.y + 10); await p.mouse.down(); await p.waitForTimeout(60); await p.mouse.up(); };

  // 1. 예제 5개 실행 오류 없음
  for (const id of ['01_hello-robodog', '02_distance-rule', '03_ai-traffic-dog', '04_ai-team-template', '05_motion-tour']) {
    await loadExample(id); await run(); await p.waitForTimeout(800);
    const el = await errorLogs();
    check(`예제 실행: ${id}`, el.length === 0, el.slice(0, 1).join(''));
    await p.click('#btnStop');
    await p.evaluate(() => { document.getElementById('log').innerHTML = ''; });
  }

  // 2. 동작 둘러보기: B = 앞으로 1초(속도 30) → 90° 회전
  await loadExample('05_motion-tour'); await run(); await p.waitForTimeout(500);
  const s0 = await state();
  await pressMb('B'); await p.waitForTimeout(1050);
  const s1 = await state();
  const moved = s0.y - s1.y;
  check('속도 30으로 1초 → 약 4.5cm 전진(추정치 기준)', moved > 3.5 && moved < 5.5, `${moved.toFixed(2)}cm`);
  check('걷는 동안 몸통 LED 초록', JSON.stringify(s1.led) === '[0,255,0]' || JSON.stringify(s1.led) === '[0,0,255]', JSON.stringify(s1.led));
  await p.waitForTimeout(1500);
  const s2 = await state();
  check('시계방향 90° 회전', Math.abs(s2.h - 90) < 3, `heading=${s2.h.toFixed(1)}`);
  await p.waitForTimeout(8000);
  const s3 = await state();
  check('사각형 4번 → 처음 방향(360°)', Math.abs(s3.h - 360) < 4, `heading=${s3.h.toFixed(1)}`);
  check('사각형 → 거의 제자리로 복귀', Math.hypot(s3.x - s0.x, s3.y - s0.y) < 2, `차이 ${Math.hypot(s3.x - s0.x, s3.y - s0.y).toFixed(2)}cm`);
  await p.screenshot({ path: path.join(OUT, 'sim_2d_square.png') });

  // 3. A = 자세 둘러보기
  await pressMb('A'); await p.waitForTimeout(400);
  check('A → 앉기 자세', (await state()).posture === 1 && (await state()).mode === 4);
  await p.waitForTimeout(6200);
  const sp = await state();
  check('… → 인사 자세 + ILOVEYOU 표정', sp.posture === 4 && sp.expr === 1, `posture=${sp.posture} expr=${sp.expr}`);
  await p.screenshot({ path: path.join(OUT, 'sim_2d_hello.png') });

  // 4. 신호등 안내견: 라디오 3 계속 → 걷기, 끊기면 2초 뒤 정지, A 잠금
  // 03은 "R1" 글자를 흘린 뒤(약 1.4초)에 라디오 받기를 등록함 → 실제 기기처럼 그 전 신호는 무시됨
  await p.click('#btnReset'); await loadExample('03_ai-traffic-dog'); await run(); await p.waitForTimeout(2200);
  const send = (n) => p.click(`#radioBtns button:nth-child(${n + 1})`);
  for (let i = 0; i < 4; i++) { await send(3); await p.waitForTimeout(400); }
  const t1 = await state();
  check('라디오 3(초록) → 출발', t1.vel === 25 && JSON.stringify(t1.led) === '[0,255,0]', `vel=${t1.vel}`);
  await p.waitForTimeout(2600);
  check('신호 2초 끊김 → 자동 정지', (await state()).vel === 0);
  await send(1); await p.waitForTimeout(300);
  check('라디오 1(빨강) → 빨간 몸통', JSON.stringify((await state()).led) === '[255,0,0]');
  await pressMb('A'); await p.waitForTimeout(200);
  for (let i = 0; i < 4; i++) { await send(3); await p.waitForTimeout(300); }
  check('A 잠금 중 초록을 받아도 정지 유지', (await state()).vel === 0);
  await pressMb('B'); await p.waitForTimeout(200);
  for (let i = 0; i < 3; i++) { await send(3); await p.waitForTimeout(300); }
  check('B로 잠금 풀면 다시 출발', (await state()).vel === 25);

  // 5. 거리센서: 앞에 장애물 → 멈춤
  await p.click('#btnStop'); await p.click('#btnReset');
  await S(() => { const w = window.__sim.world; w.obstacles.length = 0; w.obstacles.push({ x: 55, y: 15, w: 10, h: 6 }); });
  await loadExample('02_distance-rule'); await run(); await p.waitForTimeout(300);
  check('02: 켜자마자 걷지 않음', (await state()).vel === 0);
  await pressMb('B'); await p.waitForTimeout(800);
  check('02: B → 걷기 시작', (await state()).vel === 25);
  await p.waitForTimeout(9000);
  const tofNow = await S(() => window.__sim.robot.tof());
  const d5 = await state();
  check('02: 장애물 가까이(기준 20 미만)에서 멈춤', d5.vel === 0 && tofNow < 20, `vel=${d5.vel} tof=${tofNow}`);
  check('02: 멈춤 시 빨간 몸통', JSON.stringify(d5.led) === '[255,0,0]');
  await p.screenshot({ path: path.join(OUT, 'sim_2d_obstacle.png') });

  // 6. 책상에서 떨어짐 감지
  await p.click('#btnStop'); await p.click('#btnReset');
  await S(() => { window.__sim.world.obstacles.length = 0; });
  await p.fill('#code', 'robodog.move(deflib.MoveDirection.Forward, 100)\nbasic.forever(function () {\n    basic.showIcon(IconNames.Happy)\n})');
  await run(); await p.waitForTimeout(4500);
  check('책상 밖으로 나가면 "떨어짐" 감지', (await state()).fallen === true);
  await p.screenshot({ path: path.join(OUT, 'sim_2d_fall.png') });

  // 7. 무한 반복(쉬기 없음)도 화면이 멈추지 않고 정지 가능
  await p.click('#btnReset');
  await p.fill('#code', 'let n = 0\nwhile (true) {\n    n += 1\n}');
  await run(); await p.waitForTimeout(800);
  const alive = await Promise.race([p.evaluate(() => 1), new Promise(r => setTimeout(() => r(0), 2000))]);
  check('쉬기 없는 무한 반복에도 화면 응답', alive === 1);
  await p.click('#btnStop');

  // 8. 지원하지 않는 블록·음악 블록 경고
  await p.fill('#code', 'music.playTone(262, 500)\ngame.createSprite(2, 2)\nbasic.showNumber(12)');
  await run(); await p.waitForTimeout(600);
  const warns = await p.$$eval('#log .warn', els => els.map(e => e.textContent).join(' | '));
  check('음악 블록 경고', warns.includes('음악'));
  check('지원 안 되는 블록 경고(game)', warns.includes('game.createSprite'));
  // 9. 문법 오류 안내
  await p.fill('#code', 'basic.showNumber(');
  await run(); await p.waitForTimeout(300);
  check('문법 오류를 알려 줌', (await errorLogs()).some(t => t.includes('읽을 수 없어요')));

  // 10. 3D 보기
  await p.click('#btnReset'); await loadExample('05_motion-tour'); await run();
  await p.click('#tab3d'); await p.waitForTimeout(2500);
  const has3d = await p.evaluate(() => { const c = document.querySelector('#view3d canvas'); if (!c) return false; return c.width > 100; });
  check('3D 화면 그리기', has3d);
  await pressMb('A'); await p.waitForTimeout(7500);
  await p.screenshot({ path: path.join(OUT, 'sim_3d_hello.png') });
  await p.click('#tab2d');

  // 11. AI 브리지 → 시뮬레이터 연동(BroadcastChannel)
  await p.click('#btnReset'); await loadExample('03_ai-traffic-dog'); await run(); await p.waitForTimeout(2200);
  const bp = await ctx.newPage();
  await bp.goto(BASE + 'ai.html');
  await bp.waitForFunction(() => /완료|실패/.test(document.getElementById('modelStatus').textContent), null, { timeout: 120000 });
  await bp.click('#manual button:nth-child(3)');   // 수동 3
  await bp.waitForTimeout(1500);
  check('AI 브리지 수동 3 → 시뮬레이터 로보독 출발', (await state()).vel === 25);
  await bp.click('#btnStop'); await bp.waitForTimeout(1200);
  check('AI 브리지 ■멈춤 → 시뮬레이터 정지', (await state()).vel === 0);
  await bp.close();

  // 11-2. 공식 다리 각도 표와 일치 (코코아팹 다리 시뮬레이터 표본)
  const jointAfter = async (code) => {
    await p.click('#btnReset'); await p.fill('#code', code); await run(); await p.waitForTimeout(1200);
    return p.evaluate(() => window.__sim.robot.joint.map(j => j.map(Math.round)));
  };
  let j = await jointAfter('robodog.leg(deflib.LegSelection.AllLegs, 100, 0)');          // 내부 (90, 0) → 표본 (0, -90)
  check('다리 높이 100·발끝 0 → 공식 표본 어깨 0°, 무릎 -90°', j.every(a => a[0] === 0 && a[1] === -90), JSON.stringify(j[0]));
  j = await jointAfter('robodog.leg(deflib.LegSelection.FrontLegs, 0, 0)');             // 내부 (20, 0) → 표본 (-90, 70)
  check('앞다리 높이 0·발끝 0 → 공식 표본 어깨 -90°, 무릎 70°', j[0][0] === -90 && j[0][1] === 70 && j[3][0] === -90, JSON.stringify(j));
  j = await jointAfter('robodog.motor(deflib.LegSelection.RightBack, 30, -20)');
  check('모터 블록 → 오른쪽 뒷다리만 어깨 30°, 무릎 -20°', j[2][0] === 30 && j[2][1] === -20 && j[0][0] === 0, JSON.stringify(j));

  // 11-3. 군무 시연 (8대)
  await p.click('#demoCards button[data-id="dance"]');
  await p.waitForTimeout(1000);
  const n8 = await p.evaluate(() => 1 + window.__sim.world.extra.length);
  check('군무: 로보독 8대 배치', n8 === 8, `${n8}대`);
  // 바운스: 모두 같은 보행 높이로 함께 바뀜
  let sameBounce = true, sawLow = false, sawHigh = false;
  for (let i = 0; i < 20; i++) {
    const hs = await p.evaluate(() => [window.__sim.robot, ...window.__sim.world.extra].map(R => R.walkH[0]));
    if (new Set(hs).size !== 1) sameBounce = false;
    if (hs[0] <= 30) sawLow = true; if (hs[0] >= 85) sawHigh = true;
    await p.waitForTimeout(100);
  }
  check('군무 바운스: 8대가 동시에 낮게↔높게', sameBounce && sawLow && sawHigh);
  // 웨이브: 어느 순간 서로 다른 높이(차례로 바뀜)
  let sawWave = false;
  for (let i = 0; i < 60 && !sawWave; i++) {
    const hs = await p.evaluate(() => [window.__sim.robot, ...window.__sim.world.extra].map(R => R.walkH[0]));
    if (new Set(hs).size > 1) sawWave = true;
    await p.waitForTimeout(100);
  }
  check('군무 웨이브: 차례로 바뀌어 높이가 서로 다른 순간이 있음', sawWave);
  // 물구나무: 8대 모두 자세 2
  let allHand = false;
  for (let i = 0; i < 300 && !allHand; i++) {
    allHand = await p.evaluate(() => [window.__sim.robot, ...window.__sim.world.extra].every(R => R.mode === 4 && R.posture === 2));
    await p.waitForTimeout(100);
  }
  check('군무 물구나무: 8대가 동시에', allHand);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(OUT, 'sim_dance_2d.png') });
  await p.click('#btnDemoStop'); await p.waitForTimeout(300);
  check('군무 멈추면 1대로 돌아옴', (await p.evaluate(() => window.__sim.world.extra.length)) === 0);

  // 11-5. MakeCode 편집기 삽입 (실제 makecode.microbit.org, 인터넷 필요)
  await p.click('#btnReset'); await loadExample('05_motion-tour');
  await p.click('#tabEditor');
  let ready = false;
  for (let i = 0; i < 180 && !ready; i++) { ready = (await p.evaluate(() => window.__sim.mcState().mcReady)); if (!ready) await p.waitForTimeout(500); }
  check('MakeCode 편집기가 시뮬레이터 안에서 열림', ready && await p.evaluate(() => document.body.classList.contains('mc-mode')));
  const mc = p.frameLocator('#mcFrame');
  let blocksOk = false;
  for (let i = 0; i < 60 && !blocksOk; i++) { blocksOk = (await mc.locator('.blocklyTreeLabel, .blocklyTreeRow').filter({ hasText: '로보독' }).count()) > 0 && (await mc.locator('.blocklyDraggable').count()) > 5; if (!blocksOk) await p.waitForTimeout(500); }
  check('편집기에 로보독 확장 블록 + 예제 블록이 보임', blocksOk);
  await p.screenshot({ path: path.join(OUT, 'sim_mc_editor.png') });
  // 편집기 안에서 코드 고치기(JavaScript 탭 → 내용 교체) → 시뮬레이터에 반영·실행
  await p.waitForTimeout(6500);   // 불러온 직후 무시 구간 지나기
  await p.evaluate(() => document.getElementById('mcFrame').contentWindow.postMessage({ type: 'pxteditor', action: 'switchjavascript' }, 'https://makecode.microbit.org'));
  await p.waitForTimeout(3000);
  const edited = '// 편집기에서 고침\nrobodog.move(deflib.MoveDirection.Forward, 30)\nbasic.showIcon(IconNames.Heart)\n';
  const mcFrame = p.frames().find(f => f.url().startsWith('https://makecode.microbit.org'));
  await mcFrame.evaluate((c) => window.monaco.editor.getModels()[0].setValue(c), edited);
  let synced = false;
  for (let i = 0; i < 40 && !synced; i++) { synced = (await p.inputValue('#code')).includes('편집기에서 고침'); if (!synced) await p.waitForTimeout(500); }
  check('편집기에서 고친 코드가 시뮬레이터 코드로 들어옴', synced);
  await p.waitForTimeout(2500);
  check('고친 코드가 바로 실행되어 로보독이 걸음(속도 30)', (await state()).vel === 30, `vel=${(await state()).vel}`);
  await p.click('#tabJs');
  check('JavaScript 탭으로 돌아오면 넓은 화면 해제', !(await p.evaluate(() => document.body.classList.contains('mc-mode'))));

  // 12. 좁은 화면
  await p.setViewportSize({ width: 390, height: 900 }); await p.waitForTimeout(400);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  check('390px 폭 가로 스크롤 없음', sw <= 390, `scrollWidth=${sw}`);

  check('페이지 오류 없음', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await b.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - fail}/${results.length} PASS`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e.message); process.exit(2); });
