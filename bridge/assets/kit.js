// 교구 선택: 주소에 ?kit=ponybot 이 있으면 해당 교구 문구로 바꾼다(없으면 기본 = 로보독, 기존 화면 그대로).
// 쓰는 법: 바꿀 요소에 data-kit="키"(글자) 또는 data-kit-html="키"(링크 포함), data-kit-href="키", data-kit-hide="교구slug"
// 새 교구는 아래 KITS에 항목을 추가한다. 원본 설정: kits/<slug>/kit.json
(function () {
  'use strict';
  var KITS = {
    robodog: null, // 기본: 페이지에 적힌 문구 그대로
    ponybot: {
      slug: 'ponybot',
      robot: '포니봇',
      title: '포니봇 AI 교실',
      brandSub: '피지컬 AI 수업',
      home: '/ponybot/',
      aiLabel: 'AI 웹앱',
      aiHref: '/ponybot/#ai',   // 포니봇은 제조사 AI 웹앱(블루투스)을 씀 — 웹캠 AI 브리지 대신
      docsHref: '/ponybot/',
      foot: 'AI 포니봇은 바운더리엑스(boundaryX)의 제품입니다. · <a href="/ponybot/">포니봇 수업 자료</a> · <a href="/NOTICE.md">오픈소스·출처 고지</a>',
      filePrefix: '포니봇AI',
      logo: '/ponybot/assets/official/material-pony-v2.webp',   // 머리글 왼쪽 위 그림(시뮬레이터와 같은 제품 그림)
      icon: '/assets/favicon-ponybot.svg'
    }
  };
  var slug = 'robodog';
  try {
    var sp = new URLSearchParams(location.search);
    var q = sp.get('kit');
    // 수업 슬라이드(?l=ponybot_4차시)는 수업 ID 앞부분으로 교구를 알아냄
    if (!q && sp.get('l')) q = String(sp.get('l')).split('_')[0];
    if (q && Object.prototype.hasOwnProperty.call(KITS, q)) slug = q;
  } catch (e) { /* 옛 브라우저: 기본 교구 */ }
  var kit = KITS[slug];
  window.KIT = kit ? kit : { slug: 'robodog', robot: '로보독', filePrefix: '로보독AI' };
  if (!kit) return;
  // 포니봇으로 웹캠 AI 브리지(ai.html)를 열면: 블루투스 AI 웹앱 안내(브리지는 그대로 쓸 수 있음)
  try {
    if (slug === 'ponybot' && /\/ai\.html$/.test(location.pathname)) document.addEventListener('DOMContentLoaded', function () {
      var d = document.createElement('div'); d.setAttribute('role', 'note');
      d.style.cssText = 'margin:10px auto;max-width:1100px;padding:10px 14px;border-radius:12px;background:#fff4dc;color:#5a3a00;font-weight:600';
      d.innerHTML = '포니봇은 이제 바운더리엑스 <b>AI 웹앱(포즈·음성 인식, 블루투스)</b>으로 움직여요 → <a href="/ponybot/#ai">AI 웹앱 열기</a> · 이 웹캠 AI 브리지(USB·라디오)는 예전 4차시 수업용으로 남겨 두었어요.';
      var h = document.querySelector('header'); if (h && h.parentNode) h.parentNode.insertBefore(d, h.nextSibling); else document.body.insertBefore(d, document.body.firstChild);
    });
  } catch (e) { /* 무시 */ }
  // 탭 아이콘(파비콘)도 교구 것으로
  try { if (kit.icon) { var setIcon = function () { var l = document.querySelector('link[rel=icon]'); if (l) l.href = kit.icon; }; setIcon(); document.addEventListener('DOMContentLoaded', setIcon); } } catch (e) { /* 무시 */ }

  function apply() {
    document.documentElement.setAttribute('data-kit-active', kit.slug);
    if (document.title) document.title = document.title.replace(/로보독 AI 교실/g, kit.title);
    document.querySelectorAll('[data-kit]').forEach(function (el) {
      var v = kit[el.getAttribute('data-kit')];
      if (typeof v === 'string') el.textContent = v;
    });
    document.querySelectorAll('[data-kit-html]').forEach(function (el) {
      var v = kit[el.getAttribute('data-kit-html')];
      if (typeof v === 'string') el.innerHTML = v; // KITS 안의 고정 문구만 넣음(사용자 입력 아님)
    });
    document.querySelectorAll('[data-kit-href]').forEach(function (el) {
      var v = kit[el.getAttribute('data-kit-href')];
      if (typeof v === 'string') el.setAttribute('href', v);
    });
    document.querySelectorAll('[data-kit-hide]').forEach(function (el) {
      // SVG 에는 .hidden 이 듣지 않으므로 속성·style 로 숨김(로보독 로고가 포니봇 페이지에 남던 문제)
      if (el.getAttribute('data-kit-hide').split(' ').indexOf(kit.slug) >= 0) { el.setAttribute('hidden', ''); el.style.display = 'none'; }
    });
    // 머리글 로고: 교구 그림으로(로보독 그림을 숨긴 자리에)
    if (kit.logo) document.querySelectorAll('a.brand').forEach(function (a) {
      if (a.querySelector('img.kit-logo')) return;
      a.querySelectorAll('svg').forEach(function (sv) { sv.style.display = 'none'; });
      var im = document.createElement('img'); im.className = 'kit-logo'; im.src = kit.logo; im.alt = ''; im.width = 32; im.height = 32;
      a.insertBefore(im, a.firstChild);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
