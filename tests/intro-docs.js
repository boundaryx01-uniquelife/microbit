// 소개 페이지·수업 자료 페이지 시험: node tests/intro-docs.js [기본주소]
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${ok ? '' : detail}`); };
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(BASE);
  // 열면 바로 자동 재생(스크롤 없음): 자막이 나오고 3D 무대가 켜진다
  await p.waitForFunction(() => document.getElementById('capText').textContent.length > 0, null, { timeout: 60000 });
  check('열면 바로 자막이 나옴(자동 재생)', (await p.textContent('#capText')).includes('할아버지'));
  check('3D 무대가 켜짐(그래픽 가속)', await p.evaluate(() => document.getElementById('stage').classList.contains('ready') && !!document.querySelector('#stage3d canvas')));
  check('장면 진행 막대 8개', (await p.$$('#segs i')).length === 8);
  check('재생 중에는 시작 카드가 숨어 있음', !(await p.evaluate(() => document.getElementById('stage').classList.contains('ended'))));
  check('스크롤 없는 한 화면', await p.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1));
  await p.click('#skip'); await p.waitForTimeout(1200);
  const fin = await p.evaluate(() => [...document.querySelectorAll('.cta a')].map(a => ({ bottom: a.getBoundingClientRect().bottom, w: a.getBoundingClientRect().width })));
  check('[건너뛰기] → 시작 카드 링크 3개가 보임', fin.length === 3 && fin.every(f => f.w > 50), JSON.stringify(fin));
  check('노트북(768) 한 화면 안에 버튼', fin.every(f => f.bottom <= 768), JSON.stringify(fin));
  const hrefs = await p.$$eval('.cta a', as => as.map(a => a.href));
  await p.click('#replay'); await p.waitForTimeout(500);
  check('[다시 보기] → 처음부터 다시 재생', await p.evaluate(() => !document.getElementById('stage').classList.contains('ended') && window.__story.state().t < 3));
  await p.reload(); await p.waitForTimeout(2500);
  check('같은 탭에서 새로고침하면 영상을 건너뛰고 시작 카드', await p.evaluate(() => document.getElementById('stage').classList.contains('ended')));

  const rm = await b.newContext({ reducedMotion: 'reduce' });
  const p3 = await rm.newPage(); await p3.goto(BASE); await p3.waitForTimeout(2500);
  check('움직임 줄이기 설정이면 바로 끝 화면(시작 카드)', await p3.evaluate(() => document.getElementById('stage').classList.contains('ended')));
  const nogl = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await nogl.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  const p4 = await nogl.newPage(); await p4.goto(BASE); await p4.waitForTimeout(1000);
  check('그래픽 가속이 없어도 안내 문구와 시작 카드가 보임', await p4.evaluate(() => getComputedStyle(document.getElementById('nogl')).display !== 'none' && document.getElementById('stage').classList.contains('ended')));

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
