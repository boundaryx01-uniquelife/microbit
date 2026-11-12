// 사이트 첫 화면(교구 선택) 인트로 "Physical AI with micro:bit" 시험: node tests/physical-ai-intro.js [기본주소]
// 미리 보기 페이지(시각별 장면) + 첫 화면(전체 화면 재생 → 건너뛰기 → 카드, 재방문, 움직임 줄이기, 390px, 링크)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${ok ? '' : detail}`); };
// 캔버스가 비어 있지 않은지: 배경색(#f4f6fa)과 다른 화소 비율 + 서로 다른 색 수
const inkStats = (sel) => (s) => {
  const c = document.querySelector(s), x = document.createElement('canvas'); x.width = 192; x.height = Math.round(192 * c.height / c.width);
  const g = x.getContext('2d'); g.drawImage(c, 0, 0, x.width, x.height); const d = g.getImageData(0, 0, x.width, x.height).data;
  let ink = 0; const cols = new Set();
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 20 && (Math.abs(d[i] - 244) + Math.abs(d[i + 1] - 246) + Math.abs(d[i + 2] - 250)) > 40) ink++; cols.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); }
  return { ink: ink / (d.length / 4), cols: cols.size };
};
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const watch = (p) => { p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); };

  // ----- 1) 미리 보기: 시각마다 장면이 그려짐(가로·세로) -----
  for (const [W, H, tag] of [[1280, 720, '가로'], [390, 844, '세로']]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H } }); const p = await ctx.newPage(); watch(p);
    await p.goto(BASE + 'intro/physical-ai.html?cap&t=0');
    await p.waitForFunction('window.__ready', null, { timeout: 30000 });
    const bad = [];
    for (const t of [1.0, 1.6, 3.5, 6.4, 7.2, 9.5, 13.5]) {
      await p.evaluate((t) => window.__seek(t), t);
      const s = await p.evaluate(inkStats(), '#c');
      if (!(s.ink > 0.002 && s.cols > 3)) bad.push(t + 's ' + JSON.stringify(s));
    }
    check(`미리 보기(${tag}) 핵심 시각 7곳 모두 그려짐`, bad.length === 0, bad.join(' | '));
    const same = await p.evaluate(() => { window.__seek(9.37); const a = document.getElementById('c').toDataURL(); window.__seek(2); window.__seek(9.37); return a === document.getElementById('c').toDataURL(); });
    check(`미리 보기(${tag}) 같은 시각은 같은 그림(결정적)`, same);
    await ctx.close();
  }

  // ----- 2) 첫 방문: 전체 화면 인트로 → 건너뛰기 → 카드 -----
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage(); watch(p);
  await p.goto(BASE);
  await p.waitForFunction(() => window.__pai && window.__pai.state === 'play', null, { timeout: 30000 });
  const full = await p.evaluate(() => { const r = document.getElementById('paiCanvas').getBoundingClientRect(); return r.width === innerWidth && r.height === innerHeight; });
  check('첫 방문: 인트로가 화면 전체로 재생', full && await p.evaluate(() => document.documentElement.classList.contains('pai-play')));
  await p.waitForTimeout(1200);
  const s1 = await p.evaluate(inkStats(), '#paiCanvas');
  check('재생 중 캔버스가 비어 있지 않음', s1.ink > 0.002, JSON.stringify(s1));
  check('건너뛰기 버튼 보임', await p.isVisible('#paiSkip'));
  const layoutTop = () => { let e = document.querySelector('.grid'), y = 0; while (e) { y += e.offsetTop; e = e.offsetParent; } return y; };   // 변환(살짝 올라오기) 말고 실제 배치
  const cardBefore = await p.evaluate(layoutTop);
  await p.click('#paiSkip');
  await p.waitForFunction(() => window.__pai.state === 'hero', null, { timeout: 5000 });
  await p.waitForTimeout(1300);
  const after = await p.evaluate((f) => ({ top: new Function('return (' + f + ')()')(), op: getComputedStyle(document.querySelector('main')).opacity, seen: sessionStorage.getItem('pai-intro-seen'), hero: document.getElementById('paiCanvas').getBoundingClientRect().height }), layoutTop.toString());
  check('건너뛰기 → 카드가 보임(불투명)', after.op === '1', JSON.stringify(after));
  check('카드 자리가 움직이지 않음(레이아웃 이동 없음)', Math.abs(after.top - cardBefore) < 1, cardBefore + ' → ' + after.top);
  check('로고가 위쪽 자리(첫 화면 머리)로 들어감', after.hero > 150 && after.hero < 400, after.hero);
  const s2 = await p.evaluate(inkStats(), '#paiCanvas');
  check('위쪽 로고가 그려짐', s2.ink > 0.01, JSON.stringify(s2));
  check('세션에 본 것으로 기록', after.seen === '1');
  check('다시 보기 버튼 보임', await p.isVisible('#paiReplay'));
  // 다시 보기 → 재생 → Esc로 건너뛰기
  await p.click('#paiReplay');
  check('다시 보기 → 다시 재생', await p.waitForFunction(() => window.__pai.state === 'play' && document.documentElement.classList.contains('pai-play'), null, { timeout: 3000 }).then(() => true, () => false));
  await p.keyboard.press('Escape');
  check('Esc로 건너뛰기', await p.waitForFunction(() => window.__pai.state === 'hero', null, { timeout: 5000 }).then(() => true, () => false));
  // 같은 탭 재방문: 바로 정지 화면
  await p.reload(); await p.waitForFunction('window.__ready', null, { timeout: 30000 });
  check('같은 탭 재방문: 재생 없이 로고 + 카드', await p.evaluate(() => window.__pai.state === 'hero' && !document.documentElement.classList.contains('pai-play') && getComputedStyle(document.querySelector('main')).opacity === '1'));
  // 카드 링크
  const links = await p.$$eval('.kit a', (as) => [...new Set(as.map((a) => a.getAttribute('href')))]);
  const need = ['robodog/', 'ponybot/', 'sim/?kit=ponybot', 'ai.html', 'docs/', 'sim/', 'ai.html?kit=ponybot', 'lessons/?l=ponybot_4차시'];
  // 운영(Netlify)은 'pretty URLs'로 ai.html 을 /ai 로 바꿔 내보냄 — 같은 페이지로 봄(열리는지는 아래에서 따로 확인)
  const norm = (h) => h.replace(/^\/ai(?=$|\?)/, 'ai.html');
  check('카드 링크 갖춤(로보독·포니봇·포니봇 시뮬레이터·AI 브리지·수업)', need.every((h) => links.map(norm).includes(h)), JSON.stringify(links));
  const broken = [];
  for (const h of [...links, 'lessons/', 'assets/intro/physical-ai.mp4', 'ponybot/assets/official/material-pony-v2.webp']) { const r = await p.request.get(BASE + h); if (!r.ok()) broken.push(h + ' ' + r.status()); }
  check('카드·영상·사진 링크가 모두 열림', broken.length === 0, broken.join(', '));
  const pony = await p.evaluate(() => { const i = [...document.querySelectorAll('.kit img')].find((x) => x.src.includes('material-pony-v2')); return i && i.complete && i.naturalWidth > 0 && getComputedStyle(i).objectFit; });
  check('포니봇 카드: 공식 제품 그림(contain)', pony === 'contain', String(pony));
  await ctx.close();

  // ----- 3) 움직임 줄이기: 재생 없이 정지 로고 -----
  const rm = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const p3 = await rm.newPage(); watch(p3); await p3.goto(BASE); await p3.waitForFunction('window.__ready', null, { timeout: 30000 });
  check('움직임 줄이기: 재생하지 않고 정지 로고', await p3.evaluate(() => window.__pai.state === 'hero' && !document.documentElement.classList.contains('pai-play')));
  const s3 = await p3.evaluate(inkStats(), '#paiCanvas'); check('움직임 줄이기: 로고가 그려짐', s3.ink > 0.01, JSON.stringify(s3));
  await rm.close();

  // ----- 4) 휴대폰 390px: 가로 스크롤 없음(재생 중·카드) -----
  const mo = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p4 = await mo.newPage(); watch(p4); await p4.goto(BASE);
  await p4.waitForFunction(() => window.__pai && window.__pai.state === 'play', null, { timeout: 30000 });
  await p4.waitForTimeout(800);
  const sw1 = await p4.evaluate(() => document.documentElement.scrollWidth);
  await p4.tap('#paiSkip'); await p4.waitForFunction(() => window.__pai.state === 'hero', null, { timeout: 5000 }); await p4.waitForTimeout(1300);
  const m = await p4.evaluate(() => { const r = document.getElementById('paiReplay').getBoundingClientRect(), c = document.getElementById('paiCanvas'); return { sw: document.documentElement.scrollWidth, iw: innerWidth, rb: r.right, dpr: c.width / c.clientWidth }; });
  check('390px: 가로 스크롤 없음(재생 중·카드)', sw1 <= 390 && m.sw <= m.iw, JSON.stringify({ sw1, ...m }));
  check('390px: 캔버스 해상도 상한 2배', m.dpr <= 2.01, m.dpr);
  await mo.close();

  // ----- 5) mp4 -----
  const mp = path.join(__dirname, '../bridge/assets/intro/physical-ai.mp4');
  const ok = fs.existsSync(mp) && fs.statSync(mp).size;
  check('인트로 영상 physical-ai.mp4 있음(6MB 이하)', ok > 2e5 && ok <= 6.5e6, ok ? (ok / 1e6).toFixed(2) + 'MB' : '없음');

  check('콘솔 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  const pass = results.filter(Boolean).length;
  console.log(`\n${pass}/${results.length} 통과`);
  process.exit(pass === results.length ? 0 : 1);
})();
