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
  check('슬라이드 25장 불러옴', total === 25 && (await p.textContent('#counter')).trim() === '1 / 25', await p.textContent('#counter'));
  check('첫 장은 표지', await p.evaluate(() => !!document.querySelector('.slide.t-cover')));
  check('머리 메뉴의 현재 위치 = 수업 자료', (await p.textContent('.gnb nav a[aria-current="page"]')).includes('수업 자료'));
  await p.keyboard.press('ArrowRight');
  check('→ 키로 2장, 주소 #2', (await p.textContent('#counter')).trim() === '2 / 25' && new URL(p.url()).hash === '#2');
  await p.keyboard.press('Space'); await p.keyboard.press('PageDown');
  check('Space·PageDown 으로 4장', new URL(p.url()).hash === '#4');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('PageUp');
  check('← · PageUp 으로 2장', new URL(p.url()).hash === '#2');
  await p.click('#next');
  check('[다음] 버튼', (await p.textContent('#counter')).trim() === '3 / 25');
  await p.selectOption('#chsel', '2');
  check('차시 메뉴로 2차시 첫 장(12)', new URL(p.url()).hash === '#12');
  check('바닥글 "2차시 소개형 · 2교시"(패키지 이름 + 교시)', (await p.textContent('.sf')).includes('2차시 소개형 · 2교시'), await p.textContent('.sf'));
  check('머리표 "2교시 · 1/14" (장 처음에서 지금 위치)', await p.evaluate(() => { const c = document.querySelector('.slide .chip'); return !c || /^2교시 · \d+\/14$/.test(c.textContent.trim()); }));
  check('차시 메뉴 글이 "N교시 · …"', (await p.$eval('#chsel', e => e.options[1].textContent)).startsWith('2교시 · '));

  const p2 = await ctx.newPage();
  await p2.goto(L + '?l=2차시#16'); await p2.waitForSelector('.slide');
  check('#16 주소로 바로 16장', (await p2.textContent('#counter')).trim() === '16 / 25' && (await p2.textContent('.st')).includes('이렇게 연결돼요'));
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

  // 휴대폰 조작 막대: 한 줄(화면 높이의 10% 이하), 차시 메뉴는 ⋯ 안에
  { const m = await tp.evaluate(() => ({ bar: document.getElementById('bar').getBoundingClientRect().height, sel: getComputedStyle(document.getElementById('chsel')).display, more: getComputedStyle(document.getElementById('more')).display }));
    check('휴대폰: 조작 막대가 한 줄(높이 ≤ 84px)이고 차시 메뉴는 접혀 있음', m.bar <= 84 && m.sel === 'none' && m.more !== 'none', JSON.stringify(m));
    await tp.click('#more'); const o = await tp.evaluate(() => getComputedStyle(document.getElementById('chsel')).display);
    check('휴대폰: ⋯ 를 누르면 차시 메뉴·교사 모드·전체 화면이 펼쳐짐', o !== 'none', o); await tp.click('#more'); }
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
    check(`${label}: 25장 모두 넘침 없음`, bad.length === 0, bad.join(' '));
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
    check(`${id}: ${n}장 모두 넘침 없음(1280x720)`, n > 40 && bad.length === 0, '넘친 장: ' + bad.join(','));
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

  // 모든 수업·모든 장: 본문 글자 20px 이상, 자동 축소 0.85 이상, 바닥글 13px 이상, 그림 불러오기
  const EXPECT = { '2차시': 25, '4차시': 48, '8차시': 91, '예제': 18 };
  for (const id of ['2차시', '4차시', '8차시', '예제']) {
    const q = await ctx.newPage(); q.on('pageerror', e => errs.push(id + ': ' + e.message));
    await q.goto(L + '?l=' + encodeURIComponent(id)); await q.waitForSelector('.slide');
    const n = await q.evaluate(() => window.__lesson.total);
    const small = [], shrunk = [], broken = [];
    for (let i = 1; i <= n; i++) {
      await q.evaluate(k => window.__lesson.go(k - 1), i);
      await q.waitForFunction(() => [...document.querySelectorAll('.slide img')].every(im => im.complete), null, { timeout: 8000 }).catch(() => {});
      const r = await q.evaluate(() => {
        let min = 99, who = '';
        // 무대 좌표(1280x720) 기준 계산된 글자 크기: 장 전체(머리표·바닥글 포함)에서 보이는 글자 모두
        const w = document.createTreeWalker(document.querySelector('.slide'), NodeFilter.SHOW_TEXT);
        for (let t; (t = w.nextNode());) {
          if (!t.textContent.trim()) continue; const el = t.parentElement, cs = getComputedStyle(el), bb = el.getBoundingClientRect();
          if (cs.display === 'none' || cs.visibility === 'hidden' || !bb.width || !bb.height) continue;
          const fs = parseFloat(cs.fontSize); if (fs < min) { min = fs; who = el.className + ':' + t.textContent.trim().slice(0, 14); }
        }
        const sb = document.querySelector('.sbody'), sf = document.querySelector('.sf span');
        return { min, who, shrink: parseFloat(sb.style.fontSize) || 1, foot: parseFloat(getComputedStyle(sf).fontSize), imgs: [...document.querySelectorAll('.slide img')].filter(im => !(im.complete && im.naturalWidth > 0)).length };
      });
      if (r.min < 19.95) small.push(`${i}:${r.min}px(${r.who})`);
      if (r.shrink < 0.85) shrunk.push(`${i}:${r.shrink}`);
      if (r.imgs || r.foot < 20) broken.push(`${i}:img${r.imgs}/foot${r.foot}`);
    }
    check(`${id}: ${n}장(기대 ${EXPECT[id]}), 머리표·바닥글 포함 모든 글자 20px 이상(무대 좌표)`, n === EXPECT[id] && small.length === 0, small.join(' '));
    check(`${id}: 자동 축소 0.85 미만 장 없음`, shrunk.length === 0, shrunk.join(' '));
    check(`${id}: 그림 모두 그려짐·바닥글 20px 이상`, broken.length === 0, broken.join(' '));
    const refs = await q.evaluate(async (name) => {
      const d = await (await fetch('data/' + name + '.json')).json();
      const GENERIC = [/가장 중요한 한 가지/, /화면을 따라 읽는 속도/, /\(자유롭게/, /\(보이는 것을/, /\(단계를 순서대로/, /\(공통점과 차이/, /\(왼쪽과 오른쪽/, /\(목표를/, /\(자기 말로/, /\(항목을 하나씩/, /이어서\]/, /그림에서 무엇이 보이나요/, /어떤 순서로 하면 될까요/, /표를 보고 알 수 있는/, /여러분은 어떻게 생각하나요/, /예상 답: \(/, /오늘 가장 기억에 남는/, /빠뜨린 것은 없는지/, /오늘은 무엇을 배우고/, /오늘 수업이 끝나면/];
      const qs = {}; d.slides.forEach((s, i) => { const m = (s.notes || '').match(/발문: (.*?) \/ 예상 답/); const k = m ? m[1].replace(/"/g, '') : '?'; (qs[k] = qs[k] || []).push(i + 1); });
      const mins = {}; d.slides.forEach((s) => { const m = (s.notes || '').match(/^\[[^\]]*?(\d+)분[^\]]*\]/); mins[s.ch] = (mins[s.ch] || 0) + (m ? +m[1] : 0); });
      return {
        imgs: [...new Set(d.slides.flatMap(s => [s.image, ...(s.cards || []).map(c => c.icon), ...(s.nodes || []).map(n => n.icon)]).filter(Boolean))],
        noteBad: d.slides.map((s, i) => /^\[[^\]]*\d+분[^\]]*\] 발문: .+ \/ 예상 답: .+ \/ 진행: .+ \/ 주의: .+$/.test(s.notes || '') ? 0 : i + 1).filter(Boolean),
        generic: d.slides.map((s, i) => GENERIC.some(r => r.test(s.notes || '')) ? i + 1 : 0).filter(Boolean),
        dupQ: Object.entries(qs).filter(([, v]) => v.length > 1).map(([k, v]) => v.join(',') + ':' + k.slice(0, 16)),
        dupNote: (() => { const m = {}; d.slides.forEach((s, i) => { const k = (s.notes || '').replace(/^\[[^\]]*\]\s*/, ''); (m[k] = m[k] || []).push(i + 1); }); return Object.values(m).filter(v => v.length > 1).map(v => v.join(',')); })(),
        badTitle: d.slides.map((s, i) => /^(먼저 보세요|생각해 봐요|문제 찾기|생각 나누기|지난 시간 이어서|디버깅|한계 토의|윤리 토의 \d|아이디어 발산)$/.test(s.title) ? i + 1 : 0).filter(Boolean),
        covers: d.slides.filter(s => s.type === 'cover').map(s => s.sub),
        mins,
      };
    }, id);
    let miss = 0; for (const nm of refs.imgs) { const r = await p.request.get(L + 'assets/' + encodeURIComponent(nm) + '.png'); if (!r.ok()) { miss++; console.log('  missing', nm); } }
    check(`${id}: 참조한 그림 ${refs.imgs.length}개 모두 있음`, miss === 0);
    check(`${id}: 모든 장의 노트가 [시간] 발문/예상 답/진행/주의 형식(시간·빈 칸 없음)`, refs.noteBad.length === 0, '형식 아닌 장: ' + refs.noteBad.join(','));
    check(`${id}: 틀에 박힌 노트("가장 중요한 한 가지" 등 일반 발문·빈 예상 답) 없음`, refs.generic.length === 0, '장: ' + refs.generic.join(','));
    check(`${id}: 같은 발문·같은 노트가 두 장 이상 쓰이지 않음`, refs.dupQ.length === 0 && refs.dupNote.length === 0, refs.dupQ.join(' ; ') + ' | ' + refs.dupNote.join(' ; '));
    check(`${id}: 물음 장 제목이 "먼저 보세요" 같은 일반 말이 아님`, refs.badTitle.length === 0, '장: ' + refs.badTitle.join(','));
    check(`${id}: 표지 줄이 "<패키지> · N교시"`, refs.covers.length > 0 && refs.covers.every(t => /^(\d+차시 .+|예제 따라 하기) · \d+교시$/.test(t)), refs.covers.join(' / '));
    check(`${id}: 교시마다 노트 시간 합계 40분`, Object.values(refs.mins).every(m => m === 40) && Object.keys(refs.mins).length === { '2차시': 2, '4차시': 4, '8차시': 8, '예제': 2 }[id], JSON.stringify(refs.mins));
    await q.close();
  }
  // 전체 화면: 화면을 꽉 채움
  { const f = await ctx.newPage(); await f.setViewportSize({ width: 1920, height: 1080 }); await f.goto(L + '?l=2차시#9'); await f.waitForSelector('.slide');
    await f.keyboard.press('f'); await f.waitForTimeout(1200);
    const r = await f.evaluate(() => { const b = document.getElementById('fit').getBoundingClientRect(); return { fs: !!document.fullscreenElement, w: b.width, h: b.height, iw: innerWidth, ih: innerHeight }; });
    if (r.fs) check('전체 화면: 무대가 화면을 가득 채움', r.w >= r.iw - 12 && r.h >= r.ih - 8, JSON.stringify(r)); else console.log('  (이 환경은 전체 화면을 지원하지 않아 건너뜀)');
    await f.close(); }

  // 교사 모드: 조작 막대 한 줄(1280·1024), 노트 글자 17px 이상(1280 · 휴대폰), 슬라이드 목록(G) 열기·이동
  { const PINH = '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0';
    for (const [w, h] of [[1280, 720], [1024, 768]]) {
      const c2 = await b.newContext({ viewport: { width: w, height: h } }); const t = await c2.newPage(); t.on('pageerror', e => errs.push(e.message));
      await t.addInitScript(k => { localStorage.setItem('lessonTeacherOK', k); localStorage.setItem('lessonTeacher', '1'); }, PINH);
      await t.goto(L + '?l=8차시#40'); await t.waitForSelector('.slide');
      const m = await t.evaluate(() => {
        const bar = document.getElementById('bar'), bb = bar.getBoundingClientRect();
        const tops = [...bar.children].filter(e => e.offsetParent && e.getBoundingClientRect().height).map(e => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2));
        const nb = document.getElementById('notesbody'), p = nb.querySelector('p');
        return { h: bb.height, spread: Math.max(...tops) - Math.min(...tops), notes: parseFloat(getComputedStyle(p).fontSize), right: Math.max(...[...bar.children].filter(e => e.offsetParent).map(e => e.getBoundingClientRect().right)), iw: innerWidth, sw: document.documentElement.scrollWidth };
      });
      check(`교사 모드 ${w}px: 조작 막대가 한 줄(높이 ≤ 80, 가로 넘침 없음)`, m.h <= 80 && m.spread <= 4 && m.right <= m.iw && m.sw <= m.iw, JSON.stringify(m));
      check(`교사 모드 ${w}px: 교사 노트 글자 17px 이상`, m.notes >= 17, JSON.stringify(m));
      if (w === 1280) {
        check('목록 단추가 보이고 이름이 있음(aria-label)', await t.isVisible('#ovbtn') && /목록/.test(await t.getAttribute('#ovbtn', 'aria-label')));
        await t.keyboard.press('g'); await t.waitForSelector('#ovdlg[open]');
        const o = await t.evaluate(() => ({ sec: document.querySelectorAll('#ovbody .ovch').length, btn: document.querySelectorAll('#ovbody button[data-i]').length, cur: document.querySelector('#ovbody [aria-current]').textContent, fs: parseFloat(getComputedStyle(document.querySelector('#ovbody button span')).fontSize), min: Math.min(...[...document.querySelectorAll('#ovbody button, #ovbody h3')].map(e => parseFloat(getComputedStyle(e).fontSize))) }));
        check('G 키: 목록이 교시별 묶음(8)·장 91개로 열리고 현재 장 표시, 글자 18px 이상', o.sec === 8 && o.btn === 91 && o.cur.startsWith('40') && o.min >= 18, JSON.stringify(o));
        await t.click('#ovbody button[data-i="59"]');
        check('목록에서 눌러 60장으로 이동하고 닫힘', (await t.textContent('#counter')).trim() === '60 / 91' && new URL(t.url()).hash === '#60' && !(await t.evaluate(() => document.getElementById('ovdlg').open)));
        await t.keyboard.press('g'); await t.waitForSelector('#ovdlg[open]'); await t.keyboard.press('Escape');
        check('Esc 로 목록 닫기', !(await t.evaluate(() => document.getElementById('ovdlg').open)));
        const bs = await t.evaluate(() => ({ btn: parseFloat(getComputedStyle(document.getElementById('next')).fontSize), cnt: parseFloat(getComputedStyle(document.getElementById('counter')).fontSize) }));
        check('조작 막대 글자 크기(버튼 20px·번호 24px 이상)', bs.btn >= 20 && bs.cnt >= 24, JSON.stringify(bs));
      }
      await c2.close();
    }
    const c3 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const t3 = await c3.newPage(); t3.on('pageerror', e => errs.push(e.message));
    await t3.addInitScript(k => { localStorage.setItem('lessonTeacherOK', k); localStorage.setItem('lessonTeacher', '1'); }, PINH);
    await t3.goto(L + '?l=4차시#43'); await t3.waitForSelector('.slide');
    const pn = await t3.evaluate(() => { const p = document.querySelector('#notesbody p'); return { fs: parseFloat(getComputedStyle(p).fontSize), vis: !document.getElementById('notes').hidden, pw: document.documentElement.scrollWidth - innerWidth }; });
    check('휴대폰 교사 모드: 노트가 보이고 글자 17px 이상·가로 넘침 없음', pn.vis && pn.fs >= 17 && pn.pw <= 2, JSON.stringify(pn));
    await c3.close(); }

  check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close();
  const fail = results.filter(x => !x).length;
  console.log(`\n${results.length - fail}/${results.length} 통과${fail ? `, ${fail} 실패` : ''}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
