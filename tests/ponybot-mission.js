// 포니봇 미션(행동 판정)·새 슬라이드 장(이야기·퀴즈·미션) 시험
//  - 미션은 코드 글자가 아니라 시뮬레이터 로봇이 한 일로 통과를 판정: 처음 코드는 통과 못 함, 고친 코드는 통과
//  - 통과 기록이 수업 슬라이드의 미션 장에 '✓ 통과'로 보임, [슬라이드로] 돌아가기
// 실행: node tests/ponybot-mission.js [기본주소]  (기본 http://127.0.0.1:8765/ — bridge/ 를 서버로 띄워 둘 것)
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); };
const LESSON = 'ponybot_4차시';
const fwd = (ms) => `input.onButtonPressed(Button.A, function () {\n aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 80)\n basic.pause(${ms})\n aiPonybot.stopAllMotors()\n})`;
const RULE = (cond, th = 20) => `let 가까움기준 = ${th}\nlet 속도 = 200\nlet 달리는중 = false\ninput.onButtonPressed(Button.A, function () {\n 달리는중 = true\n})\nbasic.forever(function () {\n let 거리 = aiPonybot.ping(aiPonybot.PingUnit.Centimeters)\n if (${cond}) {\n  aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 속도)\n } else {\n  aiPonybot.stopAllMotors()\n }\n basic.pause(100)\n})`;
const RADIO = (body, extra = '') => `let 마지막수신 = 0\nradio.onReceivedNumber(function (n) {\n 마지막수신 = input.runningTime()\n${body}\n})\n${extra}`;
const WATCH = (ms) => `basic.forever(function () {\n if (input.runningTime() - 마지막수신 > ${ms}) {\n  aiPonybot.stopAllMotors()\n }\n basic.pause(100)\n})`;
const MOVE = (dir) => `  aiPonybot.runMecanum(aiPonybot.Mecanum.${dir}, 80)\n  basic.pause(1500)\n  aiPonybot.stopAllMotors()`;
// act: 'A' = A 버튼, 숫자(0~9) = 라디오 숫자, 100 넘는 숫자 = 기다리기(ms). w = [처음 코드, 틀린 코드, 고친 코드] 뒤 기다릴 시간
// wrong: 블록은 그럴듯하지만 로봇 행동이 목표와 다른 코드(통과하면 안 됨). null 이면 생략
const SPEC = {
  'p1-go-stop': { act: ['A'], w: [3800, 3200, 3800], sol: fwd(2000), wrong: fwd(300) },   // 멈추긴 하지만 15cm 를 못 감
  'p1-crab': { act: ['A'], w: [3800, 3200, 3800], sol: fwd(2000).replace('Forward', 'Right'), wrong: 'input.onButtonPressed(Button.A, function () {\n aiPonybot.runNormal(aiPonybot.DirectionControl.Clockwise, 80)\n basic.pause(2000)\n aiPonybot.stopAllMotors()\n})' },   // 제자리 돌기
  'p1-square': { act: ['A'], w: [5500, 7500, 9500], sol: 'input.onButtonPressed(Button.A, function () {\n' + ['Forward', 'Right', 'Backward', 'Left'].map((d) => ` aiPonybot.runMecanum(aiPonybot.Mecanum.${d}, 80)\n basic.pause(2000)`).join('\n') + '\n aiPonybot.stopAllMotors()\n})',
    wrong: 'input.onButtonPressed(Button.A, function () {\n aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 80)\n basic.pause(4000)\n aiPonybot.runMecanum(aiPonybot.Mecanum.Backward, 80)\n basic.pause(2000)\n aiPonybot.stopAllMotors()\n})' },   // 50cm 넘게 가지만 제자리로 못 옴
  'p2-wall': { act: ['A'], w: [10500, 8500, 10500], sol: RULE('달리는중 && 거리 >= 가까움기준'), wrong: 'input.onButtonPressed(Button.A, function () {\n aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 200)\n basic.pause(5000)\n aiPonybot.stopAllMotors()\n})' },   // 시간으로 멈춤 → 책에서 너무 멂
  'p2-far': { act: ['A'], w: [10500, 9500, 10000], sol: RULE('달리는중 && 거리 >= 가까움기준', 40), wrong: RULE('달리는중 && 거리 >= 가까움기준', 70) },   // 기준이 너무 큼
  'p2-empty': { act: ['A'], w: [4000, 0, 4200], sol: RULE('달리는중 && 거리 >= 가까움기준 && 거리 < 500'), wrong: null },
  'p3-signal': { act: [3, 1500, 1], w: [2500, 2500, 2500], sol: RADIO(' if (n == 3) {\n  aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 80)\n } else if (n == 1) {\n  aiPonybot.stopAllMotors()\n }'), wrong: RADIO(' if (n == 3) {\n  aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 80)\n } else if (n == 1) {\n  aiPonybot.runMecanum(aiPonybot.Mecanum.Backward, 80)\n }') },   // 1에 멈추지 않고 뒤로
  'p3-lost': { act: [3], w: [4500, 4500, 4500], sol: RADIO(' if (n == 3) {\n  aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 80)\n }', WATCH(2000)), wrong: RADIO(' if (n == 3) {\n  aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 80)\n }', WATCH(20000)) },   // 감시 시간이 너무 김
  'p4-team': { act: [1, 3000, 2], w: [3000, 3200, 3200], sol: RADIO(` if (n == 1) {\n${MOVE('Left')}\n } else if (n == 2) {\n${MOVE('Right')}\n }`), wrong: RADIO(` if (n == 1) {\n${MOVE('Left')}\n } else if (n == 2) {\n${MOVE('Left')}\n }`) },   // 두 번호가 같은 방향
};

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const data = await (await p.request.get(BASE + 'lessons/data/' + encodeURIComponent(LESSON) + '.json')).json();
  const idx = (pred) => data.slides.findIndex(pred) + 1;
  let ACT = ['A'];
  const run = async (code, ms) => {
    await p.click('#btnStop'); if (code) await p.evaluate((c) => { document.getElementById('code').value = c; }, code);
    await p.click('#btnRun'); await p.waitForFunction(() => window.__pony.runner.running, null, { timeout: 15000 }); await p.waitForTimeout(500);
    for (const a of ACT) { if (a === 'A') await p.click('.mbbtn[data-btn="A"]'); else if (a > 100) await p.waitForTimeout(a); else await p.click(`#radioBtns button:nth-child(${a + 1})`); }
    await p.waitForTimeout(ms);
    return p.evaluate(() => ({ passed: window.__mission.passed, ok: [...document.querySelectorAll('#mChecks li')].map((li) => li.classList.contains('ok') ? 1 : 0).join('') }));
  };
  const ids = [...(await (await p.request.get(BASE + 'sim/kits/ponybot/missions.js')).text()).matchAll(/^\s*id: '([\w-]+)'/gm)].map((x) => x[1]);
  check('미션 정의 9개가 시험 목록과 같음(빠진 미션 없음)', !!ids && ids.join() === Object.keys(SPEC).join(), String(ids));
  for (const id of Object.keys(SPEC)) {
    const T = SPEC[id]; ACT = T.act;
    const n = idx((s) => s.mission === id), back = `../lessons/?l=${encodeURIComponent(LESSON)}#${n}`;
    check(`${id}: 수업 슬라이드에 미션 장이 있음`, n > 0, `${n}번`);
    await p.goto(`${BASE}sim/?kit=ponybot&tab=js&mission=${id}&back=${encodeURIComponent(back)}`);
    await p.waitForFunction(() => window.__mission && window.__pony, null, { timeout: 60000 }); await p.waitForTimeout(600);
    await p.evaluate((id) => { localStorage.removeItem('pai:mission:' + id); localStorage.removeItem('pai:mission-code:' + id); }, id);
    await p.reload(); await p.waitForFunction(() => window.__mission && window.__pony, null, { timeout: 60000 }); await p.waitForTimeout(600);
    const ui = await p.evaluate(() => ({ box: !!document.getElementById('missionBox'), assist: getComputedStyle(document.getElementById('assist')).display, code: document.getElementById('code').value.length, choices: document.querySelectorAll('input[name=mpredict]').length, back: (document.querySelector('.m-back') || {}).getAttribute && document.querySelector('.m-back').getAttribute('href') }));
    check(`${id}: 미션 칸(목표·예상 3개·확인)·처음 코드가 뜨고, 말로 만들기 칸은 숨김`, ui.box && ui.assist === 'none' && ui.code > 80 && ui.choices === 3 && ui.back === back, JSON.stringify(ui));
    const s0 = await run(null, T.w[0]);
    check(`${id}: 처음 코드 그대로는 통과하지 못함`, !s0.passed, JSON.stringify(s0));
    if (id === 'p1-go-stop') {   // 예상은 로봇이 움직인 뒤에 알려 줌
      await p.click('#btnStop'); await p.click('input[name=mpredict][value="0"]');
      const before = await p.textContent('#mPredictMsg');
      await p.click('#btnRun'); await p.waitForTimeout(600); await p.click('.mbbtn[data-btn="A"]'); await p.waitForTimeout(1500);
      const after = await p.textContent('#mPredictMsg');
      check('예상 결과는 실행해서 로봇이 움직인 뒤에 알려 줌(틀린 예상 → 실제와 이유)', !/예상과 달랐/.test(before) && /예상과 달랐어요/.test(after) && /멈추라는 블록이 없/.test(after), after.slice(0, 60));
      await p.click('#mHint'); await p.click('#mHint');
      check('도움말은 한 단계씩 열림(2/3)', (await p.locator('#mHints li').count()) === 2 && /2\/3/.test(await p.textContent('#mHint')));
    }
    if (T.wrong) { const sw = await run(T.wrong, T.w[1]);
      check(`${id}: 블록은 그럴듯하지만 행동이 목표와 다른 코드는 통과하지 못함`, !sw.passed, JSON.stringify(sw)); }
    const s1 = await run(T.sol, T.w[2]);
    const st = await p.evaluate((id) => JSON.parse(localStorage.getItem('pai:mission:' + id) || 'null'), id);
    check(`${id}: 고친 코드 → 확인 칸이 모두 ✓, 통과 기록 저장, 배운 점·실물 확인 안내`, s1.passed && !/0/.test(s1.ok) && st && st.pass && /실물로 다시 확인/.test(await p.textContent('#mResult')), JSON.stringify(s1));
    await p.goto(`${BASE}lessons/?l=${encodeURIComponent(LESSON)}#${n}`); await p.waitForSelector('.slide'); await p.waitForTimeout(400);
    const sl = await p.evaluate(() => ({ badge: (document.querySelector('.mbadge') || {}).textContent, href: (document.querySelector('.mstart') || {}).getAttribute && document.querySelector('.mstart').getAttribute('href') }));
    check(`${id}: 슬라이드 미션 장에 '✓ 통과' 표시와 [미션 시작] 주소`, /통과/.test(sl.badge || '') && sl.href && sl.href.includes('mission=' + id) && sl.href.includes(encodeURIComponent(back)), JSON.stringify(sl));
  }
  // 되돌아가기 주소는 같은 사이트의 수업 슬라이드만
  ACT = ['A']; await p.goto(`${BASE}sim/?kit=ponybot&tab=js&mission=p1-crab&back=${encodeURIComponent('https://example.com/x')}`); await p.waitForFunction(() => window.__mission, null, { timeout: 60000 });
  check('바깥 주소로 돌아가기는 무시(슬라이드로 링크 없음)', (await p.locator('.m-back').count()) === 0);
  await p.goto(`${BASE}sim/?kit=ponybot&tab=js`); await p.waitForFunction(() => window.__pony, null, { timeout: 60000 });
  check('미션 주소가 아니면 미션 칸이 없고 말로 만들기 칸이 보임', (await p.locator('#missionBox').count()) === 0 && await p.evaluate(() => getComputedStyle(document.getElementById('assist')).display !== 'none'));
  await p.goto(`${BASE}sim/?mission=p1-crab`); await p.waitForFunction(() => window.__sim, null, { timeout: 60000 }); await p.waitForTimeout(500);
  check('로보독 시뮬레이터에는 영향 없음(미션 칸 없음)', (await p.locator('#missionBox').count()) === 0);

  // ---- 새 슬라이드 장
  const nStory = idx((s) => s.type === 'story'), nQuiz = idx((s) => s.type === 'quiz');
  await p.goto(`${BASE}lessons/?l=${encodeURIComponent(LESSON)}#${nStory}`); await p.waitForSelector('.slide'); await p.waitForTimeout(500);
  const sto = await p.evaluate(() => { const sc = document.querySelector('.story .scene').getBoundingClientRect(), bb = document.querySelector('.story .bub').getBoundingClientRect(), im = document.querySelector('.story .pic'); return { img: im.naturalWidth > 0, inside: bb.left >= sc.left - 1 && bb.right <= sc.right + 1 && bb.top >= sc.top - 1 && bb.bottom <= sc.bottom + 1, fs: parseFloat(getComputedStyle(document.querySelector('.story .bub span')).fontSize) / (document.getElementById('stage').getBoundingClientRect().width / 1280) }; });
  check('이야기 장: 그림이 뜨고 말풍선이 그림 안에 있음(잘리지 않음), 글자 20px 이상', sto.img && sto.inside && sto.fs >= 19.9, JSON.stringify(sto));
  await p.goto(`${BASE}lessons/?l=${encodeURIComponent(LESSON)}#${nQuiz}`); await p.waitForSelector('.slide'); await p.waitForTimeout(400);
  const wrongI = data.slides[nQuiz - 1].choices.findIndex((c) => !c.ok), okI = data.slides[nQuiz - 1].choices.findIndex((c) => c.ok);
  const hidden = await p.evaluate(() => [...document.querySelectorAll('.qz .qw')].every((e) => getComputedStyle(e).display === 'none'));
  await p.click(`.qz[data-quiz="${wrongI}"]`); await p.click(`.qz[data-quiz="${okI}"]`); await p.waitForTimeout(200);
  const qz = await p.evaluate(([w, o]) => { const q = (i) => document.querySelector(`.qz[data-quiz="${i}"]`); return { w: q(w).classList.contains('wrong') && getComputedStyle(q(w).querySelector('.qw')).display !== 'none', o: q(o).classList.contains('right') && getComputedStyle(q(o).querySelector('.qw')).display !== 'none', over: document.getElementById('stage').scrollHeight > document.getElementById('stage').clientHeight + 2 }; }, [wrongI, okI]);
  check('퀴즈 장: 누르기 전에는 설명이 숨어 있고, 누르면 보기마다 맞음/틀림과 이유가 보임(넘침 없음)', hidden && qz.w && qz.o && !qz.over, JSON.stringify(qz));
  check('페이지 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close();
  const pass = results.filter(Boolean).length;
  console.log(`\n결과: ${pass} 통과 / ${results.length - pass} 실패 (총 ${results.length})`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
