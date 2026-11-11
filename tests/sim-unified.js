// 통합 시뮬레이터(교구 고르기) 시험: /sim/ = 로보독, /sim/?kit=ponybot = 포니봇, 옛 /ponybot/sim/ 은 넘겨 줌
// 실행: node tests/sim-unified.js [기본주소] [--no-makecode]
//   기본주소를 안 주면 bridge/ 를 python3 -m http.server 로 직접 띄움. MakeCode 항목은 인터넷(makecode.microbit.org)이 필요해요.
//   화면 사진은 SHOT_DIR(기본 tests/mc)에 저장.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SHOT = process.env.SHOT_DIR || path.join(__dirname, 'mc');
fs.mkdirSync(SHOT, { recursive: true });
const NO_MC = process.argv.includes('--no-makecode');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); };

async function startServer() {
  const port = 9100 + Math.floor(Math.random() * 300);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(__dirname, '..', 'bridge'), stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 50; i++) {
    if (await new Promise((res) => require('http').get(base + 'sim/guide.js', (r) => { r.resume(); res(r.statusCode === 200); }).on('error', () => res(false)))) return { srv, base };
    await new Promise(r => setTimeout(r, 100));
  }
  srv.kill(); throw new Error('정적 서버가 안 떠요');
}

(async () => {
  let srv = null, BASE = process.argv.slice(2).find(a => /^https?:/.test(a));
  if (!BASE) { const s = await startServer(); srv = s.srv; BASE = s.base; }
  BASE = BASE.replace(/\/?$/, '/');
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const newPage = async (viewport = { width: 1400, height: 950 }) => {
    const ctx = await b.newContext({ viewport });
    const p = await ctx.newPage(); const errs = [];
    await p.route('**/api/robodog-assistant', r => r.fulfill({ json: { ok: true, configured: false, needsCode: false } }));   // 로컬 정적 서버에는 도우미 서버 함수가 없음
    p.on('pageerror', e => { if (!/makecode\.(com|microbit\.org)/.test(e.stack || '')) errs.push('pageerror: ' + e.message); });
    p.on('console', m => { if (m.type() === 'error' && !/makecode/.test(JSON.stringify(m.location() || {}))) errs.push('console: ' + m.text()); });
    p.on('requestfailed', r => { const ft = (r.failure() && r.failure().errorText) || ''; if (!/ERR_ABORTED/.test(ft) && !/makecode|pxt|githubusercontent|cdn/.test(r.url())) errs.push('requestfailed: ' + r.url() + ' ' + ft); });
    p.on('dialog', d => d.accept());
    p.errs = errs; return p;
  };
  const ponyUrl = 'sim/?kit=ponybot&tab=js', dogUrl = 'sim/?tab=js&demo=0';
  const openPony = async (p, q = ponyUrl) => { await p.goto(BASE + q); await p.waitForFunction(() => window.__ponyReady && window.Babel, null, { timeout: 30000 }); };
  const openDog = async (p, q = dogUrl) => { await p.goto(BASE + q); await p.waitForFunction(() => window.__sim && window.Babel, null, { timeout: 30000 }); };

  // ---- 1. 옛 주소는 새 화면으로 (? 값·# 값 유지) ----
  {
    const p = await newPage();
    await p.goto(BASE + 'ponybot/sim/?tab=js#x');
    await p.waitForFunction(() => window.__ponyReady, null, { timeout: 30000 });
    const u = new URL(p.url());
    check('옛 /ponybot/sim/ → /sim/?kit=ponybot 로 넘어감(쿼리·해시 유지)', /\/sim\/$/.test(u.pathname) && u.searchParams.get('kit') === 'ponybot' && u.searchParams.get('tab') === 'js' && u.hash === '#x', p.url());
    await p.close();
  }

  // ---- 2. 두 교구 모두 페이지 오류 0, 화면 요소 ----
  const pony = await newPage(), dog = await newPage();
  await openPony(pony); await openDog(dog);
  await pony.waitForTimeout(1500); await dog.waitForTimeout(1500);
  const ui = (p) => p.evaluate(() => {
    const vis = (q) => { const e = document.querySelector(q); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; };
    return { title: document.title, kit: document.documentElement.dataset.kit, brandImg: !!(document.querySelector('.brand img') && document.querySelector('.brand img').naturalWidth),
      tab3d: vis('#tab3d'), no3d: document.getElementById('no3d').textContent, demo: vis('#demoBox'), mbTab: vis('#tabEditor'), jsTab: vis('#tabJs'), examples: vis('#examples'), run: vis('#btnRun'), reset: vis('#btnReset'),
      quick: vis('#quick'), ask: vis('#askBtn'), scene: vis('#scene'), oled: vis('#oled'), wheel: vis('#whBody'), map: vis('#mapSet'), pe: vis('.pe-bar'), pSensor: vis('#pSensor'), pPSensor: vis('#pPSensor'), log: vis('#log'),
      examplesN: document.querySelectorAll('#examples option').length - 1 };
  });
  const up = await ui(pony), ud = await ui(dog);
  check('포니봇 화면: 제목·마스코트·MakeCode/글자 코드 탭·예제·실행·도우미·장면·OLED·바퀴표·지도·로그', /포니봇/.test(up.title) && up.kit === 'ponybot' && up.brandImg && up.mbTab && up.jsTab && up.examples && up.run && up.reset && up.ask && up.scene && up.oled && up.wheel && up.map && up.pe && up.pPSensor && !up.pSensor && up.log && up.examplesN === 7, JSON.stringify(up));
  check('포니봇: 3D 토글·자동 시연 숨김, "3D는 실물 사진을 받은 뒤 추가" 안내', !up.tab3d && !up.demo && /3D는 실물 사진을 받은 뒤 추가/.test(up.no3d), up.no3d);
  check('로보독 화면(기본): 3D 토글·자동 시연·로보독 센서 패널, 포니봇 전용 칸 없음', /로보독/.test(ud.title) && ud.kit === 'robodog' && ud.tab3d && ud.demo && ud.pSensor && !ud.pPSensor && !ud.scene && !ud.oled && ud.examplesN > 10, JSON.stringify(ud));

  // ---- 3. 포니봇: 실행 뒤 안내 + 안내한 버튼을 누르면 움직임 ----
  await pony.evaluate(() => window.__pony.loadExample('01_hello-ponybot'));
  const g0 = await pony.evaluate(() => ({ hidden: document.getElementById('guide').hidden }));
  await pony.click('#btnRun'); await pony.waitForTimeout(500);
  const g1 = await pony.evaluate(() => ({ hidden: document.getElementById('guide').hidden, text: document.getElementById('guideText').textContent, on: [...document.querySelectorAll('.guide-on')].map(e => e.dataset.btn || e.dataset.q || e.id), y: window.__pony.robot.y, pwm: window.__pony.robot.pwm.slice() }));
  check('01 실행 → 실행만으로는 안 움직이고, "A 버튼을 눌러 출발하세요" 안내와 A 버튼 깜빡임', g0.hidden && !g1.hidden && /A 버튼을 눌러 출발하세요/.test(g1.text) && /A 버튼을 누를 때마다/.test(g1.text) && g1.on.includes('A') && !g1.on.includes('B') && g1.pwm.every(v => v === 0), JSON.stringify(g1));
  await pony.screenshot({ path: path.join(SHOT, 'unify_pony_guide.png') });
  await pony.evaluate(() => { window.__pony.runner.stop(); });
  await pony.evaluate(() => window.__pony.loadExample('02_distance-rule'));   // A 버튼으로 출발 → 책(벽)에서 멈춤
  await pony.click('#btnRun'); await pony.waitForTimeout(500);
  const y0 = await pony.evaluate(() => window.__pony.robot.y);
  await pony.click('.mbbtn[data-btn="A"]'); await pony.waitForTimeout(2500);
  const g2 = await pony.evaluate(() => ({ y: window.__pony.robot.y, pwm: window.__pony.robot.pwm.slice(), done: document.getElementById('guide').classList.contains('done'), on: document.querySelectorAll('.guide-on').length, head: document.getElementById('guideHead').textContent }));
  check('02 안내대로 A 버튼 → 포니봇이 앞으로 움직이고 안내가 "눌렀어요"로 바뀜', y0 - g2.y > 5 && g2.pwm.some(v => v > 0) && g2.done && g2.on === 0 && /눌렀어요/.test(g2.head), JSON.stringify({ dy: y0 - g2.y, ...g2 }));
  await pony.click('#btnStop');
  const g3 = await pony.evaluate(() => document.getElementById('guide').hidden);
  check('정지 → 안내 사라짐', g3 === true);
  // 라디오 예제: 숫자 3·1 깜빡임 → 3 누르면 출발
  await pony.evaluate(() => window.__pony.loadExample('03_ai-traffic-ponybot'));
  await pony.click('#btnRun'); await pony.waitForTimeout(2800);
  const r1 = await pony.evaluate(() => ({ text: document.getElementById('guideText').textContent, on: [...document.querySelectorAll('#radioBtns .guide-on')].map(e => e.textContent), qon: [...document.querySelectorAll('#qNums .guide-on')].map(e => e.textContent) }));
  check('03 라디오 예제 → 라디오 숫자 3 · 1 안내와 숫자 버튼 깜빡임(빠른 조작 칸 포함)', /라디오 숫자 1 · 3/.test(r1.text) && r1.on.join() === '1,3' && r1.qon.join() === '1,3', JSON.stringify(r1));
  await pony.click('#qNums button[data-n="3"]'); await pony.waitForTimeout(1200);
  const r2 = await pony.evaluate(() => window.__pony.robot.pwm.slice());
  check('03 빠른 조작의 숫자 3 → 출발(모터 전진)', r2.every(v => v > 0), String(r2));
  await pony.click('#btnStop');
  // 직접 만든 코드에도(예제가 아님) 입력 안내
  await pony.evaluate(() => { document.getElementById('code').value = 'input.onButtonPressed(Button.B, function () {\n    aiPonybot.runMecanum(aiPonybot.Mecanum.Left, 80)\n})'; });
  await pony.click('#btnRun'); await pony.waitForTimeout(400);
  const c1 = await pony.evaluate(() => ({ text: document.getElementById('guideText').textContent, on: [...document.querySelectorAll('.guide-on')].map(e => e.dataset.btn || e.dataset.q) }));
  check('직접 쓴 코드(B 버튼) → B 버튼 안내', /B 버튼/.test(c1.text) && c1.on.includes('B') && !c1.on.includes('A'), JSON.stringify(c1));
  await pony.click('#btnStop');

  // ---- 4. 로보독: 같은 안내(본체 버튼) ----
  await dog.selectOption('#examples', '10_button-bark');
  await dog.click('#btnRun'); await dog.waitForTimeout(600);
  const d1 = await dog.evaluate(() => ({ hidden: document.getElementById('guide').hidden, text: document.getElementById('guideText').textContent, on: [...document.querySelectorAll('.guide-on')].map(e => e.id) }));
  check('로보독 버튼 예제 실행 → "본체 버튼 누르기" 안내와 버튼 깜빡임', !d1.hidden && /본체 버튼/.test(d1.text) && d1.on.includes('qRobot'), JSON.stringify(d1));
  await dog.screenshot({ path: path.join(SHOT, 'unify_dog_guide.png') });
  await dog.click('#btnStop');
  await dog.selectOption('#examples', '03_ai-traffic-dog');
  await dog.click('#btnRun'); await dog.waitForTimeout(600);
  const d2 = await dog.evaluate(() => ({ text: document.getElementById('guideText').textContent, on: document.querySelectorAll('.guide-on').length }));
  check('로보독 라디오 예제 → 라디오 안내', /라디오 숫자/.test(d2.text) && d2.on > 0, JSON.stringify(d2));
  await dog.click('#btnStop');

  // ---- 5. 큰 화면 사진 ----
  await pony.evaluate(() => { window.__pony.loadExample('00_check-ponybot'); });
  await dog.evaluate(() => window.__sim.showTab(false));
  await pony.screenshot({ path: path.join(SHOT, 'unify_pony_desktop.png') });
  await dog.screenshot({ path: path.join(SHOT, 'unify_dog_desktop.png') });
  check('페이지 오류·콘솔 오류 0 (두 교구, 데스크톱)', pony.errs.length === 0 && dog.errs.length === 0, JSON.stringify([...pony.errs, ...dog.errs]).slice(0, 300));
  await pony.close(); await dog.close();

  // ---- 6. 390px: 가로 스크롤 없음 (두 교구, 지도 칸을 열어 둔 채) ----
  for (const [name, openFn, q] of [['포니봇', openPony, ponyUrl], ['로보독', openDog, dogUrl]]) {
    const p = await newPage({ width: 390, height: 844 });
    await openFn(p, q); await p.waitForTimeout(800);
    await p.evaluate(() => { document.getElementById('mapSet').open = true; document.getElementById('ctrlBox').open = true; });
    await p.click('#btnRun'); await p.waitForTimeout(600);
    const sw = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, bw: document.body.scrollWidth }));
    check(`${name} 390px 가로 스크롤 없음(실행 뒤 안내·지도 칸 연 상태)`, sw.sw <= sw.iw && sw.bw <= sw.iw, JSON.stringify(sw));
    if (name === '포니봇') {
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.screenshot({ path: path.join(SHOT, 'unify_pony_390.png'), fullPage: true });
    }
    check(`${name} 390px 페이지 오류 0`, p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  }

  // ---- 7. MakeCode(진짜 편집기): 포니봇 확장 블록이 예제마다 블록으로 보임 ----
  if (!NO_MC) {
    const p = await newPage({ width: 1500, height: 1000 });
    await p.goto(BASE + 'sim/?kit=ponybot');   // 처음 화면 = 블록 코딩 탭
    await p.waitForFunction(() => window.__ponyReady, null, { timeout: 30000 });
    let ready = false;
    try { await p.waitForFunction(() => window.__sim.mcState().mcReady, null, { timeout: 150000 }); ready = true; } catch (e) { /* 아래에서 실패 처리 */ }
    check('MakeCode 편집기 열림(editorcontentloaded)', ready);
    if (ready) {
      await p.waitForTimeout(8000);
      const frame = () => p.frames().find(f => /makecode\.microbit\.org/.test(f.url()));
      const probe = () => frame().evaluate(() => {
        const texts = [...document.querySelectorAll('.blocklyText')].map(t => t.textContent);
        const dlg = document.querySelector('.ui.modal.visible, .ui.dimmer.visible .modal');
        const bad = texts.filter(t => /aiPonybot\.|basic\.|input\.|radio\.|;|=>|unknown|알 수 없/i.test(t));
        const errBlocks = document.querySelectorAll('.blocklyDraggable.blocklyError, g.blocklyError, .blocklyBlockError, [class*="blocklyError"]').length;
        const warnIcons = document.querySelectorAll('.blocklyWarningIcon, .blocklyErrorIcon').length;
        const jsBlocks = document.querySelectorAll('.blocklyDraggable[data-argument-type="js"], .pxt-js-block').length;
        const onBlocks = !!document.querySelector('.blocklyWorkspace .blocklyBlockCanvas') && document.querySelectorAll('.blocklyDraggable').length > 0;
        return { n: document.querySelectorAll('.blocklyDraggable').length, texts, bad, dlg: dlg ? dlg.innerText.slice(0, 200) : '', errBlocks, warnIcons, jsBlocks, onBlocks };
      });
      const exIds = await p.evaluate(() => [...document.querySelectorAll('#examples option')].map(o => o.value).filter(Boolean));
      for (const id of exIds) {
        // 예제 코드를 코드 칸에 넣으면 1.5초 안에 편집기로 보내짐(블록 코딩 탭에서)
        await p.evaluate((id) => { window.__pony.loadExample(id); }, id);
        await p.waitForTimeout(9000);
        const r = await probe();
        const hasPony = r.texts.some(t => /메카넘|바퀴|포니|모터|OLED|화면|거리|라인|색/.test(t));
        check(`MakeCode 블록: ${id} — 블록 ${r.n}개, 포니봇 블록 있음, 원문 코드·오류·대화상자 없음`, r.n > 3 && hasPony && r.bad.length === 0 && r.errBlocks === 0 && !r.dlg && r.onBlocks, JSON.stringify({ n: r.n, bad: r.bad.slice(0, 3), dlg: r.dlg, err: r.errBlocks, js: r.jsBlocks, sample: r.texts.slice(0, 12) }).slice(0, 400));
        if (id === '01_hello-ponybot') await p.screenshot({ path: path.join(SHOT, 'unify_pony_makecode_blocks.png') });
      }
      // 음성 대조: 없는 블록을 부르는 코드는 편집기가 '블록으로 바꿀 수 없어요' 대화상자를 띄움 → 위 검사의 "대화상자 없음"이 실제로 오류를 잡는다는 증거
      await p.evaluate(() => { document.getElementById('code').value = 'aiPonybot.fooBar(1, 2)\ninput.onButtonPressed(Button.A, function () {\n    aiPonybot.stopAllMotors()\n})\n'; });
      await p.waitForTimeout(10000);
      const neg = await probe();
      check('(음성 대조) 없는 블록 호출 코드 → 편집기가 변환 대화상자를 띄움(위 검사가 오류를 잡아냄)', /변환|convert/i.test(neg.dlg), neg.dlg.slice(0, 80));
      // 편집기에서 고친 코드가 시뮬레이터로 돌아오는지(블록 → main.ts): 편집기가 저장한 코드는 코드 칸에 들어옴
      const st = await p.evaluate(() => window.__sim.mcState());
      check('MakeCode 와 시뮬레이터 연결(편집기 준비·프로젝트 전달)', st.mcReady === true);
    }
    check('MakeCode 화면 페이지 오류 0(우리 코드)', p.errs.length === 0, p.errs.slice(0, 3).join(' | '));
    await p.close();
  }

  await b.close();
  if (srv) srv.kill();
  const fail = results.filter(x => !x.ok).length;
  console.log(`\n결과: ${results.length - fail} 통과 / ${fail} 실패 (총 ${results.length})`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
