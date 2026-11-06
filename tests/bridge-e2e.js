// AI 브리지 종단 테스트: 가짜 카메라(색 조절) + 가짜 Web Serial
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); };

const INIT = () => {
  // 색을 바꿀 수 있는 가짜 카메라
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 480;
  const ctx = cv.getContext('2d');
  window.__color = '#888888';
  window.__setColor = (c) => { window.__color = c; };
  window.__split = null;
  const draw = () => { ctx.fillStyle = window.__color; ctx.fillRect(0, 0, 640, 480);
    if (window.__split) { ctx.fillStyle = window.__split; ctx.fillRect(320, 0, 320, 480); }
    ctx.fillStyle = '#fff'; ctx.fillRect(280 + Math.random() * 4, 200, 80, 80); requestAnimationFrame(draw); };
  draw();
  navigator.mediaDevices.getUserMedia = async () => cv.captureStream(30);
  navigator.mediaDevices.enumerateDevices = async () => [{ kind: 'videoinput', deviceId: 'fake', label: '가짜 카메라' }];
  // 가짜 Web Serial
  window.__writes = [];
  const listeners = {};
  const port = {
    open: async (o) => { window.__baud = o.baudRate; },
    close: async () => {},
    writable: { getWriter: () => ({ write: async (b) => { window.__writes.push({ t: performance.now(), s: new TextDecoder().decode(b) }); }, releaseLock: () => {} }) },
    readable: {}
  };
  Object.defineProperty(navigator, 'serial', { value: {
    requestPort: async (opts) => { window.__filters = opts; return port; },
    addEventListener: (n, f) => { listeners[n] = f; },
  }});
  window.__unplug = () => listeners.disconnect && listeners.disconnect({ target: port });
};

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(INIT);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('dialog', d => { console.log('  dialog:', d.message().split('\n')[0]); d.accept(); });

  await p.goto(BASE);
  await p.waitForFunction(() => /완료|실패/.test(document.getElementById('modelStatus').textContent), null, { timeout: 120000 });
  const status = await p.textContent('#modelStatus');
  const logTxt = await p.textContent('#log');
  check('모델 로딩', status.includes('완료'), status);
  check('내장(로컬) 모델 사용', !logTxt.includes('인터넷에서 받는 중'));

  await p.click('#btnCam');
  await p.waitForTimeout(800);

  const hold = async (i, color, ms) => {
    await p.evaluate(c => window.__setColor(c), color);
    await p.waitForTimeout(300);
    const bx = await (await p.$$('.hold'))[i].boundingBox();
    await p.mouse.move(bx.x + 5, bx.y + 5); await p.mouse.down(); await p.waitForTimeout(ms); await p.mouse.up();
  };
  await hold(0, '#e00000', 6000);
  await hold(1, '#e0d000', 6000);
  await hold(2, '#00b000', 6000);
  await hold(3, '#808080', 6000);
  const counts = await p.$$eval('.cls .count b', e => e.map(x => Number(x.textContent)));
  check('사진 수집(꾹 누르기 약 4장/초)', counts.every(c => c >= 18 && c <= 30), JSON.stringify(counts));

  // 한 번 클릭 = 1장
  const before = counts[0];
  await p.evaluate(() => window.__setColor('#e00000'));
  await (await p.$$('.hold'))[0].click();
  await p.waitForTimeout(200);
  const after = Number((await p.$$eval('.cls .count b', e => e.map(x => x.textContent)))[0]);
  check('한 번 클릭하면 1~2장', after - before >= 1 && after - before <= 2, `${before}→${after}`);

  await p.click('#btnSerial');
  await p.waitForTimeout(300);
  check('시리얼 115200 / micro:bit 필터', await p.evaluate(() => window.__baud === 115200 && window.__filters.filters[0].usbVendorId === 0x0d28));

  const lastWrites = (ms) => p.evaluate((ms) => { const now = performance.now(); return window.__writes.filter(w => now - w.t < ms).map(w => w.s.trim()); }, ms);
  const expectColor = async (color, want, label) => {
    await p.evaluate(c => window.__setColor(c), color);
    await p.waitForTimeout(2000);
    const w = await lastWrites(600);
    check(`${label} → ${want} 전송`, w.length > 0 && w.every(s => s === String(want)), JSON.stringify(w));
  };
  await expectColor('#e00000', 1, '빨강');
  await expectColor('#e0d000', 2, '노랑');
  await expectColor('#00b000', 3, '초록');
  await expectColor('#808080', 4, '배경');
  await expectColor('#00b000', 3, '다시 초록');

  // 하트비트: 같은 값 반복 간격
  await p.waitForTimeout(3000);
  const ts = await p.evaluate(() => window.__writes.slice(-6).map(w => w.t));
  const gaps = ts.slice(1).map((t, i) => t - ts[i]);   // 값이 그대로일 때의 반복 간격
  check('하트비트 간격 0.4~0.7초', gaps.every(g => g > 350 && g < 750), gaps.map(g => g.toFixed(0)).join(','));

  // 사진 모으는 동안은 0
  const bx = await (await p.$$('.hold'))[2].boundingBox();
  await p.mouse.move(bx.x + 5, bx.y + 5); await p.mouse.down(); await p.waitForTimeout(900);
  const wHold = await lastWrites(500);
  await p.mouse.up();
  check('사진 모으는 중에는 0', wHold.length > 0 && wHold.every(s => s === '0'), JSON.stringify(wHold));
  await p.waitForTimeout(1500);

  // 멈춤 버튼: 초록을 보여도 0 유지
  await p.click('#btnStop');
  await p.waitForTimeout(2500);
  const wStop = await lastWrites(2000);
  check('멈춤 잠금 중 계속 0', wStop.length >= 3 && wStop.every(s => s === '0'), JSON.stringify(wStop));
  await p.click('#btnStop');
  await p.waitForTimeout(2000);
  check('멈춤 풀면 다시 3', (await lastWrites(600)).every(s => s === '3'));

  // Esc 키
  await p.keyboard.press('Escape');
  await p.waitForTimeout(800);
  check('Esc 키로 멈춤', (await lastWrites(500)).every(s => s === '0'));
  await p.click('#btnStop');
  await p.waitForTimeout(1500);

  // 관찰: 처음 보는 색(파랑)에 대한 AI 답 기록 (확신 높은 오답 가능)
  await p.evaluate(() => window.__setColor('#0000ff'));
  await p.waitForTimeout(1500);
  console.log('  관찰(파랑, 학습 안 함):', await p.textContent('#result'));
  // 확신 낮음(반반 섞인 화면) + 기준 100% → 0
  await p.evaluate(() => { window.__setColor('#e00000'); window.__split = '#00b000'; });
  await p.$eval('#thr', el => { el.value = 100; el.dispatchEvent(new Event('input')); });
  // 헷갈리는 화면 후보 중 실제로 '모르겠어요'가 나오는 것을 고름
  const candidates = [['#e07000', null], ['#e00000', '#e0d000'], ['#e0d000', '#00b000'], ['#f06060', null], ['#a0a040', null], ['#e00000', '#00b000']];
  for (const [c1, c2] of candidates) {
    await p.evaluate(([a, b]) => { window.__setColor(a); window.__split = b; }, [c1, c2]);
    await p.waitForTimeout(1200);
    let n = 0;
    for (let i = 0; i < 10; i++) { if ((await p.textContent('#result')).includes('모르겠')) n++; await p.waitForTimeout(100); }
    console.log(`  후보 ${c1}/${c2}: 미달 ${n}/10`);
    if (n >= 9) break;
  }
  // 100ms마다 (화면이 '모르겠어요'인지, 마지막 전송값)을 기록 → '모르겠어요'가 1.5초 이상 이어진 구간의 뒷부분은 반드시 0이어야 함
  const samples = [];
  for (let i = 0; i < 60; i++) {
    samples.push(await p.evaluate(() => ({ t: performance.now(), unsure: document.getElementById('result').textContent.includes('모르겠'),
      last: (window.__writes[window.__writes.length - 1] || {}).s })));
    await p.waitForTimeout(100);
  }
  let runStart = null, checked = 0, bad = 0;
  for (const s of samples) {
    if (s.unsure) { if (runStart === null) runStart = s.t; if (s.t - runStart > 1500) { checked++; if ((s.last || '').trim() !== '0') bad++; } }
    else runStart = null;
  }
  check('확신 기준 미달이 이어지면 0', checked > 0 && bad === 0, `확인 ${checked}회, 위반 ${bad}회` + (checked === 0 ? ' (판단 불가: 미달 상태가 1.5초 이상 이어지지 않음)' : ''));
  await p.evaluate(() => { window.__split = null; });
  await p.$eval('#thr', el => { el.value = 70; el.dispatchEvent(new Event('input')); });

  // 수동 보내기
  await p.click('#manual button:nth-child(2)');
  await p.waitForTimeout(1500);
  check('자동 끄고 수동 2를 계속 보냄', (await lastWrites(1100)).filter(s => s === '2').length >= 2);
  await p.check('#autoSend');

  // 다른 탭으로 이동 → 0
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForTimeout(1200);
  const wHidden = await lastWrites(1000);
  check('탭이 가려지면 0', wHidden.length > 0 && wHidden.every(s => s === '0'), JSON.stringify(wHidden));
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });

  // 모두 지우기 → 0
  await p.evaluate(() => window.__setColor('#00b000'));
  await p.waitForTimeout(1500);
  // 정확도 실험 + 저장 (지우기 전에)
  await p.click('#adv summary');
  const testBtns = await p.$$('#testClasses button');
  const colors = ['#e00000', '#e0d000', '#00b000', '#808080'];
  for (let i = 0; i < 4; i++) { await p.evaluate(c => window.__setColor(c), colors[i]); await p.waitForTimeout(300); for (let j = 0; j < 5; j++) { await (await p.$$('#testClasses button'))[i].click(); await p.waitForTimeout(80); } }
  await p.click('#btnEval');
  await p.waitForTimeout(800);
  const evalTxt = await p.textContent('#evalOut');
  check('정확도 계산·혼동행렬', /정확도 \d/.test(evalTxt) && (await p.$$('#evalOut td')).length === 20, evalTxt.slice(0, 40));

  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btnSave')]);
  const path = await dl.path();
  check('학습 데이터 저장', !!path, dl.suggestedFilename());

  await p.click('#btnClear');
  await p.waitForTimeout(1000);
  check('모두 지우면 0', (await lastWrites(500)).every(s => s === '0'));
  await p.setInputFiles('#fileLoad', path);
  await p.waitForTimeout(800);
  const counts2 = await p.$$eval('.cls .count b', e => e.map(x => Number(x.textContent)));
  check('학습 데이터 불러오기', counts2[0] > 0 && counts2[3] > 0, JSON.stringify(counts2));
  await p.evaluate(() => window.__setColor('#e00000'));
  await p.waitForTimeout(2000);
  check('불러온 데이터로 빨강 → 1', (await lastWrites(600)).every(s => s === '1'));

  // XSS: 클래스 이름에 태그
  await p.fill('.cls input[type=text] >> nth=0', '<img src=x onerror=window.__xss=1>');
  await p.waitForTimeout(1500);
  check('이름 입력 XSS 차단', !(await p.evaluate(() => window.__xss)));

  // USB 뽑힘
  await p.evaluate(() => window.__unplug());
  await p.waitForTimeout(300);
  check('USB 뽑힘 표시', (await p.textContent('#serialStatus')).includes('안 됨'));

  await p.screenshot({ path: __dirname + '/e2e_desktop.png', fullPage: true });
  // 모바일 폭
  await p.setViewportSize({ width: 375, height: 800 });
  await p.waitForTimeout(500);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  check('375px 폭 가로 스크롤 없음', sw <= 375, `scrollWidth=${sw}`);
  await p.screenshot({ path: __dirname + '/e2e_mobile.png', fullPage: true });

  check('페이지 오류 없음', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await b.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - fail}/${results.length} PASS`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e.message); process.exit(2); });
