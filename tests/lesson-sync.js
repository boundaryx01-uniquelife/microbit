// 함께 보기(교사 → 학생 따라가기) 시험: node tests/lesson-sync.js [기본주소]
// 로컬 주소면 /api/lesson-sync 를 netlify/functions/lesson-sync.mjs 로 바로 연결(메모리 저장), 배포 주소면 실제 함수 사용
const { chromium } = require('playwright');
const path = require('path');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const LOCAL = /127\.0\.0\.1|localhost/.test(BASE);
const L = BASE + 'lessons/';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${ok ? '' : detail}`); };
const waitFor = async (fn, ms = 9000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise(r => setTimeout(r, 200)); } return false; };

(async () => {
  const b = await chromium.launch();
  const errs = [];
  async function ctxFor(opts) {
    const c = await b.newContext(opts);
    if (LOCAL) {
      const fn = (await import(path.resolve(__dirname, '../netlify/functions/lesson-sync.mjs'))).default;
      await c.route('**/api/lesson-sync**', async route => {
        const rq = route.request();
        const res = await fn(new Request(rq.url(), { method: rq.method(), headers: { 'content-type': 'application/json' }, body: rq.method() === 'POST' ? rq.postData() : undefined }), { ip: '1' });
        await route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
      });
    }
    return c;
  }
  const tc = await ctxFor({ viewport: { width: 1280, height: 720 } });
  const t = await tc.newPage(); t.on('pageerror', e => errs.push('T ' + e.message));
  await t.goto(L + '?l=2차시#3'); await t.waitForSelector('.slide');
  check('학생 모드에서는 [학생 연결] 숨김', !(await t.isVisible('#syncbtn')));
  await t.keyboard.press('n');
  if (await t.isVisible('#pindlg')) { await t.fill('#pin', '0000'); await t.click('#pinform button[type=submit]'); await t.waitForSelector('#notes:not([hidden])'); }
  check('교사 모드에서 [학생 연결] 보임', await t.isVisible('#syncbtn'));
  await t.click('#syncbtn');
  check('코드 창에 숫자 4개', await waitFor(async () => /^\d{4}$/.test((await t.textContent('#synccode')).trim())));
  const room = (await t.textContent('#synccode')).trim();
  check('코드 창에 주소 안내', (await t.textContent('#syncurl')).includes('/lessons/'));
  await t.click('#syncclose');
  check('막대에 "학생 코드 ' + room + '"', (await t.textContent('#syncpill')).includes(room));

  // 학생: 목록에서 코드 입력
  const sc = await ctxFor({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const s = await sc.newPage(); s.on('pageerror', e => errs.push('S ' + e.message));
  await s.goto(L); await s.waitForSelector('#joinform');
  await s.fill('#joincode', '12'); await s.click('#joinform button');
  check('숫자 4개가 아니면 안내', (await s.textContent('#joinmsg')).includes('4개'));
  await s.fill('#joincode', room); await s.click('#joinform button');
  await s.waitForSelector('.slide');
  check('코드로 들어가면 교사와 같은 장(3)', await waitFor(async () => (await s.textContent('#counter')).trim().startsWith('3 /')), await s.textContent('#counter'));
  check('학생 막대에 "따라가는 중"', (await s.textContent('#syncpill')).includes('따라가는 중'));

  await t.keyboard.press('ArrowRight'); await t.keyboard.press('ArrowRight');
  check('교사가 5장으로 → 학생도 5장', await waitFor(async () => (await s.textContent('#counter')).trim().startsWith('5 /')), await s.textContent('#counter'));
  await s.evaluate(() => window.__lesson.go(9));
  check('학생이 직접 넘기면 따라가기 멈춤', (await s.textContent('#syncpill')).includes('선생님 화면으로'));
  await t.keyboard.press('ArrowRight');
  await s.waitForTimeout(3500);
  check('멈춘 동안은 그대로(10장)', (await s.textContent('#counter')).trim().startsWith('10 /'));
  await s.click('#syncpill');
  check('[선생님 화면으로] → 교사 장(6)', await waitFor(async () => (await s.textContent('#counter')).trim().startsWith('6 /')), await s.textContent('#counter'));

  // 교사 새로고침 후에도 같은 코드 유지
  await t.reload(); await t.waitForSelector('.slide');
  check('교사 새로고침 후 같은 코드 유지', (await t.textContent('#syncpill')).includes(room));
  await t.evaluate(() => window.__lesson.go(11));
  check('새로고침 뒤 넘겨도 학생이 따라옴(12)', await waitFor(async () => (await s.textContent('#counter')).trim().startsWith('12 /')));

  // 연결은 수업마다 따로(다른 수업 화면엔 코드 없음)
  await t.goto(L + '?l=4차시'); await t.waitForSelector('.slide');
  check('다른 수업에서는 연결 없음', await t.isHidden('#syncpill'));

  // 잘못된 코드 / 끝내기
  const s2 = await sc.newPage(); s2.on('pageerror', e => errs.push('S2 ' + e.message));
  await s2.goto(L); await s2.fill('#joincode', room === '9999' ? '9998' : '9999'); await s2.click('#joinform button');
  check('없는 코드는 안내', await waitFor(async () => (await s2.textContent('#joinmsg')).includes('없어요')));
  await t.goto(L + '?l=2차시'); await t.waitForSelector('.slide');
  await t.click('#syncpill'); await t.click('#syncstop');
  check('연결 끝내기 → 막대 표시 사라짐', await t.isHidden('#syncpill'));
  const fake = await s2.evaluate(async r => (await fetch('/api/lesson-sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'set', room: r, key: 'x', slide: 1 }) })).status, room);
  check('열쇠 없이 장 바꾸기 거부(403)', fake === 403, String(fake));

  check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close();
  const fail = results.filter(x => !x).length;
  console.log(`\n${results.length - fail}/${results.length} 통과${fail ? `, ${fail} 실패` : ''}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
