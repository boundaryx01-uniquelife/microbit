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
      aiHref: '/ai.html?kit=ponybot',
      docsHref: '/ponybot/',
      foot: 'AI 포니봇은 바운더리엑스(boundaryX)의 제품입니다. · <a href="/ponybot/">포니봇 수업 자료</a> · <a href="/NOTICE.md">오픈소스·출처 고지</a>',
      filePrefix: '포니봇AI'
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
      if (el.getAttribute('data-kit-hide').split(' ').indexOf(kit.slug) >= 0) el.hidden = true;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
