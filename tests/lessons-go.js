// 수업 슬라이드 '바로 가기' 단추(go): 다운로드·앱 열기를 시키는 장에는 단추가 있고, 누르면 그 화면이 열림
// 사용자 피드백(2026-11-17): "실물 포니봇으로 다시 확인" 장에서 다운로드하라는데 갈 곳이 없음 — 다른 장도 점검
// 실행: node tests/lessons-go.js [기본주소]  (bridge/ 를 서버로 띄워 둘 것)
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = []; const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${ok ? '' : d}`); };
const NEED = /다운로드|내려받|웹앱 열기|시뮬레이터에서 예제|카드 뽑기 웹사이트|예제를 \[이 코드로|예제 "2\./;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/api/*-assistant', (r) => r.fulfill({ json: { configured: false } }));
  for (const id of ['ponybot_4차시', '4차시', '8차시', '예제']) {
    const d = await (await p.request.get(BASE + 'lessons/data/' + encodeURIComponent(id) + '.json')).json();
    const lack = d.slides.map((s, i) => (s.type !== 'mission' && NEED.test(JSON.stringify({ ...s, notes: '' })) && !(s.go && s.go.length) ? i + 1 : 0)).filter(Boolean);
    check(`${id}: 다운로드·앱 열기를 시키는 장에는 바로 가기 단추가 있음`, lack.length === 0, '단추 없는 장: ' + lack.join(','));
    const withGo = d.slides.map((s, i) => [s, i + 1]).filter(([s]) => s.go && s.go.length);
    for (const [s, n] of withGo) {
      await p.goto(BASE + 'lessons/?l=' + encodeURIComponent(id) + '#' + n); await p.waitForSelector('.slide'); await p.waitForTimeout(200);
      const hrefs = await p.$$eval('.slide .gobtn', (as) => as.map((a) => a.href));
      check(`${id} ${n}장 "${s.title}": 단추 ${s.go.length}개`, hrefs.length === s.go.length, String(hrefs.length));
      for (const h of hrefs) {
        if (!h.startsWith(BASE)) { check(`  └ 바깥 주소 새 탭: ${h}`, await p.$eval(`.slide .gobtn[href="${h}"]`, (a) => a.target === '_blank')); continue; }
        const u = new URL(h), ex = u.searchParams.get('ex'), ms = u.searchParams.get('mission');
        const r = await p.request.get(h); check(`  └ 열림: ${u.pathname}${u.search.slice(0, 60)}`, r.ok(), String(r.status()));
        if (ms || /\/(sim\/|ai\.html)/.test(u.pathname)) check(`  └ 이 장으로 돌아오는 주소(back)를 가짐`, decodeURIComponent(u.searchParams.get('back') || '').endsWith('#' + n), h);
        if (!ms && /\/(sim\/|ai\.html)/.test(u.pathname)) {   // 열린 화면에 [← 슬라이드로 돌아가기], 누르면 이 장으로
          const q = await b.newPage(); await q.route('**/api/*-assistant', (r) => r.fulfill({ json: { configured: false } }));
          await q.goto(h); await q.waitForSelector('#backToSlide', { timeout: 30000 }).catch(() => {});
          const bk = await q.$eval('#backToSlide', (a) => a.href).catch(() => '');
          check(`  └ 열린 화면에 [← 슬라이드로 돌아가기] → ${n}장`, bk.endsWith('#' + n) && bk.includes('/lessons/'), bk);
          await q.close();
        }
        if (ex) {   // 예제가 실제로 열리는지
          const q = await b.newPage(); await q.route('**/api/*-assistant', (r) => r.fulfill({ json: { configured: false } }));
          await q.goto(h + '&tab=js'); await q.waitForFunction(() => window.__sim || window.__pony, null, { timeout: 60000 }); await q.waitForTimeout(1500);
          const code = await q.evaluate(() => document.getElementById('code').value);
          const want = await q.evaluate(async (exId) => { const m = await import(location.search.includes('kit=ponybot') ? './kits/ponybot/examples.js' : './examples.js'); return (m.EXAMPLES.find((e) => e.id === exId) || {}).code; }, ex);
          check(`  └ 시뮬레이터가 예제 ${ex} 코드로 시작`, !!want && code === want);
          await q.close();
        }
      }
    }
  }
  check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close(); const f = results.filter((x) => !x).length;
  console.log(`\n결과: ${results.length - f} 통과 / ${f} 실패 (총 ${results.length})`); process.exit(f ? 1 : 0);
})();
