// 페이지마다 알맞은 머리글 로고·탭 아이콘 — 사용자 피드백(2026-11-17): 포니봇 교실 왼쪽 위 아이콘이 로보독
// 실행: node tests/brand-icons.js [기본주소]  (bridge/ 를 서버로 띄워 둘 것)
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const results = []; const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${ok ? '' : d}`); };
const P = 'ponybot_4%EC%B0%A8%EC%8B%9C', R4 = '4%EC%B0%A8%EC%8B%9C';
const WANT = [
  ['', 'favicon-hub.svg', 'favicon-hub.svg'],
  ['ponybot/', 'material-pony-v2.webp', 'favicon-ponybot.svg'], ['sim/?kit=ponybot&tab=js', 'material-pony-v2.webp', 'favicon-ponybot.svg'],
  ['ai.html?kit=ponybot', 'material-pony-v2.webp', 'favicon-ponybot.svg'], [`lessons/?l=${P}#3`, 'material-pony-v2.webp', 'favicon-ponybot.svg'],
  ['robodog/', 'robodog-svg', 'favicon.svg'], ['sim/?tab=js&demo=0', 'robodog-svg', 'favicon.svg'], ['ai.html', 'robodog-svg', 'favicon.svg'], [`lessons/?l=${R4}#3`, 'robodog-svg', 'favicon.svg'],
];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/api/*-assistant', (r) => r.fulfill({ json: { configured: false } }));
  for (const [u, logo, fav] of WANT) {
    await p.goto(BASE + u); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      const a = document.querySelector('a.brand'), vis = (e) => e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
      const shown = a ? [...a.querySelectorAll('img, svg')].filter(vis) : [];
      const one = shown[0]; const name = !one ? 'none' : one.tagName === 'IMG' ? one.getAttribute('src').split('/').pop() : (one.innerHTML.includes('0b0e14') ? 'robodog-svg' : 'svg');
      return { name, count: shown.length, fav: ((document.querySelector('link[rel=icon]') || {}).href || '').split('/').pop() };
    });
    check(`${u || '/'}: 로고 ${logo} 하나만, 탭 아이콘 ${fav}`, r.name === logo && r.count === 1 && r.fav === fav, JSON.stringify(r));
  }
  check('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close(); const f = results.filter((x) => !x).length;
  console.log(`\n결과: ${results.length - f} 통과 / ${f} 실패 (총 ${results.length})`); process.exit(f ? 1 : 0);
})();
