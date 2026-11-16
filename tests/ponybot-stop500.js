// 포니봇 '피하고 계속 가' 코드가 앞이 트이면 거리 500(못 읽음)으로 멈출 때, 시뮬레이터가 멈춘 이유를 알려 주는지
// (사용자 피드백 2026-11-16: '피한 뒤 정지·종료'는 코드의 500=멈춤 안전 규칙 때문 — 시뮬레이터 오류 아님)
// 실행: node tests/ponybot-stop500.js [기본주소]  (bridge/ 를 서버로 띄워 둘 것)
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = []; const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${ok ? '' : d}`); };
const CODE = `// 장애물 피하기(사용자 화면을 본떠 재구성)
let 속도 = 100
let 달리는중 = false
let 거리 = 0
aiPonybot.stopAllMotors()
input.onButtonPressed(Button.A, function () { 달리는중 = true })
input.onButtonPressed(Button.B, function () { 달리는중 = false; aiPonybot.stopAllMotors() })
basic.forever(function () {
    if (달리는중) {
        거리 = aiPonybot.ping(aiPonybot.PingUnit.Centimeters)
        if (거리 <= 0 || 거리 >= 500) {
            aiPonybot.stopAllMotors()
        } else if (거리 < 20) {
            aiPonybot.runMecanum(aiPonybot.Mecanum.Right, 속도)
            basic.pause(5000)
            aiPonybot.stopAllMotors()
        } else {
            aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 속도)
        }
    }
    basic.pause(50)
})`;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
 await p.route('**/api/*-assistant', r => r.fulfill({ json: { configured: false } }));
 const errs=[]; p.on('pageerror', e=>errs.push(e.message));
 await p.goto(BASE + 'sim/?kit=ponybot&tab=js'); await p.waitForFunction(() => window.__pony, null, { timeout: 60000 });
 await p.evaluate(() => { window.__noAutoSetup = true; window.__pony.setScene('free'); });
 await p.evaluate((c) => { document.getElementById('code').value = c; window.__pony.runCode(); }, CODE);
 await p.waitForFunction(() => window.__pony.runner.running, null, { timeout: 15000 });
 const st = () => p.evaluate(() => { const P = window.__pony, r = P.robot; return { x: +r.x.toFixed(0), y: +r.y.toFixed(0), moving: r.pwm.some(v=>v), d: Math.round(Math.min(500, r.sonarTrue())), boxes: P.props.boxes.length }; });
 await p.evaluate(() => { const P=window.__pony, r=P.robot; P.props.boxes.push({ x: r.x-15, y: r.y-60, w: 30, h: 10 }); });
 await p.click('.mbbtn[data-btn="A"]');
 const s0 = await st(); await p.waitForTimeout(1500); const s1 = await st();
 check('상자가 가까워지면 옆으로 피함', s1.x > s0.x + 5 || s1.moving, JSON.stringify(s1));
 await p.waitForTimeout(9000); const s2 = await st();
 check('피한 뒤 앞이 트이면 거리 500 → 코드대로 멈춤', !s2.moving && s2.d === 500 && s2.x > s0.x + 20, JSON.stringify(s2));
 const msg = await p.evaluate(() => document.getElementById('log').textContent);
 check('멈춘 이유(500 = 못 읽음, 코드의 안전 규칙) 안내가 한 번 나옴', (msg.match(/멈춘 이유/g) || []).length === 1, msg.slice(-200));
 check('센서 칸의 거리 표시 강조', await p.evaluate(() => document.getElementById('psDist').classList.contains('warn500')));
 check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
 await b.close(); const f = results.filter(x => !x).length; console.log(`\n결과: ${results.length - f} 통과 / ${f} 실패 (총 ${results.length})`); process.exit(f ? 1 : 0); })();
