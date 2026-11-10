// 로보독 시뮬레이터: 장면 소품(상자·색 물체) + AI 카메라 흉내 시험
//   node tests/sim-scene.js [기본주소] [사진폴더]
//   (cd bridge && python3 -m http.server 8765 로 먼저 서버를 켜 두세요)
const { chromium } = require('playwright');
const path = require('path');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const SHOTS = process.argv[3];
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${ok ? '' : detail}`); };

const RED_STOP = `robodog.aiDetection(deflib.AiMode.ColorDetect)
basic.forever(function () {
    if (robodog.getColorDetect() == 1) {
        robodog.stop()
        robodog.bodyLed(255, 0, 0)
    } else {
        robodog.move(deflib.MoveDirection.Forward, 25)
        robodog.bodyLed(0, 255, 0)
    }
    basic.pause(50)
})
`;

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => { if (!/makecode\.(com|microbit\.org)/.test(e.stack || '')) errs.push(e.message); });
  p.on('console', m => { if (m.type() === 'error' && !/makecode|ERR_FAILED|Failed to load resource/.test(m.text() + JSON.stringify(m.location()))) errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false}' }));
  await p.goto(BASE + 'sim/?tab=js&demo=0');
  await p.waitForFunction(() => window.__sim && window.Babel, null, { timeout: 30000 });
  const S = (fn, arg) => p.evaluate(fn, arg);
  await S(() => window.__sim.showTab(false));
  await S(() => { window.__sim.stopDemo(); document.getElementById('aiSet').open = true; });

  // ---- 화면 좌표 ↔ 월드 끌기 ----
  const drag = async (from, to) => {
    const a = await S(([x, y]) => window.__sim.view2d.toScreen(x, y), [from.x, from.y]);
    const c = await S(([x, y]) => window.__sim.view2d.toScreen(x, y), [to.x, to.y]);
    await p.mouse.move(a.x, a.y); await p.mouse.down();
    await p.mouse.move((a.x + c.x) / 2, (a.y + c.y) / 2, { steps: 4 }); await p.mouse.move(c.x, c.y, { steps: 4 }); await p.mouse.up();
  };
  const R = () => S(() => { const r = window.__sim.robot; return { x: r.x, y: r.y, h: r.heading }; });
  const objs = () => S(() => window.__sim.world.props.objects.map(o => ({ x: +o.x.toFixed(1), y: +o.y.toFixed(1), c: o.color })));
  const cls = () => S(() => window.__sim.runner.buildEnv().robodog.getColorDetect());
  const env = (expr) => S(`(() => { const rd = window.__sim.runner.buildEnv().robodog; return ${expr}; })()`);

  // ===== 1. 색 인식 값 =====
  await S(() => { const w = window.__sim.world; window.__sim.PROPS.assignProps(w.props, window.__sim.PROPS.emptyProps()); window.__sim.robot.reset(); });
  const r0 = await R();
  await S(([x, y]) => window.__sim.world.props.objects.push({ x, y, r: 4.5, color: 'red' }), [r0.x, r0.y - 40]);
  check('색 인식 모드 켜기 전에는 0 (빨강 물체가 앞에 있어도)', (await cls()) === 0);
  await S(() => { window.__sim.robot.aiMode = 3; });
  check('aiDetection(색 인식) 뒤 빨강 물체가 시야 안 → 클래스 1', (await cls()) === 1, String(await cls()));
  check('위치 X: 정면 → 0', (await env('rd.aiDetection(3), rd.getAiPosition(0)')) === 0);
  await S(([x, y]) => { const o = window.__sim.world.props.objects[0]; o.x = x + 14; o.y = y - 40; }, [r0.x, r0.y]);
  const px = await env('rd.getAiPosition(0)');
  check('위치 X: 오른쪽 물체는 양수(−100~100)', px > 0 && px <= 100, String(px));
  await S(([x, y]) => { const o = window.__sim.world.props.objects[0]; o.x = x + 60; o.y = y; }, [r0.x, r0.y]);
  check('시야 밖(옆 90°) → 0', (await cls()) === 0);
  await S(([x, y]) => { const o = window.__sim.world.props.objects[0]; o.x = x; o.y = y - 130; }, [r0.x, r0.y]);
  check('시야 안이어도 100cm보다 멀면 → 0', (await cls()) === 0);
  await S(([x, y]) => { const o = window.__sim.world.props.objects[0]; o.x = x; o.y = y - 40; }, [r0.x, r0.y]);
  await S(([x, y]) => window.__sim.world.props.boxes.push({ x: x - 10, y: y - 25, w: 20, h: 4 }), [r0.x, r0.y]);
  check('상자가 가로막으면 물체가 안 보여 → 0', (await cls()) === 0);
  await S(() => { window.__sim.world.props.boxes.length = 0; });

  // ===== 2. 끌어서 옮기면 값이 따라 바뀜 =====
  await S(() => window.__sim.editor.setTool('select'));
  await drag({ x: r0.x, y: r0.y - 40 }, { x: r0.x + 60, y: r0.y });
  const o1 = (await objs())[0];
  check('끌기: 빨강 물체가 옆으로 옮겨짐', Math.abs(o1.x - (r0.x + 60)) < 3, JSON.stringify(o1));
  check('끌어서 시야 밖 → 0', (await cls()) === 0);
  await drag({ x: o1.x, y: o1.y }, { x: r0.x, y: r0.y - 40 });
  check('다시 끌어 앞으로 → 1', (await cls()) === 1, String(await cls()));
  // 색 → 번호 설정
  await p.selectOption('#aiCls-red', '5');
  check('설정에서 빨강의 번호를 5로 → 5', (await cls()) === 5, String(await cls()));
  await p.selectOption('#aiCls-red', '0');
  check('빨강을 "인식 안 함"으로 → 0', (await cls()) === 0);
  await p.click('#aiMapReset');
  check('기본값 되돌리기 → 1', (await cls()) === 1);
  await S(() => { window.__sim.world.props.objects[0].color = 'yellow'; });
  check('노랑 물체 → 기본 번호 2', (await cls()) === 2);
  await S(() => { window.__sim.world.props.objects[0].color = 'green'; });
  check('초록 물체 → 3', (await cls()) === 3);
  await S(() => { window.__sim.world.props.objects[0].color = 'white'; });
  check('흰색 물체는 번호가 없어 → 0', (await cls()) === 0);

  // 거리센서가 끌어 옮긴 상자를 따라감
  await S(() => { const w = window.__sim.world; w.props.objects.length = 0; w.props.boxes.length = 0; window.__sim.robot.aiMode = 0; });
  await S(([x, y]) => window.__sim.world.props.boxes.push({ x: x - 6, y: y - 46, w: 12, h: 12 }), [r0.x, r0.y]);   // 중심 y-40
  const t0 = await S(() => window.__sim.robot.tof());
  await drag({ x: r0.x, y: r0.y - 40 }, { x: r0.x, y: r0.y - 70 });
  const t1 = await S(() => window.__sim.robot.tof());
  console.log('DBG', JSON.stringify(await S(([x, y]) => ({ sy: scrollY, ih: innerHeight, sc: window.__sim.view2d.toScreen(x, y - 40), r: window.__sim.robot.y, hit: window.__sim.PROPS.hitTest(window.__sim.world.props, x, y - 40, 4, { items: true }) }), [r0.x, r0.y])));
  check('거리센서: 상자를 30cm 더 멀리 끌면 값이 그만큼 커짐', t1 - t0 >= 25 && t1 - t0 <= 35, `${t0} → ${t1}`);
  await drag({ x: r0.x, y: r0.y - 70 }, { x: r0.x + 50, y: r0.y - 70 });
  check('상자를 옆으로 치우면 거리 없음(255)', (await S(() => window.__sim.robot.tof())) === 255);

  // ===== 3. 색 보이면 멈춰(코드) + 실행 때 자동 배치 =====
  await S(() => { const w = window.__sim.world; w.props.objects.length = 0; w.props.boxes.length = 0; });
  await p.fill('#code', RED_STOP);
  await p.click('#btnRun'); await p.waitForTimeout(900);
  const a1 = await objs();
  check('실행 → 빨간 물체가 자동으로 생김(1개)', a1.length === 1 && a1[0].c === 'red', JSON.stringify(a1));
  const log1 = await p.textContent('#log');
  check('안내: "빨간 … 앞 …cm … 끌어서 옮길 수 있어요"', /빨간.*앞 \d+cm.*끌어서 옮길 수 있어요/.test(log1), log1.slice(0, 160));
  let st = await S(() => ({ vel: window.__sim.robot.vel, led: window.__sim.robot.bodyLed.join(), tof: window.__sim.robot.tof() }));
  check('빨강이 보이면 멈춤·빨강 불', st.vel === 0 && st.led === '255,0,0', JSON.stringify(st));
  if (SHOTS) await p.locator('#pane2d').screenshot({ path: path.join(SHOTS, 'scene-2d.png') });
  // 끌어서 시야 밖으로 → 걷기
  const rr = await R();
  await drag({ x: a1[0].x, y: a1[0].y }, { x: rr.x + 70, y: rr.y });
  await p.waitForTimeout(500);
  st = await S(() => ({ vel: window.__sim.robot.vel, led: window.__sim.robot.bodyLed.join(), run: window.__sim.runner.running }));
  check('실행 중에 끌어 치우면 → 걷기(초록 불), 실행은 계속', st.vel === 25 && st.led === '0,255,0' && st.run, JSON.stringify(st));
  await S(() => window.__sim.robot.reset());   // 다시 앞을 보게
  await drag({ x: rr.x + 70, y: rr.y }, { x: rr.x, y: rr.y - 40 });
  await p.waitForTimeout(500);
  st = await S(() => ({ vel: window.__sim.robot.vel, led: window.__sim.robot.bodyLed.join() }));
  check('실행 중에 앞으로 끌어 놓으면 → 멈춤', st.vel === 0 && st.led === '255,0,0', JSON.stringify(st));
  // 다시 실행해도 물체를 더 만들지 않고 옮긴 자리를 지킴
  await drag({ x: rr.x, y: rr.y - 40 }, { x: rr.x + 20, y: rr.y - 50 });
  const moved = (await objs())[0];
  await p.click('#btnRun'); await p.waitForTimeout(500);
  const a2 = await objs();
  check('다시 실행해도 빨간 물체는 1개, 옮긴 자리 그대로', a2.length === 1 && Math.abs(a2[0].x - moved.x) < 0.2 && Math.abs(a2[0].y - moved.y) < 0.2, JSON.stringify([moved, a2]));
  // 지웠다가 다시 실행하면 없는 것만 다시 채움
  await S(() => { window.__sim.world.props.objects.length = 0; });
  await p.click('#btnRun'); await p.waitForTimeout(500);
  check('지운 뒤 실행하면 없는 물체만 다시 놓음', (await objs()).length === 1);

  // 색 번호를 바꾸면 그 번호에 맞는 색을 요구
  await S(() => { const w = window.__sim.world; w.props.objects.length = 0; });
  await p.selectOption('#aiCls-red', '0'); await p.selectOption('#aiCls-blue', '1');
  await p.click('#btnRun'); await p.waitForTimeout(500);
  const a3 = await objs();
  check('번호 1을 파랑으로 바꾸면 실행 때 파란 물체를 놓음', a3.length === 1 && a3[0].c === 'blue', JSON.stringify(a3));
  await p.click('#aiMapReset');

  // ===== 4. AI 신호등(라디오) + 카메라 흉내 =====
  await S(() => { const w = window.__sim.world; w.props.objects.length = 0; w.props.boxes.length = 0; window.__sim.runner.stop(); });
  const code03 = await S(async () => (await import('./examples.js')).EXAMPLES.find(e => e.id === '03_ai-traffic-dog').code);
  await p.fill('#code', code03);
  await p.click('#btnRun'); await p.waitForTimeout(2300);
  check('AI 신호 코드 → 카메라 흉내가 기본으로 켜짐', await p.isChecked('#camEmu'));
  const c3 = await objs();
  check('AI 신호 코드 실행 → 빨강·초록 카드가 자동으로 놓임', c3.length === 2 && c3.some(o => o.c === 'red') && c3.some(o => o.c === 'green'), JSON.stringify(c3));
  const log3 = await p.textContent('#log');
  check('안내: 카드를 놓았어요', /빨간 카드를 앞 \d+cm/.test(log3) && /초록 카드/.test(log3), log3.slice(0, 200));
  const rs = async () => S(() => ({ vel: window.__sim.robot.vel, led: window.__sim.robot.bodyLed.join(), last: window.__sim.camEmuState().last.n }));
  let s3 = await rs();
  check('빨간 카드가 앞에 있으면 → 라디오 1 → 멈춤·빨강', s3.last === 1 && s3.vel === 0 && s3.led === '255,0,0', JSON.stringify(s3));
  const red = c3.find(o => o.c === 'red'), green = c3.find(o => o.c === 'green'), r3 = await R();
  // 빨강을 치우면 배경(4)
  await drag({ x: red.x, y: red.y }, { x: r3.x - 70, y: r3.y });
  await p.waitForTimeout(900);
  s3 = await rs();
  check('카드가 시야에서 사라지면 → 배경 4 → 멈춤·불 꺼짐', s3.last === 4 && s3.vel === 0 && s3.led === '0,0,0', JSON.stringify(s3));
  // 초록을 앞으로 끌어 옴
  await drag({ x: green.x, y: green.y }, { x: r3.x, y: r3.y - 45 });
  await p.waitForTimeout(1200);
  s3 = await rs();
  check('초록 카드를 앞으로 끌어 오면 → 라디오 3 → 걷기·초록', s3.last === 3 && s3.vel === 25 && s3.led === '0,255,0', JSON.stringify(s3));
  await p.waitForTimeout(2600);   // 2초 넘게 지나도(신호를 0.5초마다 이어 보내므로) 계속 걸음
  s3 = await rs();
  check('신호를 이어 보내므로 2초 안전장치에 안 걸림', s3.last === 3 && s3.led === '0,255,0', JSON.stringify(s3));
  // 직접 누른 라디오 버튼이 우선
  await S(() => window.__sim.robot.reset());
  await p.click('#radioBtns button:nth-child(2)'); await p.waitForTimeout(500);
  s3 = await rs();
  check('수동 라디오 1 버튼도 그대로 동작(카메라 흉내가 4초 양보)', s3.led === '255,0,0' && s3.vel === 0, JSON.stringify(s3));
  // 끄면 숫자를 안 보냄
  await p.uncheck('#camEmu');
  const n0 = await S(() => window.__sim.camEmuState().last.t);
  await p.waitForTimeout(1200);
  check('흉내를 끄면 더 보내지 않음', (await S(() => window.__sim.camEmuState().last.t)) === n0);
  const radioTxt = await p.textContent('#pRadio');
  check('설명 글에 "시뮬레이터 전용 흉내 · 노트북 웹캠 + AI 브리지"', /시뮬레이터 전용 흉내/.test(radioTxt) && /웹캠 \+ AI 브리지/.test(radioTxt));
  // 리모컨 예제는 기본으로 꺼짐
  const code21 = await S(async () => (await import('./examples.js')).EXAMPLES.find(e => e.id === '21_remote-dog').code);
  await p.fill('#code', code21); await p.click('#btnRun'); await p.waitForTimeout(500);
  check('리모컨 예제(AI 카드 아님)는 카메라 흉내가 꺼져 있고 카드를 더 놓지 않음', !(await p.isChecked('#camEmu')) && (await objs()).length === 2);
  await p.click('#btnStop');

  // ===== 5. 환경: 책상/바닥, 공간 크기, 지도 =====
  await S(() => { const w = window.__sim.world; w.props.objects.length = 0; w.props.boxes.length = 0; window.__sim.robot.reset(); });
  await p.click('#btnFloor');
  const wallTof = await S(() => window.__sim.robot.tof());
  check('바닥(벽) 모드: 상자 없이도 벽까지 거리가 나옴', wallTof > 60 && wallTof < 90, String(wallTof));
  await p.click('#btnTable');
  check('책상 모드: 아무것도 없으면 255', (await S(() => window.__sim.robot.tof())) === 255);
  const code02 = await S(async () => (await import('./examples.js')).EXAMPLES.find(e => e.id === '02_distance-rule').code);
  await p.fill('#code', code02); await p.click('#btnRun'); await p.waitForTimeout(500);
  const bx = await S(() => window.__sim.world.props.boxes.length);
  check('거리센서 코드 실행 → 앞에 상자 1개', bx === 1, String(bx));
  await p.selectOption('#spaceSize', '120x80'); await p.waitForTimeout(200);
  const sz = await S(() => ({ w: window.__sim.world.table.w, h: window.__sim.world.table.h, boxes: window.__sim.world.props.boxes.length }));
  check('공간 크기 120×80으로 바꾸면 크기가 바뀌고 상자는 다시 1개', sz.w === 120 && sz.h === 80 && sz.boxes === 1, JSON.stringify(sz));
  await p.selectOption('#spaceSize', '200x140');
  const lab = await p.$$eval('#map-pick option', os => os.map(o => o.textContent));
  check('지도 목록의 선 지도는 "포니봇용(라인 센서)"로 표시', lab.filter(t => /포니봇용\(라인 센서\)/.test(t)).length >= 5, lab.join('|').slice(0, 200));
  check('타일 편집 칸은 숨김(로보독에는 선 센서가 없음)', (await p.$$('#tile-det')).length === 0);
  await S(() => window.__sim.mapLib.loadBuiltin('l1-oval'));
  const sz2 = await S(() => ({ w: window.__sim.world.table.w, h: window.__sim.world.table.h, sel: document.getElementById('spaceSize').value, rx: window.__sim.robot.x, sx: window.__sim.world.start.x }));
  check('지도를 고르면 월드 크기·시작 자리가 바뀜(240×160)', sz2.w === 240 && sz2.h === 160 && sz2.sel === 'map' && Math.abs(sz2.rx - sz2.sx) < 0.01, JSON.stringify(sz2));
  await p.selectOption('#spaceSize', '200x140');
  check('공간 크기를 다시 고르면 지도 항목은 사라짐', (await p.$$('#spaceSize option[value="map"]')).length === 0);

  // 편집기 도구: 색 물체 놓기 → 상자 놓기 → 지우기
  await S(() => { const w = window.__sim.world; window.__sim.PROPS.assignProps(w.props, window.__sim.PROPS.emptyProps()); window.__sim.robot.reset(); });
  const rb = await R();
  await p.click('.pe-bar [data-tool="object"]'); await p.click('.pe-bar [data-color="green"]');
  const sc = await S(([x, y]) => window.__sim.view2d.toScreen(x, y), [rb.x + 30, rb.y - 40]);
  await p.mouse.click(sc.x, sc.y);
  const ob = await objs();
  check('색 물체 도구 + 초록: 클릭한 자리에 초록 물체', ob.length === 1 && ob[0].c === 'green' && Math.abs(ob[0].x - (rb.x + 30)) < 2, JSON.stringify(ob));
  await p.click('.pe-bar [data-tool="box"]');
  const sb = await S(([x, y]) => window.__sim.view2d.toScreen(x, y), [rb.x - 40, rb.y - 40]);
  await p.mouse.click(sb.x, sb.y);
  check('상자 도구: 상자가 놓임', (await S(() => window.__sim.world.props.boxes.length)) === 1);
  await p.click('.pe-bar [data-tool="select"]');
  await p.mouse.click(sb.x, sb.y); await p.keyboard.press('Delete');
  check('선택 후 Delete 로 지움', (await S(() => window.__sim.world.props.boxes.length)) === 0);
  check('"선 편집" 도구는 화면에서 숨김', !(await p.isVisible('.pe-bar [data-tool="track"]')));

  // ===== 6. 3D =====
  await S(() => { const w = window.__sim.world, P = window.__sim.PROPS; P.assignProps(w.props, P.emptyProps());
    w.props.boxes.push({ x: 60, y: 40, w: 14, h: 10 }); w.props.objects.push({ x: 100, y: 45, r: 4.5, color: 'red' }, { x: 130, y: 60, r: 4.5, color: 'green' });
    w.props.chips.push({ x: 150, y: 100, w: 8, h: 8, color: 'blue' }); window.__sim.robot.reset(); });
  await S(() => window.__sim.showTab(true));
  await p.waitForFunction(() => window.__sim.view3d() && window.__sim.view3d().ready, null, { timeout: 30000 });
  await p.waitForTimeout(800);
  const g3 = await S(() => { const v = window.__sim.view3d(); return { n: v.obsGroup.children.length, cols: v.obsGroup.children.map(m => m.material.color.getHexString()) }; });
  check('3D: 상자 1 + 물체 2(원기둥+윗면) + 칩 1 = 6개 모형', g3.n === 6, JSON.stringify(g3));
  check('3D: 빨강·초록 물체 색이 2D와 같음', g3.cols.includes('d72d2d') && g3.cols.includes('32a550'), JSON.stringify(g3.cols));
  await S(() => { window.__sim.world.props.objects[0].x += 10; });
  await p.waitForTimeout(300);
  const mv = await S(() => window.__sim.view3d().obsGroup.children.some(m => Math.abs(m.position.x - 110) < 0.01));
  check('3D: 물체를 옮기면 모형도 따라 옮겨짐', mv);
  await S(() => { window.__sim.robot.aiMode = 3; });
  await p.waitForTimeout(300);
  check('3D: 색 인식 모드면 카메라 시야 부채꼴이 보임', await S(() => window.__sim.view3d().camFan.visible));
  if (SHOTS) await p.locator('#pane3d').screenshot({ path: path.join(SHOTS, 'scene-3d.png') });
  await S(() => { window.__sim.robot.aiMode = 0; window.__sim.showTab(false); });
  await p.waitForTimeout(500);
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'scene-desktop.png') });

  // ===== 7. 휴대폰 폭 =====
  const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const m = await mctx.newPage();
  m.on('pageerror', e => { if (!/makecode/.test(e.stack || '')) errs.push('(390) ' + e.message); });
  await m.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false}' }));
  await m.goto(BASE + 'sim/?tab=js&demo=0&view=2d');
  await m.waitForFunction(() => window.__sim && window.Babel, null, { timeout: 30000 });
  await m.evaluate((code) => { document.getElementById('code').value = code; document.getElementById('btnRun').click(); }, code03);
  await m.waitForTimeout(1500);
  const ov = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, cv: document.getElementById('top2d').getBoundingClientRect().width, bar: document.getElementById('peBar').getBoundingClientRect().right }));
  check('390px: 가로 스크롤 없음', ov.sw <= ov.iw, JSON.stringify(ov));
  check('390px: 편집 도구·2D 화면이 화면 안', ov.cv <= ov.iw && ov.bar <= ov.iw + 1, JSON.stringify(ov));
  await m.evaluate(() => document.getElementById('top2d').scrollIntoView());
  if (SHOTS) await m.screenshot({ path: path.join(SHOTS, 'scene-390.png') });
  await m.evaluate(() => window.__sim.showTab(true));
  await m.waitForFunction(() => window.__sim.view3d() && window.__sim.view3d().ready, null, { timeout: 30000 }).catch(() => {});
  await m.waitForTimeout(500);
  const ov3 = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  check('390px 3D 보기: 가로 스크롤 없음', ov3.sw <= ov3.iw, JSON.stringify(ov3));
  await mctx.close();

  check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close();
  const fail = results.filter(x => !x).length;
  console.log(`\n${results.length - fail}/${results.length} 통과${fail ? `, ${fail} 실패` : ''}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
