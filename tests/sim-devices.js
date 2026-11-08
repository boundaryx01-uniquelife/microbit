// 코드에 맞는 장치·기물이 시뮬레이터에 함께 나타나는지: node tests/sim-devices.js [기본주소] [사진폴더]
const { chromium } = require('playwright');
const path = require('path');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const SHOTS = process.argv[3];
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${ok ? '' : detail}`); };

(async () => {
  // 1) 코드 분석(브라우저 없이)
  const { detectDevices } = await import(path.resolve(__dirname, '../bridge/sim/devices.js'));
  const { EXAMPLES } = await import(path.resolve(__dirname, '../bridge/sim/examples.js'));
  const ex = (id) => EXAMPLES.find(e => e.id === id).code;
  const d02 = detectDevices(ex('02_distance-rule')), d03 = detectDevices(ex('03_ai-traffic-dog')), d00 = detectDevices(ex('00_check-robodog'));
  check('예제 2 → 거리센서·본체 버튼', d02.includes('tof') && d02.includes('button'), d02.join());
  check('예제 3 → AI 신호 카드(라디오)·본체 버튼', d03.includes('radio') && d03.includes('button'), d03.join());
  check('예제 0 → 배터리·본체 버튼', d00.includes('battery') && d00.includes('button'), d00.join());
  check('주석 속 블록 이름은 무시', detectDevices('// robodog.getTof() 를 쓰면\nrobodog.gesture(deflib.Posture.Ready)').length === 0);
  check('A·B 버튼 코드 → 주의 표시 대상', detectDevices('input.onButtonPressed(Button.A, function () {})').includes('mbBtn'));

  // 2) 화면
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => { if (!/makecode\.(com|microbit\.org)/.test(e.stack || '')) errs.push(e.message); });
  await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false}' }));
  await p.goto(BASE + 'sim/'); await p.waitForFunction(() => window.__sim && window.__sim.view3d() && window.__sim.view3d().ready, null, { timeout: 30000 });
  await p.evaluate(() => { const w = window.__sim.world; w.obstacles.length = 0; });
  const run = async (id) => {
    await p.evaluate(async (code) => { document.getElementById('code').value = code; document.getElementById('btnRun').click(); }, ex(id));
    await p.waitForTimeout(800);
  };
  await run('02_distance-rule');
  const s2 = await p.evaluate(() => { const v = window.__sim.view3d(); return { obs: window.__sim.world.obstacles.length, beam: v.beam.visible, card: v.card.sp.visible, btn: v.btnTag.sp.visible, needs: document.getElementById('needs').textContent, msg: document.getElementById('runMsg').textContent, env: document.getElementById('pEnv').classList.contains('need-on') }; });
  check('거리 코드 실행 → 앞에 장애물 자동 배치', s2.obs === 1, JSON.stringify(s2));
  check('3D에 거리센서 선·값 표시', s2.beam);
  check('3D에 본체 버튼 표시, 카드는 없음', s2.btn && !s2.card);
  check('"이 코드에 필요한 장치"에 거리센서·본체 버튼', s2.needs.includes('거리센서') && s2.needs.includes('본체 버튼'), s2.needs);
  check('실행 안내가 코드에 맞춤(A·B 아님)', s2.msg.includes('본체 버튼') && !s2.msg.includes('A·B'), s2.msg);
  check('관련 패널 강조', s2.env);
  const tofTxt = await p.evaluate(() => window.__sim.view3d().tofTag.key);
  check('거리 값이 장애물까지 거리(255 아님)', Number(tofTxt) > 0 && Number(tofTxt) < 255, tofTxt);
  if (SHOTS) await p.locator('#pane3d').screenshot({ path: SHOTS + '/dev-tof.png' });
  await p.click('#btnRobot');
  check('본체 버튼 누름 → 3D 표시 바뀜', await p.evaluate(() => new Promise(r => setTimeout(() => r(window.__sim.view3d().btnTag.key === 'on'), 60))));

  await p.evaluate(() => { window.__sim.world.obstacles.length = 0; });
  await run('03_ai-traffic-dog');
  const s3 = await p.evaluate(() => { const v = window.__sim.view3d(); return { obs: window.__sim.world.obstacles.length, beam: v.beam.visible, card: v.card.sp.visible, key: v.card.key }; });
  check('라디오 코드 → AI 신호 카드 보임, 장애물·거리선 없음', s3.card && !s3.beam && s3.obs === 0, JSON.stringify(s3));
  await p.click('#radioBtns button:nth-child(4)');   // 3 = 초록
  await p.waitForTimeout(150);
  check('숫자 3 보내면 카드가 3(초록)', (await p.evaluate(() => window.__sim.view3d().card.key)).startsWith('3'));
  if (SHOTS) await p.locator('#pane3d').screenshot({ path: SHOTS + '/dev-radio.png' });
  if (SHOTS) await p.locator('#needs').screenshot({ path: SHOTS + '/dev-needs.png' });

  await p.evaluate(() => { window.__sim.playDemo(2); });
  await p.waitForTimeout(1500);
  check('시연(규칙)에서도 장애물 1개만', await p.evaluate(() => window.__sim.world.obstacles.length === 1));
  await p.evaluate(() => window.__sim.stopDemo());
  check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close();
  const fail = results.filter(x => !x).length;
  console.log(`\n${results.length - fail}/${results.length} 통과${fail ? `, ${fail} 실패` : ''}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
