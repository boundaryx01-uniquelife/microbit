// 주소에 back=../lessons/… 가 있으면(수업 슬라이드의 '바로 가기' 단추로 온 경우) 화면 위에 [← 슬라이드로] 단추를 띄움
// 안전: 수업 슬라이드 주소(../lessons/ 또는 /lessons/)로만 돌아감 — 다른 사이트로 보내지 않음
(function () {
  'use strict';
  var back = null;
  try { back = new URLSearchParams(location.search).get('back'); } catch (e) { return; }
  if (!back || !/^(\.\.\/|\/)lessons\//.test(back)) return;
  if (new URLSearchParams(location.search).get('mission')) return;   // 미션 화면은 미션 칸에 이미 [← 슬라이드로]가 있음
  function put() {
    if (document.getElementById('backToSlide')) return;
    var a = document.createElement('a'); a.id = 'backToSlide'; a.href = back; a.textContent = '← 슬라이드로 돌아가기';
    a.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:50;padding:10px 16px;border-radius:999px;background:#2456e5;color:#fff;font-weight:800;text-decoration:none;box-shadow:0 6px 18px rgba(0,0,0,.25);font-size:15px';
    document.body.appendChild(a);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', put); else put();
})();
