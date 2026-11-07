// 소개 페이지·수업 자료 페이지 시험: node tests/intro-docs.js [기본주소]
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${ok ? '' : detail}`); };
const opacity = (pg) => pg.evaluate(() => +getComputedStyle(document.querySelector('.cta a')).opacity);
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(BASE);
  const op0 = await opacity(p);
  check('처음에는 버튼이 숨어 있다가(애니메이션)', op0 < 0.5, op0);
  await p.waitForTimeout(6000);
  const fin = await p.evaluate(() => [...document.querySelectorAll('.cta a')].map(a => ({ op: +getComputedStyle(a).opacity, bottom: a.getBoundingClientRect().bottom })));
  check('6초 뒤 버튼 3개가 보임', fin.length === 3 && fin.every(f => f.op > 0.95), JSON.stringify(fin));
  check('노트북(768) 첫 화면 안에 버튼', fin.every(f => f.bottom <= 768), JSON.stringify(fin));

  const ctx2 = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const p2 = await ctx2.newPage(); await p2.goto(BASE);
  await p2.click('#skip'); await p2.waitForTimeout(200);
  check('[건너뛰기] → 바로 끝 화면', (await opacity(p2)) > 0.95);
  const rm = await b.newContext({ reducedMotion: 'reduce' });
  const p3 = await rm.newPage(); await p3.goto(BASE); await p3.waitForTimeout(300);
  check('움직임 줄이기 설정이면 바로 끝 화면', (await opacity(p3)) > 0.95);

  const hrefs = await p.$$eval('.cta a, .sub a', as => as.map(a => a.href));
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
