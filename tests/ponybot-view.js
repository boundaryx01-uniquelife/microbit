// 포니봇 시뮬레이터 화면 구성·2D 보기 조작·선 닫기 시험
//  - 한 화면: 움직임(3D·2D) 바로 아래에 라디오 0~9 한 줄, [마이크로비트 | OLED], [센서 | 바퀴 명령]
//  - 위쪽 한 줄: 3D · 2D  − ＋ 전체 로봇 따라가기 ('보기'라는 말 없이, 두 줄로 갈라지지 않음)
//  - 2D: 마우스 휠 = 확대/축소(사이트 전체는 스크롤되지 않음), 오른쪽 버튼 끌기 = 이동, 전체 = 처음 시점
//  - 선 편집: 시작점(초록)을 누르면 고리로 닫힘, [선 닫기/열기] 단추
// 실행: node tests/ponybot-view.js [기본주소]   (기본: http://127.0.0.1:8765/ — bridge/ 를 Range 지원 서버로 띄워 둘 것)
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); };

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + 'sim/?kit=ponybot'); await p.waitForFunction(() => window.__pony && window.__pony.view, null, { timeout: 60000 });
  await p.waitForTimeout(1500); await p.click('#tab2d'); await p.waitForTimeout(500);
  const S = (fn, arg) => p.evaluate(fn, arg);
  const rect = (id) => S((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, id);

  // ---- 화면 구성
  const tabs = await S(() => ({ t3: document.getElementById('tab3d').textContent, t2: document.getElementById('tab2d').textContent, btns: [...document.querySelectorAll('#viewCtl button')].map(x => x.textContent), follow: document.getElementById('vfollow').closest('label').textContent.trim(),
    tops: [...document.querySelectorAll('#tab3d, #tab2d, #viewCtl button, #viewCtl label')].map(e => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2)) }));
  check('위쪽 줄: 3D · 2D − ＋ 전체 로봇 따라가기 (글자에 "보기"가 없음)', tabs.t3 === '3D' && tabs.t2 === '2D' && tabs.btns.join('') === '−＋전체' && /로봇 따라가기/.test(tabs.follow) && !/보기/.test([tabs.t3, tabs.t2, ...tabs.btns, tabs.follow].join('')), JSON.stringify(tabs));
  check('위쪽 줄이 한 줄(두 줄로 갈라지지 않음)', Math.max(...tabs.tops) - Math.min(...tabs.tops) <= 8, JSON.stringify(tabs.tops));
  const view = await rect('top2d'), strip = await rect('radioStrip'), mb = await rect('pMb'), oled = await rect('pPOled'), sens = await rect('pPSensor'), wheel = await rect('pPWheel');
  const nums = await S(() => [...document.querySelectorAll('#radioStrip #radioBtns button')].map(x => [x.textContent, Math.round(x.getBoundingClientRect().top)]));
  check('미리보기 바로 아래에 라디오 0~9가 한 줄', nums.map(n => n[0]).join('') === '0123456789' && new Set(nums.map(n => n[1])).size === 1 && strip.t >= view.b - 2 && strip.t - view.b < 60, JSON.stringify([view.b, strip.t, nums.length]));
  check('마이크로비트와 OLED가 같은 줄(위), 센서와 바퀴 명령이 같은 줄(아래)', Math.abs(mb.t - oled.t) < 4 && Math.abs(sens.t - wheel.t) < 4 && sens.t >= mb.b - 2 && mb.l < oled.l && sens.l < wheel.l && oled.t >= strip.b - 2, JSON.stringify({ mb: mb.t, oled: oled.t, sens: sens.t, wheel: wheel.t }));
  check('움직임·LED·OLED가 첫 화면(900px)에 같이 보임', oled.b <= 900 && mb.b <= 900 && view.t >= 0, `OLED 아래 ${Math.round(oled.b)}px`);
  const ov = await S(() => document.documentElement.scrollWidth <= innerWidth);
  check('가로 스크롤 없음', ov);

  // ---- 2D 확대·이동
  const z0 = await S(() => ({ z: window.__pony.view.zoom, sy: scrollY }));
  await p.mouse.move(view.l + view.w / 2, view.t + view.h / 2); await p.mouse.wheel(0, -300); await p.waitForTimeout(250);
  const z1 = await S(() => ({ z: window.__pony.view.zoom, sy: scrollY }));
  check('2D 위에서 휠 → 확대되고 사이트 전체는 스크롤되지 않음', z1.z > z0.z * 1.1 && z1.sy === z0.sy, JSON.stringify([z0, z1]));
  await p.mouse.wheel(0, 300); await p.mouse.wheel(0, 300); await p.waitForTimeout(250);
  check('휠을 반대로 돌리면 축소(전체 이하로는 안 줄어듦)', await S(() => window.__pony.view.zoom) <= z1.z && await S(() => window.__pony.view.zoom) >= 1);
  await p.click('#viewCtl [data-v="in"]'); await p.click('#viewCtl [data-v="in"]'); await p.click('#viewCtl [data-v="in"]');
  const before = await S(() => ({ ox: window.__pony.view.ox, oy: window.__pony.view.oy, z: window.__pony.view.zoom }));
  await p.mouse.move(view.l + view.w / 2, view.t + view.h / 2); await p.mouse.down({ button: 'right' }); await p.mouse.move(view.l + view.w / 2 - 70, view.t + view.h / 2 - 40, { steps: 6 }); await p.mouse.up({ button: 'right' });
  const after = await S(() => ({ ox: window.__pony.view.ox, oy: window.__pony.view.oy }));
  check('확대한 뒤 오른쪽 버튼 끌기 → 화면 이동', before.z > 1.5 && (Math.abs(after.ox - before.ox) > 3 || Math.abs(after.oy - before.oy) > 3), JSON.stringify([before, after]));
  const map = await S(() => { const v = window.__pony.view, w = { x: 100, y: 70 }, s = v.toScreen(w.x, w.y), back = v.toWorld({ clientX: s.x, clientY: s.y }); return Math.hypot(back.x - w.x, back.y - w.y); });
  check('확대·이동해도 월드↔화면 좌표 변환이 서로 맞음', map < 0.01, String(map));
  await p.click('#viewCtl [data-v="fit"]'); await p.waitForTimeout(150);
  const fit = await S(() => ({ z: window.__pony.view.zoom, ox: window.__pony.view.ox, f: window.__pony.view.follow }));
  check('[전체] → 처음 시점(확대 1·이동 0·따라가기 꺼짐)', fit.z === 1 && fit.ox === 0 && !fit.f, JSON.stringify(fit));
  await p.click('#vfollow'); await p.waitForTimeout(150);
  check('[로봇 따라가기] → 켜지고 확대됨', await S(() => window.__pony.view.follow && window.__pony.view.zoom > 1.4));
  await p.click('#viewCtl [data-v="fit"]');

  // ---- 선 닫기(고리)
  await p.click('[data-tool="track"]');
  const sc = (x, y) => S(([x, y]) => window.__pony.view.toScreen(x, y), [x, y]);
  const clickW = async (x, y) => { const s = await sc(x, y); await p.mouse.click(s.x, s.y); await p.waitForTimeout(60); };
  await S(() => { window.__pony.props.tracks.length = 0; });
  for (const [x, y] of [[60, 40], [140, 40], [140, 100], [60, 100]]) await clickW(x, y);
  const open = await S(() => { const t = window.__pony.props.tracks[0]; return { n: t.pts.length, closed: !!t.closed }; });
  check('선 4점을 그리면 아직 열려 있음', open.n === 4 && !open.closed, JSON.stringify(open));
  await clickW(60, 40);
  const closed = await S(() => { const t = window.__pony.props.tracks[0]; return { n: t.pts.length, closed: !!t.closed, btn: document.getElementById('pe-closebtn').textContent }; });
  check('시작점(초록)을 누르면 고리로 닫힘(점이 늘지 않음)', closed.closed && closed.n === 4 && /열기/.test(closed.btn), JSON.stringify(closed));
  const onLoop = await S(() => { const P = window.__pony; return P.PROPS.onLine(P.props, 60, 70) && P.PROPS.onLine(P.props, 100, 40) && P.PROPS.onLine(P.props, 140, 70) && P.PROPS.onLine(P.props, 100, 100); });
  check('닫힌 선의 네 변 모두 라인 센서가 검정으로 읽음(마지막→처음 변 포함)', onLoop);
  await p.click('#pe-closebtn');
  check('[선 열기] 단추로 다시 열림', await S(() => !window.__pony.props.tracks[0].closed));
  await p.click('#pe-closebtn');
  check('[선 닫기] 단추로 다시 닫힘', await S(() => !!window.__pony.props.tracks[0].closed));
  await S(() => { window.__pony.props.tracks.length = 0; });
  for (const [x, y] of [[60, 40], [140, 40]]) await clickW(x, y);
  await clickW(60, 40);
  check('점이 2개일 때는 닫히지 않음(3개 이상 필요)', await S(() => { const t = window.__pony.props.tracks[0]; return !t.closed; }));

  // ---- 3D: 같은 단추가 3D에도 듣고, 한 줄 유지
  await p.click('#tab3d'); await p.waitForTimeout(1500);
  const d0 = await S(() => { const v = window.__sim.view3d(); return v.camera.position.distanceTo(v.controls.target); });
  await p.click('#viewCtl [data-v="in"]'); await p.waitForTimeout(200);
  const d1 = await S(() => { const v = window.__sim.view3d(); return v.camera.position.distanceTo(v.controls.target); });
  check('3D에서도 ＋ 단추가 가까이 보여 줌', d1 < d0 - 1, `${d0.toFixed(1)} → ${d1.toFixed(1)}`);
  await p.click('#viewCtl [data-v="out"]'); await p.click('#viewCtl [data-v="out"]'); await p.waitForTimeout(200);
  const d2 = await S(() => { const v = window.__sim.view3d(); return v.camera.position.distanceTo(v.controls.target); });
  check('3D에서 − 단추는 멀리 보여 줌', d2 > d1 + 1, `${d1.toFixed(1)} → ${d2.toFixed(1)}`);
  const t3 = await S(() => [...document.querySelectorAll('#tab3d, #tab2d, #viewCtl button, #viewCtl label')].map(e => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2)));
  check('3D 보기에서도 위쪽 줄이 한 줄', Math.max(...t3) - Math.min(...t3) <= 8, JSON.stringify(t3));

  // ---- 좁은 화면(휴대폰)
  const m = await b.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto(BASE + 'sim/?kit=ponybot'); await m.waitForFunction(() => window.__pony && window.__pony.view, null, { timeout: 60000 }); await m.waitForTimeout(1200);
  check('390px: 가로 스크롤 없음', await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), String(await m.evaluate(() => document.documentElement.scrollWidth)));
  check('페이지 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close();
  const pass = results.filter(Boolean).length;
  console.log(`\n결과: ${pass} 통과 / ${results.length - pass} 실패 (총 ${results.length})`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
