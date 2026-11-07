// 웹 슬라이드 뷰어 시험: node tests/lessons-web.js [기본주소]
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const L = BASE + 'lessons/';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${ok ? '' : detail}`); };
(async () => {
  const b = await chromium.launch();
  const errs = [], badImg = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('response', r => { if (r.request().resourceType() === 'image' && !r.ok()) badImg.push(r.url()); });

  await p.goto(L);
  await p.waitForSelector('.lcard');
  check('목록에 2차시가 보임', (await p.textContent('#cards')).includes('2차시'));
  check('목록 카드 링크가 ?l=2차시', (await p.$eval('.lcard', a => decodeURIComponent(a.getAttribute('href')))) === '?l=2차시');

  await p.goto(L + '?l=2차시'); await p.waitForSelector('.slide');
  const total = await p.evaluate(() => window.__lesson.total);
  check('슬라이드 24장 불러옴', total === 24 && (await p.textContent('#counter')).trim() === '1 / 24', await p.textContent('#counter'));
  check('첫 장은 표지', await p.evaluate(() => !!document.querySelector('.slide.t-cover')));
  check('머리 메뉴의 현재 위치 = 수업 자료', (await p.textContent('.gnb nav a[aria-current="page"]')).includes('수업 자료'));
  await p.keyboard.press('ArrowRight');
  check('→ 키로 2장, 주소 #2', (await p.textContent('#counter')).trim() === '2 / 24' && new URL(p.url()).hash === '#2');
  await p.keyboard.press('Space'); await p.keyboard.press('PageDown');
  check('Space·PageDown 으로 4장', new URL(p.url()).hash === '#4');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('PageUp');
  check('← · PageUp 으로 2장', new URL(p.url()).hash === '#2');
  await p.click('#next');
  check('[다음] 버튼', (await p.textContent('#counter')).trim() === '3 / 24');
  await p.selectOption('#chsel', '2');
  check('차시 메뉴로 2차시 첫 장(12)', new URL(p.url()).hash === '#12');
  check('바닥글에 "피지컬 AI 교실 · 2차시"', (await p.textContent('.sf')).includes('피지컬 AI 교실 · 2차시'));

  const p2 = await ctx.newPage();
  await p2.goto(L + '?l=2차시#15'); await p2.waitForSelector('.slide');
  check('#15 주소로 바로 15장', (await p2.textContent('#counter')).trim() === '15 / 24' && (await p2.textContent('.st')).includes('이렇게 연결돼요'));
  check('교사 모드는 처음엔 꺼짐(노트 숨김)', await p2.evaluate(() => document.getElementById('notes').hidden));
  await p2.keyboard.press('n');
  check('N 키 → 비밀번호 창(노트는 아직 숨김)', await p2.isVisible('#pindlg') && await p2.evaluate(() => document.getElementById('notes').hidden));
  await p2.fill('#pin', '1234'); await p2.click('#pinform button[type=submit]');
  check('틀린 비밀번호는 거절', await p2.evaluate(() => document.getElementById('notes').hidden) && (await p2.textContent('#pinmsg')).includes('맞지 않'));
  if (await p2.isVisible('#pindlg')) { await p2.fill('#pin', '0000'); await p2.click('#pinform button[type=submit]'); await p2.waitForSelector('#notes:not([hidden])'); }
  const nt = await p2.textContent('#notesbody');
  check('N 키 → 교사 노트가 보임', await p2.evaluate(() => !document.getElementById('notes').hidden) && nt.includes('초록 카드를 보면 AI가 3번이라고 정하고'), nt);
  await p2.reload(); await p2.waitForSelector('.slide');
  check('교사 모드가 새로고침 후에도 유지', await p2.evaluate(() => !document.getElementById('notes').hidden));
  await p2.click('#teacher');
  check('버튼으로 교사 모드 끄기', await p2.evaluate(() => document.getElementById('notes').hidden));
  await p2.goto(L + '?l=없는수업'); await p2.waitForSelector('#err:not([hidden])');
  check('없는 수업은 안내 문구', (await p2.textContent('#err')).includes('찾지 못'));
  await p2.close();

  // 스와이프(터치)
  const tctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const tp = await tctx.newPage(); tp.on('pageerror', e => errs.push(e.message));
  await tp.goto(L + '?l=2차시#5'); await tp.waitForSelector('.slide');
  await tp.evaluate(() => {
    const w = document.getElementById('stagewrap');
    const ev = (t, x) => { const o = new Touch({ identifier: 1, target: w, clientX: x, clientY: 300 }); w.dispatchEvent(new TouchEvent(t, { changedTouches: [o], touches: t === 'touchend' ? [] : [o], bubbles: true })); };
    ev('touchstart', 300); ev('touchend', 100);
  });
  check('왼쪽으로 밀면 다음 장(휴대폰)', new URL(tp.url()).hash === '#6', tp.url());

  // 모든 장 넘침 검사: 1280x720 과 휴대폰 390x844
  async function sweep(page, label) {
    const bad = [];
    for (let i = 1; i <= total; i++) {
      await page.evaluate(n => window.__lesson.go(n - 1), i);
      await page.waitForTimeout(60);
      const r = await page.evaluate(() => {
        const e = document.querySelector('.sbody'), s = document.querySelector('.slide');
        return { h: e.scrollHeight - e.clientHeight, w: e.scrollWidth - e.clientWidth, sw: s.scrollWidth - s.clientWidth, pw: document.documentElement.scrollWidth - innerWidth };
      });
      if (r.h > 2 || r.w > 2 || r.sw > 2 || r.pw > 2) bad.push(i + ':' + JSON.stringify(r));
    }
    check(`${label}: 24장 모두 넘침 없음`, bad.length === 0, bad.join(' '));
  }
  const pd = await ctx.newPage(); pd.on('pageerror', e => errs.push(e.message));
  await pd.goto(L + '?l=2차시'); await pd.waitForSelector('.slide');
  await sweep(pd, '1280x720');
  await pd.keyboard.press('n'); await sweep(pd, '1280x720 교사 모드');
  await sweep(tp, '390x844 휴대폰');
  // 다른 수업(4차시·8차시)도 넘침·그림 검사
  for (const id of ['4차시', '8차시']) {
    const q = await ctx.newPage(); q.on('pageerror', e => errs.push(id + ': ' + e.message));
    await q.goto(L + '?l=' + encodeURIComponent(id)); await q.waitForSelector('.slide');
    const n = await q.evaluate(() => window.__lesson.total || document.querySelectorAll('.slide').length);
    const bad = [];
    for (let i = 1; i <= n; i++) {
      await q.evaluate(k => window.__lesson.go(k - 1), i); await q.waitForTimeout(40);
      const r = await q.evaluate(() => { const e = document.querySelector('.sbody'), s = document.querySelector('.slide'); return Math.max(e.scrollHeight - e.clientHeight, e.scrollWidth - e.clientWidth, s.scrollWidth - s.clientWidth); });
      if (r > 2) bad.push(i);
    }
    check(`${id}: ${n}장 모두 넘침 없음(1280x720)`, n > 20 && bad.length === 0, '넘친 장: ' + bad.join(','));
    await q.close();
  }
  check('휴대폰: 슬라이드 글자 크기 15px 이상', await tp.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.stage')).fontSize) >= 15));

  // 그림 불러오기
  const imgs = await pd.evaluate(async () => {
    const d = await (await fetch('data/2차시.json')).json();
    return [...new Set(d.slides.flatMap(s => [s.image]).filter(Boolean))];
  });
  let okImgs = 0;
  for (const n of imgs) { const r = await p.request.get(L + 'assets/' + encodeURIComponent(n) + '.png'); if (r.ok()) okImgs++; else console.log('  missing', n); }
  check(`참조한 그림 ${imgs.length}개 모두 있음`, okImgs === imgs.length);
  const shown = await (async () => { let bad = 0, n = 0; for (let i = 1; i <= total; i++) { await pd.evaluate(k => window.__lesson.go(k - 1), i); await pd.waitForFunction(() => [...document.querySelectorAll('.slide img')].every(im => im.complete), null, { timeout: 8000 }).catch(() => {}); const r = await pd.evaluate(() => [...document.querySelectorAll('.slide img')].map(im => im.complete && im.naturalWidth > 0 && !!im.alt)); n += r.length; bad += r.filter(x => !x).length; } return { n, bad }; })();
  check(`화면의 그림 ${shown.n}개 모두 그려짐·alt 있음`, shown.bad === 0 && shown.n > 0, JSON.stringify(shown));
  check('그림 요청 실패 없음', badImg.length === 0, badImg.join(','));

  // 어두운 화면·움직임 줄이기
  const dk = await b.newContext({ viewport: { width: 1280, height: 720 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  const dp = await dk.newPage(); dp.on('pageerror', e => errs.push(e.message));
  await dp.goto(L + '?l=2차시#7'); await dp.waitForSelector('.slide');
  check('어두운 화면: 슬라이드 배경이 어두움', await dp.evaluate(() => { const c = getComputedStyle(document.getElementById('stage')).backgroundColor.match(/\d+/g).map(Number); return c[0] < 80; }));
  check('움직임 줄이기: 슬라이드 애니메이션 없음', await dp.evaluate(() => getComputedStyle(document.querySelector('.slide')).animationName === 'none'));

  check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close();
  const fail = results.filter(x => !x).length;
  console.log(`\n${results.length - fail}/${results.length} 통과${fail ? `, ${fail} 실패` : ''}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
