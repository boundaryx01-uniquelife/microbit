// 첫 화면(첫 산책 영상 + 엔딩 모션)·수업 자료 페이지 시험: node tests/intro-docs.js [기본주소]
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${ok ? '' : detail}`); };
const fs = require('fs');
const LAUNCH = { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };
const noise = (t) => /GL Driver|GPU stall|WebGL/i.test(t);
(async () => {
  const b = await chromium.launch(LAUNCH);
  const errs = [];
  const watch = (p) => { p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !noise(m.text())) errs.push(m.text()); }); };
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage(); watch(p);
  const cls = (q, c) => q.evaluate((c) => document.getElementById('stage').classList.contains(c), c);
  // ----- 첫 화면: '로보독의 첫 산책' 영상이 열자마자 재생 -----
  await p.goto(BASE);
  await p.waitForFunction(() => window.__story && window.__outro && document.getElementById('stage').classList.contains('ready'), null, { timeout: 120000 });
  await p.waitForFunction(() => document.getElementById('capText').textContent.length > 0, null, { timeout: 60000 });
  check('열면 바로 자막이 나옴(자동 재생)', (await p.textContent('#capText')).length > 3);
  check('3D 무대가 켜짐(그래픽 가속)', await p.evaluate(() => !!document.querySelector('#stage3d canvas')));
  check('자막 진행 막대 8개', (await p.$$('#segs i')).length === 8);
  check('재생 중에는 시작 카드·엔딩이 숨어 있음', !(await cls(p, 'ended')) && !(await cls(p, 'outro')));
  check('스크롤 없는 한 화면', await p.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth));

  // ----- 영상이 끝나면 엔딩 모션이 마지막 화면을 이어받아 재생 → 시작 카드 -----
  await p.evaluate(() => { window.__story.seek(0, 29.95); window.__outro.endNow(); });   // 마지막 프레임을 그린 직후 끝 처리(실제 끝과 같은 순서)
  check('영상이 끝나면 엔딩 모션이 시작되고 자막은 물러남', await cls(p, 'outro') && !(await cls(p, 'ended')) && await p.evaluate(() => window.__outro.api.running));
  check('엔딩 중에도 [건너뛰기]가 보임', await p.isVisible('#skip'));
  const px0 = await p.evaluate(() => { const c = document.getElementById('outro'), x = c.getContext('2d').getImageData(c.width >> 1, c.height >> 2, 1, 1).data; return x[0] + x[1] + x[2]; });
  check('엔딩 첫 화면은 비어 있지 않음(마지막 화면을 이어받음)', px0 > 30, String(px0));
  await p.waitForFunction(() => document.getElementById('stage').classList.contains('ended'), null, { timeout: 30000 });
  check('엔딩 본편(8.2초)이 끝나면 시작 카드가 나옴', await p.evaluate(() => window.__outro.api.time >= 8.2));
  await p.waitForTimeout(1500);
  const fin = await p.evaluate(() => [...document.querySelectorAll('.cta a')].map(a => ({ bottom: a.getBoundingClientRect().bottom, w: a.getBoundingClientRect().width })));
  check('시작 카드 링크 3개가 보임', fin.length === 3 && fin.every(f => f.w > 50), JSON.stringify(fin));
  check('노트북(768) 한 화면 안에 버튼', fin.every(f => f.bottom <= 768), JSON.stringify(fin));
  const moon = await p.evaluate(() => { const c = document.getElementById('outro'), card = document.querySelector('.end-in').getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect();
    const k = c.width / st.width, y = Math.round((card.top - st.top) * k * 0.5), row = c.getContext('2d').getImageData(0, y, c.width, 1).data;
    let bright = 0; for (let i = 0; i < row.length; i += 4) if (row[i] > 200 && row[i + 1] > 190) bright++;
    return { bright, edge: row[0] + row[1] + row[2] }; });   // 가운데 줄: 머리 양옆으로 달이 보이고, 가장자리는 밤하늘
  check('카드 위 빈자리에 보름달 + 로보독(엔딩이 카드 뒤 배경으로 남음)', moon.bright > 20 && moon.edge < 400, JSON.stringify(moon));
  const hrefs = await p.$$eval('.cta a', as => as.map(a => a.href));
  check('[다시 보기] → 처음부터 다시 재생, 엔딩 닫힘', await p.evaluate(() => { document.getElementById('replay').click(); return !document.getElementById('stage').classList.contains('ended') && !document.getElementById('stage').classList.contains('outro') && window.__story.state().t < 3; }));
  await p.click('#skip'); await p.waitForTimeout(600);
  check('[건너뛰기] → 엔딩 정지 화면 + 시작 카드', await cls(p, 'ended') && await cls(p, 'outro') && !(await p.evaluate(() => window.__outro.api.running)));
  await p.reload(); await p.waitForFunction(() => window.__story && document.getElementById('stage').classList.contains('ended'), null, { timeout: 120000 });
  check('같은 탭에서 새로고침하면 영상을 건너뛰고 시작 카드', await cls(p, 'ended') && await cls(p, 'outro'));

  // ----- 화면 크기별 시작 카드 -----
  for (const [w, h] of [[390, 844], [1280, 720], [1920, 800]]) {
    const c2 = await b.newContext({ viewport: { width: w, height: h } }); const q = await c2.newPage(); watch(q);
    await q.goto(BASE); await q.waitForFunction(() => window.__story && document.getElementById('stage').classList.contains('ready'), null, { timeout: 120000 });
    await q.click('#skip'); await q.waitForTimeout(1200);
    check(`${w}x${h}: 가로 스크롤 없음`, await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth));
    check(`${w}x${h}: 조절 버튼이 화면 안`, await q.evaluate(() => [...document.querySelectorAll('.ctl button')].filter(x => !x.hidden).every(x => { const r = x.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.height >= 36; })));
    const endR = await q.evaluate(() => { const f = document.querySelector('.foot'), fr = f.getBoundingClientRect(); return { footB: fr.bottom, footFs: parseFloat(getComputedStyle(f).fontSize), footShown: fr.height > 0, links: [...document.querySelectorAll('.cta a')].map(a => { const r = a.getBoundingClientRect(); return r.bottom <= innerHeight && r.top > 0 && r.width > 50; }) }; });
    check(`${w}x${h}: 시작 카드 링크가 화면 안, 바닥글 12px 이상`, endR.links.every(Boolean) && (!endR.footShown || (endR.footB <= h && endR.footFs >= 12)), JSON.stringify(endR));
    check(`${w}x${h}: 시작 카드에 학생 링크(수업 코드)가 보임`, await q.evaluate(() => { const r = document.querySelector('.joinl a').getBoundingClientRect(); return r.width > 50 && r.bottom <= innerHeight && r.top > 0; }));
    await c2.close();
  }

  // ----- 움직임 줄이기: 영상 없이 엔딩 정지 화면 + 시작 카드 -----
  const rm = await b.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } });
  const p3 = await rm.newPage(); watch(p3); await p3.goto(BASE);
  await p3.waitForFunction(() => window.__story && document.getElementById('stage').classList.contains('ended'), null, { timeout: 120000 });
  check('움직임 줄이기: 바로 시작 카드(엔딩 정지 화면)', await cls(p3, 'ended') && await cls(p3, 'outro') && !(await p3.evaluate(() => window.__outro.api.running)));

  const nogl = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await nogl.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  const p4 = await nogl.newPage(); await p4.goto(BASE); await p4.waitForTimeout(1500);
  check('그래픽 가속이 없어도 안내 문구와 시작 카드가 보임', await p4.evaluate(() => getComputedStyle(document.getElementById('nogl')).display !== 'none' && document.getElementById('stage').classList.contains('ended')));

  // ----- 머리말(공유 미리보기) 와 그림 파일 -----
  const meta = await p.evaluate(() => { const g = (s) => (document.querySelector(s) || {}).content || ''; return { ogt: g('meta[property="og:title"]'), ogd: g('meta[property="og:description"]'), ogi: g('meta[property="og:image"]'), tc: g('meta[name="twitter:card"]'), th: g('meta[name="theme-color"]'), ti: g('meta[name="twitter:image"]') }; });
  check('og:title·og:description·og:image·twitter:card·theme-color 있음', meta.ogt && meta.ogd && /^https:\/\/.+\/assets\/intro\/og\.png$/.test(meta.ogi) && meta.tc === 'summary_large_image' && /^#[0-9a-f]{6}$/i.test(meta.th) && meta.ti === meta.ogi, JSON.stringify(meta));
  const ogb = fs.readFileSync(require('path').join(__dirname, '../bridge/assets/intro/og.png'));
  check('og.png는 1200x630 PNG', ogb.readUInt32BE(16) === 1200 && ogb.readUInt32BE(20) === 630 && ogb.slice(1, 4).toString() === 'PNG', ogb.length + 'B');
  const lf = fs.statSync(require('path').join(__dirname, '../bridge/assets/intro/veo-last.webp')).size;
  check('엔딩 미리 보기 시작 그림이 150KB 이하', lf > 1000 && lf <= 150 * 1024, String(lf));

  for (const h of hrefs) { const r = await p.request.get(h); check('링크 열림: ' + h.replace(BASE, '/'), r.ok(), r.status()); }

  // 수업 자료
  await p.goto(BASE + 'docs/');
  const docLinks = await p.$$eval('a', as => [...new Set(as.map(a => a.href).filter(h => h.includes('/docs/')))]);
  const bad = [];
  for (const h of docLinks) { const r = await p.request.get(h); if (!r.ok()) bad.push(h + ' ' + r.status()); }
  check(`수업 자료 링크 ${docLinks.length}개 모두 열림`, bad.length === 0 && docLinks.length >= 18, bad.join(', '));
  const ts = await p.request.get(BASE + 'docs/makecode/03_ai-traffic-dog.ts');
  check('예제 .ts 내려받기(글자 파일)', ts.ok() && (await ts.text()).includes('robodog.'));
  await p.goto(BASE + 'docs/01.html');
  check('물결표가 취소선으로 바뀌지 않음', (await p.$$('del')).length === 0 && (await p.textContent('main')).includes('5~6학년'));
  const ext = await p.$$eval('a[href^="http"]', as => as.map(a => a.getAttribute('href')).filter(h => /\)|%E[A-F]/i.test(h)));
  check('깨진 외부 링크 없음', ext.length === 0, ext.join(', '));
  await p.emulateMedia({ media: 'print' });
  check('인쇄할 때 머리 메뉴 숨김', await p.isHidden('header'));
  check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close();
  const fail = results.filter(x => !x).length;
  console.log(`\n${results.length - fail}/${results.length} PASS`);
  process.exit(fail ? 1 : 0);
})();
