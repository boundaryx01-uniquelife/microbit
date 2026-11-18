// 시뮬레이터 반응형 시험(좁은 화면: 편집기와 무대가 한 화면 / 넓은 화면: 무대 고정·확대 / 가로 넘침 없음 / 터치 44px):
//   node tests/sim-responsive.js [기본주소]   (Range 지원 서버 필요: node .claude/skills/microbit-kit-site/scripts/rangeserve.js bridge 8765)
const { chromium, devices } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const SHOT = process.env.SHOT_DIR || '';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${ok ? '' : detail}`); };
const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const rect = (p, sel) => p.evaluate(s => { const e = [...document.querySelectorAll(s)].find(x => x.getBoundingClientRect().height > 0); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, w: r.width, h: r.height, vy: r.y }; }, sel);
const small = (p, sels, min) => p.evaluate(([sels, min]) => sels.flatMap(s => [...document.querySelectorAll(s)].filter(e => e.offsetParent && !e.closest('[hidden]')).map(e => { const r = e.getBoundingClientRect(); return r.height < min - 0.5 && r.height > 0 ? `${s}:${Math.round(r.height)}` : null; }).filter(Boolean)), [sels, min]);
const sizes = [
  ['iPhone13-세로', devices['iPhone 13'], 'narrow'],
  ['iPad-세로', devices['iPad (gen 7)'], 'narrow'],
  ['iPad-가로', { ...devices['iPad (gen 7) landscape'] }, 'wide'],
  ['PC1440x900', { viewport: { width: 1440, height: 900 } }, 'wide'],
  ['칠판1920x1080', { viewport: { width: 1920, height: 1080 } }, 'wide'],
];
(async () => {
  const b = await chromium.launch({ args: ARGS });
  for (const [name, dev, kind] of sizes) {
    for (const kit of ['robodog', 'ponybot']) {
      const ctx = await b.newContext(dev); const p = await ctx.newPage();
      const errs = []; p.on('pageerror', e => { if (!/makecode\.(com|microbit\.org)/.test(e.stack || '')) errs.push(e.message); });
      await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false}' }));
      await p.goto(BASE + 'sim/?kit=' + kit); await p.waitForTimeout(1500);
      const tag = `${name} ${kit}`;
      const vw = p.viewportSize(), vh = vw.height;
      const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      check(`${tag}: 가로 스크롤 없음`, sw[0] <= sw[1], `${sw[0]}>${sw[1]}`);
      const ed = await rect(p, '#mcWrap .frame') || await rect(p, '#code');
      const st = await rect(p, '#view3d, #top2d');
      if (SHOT) await p.screenshot({ path: `${SHOT}/${name}-${kit}-top.png` });
      if (kind === 'narrow') {
        check(`${tag}: 무대가 편집기보다 위(또는 편집기와 700px 이내)`, st && ed && st.y < ed.y + 1 || Math.abs(st.y - ed.y) < 700, `편집기 y=${Math.round(ed.y)} 무대 y=${Math.round(st.y)}`);
        // 편집기까지 스크롤한 뒤에도 무대가 화면에 보이는지
        await p.evaluate(y => scrollTo(0, y - 80), ed.y); await p.waitForTimeout(300);
        const st2 = await rect(p, '#view3d, #top2d'), ed2 = await rect(p, '#mcWrap .frame');
        const both = st2.vy + st2.h > 40 && st2.vy < vh - 100 && ed2.vy < vh - 150;
        check(`${tag}: 편집기로 스크롤해도 무대가 같이 보임`, both, `무대 vy=${Math.round(st2.vy)} h=${Math.round(st2.h)} 편집기 vy=${Math.round(ed2.vy)}`);
        check(`${tag}: 무대 높이 ≤ 화면 ${Math.round(vh * 0.40)}px`, st2.h <= vh * 0.40 + 2, `h=${Math.round(st2.h)}`);
        if (SHOT) await p.screenshot({ path: `${SHOT}/${name}-${kit}-editor.png` });
      } else {
        await p.evaluate(() => scrollTo(0, 1100)); await p.waitForTimeout(300);
        const st2 = await rect(p, '#view3d, #top2d');
        check(`${tag}: 아래로 스크롤해도 무대가 화면에 남음`, st2.vy >= -2 && st2.vy < vh - 100, `vy=${Math.round(st2.vy)}`);
        if (SHOT) await p.screenshot({ path: `${SHOT}/${name}-${kit}-scrolled.png` });
        if (vw.width >= 1600) check(`${tag}: 넓은 화면에서 무대가 440px보다 큼`, st.w > 480, `w=${Math.round(st.w)}`);
        const bt = await p.evaluate(() => ['btnRun', 'btnStop', 'btnReset'].map(i => { const r = document.getElementById(i).getBoundingClientRect(); return Math.round(r.y); }));
        check(`${tag}: 실행·정지·처음으로 한 줄`, Math.max(...bt) - Math.min(...bt) < 6, bt.join(','));
      }
      if (dev.hasTouch || dev.isMobile) {
        const bad = await small(p, ['header .gnb nav a', '#btnRun', '#btnStop', '#btnReset', '#examples', 'label:has(>input[type=checkbox])', '.tabs button'], 44);
        check(`${tag}: 터치 대상 44px 이상`, bad.length === 0, bad.join(' '));
      }
      check(`${tag}: 페이지 오류 없음`, errs.length === 0, errs.join(' | '));
      await ctx.close();
    }
  }
  // ?ex 처리
  const c2 = await b.newContext({ viewport: { width: 1280, height: 800 } }); const q = await c2.newPage();
  await q.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false}' }));
  await q.goto(BASE + 'sim/?kit=robodog'); await q.waitForTimeout(800);
  const firstId = await q.evaluate(() => [...document.querySelectorAll('#examples option')].map(o => o.value).filter(Boolean)[0]);
  await q.goto(BASE + 'sim/?kit=robodog&ex=' + firstId); await q.waitForTimeout(1200);
  check('?ex=<id> 이면 예제 목록에 그 예제가 선택돼 보임', (await q.inputValue('#examples')) === firstId, await q.inputValue('#examples'));
  await q.goto(BASE + 'sim/?kit=robodog&ex=nope-zzz'); await q.waitForTimeout(1200);
  check('모르는 ?ex 는 로그에 안내', /nope-zzz/.test(await q.textContent('#log')), (await q.textContent('#log')).slice(0, 100));
  await c2.close();
  await b.close();
  const fail = results.filter(x => !x).length;
  console.log(`\n${results.length - fail}/${results.length} PASS`);
  process.exit(fail ? 1 : 0);
})();
