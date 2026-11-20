// 포니봇 3D 미리보기: 꽂힌 마이크로비트의 5×5 LED 가 코드의 화면과 같게 켜짐(OLED 쪽에서 볼 때 거울 반전 없음)
// 사용자 요청(2026-11-17): 3D 미리보기에 마이크로비트를 꽂고 LED 도 표시
// 실행: node tests/ponybot-3d-microbit.js [기본주소]  (bridge/ 를 서버로 띄워 둘 것)
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = []; const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${ok ? '' : d}`); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/api/*-assistant', (r) => r.fulfill({ json: { configured: false } }));
  await p.goto(BASE + 'sim/?kit=ponybot&tab=js&view=3d'); await p.waitForFunction(() => window.__pony && window.__sim.view3d && window.__sim.view3d() && window.__sim.view3d().model, null, { timeout: 60000 }); await p.waitForTimeout(1000);
  check('3D 모형에 마이크로비트 LED 25개', await p.evaluate(() => window.__sim.view3d().model.mbLeds.length === 25));
  for (const [code, name] of [['basic.showArrow(ArrowNames.East)', '동쪽 화살표'], ['basic.showIcon(IconNames.Heart)', '하트'], ['basic.clearScreen()', '지우기']]) {
    await p.evaluate((c) => { document.getElementById('code').value = c + '\nbasic.forever(function () { basic.pause(100) })'; window.__pony.runCode(); }, code);
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => { const d = window.__pony.runner.display.map((row) => row.map((v) => (v ? 1 : 0)).join('')).join(''); const l = window.__sim.view3d().model.mbLeds.map((m) => (m.material.color.getHex() === 0xff3b2f ? 1 : 0)).join(''); return { d, l }; });
    check(`${name}: 3D LED = 마이크로비트 화면`, r.d === r.l, JSON.stringify(r));
  }
  const pr = await p.evaluate(() => { const V = window.__sim.view3d(), P = V.model, s = window.__pony.world.start; V.camera.position.set(s.x, 6, s.y + 25); V.controls.target.set(s.x, 4, s.y + 4.9); V.controls.update(); V.camera.updateMatrixWorld(); const sx = (m) => { const v = m.getWorldPosition(m.position.clone()); v.project(V.camera); return v.x; }; return { c0: sx(P.mbLeds[0]), c4: sx(P.mbLeds[4]) }; });
  check('OLED 쪽에서 볼 때 0열이 왼쪽(거울 반전 없음)', pr.c0 < pr.c4, JSON.stringify(pr));
  check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close(); const f = results.filter((x) => !x).length;
  console.log(`\n결과: ${results.length - f} 통과 / ${f} 실패 (총 ${results.length})`); process.exit(f ? 1 : 0);
})();
