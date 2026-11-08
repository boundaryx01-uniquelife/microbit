// 소개 페이지·수업 자료 페이지 시험: node tests/intro-docs.js [기본주소]
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
  // 첫 화면(포스터)이 3D보다 먼저 보이고, 첫 프레임이 그려지기 전에는 시간이 흐르지 않는다
  await p.addInitScript(() => {
    window.__tm = { ready: 0, img: 0, maxT: 0 };
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.getElementById('stage'), im = document.querySelector('#poster img'); if (!st || !im) return;
      const done = () => { if (!window.__tm.img) { window.__tm.img = performance.now(); window.__tm.imgOk = im.naturalWidth > 100 && getComputedStyle(document.getElementById('poster')).opacity === '1' && !st.classList.contains('ready'); window.__tm.cap = document.getElementById('capText').textContent; } };
      if (im.complete && im.naturalWidth) done(); else im.addEventListener('load', done);
      new MutationObserver(() => { if (st.classList.contains('ready') && !window.__tm.ready) window.__tm.ready = performance.now(); }).observe(st, { attributes: true });
      const iv = setInterval(() => { const e = window.__intro; if (e && !window.__tm.ready) window.__tm.maxT = Math.max(window.__tm.maxT, e.state().t); if (window.__tm.ready) clearInterval(iv); }, 20);
    });
  });
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__tm.img > 0, null, { timeout: 15000 });
  const first = await p.evaluate(() => ({ ok: window.__tm.imgOk, cap: window.__tm.cap }));
  check('포스터 그림은 장식(aria-hidden)으로 일관', await p.evaluate(() => document.getElementById('poster').getAttribute('aria-hidden') === 'true' && document.querySelector('#poster img').getAttribute('alt') === ''));
  check('포스터와 함께 첫 자막이 바로 보임', first.cap.includes('할아버지'), first.cap);
  check('첫 화면 그림(포스터)이 3D보다 먼저 바로 보임', first.ok === true, JSON.stringify(first));
  await p.waitForFunction(() => window.__tm.ready > 0, null, { timeout: 90000 });
  const tm = await p.evaluate(() => window.__tm);
  check('포스터가 3D 첫 프레임보다 먼저 나옴', tm.img <= tm.ready, JSON.stringify(tm));
  check('첫 프레임이 그려지기 전에는 영상 시간이 0', tm.maxT === 0, JSON.stringify(tm));
  // 열면 바로 자동 재생: 자막이 나오고 3D 무대가 켜진다
  await p.waitForFunction(() => document.getElementById('capText').textContent.length > 0, null, { timeout: 60000 });
  check('열면 바로 자막이 나옴(자동 재생)', (await p.textContent('#capText')).length > 3);
  check('3D 무대가 켜짐(그래픽 가속)', await p.evaluate(() => document.getElementById('stage').classList.contains('ready') && !!document.querySelector('#stage3d canvas')));
  check('장면 진행 막대(버튼) 8개', (await p.$$('#segs button')).length === 8 && (await p.$$('#segs i')).length === 8);
  check('재생 중에는 시작 카드가 숨어 있음', !(await p.evaluate(() => document.getElementById('stage').classList.contains('ended'))));
  check('스크롤 없는 한 화면', await p.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth));
  // 시간은 실제 시간대로 흐름(느린 기기에서도 슬로모션이 되지 않음)
  const w0 = await p.evaluate(() => ({ t: window.__intro.state().t, now: performance.now() }));
  await p.waitForTimeout(2500);
  const w1 = await p.evaluate(() => ({ t: window.__intro.state().t, now: performance.now() }));
  const ratio = (w1.t - w0.t) / ((w1.now - w0.now) / 1000);
  check('영상 시간이 실제 시간만큼 흐름(건너뛰며 따라잡음)', ratio > 0.8 && ratio < 1.3, 'ratio ' + ratio.toFixed(2));

  // ----- 조절 막대 -----
  await p.evaluate(() => window.__intro.seek(2));   // 처음 부근으로(느린 화면에서 영상이 끝나 버리지 않게)
  await p.click('#playB'); await p.waitForTimeout(200);
  const pa = await p.evaluate(() => window.__intro.state().t); await p.waitForTimeout(900);
  const pb = await p.evaluate(() => window.__intro.state().t);
  check('[일시정지] 누르면 시간이 멈춤', Math.abs(pb - pa) < 1e-6 && (await p.getAttribute('#playB', 'aria-label')) === '재생', pa + ' vs ' + pb);
  await p.click('#playB');
  check('[재생] 누르면 다시 흐름', await p.waitForFunction((x) => window.__intro.state().t > x + 0.3, pb, { timeout: 20000 }).then(() => true, () => false));
  await p.click('#playB');   // 이후 장면 이동 시험은 멈춘 채로(느린 화면에서도 흔들리지 않게)
  await p.click('#segs button:nth-child(5)'); await p.waitForTimeout(150);
  let st = await p.evaluate(() => window.__intro.state());
  check('장면 막대를 누르면 그 장면으로 이동(5번)', st.scene === 4 && st.t >= 18.5 && st.t < 20, JSON.stringify(st));
  check('이동하면 자막도 바뀜', await p.waitForFunction(() => document.getElementById('capText').textContent.includes('AI가 배웠어요'), null, { timeout: 3000 }).then(() => true, () => false));
  await p.click('#prevB'); await p.waitForTimeout(150);
  st = await p.evaluate(() => window.__intro.state()); check('[이전 장면]', st.scene === 3, JSON.stringify(st));
  await p.click('#nextB'); await p.click('#nextB'); await p.waitForTimeout(150);
  st = await p.evaluate(() => window.__intro.state()); check('[다음 장면]', st.scene === 5, JSON.stringify(st));
  // 자막 켜기/끄기, 읽어 주는 영역은 장면마다 한 번만 갱신
  check('자막이 처음엔 켜져 있음', await p.isVisible('#capText') && (await p.getAttribute('#ccB', 'aria-pressed')) === 'true');
  await p.click('#ccB'); check('[자막] 끄면 자막이 사라짐', !(await p.isVisible('#capText')) && (await p.getAttribute('#ccB', 'aria-pressed')) === 'false');
  await p.click('#ccB'); check('[자막] 다시 켜면 보임', await p.isVisible('#capText'));
  await p.evaluate(() => { window.__srN = 0; new MutationObserver(() => window.__srN++).observe(document.getElementById('sr'), { childList: true, characterData: true, subtree: true }); });
  await p.click('#segs button:nth-child(2)'); await p.waitForTimeout(100);
  await p.click('#segs button:nth-child(2)'); await p.waitForTimeout(100);
  await p.waitForTimeout(500);
  const srN = await p.evaluate(() => window.__srN);
  check('낭독 영역(aria-live)은 같은 장면에서 다시 읽지 않음', srN === 1, 'updates ' + srN);
  check('보이는 자막은 스크린리더에서 숨김(중복 낭독 방지)', await p.evaluate(() => document.getElementById('capText').getAttribute('aria-hidden') === 'true' && !document.getElementById('cap').hasAttribute('aria-live') && document.getElementById('sr').getAttribute('aria-live') === 'polite'));
  // 소리: 기본 꺼짐, 켜고 끌 수 있음(지원하지 않는 기기에서는 버튼이 숨음)
  check('소리는 기본 꺼짐', (await p.getAttribute('#sndB', 'aria-pressed')) === 'false' && (await p.textContent('#sndL')).includes('소리 켜기'));
  if (await p.isVisible('#sndB')) {
    await p.click('#sndB'); const on = await p.getAttribute('#sndB', 'aria-pressed'); await p.click('#sndB'); const off = await p.getAttribute('#sndB', 'aria-pressed');
    check('[소리 켜기] 켜고 끌 수 있음', on === 'true' && off === 'false', on + '/' + off);
  } else check('소리 미지원 기기에서는 버튼이 숨음', true);

  // ----- 장면이 잘리지 않음: 세로(0.46)·가로(16:9)·초와이드(2.4) -----
  for (const [w, h] of [[390, 844], [1280, 720], [1920, 800]]) {
    const c2 = await b.newContext({ viewport: { width: w, height: h } }); const q = await c2.newPage(); watch(q);
    await q.goto(BASE + '?q=0'); await q.waitForFunction(() => window.__intro && document.getElementById('stage').classList.contains('ready'), null, { timeout: 90000 });
    await q.evaluate(() => window.__intro.pause());
    const bad = [];
    const times = []; for (let sI = 0; sI < 8; sI++) { const a = [0, 3.5, 7, 12, 18.5, 24, 27.5, 31.5][sI], e = [3.5, 7, 12, 18.5, 24, 27.5, 31.5, 35][sI]; times.push(a + 1.2, (a + e) / 2, e - 0.05); }
    for (const t of times) {
      const r = await q.evaluate((t) => { window.__intro.seek(t); return window.__intro.frameInfo(); }, t);
      const lo = -1 + 2 * r.bottom - 0.03, hi = 1 - 2 * r.top + 0.03;
      if (r.x0 < -1.001 || r.x1 > 1.001 || r.y0 < lo || r.y1 > hi) bad.push(`${t.toFixed(1)}s x[${r.x0.toFixed(2)},${r.x1.toFixed(2)}] y[${r.y0.toFixed(2)},${r.y1.toFixed(2)}] 허용[${lo.toFixed(2)},${hi.toFixed(2)}]`);
    }
    check(`${w}x${h}: 장면마다 꼭 보여야 할 물건이 화면 안에 다 들어옴(${times.length}곳)`, bad.length === 0, bad.slice(0, 4).join(' | '));
    check(`${w}x${h}: 가로 스크롤 없음`, await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth));
    check(`${w}x${h}: 조절 버튼이 화면 안`, await q.evaluate(() => [...document.querySelectorAll('#ctl button')].filter(x => !x.hidden).every(x => { const r = x.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.width >= 36 && r.height >= 36; })));
    if (w < 721) {
      const row = await q.evaluate(() => { const bs = [...document.querySelectorAll('#ctl button')].filter(x => !x.hidden), rs = bs.map(x => x.getBoundingClientRect()); return { n: bs.length, oneRow: rs.every(r => Math.abs(r.top - rs[0].top) < 2), min: Math.min(...rs.map(r => Math.min(r.width, r.height))), labeled: bs.every(x => x.getAttribute('aria-label')), titleShown: getComputedStyle(document.querySelector('.title')).display !== 'none', trunc: [...document.querySelectorAll('.top *')].some(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).display !== 'none' && e.clientWidth > 0 && getComputedStyle(e).overflow !== 'visible') }; });
      check(`${w}x${h}: 조절 버튼 ${row.n}개가 한 줄, 44px 이상, 이름표(aria-label) 있음, 잘린 글자 없음`, row.n >= 5 && row.oneRow && row.min >= 44 && row.labeled && !row.titleShown && !row.trunc, JSON.stringify(row));
    }
    check(`${w}x${h}: 장면 3~7에서 할아버지(머리~무릎)가 통째로 보이거나 상자에 포함됨`, await q.evaluate(() => [8.5, 14, 21, 25.5, 29].every(t => { window.__intro.seek(t); const r = window.__intro.frameInfo(); return r.x0 >= -1.001 && r.x1 <= 1.001; })));
    await q.evaluate(() => window.__intro.seek(35)); await q.waitForTimeout(1500);
    const endR = await q.evaluate(() => { const f = document.querySelector('.foot').getBoundingClientRect(), card = document.querySelector('.end-in').getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect(); return { footH: f.height, footB: f.bottom, footFs: parseFloat(getComputedStyle(document.querySelector('.foot')).fontSize), ch: card.height / st.height, links: [...document.querySelectorAll('.cta a')].map(a => { const r = a.getBoundingClientRect(); return r.bottom <= innerHeight && r.top > 0 && r.width > 50; }) }; });
    check(`${w}x${h}: 끝 카드의 링크와 바닥글이 화면 안, 글자 12px 이상`, endR.links.every(Boolean) && endR.footH > 10 && endR.footB <= h && endR.footFs >= 12, JSON.stringify(endR));
    check(`${w}x${h}: 끝 카드에 학생 링크(수업 코드)가 보임`, await q.evaluate(() => { const r = document.querySelector('.joinl a').getBoundingClientRect(); return r.width > 50 && r.bottom <= innerHeight && r.top > 0; }));
    check(`${w}x${h}: 끝 카드가 장면을 너무 가리지 않음(${(endR.ch * 100).toFixed(0)}%)`, endR.ch <= (w < 721 ? 0.36 : 0.42), String(endR.ch));
    await c2.close();
  }

  // ----- 움직임 줄이기: 그림 한 장씩 + 이전/다음 -----
  const rm = await b.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } });
  const p3 = await rm.newPage(); watch(p3); await p3.goto(BASE);
  await p3.waitForFunction(() => document.getElementById('stage').classList.contains('ready'), null, { timeout: 90000 }); await p3.waitForTimeout(800);
  const r0 = await p3.evaluate(() => ({ ...window.__intro.state(), ended: document.getElementById('stage').classList.contains('ended'), playHidden: document.getElementById('playB').hidden }));
  await p3.waitForTimeout(1200); const r1 = await p3.evaluate(() => window.__intro.state().t);
  check('움직임 줄이기: 자동으로 움직이지 않고 첫 장면 그림만 보임', !r0.ended && r0.playHidden && r0.scene === 0 && Math.abs(r1 - r0.t) < 1e-6, JSON.stringify(r0));
  await p3.click('#nextB'); await p3.waitForTimeout(150);
  check('움직임 줄이기: [다음]으로 한 장면씩 넘김', (await p3.evaluate(() => window.__intro.state().scene)) === 1 && (await p3.textContent('#capText')).includes('로보독'));
  for (let i = 0; i < 7; i++) await p3.click('#nextB');
  await p3.waitForTimeout(700);
  check('움직임 줄이기: 끝까지 넘기면 시작 카드', await p3.evaluate(() => document.getElementById('stage').classList.contains('ended')));
  await p3.click('#prevB'); await p3.waitForTimeout(300);
  check('움직임 줄이기: [이전]으로 돌아오면 시작 카드가 닫힘', !(await p3.evaluate(() => document.getElementById('stage').classList.contains('ended'))));

  const nogl = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await nogl.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  const p4 = await nogl.newPage(); await p4.goto(BASE); await p4.waitForTimeout(1000);
  check('그래픽 가속이 없어도 안내 문구와 시작 카드가 보임', await p4.evaluate(() => getComputedStyle(document.getElementById('nogl')).display !== 'none' && document.getElementById('stage').classList.contains('ended')));

  // ----- 머리말(공유 미리보기) 와 그림 파일 -----
  const meta = await p.evaluate(() => { const g = (s) => (document.querySelector(s) || {}).content || ''; return { ogt: g('meta[property="og:title"]'), ogd: g('meta[property="og:description"]'), ogi: g('meta[property="og:image"]'), tc: g('meta[name="twitter:card"]'), th: g('meta[name="theme-color"]'), ti: g('meta[name="twitter:image"]') }; });
  check('og:title·og:description·og:image·twitter:card·theme-color 있음', meta.ogt && meta.ogd && /^https:\/\/.+\/assets\/intro\/og\.png$/.test(meta.ogi) && meta.tc === 'summary_large_image' && /^#[0-9a-f]{6}$/i.test(meta.th) && meta.ti === meta.ogi, JSON.stringify(meta));
  const ogb = fs.readFileSync(require('path').join(__dirname, '../bridge/assets/intro/og.png'));
  check('og.png는 1200x630 PNG', ogb.readUInt32BE(16) === 1200 && ogb.readUInt32BE(20) === 630 && ogb.slice(1, 4).toString() === 'PNG', ogb.length + 'B');
  const ps = ['poster-wide.webp', 'poster-tall.webp'].map(f => fs.statSync(require('path').join(__dirname, '../bridge/assets/intro/' + f)).size);
  check('포스터 그림이 각각 150KB 이하', ps.every(x => x > 1000 && x <= 150 * 1024), ps.join(','));

  // ----- 느린 기기: 화질을 자동으로 낮춤 -----
  const slow = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p5 = await slow.newPage(); watch(p5); await p5.goto(BASE);
  await p5.waitForFunction(() => window.__intro && document.getElementById('stage').classList.contains('ready'), null, { timeout: 90000 });
  await p5.waitForFunction(() => window.__intro.state().level >= 1, null, { timeout: 60000 }).catch(() => {});
  const lv = await p5.evaluate(() => window.__intro.state().level);
  check('프레임이 느리면 화질(해상도·그림자)을 자동으로 낮춤', lv >= 1, 'level ' + lv);

  // ----- 같은 탭 새로고침 / 건너뛰기 / 다시 보기 -----
  await p.click('#skip'); await p.waitForTimeout(1500);
  const fin = await p.evaluate(() => [...document.querySelectorAll('.cta a')].map(a => ({ bottom: a.getBoundingClientRect().bottom, w: a.getBoundingClientRect().width })));
  check('[건너뛰기] → 시작 카드 링크 3개가 보임', fin.length === 3 && fin.every(f => f.w > 50), JSON.stringify(fin));
  check('노트북(768) 한 화면 안에 버튼', fin.every(f => f.bottom <= 768), JSON.stringify(fin));
  const hrefs = await p.$$eval('.cta a', as => as.map(a => a.href));
  check('[다시 보기] → 처음부터 다시 재생', await p.evaluate(() => { document.getElementById('replay').click(); return !document.getElementById('stage').classList.contains('ended') && window.__intro.state().t < 3; }));
  await p.reload(); await p.waitForFunction(() => document.getElementById('stage').classList.contains('ready'), null, { timeout: 90000 }); await p.waitForTimeout(800);
  check('같은 탭에서 새로고침하면 영상을 건너뛰고 시작 카드', await p.evaluate(() => document.getElementById('stage').classList.contains('ended')));

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
