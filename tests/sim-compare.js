// 홍보 영상 장면과 비교용 캡처: 기본 눈(흰색), 웃는 눈(파란색), 걷기, 물구나무(위에서)
const { chromium } = require('playwright');
const path = require('path');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const OUT = path.join(__dirname, 'mc');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
  p.on('pageerror', e => console.log('pageerror', e.message));
  await p.goto(BASE + 'sim/?demo=0&tab=js');
  await p.waitForFunction(() => window.__sim && window.Babel);
  await p.click('#tab3d'); await p.waitForTimeout(1500);
  const view = await p.$('#view3d');
  const cam = (pos, target, follow = false) => p.evaluate(([pos, target, follow]) => {
    const v = window.__sim.view3d(); v.follow = follow;
    const r = window.__sim.robot;
    v.camera.position.set(r.x + pos[0], pos[1], r.y + pos[2]); v.controls.target.set(r.x + target[0], target[1], r.y + target[2]);
  }, [pos, target, follow]);
  const runCode = async (code, wait) => { await p.click('#btnReset'); await p.fill('#code', code); await p.click('#btnRun'); await p.waitForTimeout(wait); };

  await runCode('robodog.gesture(deflib.Posture.Ready)\nrobodog.headLedExp(deflib.LedExpression.BigEyes)', 1500);
  await cam([20, 14, -30], [0, 8, -2]); await p.waitForTimeout(400);
  await view.screenshot({ path: path.join(OUT, 'cmp_ready_white.png') });

  await p.selectOption('#eyeColor', 'blue');
  await runCode('robodog.headLedExp(deflib.LedExpression.Thanks)', 1200);
  await cam([2, 13.5, -19], [0, 12.5, -5]); await p.waitForTimeout(400);
  await view.screenshot({ path: path.join(OUT, 'cmp_face_blue.png') });
  await p.selectOption('#eyeColor', 'white');

  await runCode('robodog.headLedExp(deflib.LedExpression.BigEyes)\nrobodog.move(deflib.MoveDirection.Forward, 20)', 1300);
  await cam([22, 12, -20], [0, 7, 0], true); await p.waitForTimeout(500);
  await view.screenshot({ path: path.join(OUT, 'cmp_walk.png') });

  await runCode('robodog.gesture(deflib.Posture.Handstand)', 2500);
  await cam([0.1, 55, 0.1], [0, 0, 0]); await p.waitForTimeout(400);
  await view.screenshot({ path: path.join(OUT, 'cmp_handstand_top.png') });
  await cam([30, 12, 2], [0, 8, 0]); await p.waitForTimeout(400);
  await view.screenshot({ path: path.join(OUT, 'cmp_handstand_side.png') });
  await p.click('#tab2d'); await p.waitForTimeout(500);
  await (await p.$('#side2d')).screenshot({ path: path.join(OUT, 'cmp_handstand_2dside.png') });
  await (await p.$('#eyes')).screenshot({ path: path.join(OUT, 'cmp_eyes_2d.png') });
  await b.close();
})();
