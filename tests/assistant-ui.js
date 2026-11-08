// 시뮬레이터의 로보독 도우미 화면 시험: 규칙 도우미(키 없음) + AI 응답(가짜 서버 응답으로) + 실패 시 규칙 도우미로 바뀜
// 실행: (bridge 폴더에서 정적 서버) node tests/assistant-ui.js http://127.0.0.1:8765/
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); };
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const open = async (route) => {
    const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
    p.on('pageerror', e => errors.push(e.message));
    p.on('dialog', d => d.accept());
    if (route) await p.route('**/api/robodog-assistant', route);
    await p.goto(BASE + 'sim/?demo=0&tab=js');
    await p.waitForFunction(() => window.__sim && window.Babel);
    await p.waitForTimeout(500);
    return p;
  };
  // 1) 키 없음 → 규칙 도우미 (실제 사이트에서도 AI를 부르지 않도록 응답을 대신함)
  let p = await open(r => r.request().method() === 'GET' ? r.fulfill({ json: { ok: true, configured: false, needsCode: false } }) : r.fulfill({ status: 503, json: { error: 'not_configured' } }));
  check('키 없으면 규칙 도우미 표시', (await p.textContent('#askMode')).includes('규칙'));
  check('AI가 꺼져 있어도 수업 코드 칸은 보임(잠김) + 이유 안내', await p.isVisible('#askClass') && await p.isDisabled('#askClass') && (await p.textContent('#askNote')).includes('관리자'));
  await p.fill('#askText', 'A 버튼을 누르면 빨간 불을 켜고 멍멍 짖어, B 버튼을 누르면 앉아');
  await p.click('#askBtn');
  const code = await p.textContent('#askCode');
  check('버튼 이벤트·불빛·소리 코드 생성', code.includes('Button.A') && code.includes('bodyLed(255, 0, 0)') && code.includes('SoundEffect.Bark') && code.includes('SitDown'));
  const ws = await p.$$eval('#askWarn li', l => l.map(x => x.textContent));
  check('문법 경고 없음 + "A·B 가려짐" 안내만', ws.length === 1 && /가려져/.test(ws[0]), ws.join(' | '));
  await p.click('#askRun'); await p.waitForTimeout(800);
  await p.evaluate(() => window.__sim.runner.press('A')); await p.waitForTimeout(600);
  check('실행 후 A → 몸통 빨간 불', await p.evaluate(() => { return window.__sim.robot.bodyLed[0] === 255; }), await p.evaluate(() => JSON.stringify(window.__sim.robot.bodyLed)));
  await p.click('#askUse');
  check('코드 칸에 넣기 + 결과 닫혀 코딩 칸 넓게', (await p.inputValue('#code')).includes('robodog.bodyLed(255, 0, 0)') && await p.isHidden('#askOut'));
  await p.fill('#askText', '');
  await p.click('#askBtn');
  check('빈 입력이면 안내 + 실행 버튼 숨김', (await p.textContent('#askExpl')).includes('한 줄') && await p.isHidden('#askBtns'));
  await p.fill('#askText', '앞으로 걸어'); await p.press('#askText', 'Enter');
  check('Enter로 만들기', (await p.textContent('#askCode')).includes('Forward'));
  await p.fill('#code', ''); await p.click('#btnRun');
  check('빈 코드 실행 → 안내', (await p.textContent('#runMsg')).includes('비어'));
  await p.fill('#code', 'robodog.foo('); await p.click('#btnRun');
  check('문법 오류 실행 → 빨간 안내', (await p.getAttribute('#runMsg', 'class')) === 'err');
  await p.fill('#askText', '하늘을 날아');
  await p.click('#askBtn');
  check('모르는 말은 안내 + 실행 버튼 꺼짐', (await p.textContent('#askWarn')).includes('이해하지 못한') && await p.isDisabled('#askRun'));
  await p.fill('#askText', '장애물이 가까우면 멈추고 비켜라고 말해');
  await p.click('#askBtn');
  check('비슷한 예제 추천(거리)', (await p.textContent('#askSug')).includes('규칙으로 반응하기'));
  await p.click('#askEx > summary'); await p.click('#askChips button >> nth=0');
  check('예시 문장 칩 → 입력칸', (await p.inputValue('#askText')).includes('앞으로 2초'));
  await p.close();

  // 2) AI 사용 가능 + 정상 응답
  let posted = null;
  p = await open(async (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ json: { ok: true, configured: true, needsCode: true } });
    posted = JSON.parse(req.postData());
    return route.fulfill({ json: { code: '// AI 코드\nrobodog.gesture(deflib.Posture.Ready)\nrobodog.gesture(deflib.Posture.Stretch)', explanation: '기지개를 켜요.', warnings: ['테스트 경고'] } });
  });
  check('키 있어도 코드 전에는 규칙 도우미 + 코드 안내', (await p.textContent('#askMode')).includes('수업 코드') && !(await p.textContent('#askMode')).startsWith('AI'));
  check('수업 코드 칸 보임', await p.isVisible('#askClass'));
  await p.fill('#askText', '앞으로 2초 걸어'); await p.click('#askBtn'); await p.waitForSelector('#askOut:not(.hidden)');
  check('코드 없이 만들기 → AI에 요청을 보내지 않고 규칙 도우미', posted === null && (await p.textContent('#askCode')).includes('MoveDirection.Forward') && (await p.textContent('#askWarn')).includes('수업 코드를 넣어야'));
  await p.fill('#askClass', '1234');
  check('코드를 넣으면 AI 도우미로 바뀜', (await p.textContent('#askMode')).includes('AI 도우미 (Claude)'));
  await p.fill('#askText', '기지개 켜'); await p.check('#askFix');
  await p.click('#askBtn'); await p.waitForSelector('#askOut:not(.hidden)');
  check('AI 응답 표시', (await p.textContent('#askCode')).includes('Stretch') && (await p.textContent('#askWarn')).includes('테스트 경고'));
  check('요청에 수업 코드·지금 코드 포함', posted && posted.classCode === '1234' && posted.currentCode.length > 10);
  await p.close();

  // 3) AI 실패(수업 코드 틀림) → 규칙 도우미로 대신
  p = await open(async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { ok: true, configured: true, needsCode: true } });
    return route.fulfill({ status: 401, json: { error: 'class_code' } });
  });
  await p.fill('#askClass', '9999');
  await p.fill('#askText', '앞으로 2초 걸어');
  await p.click('#askBtn'); await p.waitForSelector('#askOut:not(.hidden)');
  check('AI 실패 → 규칙 도우미 코드 + 이유 안내', (await p.textContent('#askCode')).includes('MoveDirection.Forward') && (await p.textContent('#askWarn')).includes('수업 코드'));
  await p.close();

  // 4) 편집기 모드: 시연 접힘, 오른쪽 좁음
  p = await b.newPage({ viewport: { width: 1400, height: 950 } });
  await p.route('https://makecode.microbit.org/**', r => r.fulfill({ body: '<html></html>', contentType: 'text/html' }));
  await p.goto(BASE + 'sim/?demo=0');
  await p.waitForFunction(() => window.__sim);
  const lay = await p.evaluate(() => ({ demoOpen: document.getElementById('demoBox').open, cols: getComputedStyle(document.querySelector('main')).gridTemplateColumns,
    frameTop: document.getElementById('mcFrame').getBoundingClientRect().top, chips: document.getElementById('assist').getBoundingClientRect().height,
    demo: !!window.__sim.runner.running }));
  const [left, right] = lay.cols.split(' ').map(parseFloat);
  check('편집기 모드에서 시연 접힘·자동 시연 없음', lay.demoOpen === false && !lay.demo);
  check('편집기 모드에서 코딩 칸이 넓음(오른쪽 ≤ 400px)', right <= 400 && left > right * 2, lay.cols);
  check('도우미가 낮아 편집기가 첫 화면에 보임(위치 < 380px)', lay.frameTop < 380 && lay.chips < 160, JSON.stringify(lay));
  await p.setViewportSize({ width: 1366, height: 768 }); await p.mouse.wheel(0, 500); await p.waitForTimeout(400);
  const vis = await p.evaluate(() => { const r = document.querySelector('#pane3d:not(.hidden), #pane2d:not(.hidden)').getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
  check('스크롤해도 로보독 화면이 보임(오른쪽 따라옴)', vis);
  await p.close();

  check('페이지 오류 없음', errors.length === 0, errors.join(' | '));
  await b.close();
  const fail = results.filter(x => !x).length;
  console.log(`\n${results.length - fail}/${results.length} PASS`);
  process.exit(fail ? 1 : 0);
})();
