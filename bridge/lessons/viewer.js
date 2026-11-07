(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var W = 1280, H = 720;
  var params = new URLSearchParams(location.search);
  var id = params.get('l');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function getJSON(u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ---------- 목록 ---------- */
  function showList() {
    $('list').hidden = false;
    getJSON('data/index.json').then(function (idx) {
      return Promise.all(idx.map(function (it) {
        return getJSON('data/' + encodeURIComponent(it.id) + '.json').then(function (d) { return { it: it, n: d.slides.length }; }, function () { return null; });
      }));
    }).then(function (rows) {
      rows = rows.filter(Boolean);
      $('cards').innerHTML = rows.map(function (r) {
        return '<a class="lcard" href="?l=' + encodeURIComponent(r.it.id) + '"><b>' + esc(r.it.title) + '</b><span>' + esc(r.it.target || '') + '</span><span class="badge">슬라이드 ' + r.n + '장</span></a>';
      }).join('');
      if (!rows.length) $('listmsg').textContent = '아직 열 수 있는 수업이 없어요.';
    }).catch(function () { $('listmsg').textContent = '수업 목록을 불러오지 못했어요.'; });
  }

  /* ---------- 슬라이드 그리기 ---------- */
  var COLORS = { blue: 1, red: 1, yellow: 1, green: 1, orange: 1, gray: 1, ink: 1 };
  function cc(c, d) { return COLORS[c] ? c : (d || 'blue'); }
  function img(name, alt, cls) { return name ? '<img class="pic ' + (cls || '') + '" src="assets/' + encodeURIComponent(name) + '.png" alt="' + esc(alt) + '">' : ''; }
  function circle(text, color) { return '<span class="dot c-' + cc(color) + '">' + esc(text) + '</span>'; }
  function foot(s) { return s.footer ? '<p class="sfoot">' + esc(s.footer) + '</p>' : ''; }

  var R = {
    cover: function (s) {
      return '<div class="cv"><div class="cvt"><h1>' + esc(s.title) + '</h1><p>' + esc(s.sub) + '</p></div>' + img(s.image, s.title) + '</div>';
    },
    goals: function (s) {
      return '<ol class="goals">' + s.items.map(function (t, i) { return '<li>' + circle(i + 1, 'blue') + '<span>' + esc(t) + '</span></li>'; }).join('') + '</ol>';
    },
    points: function (s) {
      var list = '<ul class="pts">' + s.items.map(function (it, i) {
        return '<li>' + circle(it.badge || (i + 1), it.color || 'blue') + '<div><b>' + esc(it.text) + '</b>' + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</div></li>';
      }).join('') + '</ul>';
      var side = s.image ? (s.imageSide === 'left' ? 'L' : 'R') : '';
      var body = s.image ? (side === 'L' ? img(s.image, s.title) + list : list + img(s.image, s.title)) : list;
      return '<div class="split ' + (s.image ? 'has-img' : '') + '">' + body + '</div>' + foot(s);
    },
    cards: function (s) {
      return '<div class="cds n' + s.cards.length + '">' + s.cards.map(function (c) {
        return '<div class="cd c-' + cc(c.color) + '"><h3>' + (c.badge ? circle(c.badge, c.color) : '') + '<span>' + esc(c.head) + '</span></h3><ul>' +
          c.lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul></div>';
      }).join('') + '</div>' + foot(s);
    },
    flow: function (s) {
      var n = s.nodes.length;
      var nodes = s.nodes.map(function (nd, i) {
        return (i ? '<span class="arr" aria-hidden="true">→</span>' : '') + '<div class="nd c-' + cc(nd.color) + '">' + (nd.tag ? '<em>' + esc(nd.tag) + '</em>' : '') + '<b>' + esc(nd.label) + '</b>' + (nd.sub ? '<small>' + esc(nd.sub) + '</small>' : '') + '</div>';
      }).join('');
      var loop = s.loop ? '<svg class="loop" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><path d="M92 0 V12 H8 V2" fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-dasharray="6 5"/><path d="M4 5 L8 0 L12 5" fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>' : '';
      var strip = s.strip && s.strip.length ? '<div class="strip">' + s.strip.map(esc).join(' <i aria-hidden="true">→</i> ') + '</div>' : '';
      var low = (s.image || strip) ? '<div class="low">' + img(s.image, s.title) + strip + '</div>' : '';
      return '<div class="flowwrap"><div class="flow n' + n + '">' + nodes + '</div>' + loop + low + '</div>';
    },
    question: function (s) {
      var big = s.big === '?' ? '<div class="q q-mark" aria-hidden="true">?</div>' : '<div class="q q-text">' + esc(s.big) + '</div>';
      return '<div class="qa ' + (s.image ? 'has-img' : '') + '"><div class="qt">' + big + (s.sub ? '<p>' + esc(s.sub) + '</p>' : '') + '</div>' + img(s.image, s.title) + '</div>';
    },
    image: function (s) {
      var side = '';
      if (s.points && s.points.length) side += '<ul class="bul">' + s.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>';
      if (s.callout) side += '<div class="callout">' + esc(s.callout) + '</div>';
      return '<div class="imgs">' + img(s.image, s.title) + '<div class="side">' + side + '</div></div>';
    },
    table: function (s) {
      var rows = '<ul class="rows">' + s.rows.map(function (r, i) {
        return '<li class="c-' + cc(r.color) + '">' + circle(r.badge || (i + 1), r.color) + '<b>' + esc(r.left) + '</b><span class="arr" aria-hidden="true">→</span><span class="rt">' + esc(r.right) + '</span></li>';
      }).join('') + '</ul>';
      return '<div class="split tbl ' + (s.image ? 'has-img' : '') + '">' + rows + img(s.image, s.title) + '</div>';
    },
    code: function (s) {
      var steps = '<ol class="steps">' + s.steps.map(function (st, i) {
        return '<li>' + circle(i + 1, 'blue') + '<div><b>' + esc(st.text) + '</b>' + (st.sub ? '<small>' + esc(st.sub) + '</small>' : '') + '</div></li>';
      }).join('') + '</ol>';
      var tip = s.tip ? '<div class="callout">' + esc(s.tip) + '</div>' : '';
      return '<div class="split code ' + (s.image ? 'has-img' : '') + '"><div class="stepcol">' + steps + tip + '</div>' + img(s.image, s.title) + '</div>';
    },
    core: function (s) {
      return '<ol class="core">' + s.items.map(function (t, i) { return '<li>' + circle(i + 1, 'yellow') + '<span>' + esc(t) + '</span></li>'; }).join('') + '</ol>';
    },
    checklist: function (s) {
      return '<ul class="chk">' + s.items.map(function (t) { return '<li><span class="box" aria-hidden="true"></span><span>' + esc(t) + '</span></li>'; }).join('') + '</ul>';
    }
  };

  function slideHTML(s, i, total) {
    var fn = R[s.type] || R.points;
    var plain = (s.type === 'cover');
    var head = plain ? '' : '<h2 class="st">' + esc(s.title) + '</h2>';
    return '<div class="slide t-' + esc(s.type) + '" data-type="' + esc(s.type) + '">' + head +
      '<div class="sbody">' + (R[s.type] ? fn(s) : '') + '</div>' +
      '<div class="sf"><span>피지컬 AI 교실 · ' + esc(s.ch) + '차시</span><span>' + (i + 1) + '</span></div></div>';
  }

  /* 교사 노트: "/" 로 나눈 항목을 줄로, 앞 이름은 굵게 */
  function notesHTML(t) {
    if (!t) return '<p class="muted">이 슬라이드에는 노트가 없어요.</p>';
    return t.split(' / ').map(function (part) {
      var m = part.match(/^((?:\[[^\]]+\]\s*)?)(발문|예상 답|진행|주의)(:)\s*(.*)$/);
      if (m) return '<p>' + (m[1] ? '<span class="tm">' + esc(m[1].trim()) + '</span> ' : '') + '<b>' + m[2] + '</b> ' + esc(m[4]) + '</p>';
      var t2 = part.match(/^(\[[^\]]+\])\s*(.*)$/);
      if (t2) return '<p><span class="tm">' + esc(t2[1]) + '</span> ' + esc(t2[2]) + '</p>';
      return '<p>' + esc(part) + '</p>';
    }).join('');
  }

  /* ---------- 뷰어 ---------- */
  function showViewer(d) {
    var slides = d.slides, total = slides.length, cur = 0;
    document.title = d.title + ' · 수업 슬라이드';
    $('viewer').hidden = false;
    document.body.classList.add('is-viewer');

    var sel = $('chsel');
    sel.innerHTML = (d.chapters || []).map(function (c) { return '<option value="' + c.n + '">' + c.n + '차시 · ' + esc(c.title) + '</option>'; }).join('');
    if (!(d.chapters || []).length) sel.hidden = true;

    function fromHash() { var n = parseInt((location.hash || '').replace('#', ''), 10); return n >= 1 && n <= total ? n - 1 : 0; }

    function render() {
      var s = slides[cur];
      $('stage').innerHTML = slideHTML(s, cur, total);
      $('counter').textContent = (cur + 1) + ' / ' + total;
      $('prev').disabled = cur === 0; $('next').disabled = cur === total - 1;
      var pr = document.querySelector('.progress');
      pr.setAttribute('aria-valuenow', cur + 1); pr.setAttribute('aria-valuemax', total);
      pr.firstElementChild.style.width = ((cur + 1) / total * 100) + '%';
      sel.value = String(s.ch);
      $('notesbody').innerHTML = notesHTML(s.notes);
      var nb = $('notes'); nb.scrollTop = 0;
      var h = '#' + (cur + 1);
      if (location.hash !== h) history.replaceState(null, '', h);
      fit();
      shrink();
    }
    // 글이 많은 장: 넘치면 그 장의 글자 크기를 조금씩 줄여 상자 안에 맞춤(최소 62%)
    function shrink() {
      var b = document.querySelector('#stage .sbody'); if (!b) return;
      var over = function () { var sl = b.closest('.slide'); return b.scrollHeight - b.clientHeight > 1 || b.scrollWidth - b.clientWidth > 1 || (sl && sl.scrollWidth - sl.clientWidth > 1); };
      b.style.fontSize = '';
      for (var f = 0.96; f >= 0.62 && over(); f -= 0.04) b.style.fontSize = f.toFixed(2) + 'em';
    }
    function go(n) { n = Math.max(0, Math.min(total - 1, n)); if (n !== cur) { cur = n; render(); } }

    function fit() {
      var wrap = $('stagewrap'), f = $('fit'), st = $('stage');
      var fluid = window.innerWidth < 760;
      document.body.classList.toggle('fluid', fluid);
      if (fluid) {
        f.style.width = ''; f.style.height = ''; st.style.transform = '';
        return;
      }
      var cw = wrap.clientWidth, ch = wrap.clientHeight;
      var sc = Math.max(0.1, Math.min(cw / W, ch / H));
      f.style.width = (W * sc) + 'px'; f.style.height = (H * sc) + 'px';
      st.style.transform = 'scale(' + sc + ')';
    }
    window.addEventListener('resize', fit);
    if (window.ResizeObserver) new ResizeObserver(fit).observe($('stagewrap'));
    document.addEventListener('fullscreenchange', function () { document.body.classList.toggle('is-fs', !!document.fullscreenElement); setTimeout(fit, 50); });

    $('prev').onclick = function () { go(cur - 1); };
    $('next').onclick = function () { go(cur + 1); };
    sel.onchange = function () {
      var n = parseInt(sel.value, 10);
      for (var i = 0; i < total; i++) if (slides[i].ch === n) { go(i); break; }
    };
    window.addEventListener('hashchange', function () { go(fromHash()); });

    function teacher(on) {
      document.body.classList.toggle('teacher', on);
      $('notes').hidden = !on; $('teacher').setAttribute('aria-pressed', on ? 'true' : 'false');
      $('teacher').classList.toggle('primary', on);
      store.set('lessonTeacher', on ? '1' : '0'); fit();
    }
    $('teacher').onclick = function () { teacher(!document.body.classList.contains('teacher')); };
    function fs() {
      if (document.fullscreenElement) { document.exitFullscreen(); return; }
      var v = $('viewer'); if (v.requestFullscreen) v.requestFullscreen().catch(function () {});
    }
    $('fs').onclick = fs;
    if (!document.documentElement.requestFullscreen) $('fs').hidden = true;

    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = (e.target && e.target.tagName) || '';
      var k = e.key;
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'Spacebar') { if (tag === 'BUTTON' && k === ' ') return; e.preventDefault(); go(cur + 1); }
      else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); go(cur - 1); }
      else if (k === 'Home') { e.preventDefault(); go(0); }
      else if (k === 'End') { e.preventDefault(); go(total - 1); }
      else if (k === 'f' || k === 'F') { fs(); }
      else if (k === 'n' || k === 'N') { $('teacher').click(); }
    });

    var sx = 0, sy = 0, st0 = 0;
    var wrap = $('stagewrap');
    wrap.addEventListener('touchstart', function (e) { var t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; st0 = Date.now(); }, { passive: true });
    wrap.addEventListener('touchend', function (e) {
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - st0 < 800) go(cur + (dx < 0 ? 1 : -1));
    }, { passive: true });

    /* 전체 화면에서 막대는 마우스를 움직일 때만 */
    var hideT;
    document.addEventListener('mousemove', function () {
      var b = $('bar'); b.classList.add('show'); clearTimeout(hideT); hideT = setTimeout(function () { b.classList.remove('show'); }, 2500);
    });

    cur = fromHash();
    teacher(store.get('lessonTeacher') === '1');
    render();
    window.__lesson = { go: go, total: total, cur: function () { return cur; } };
  }

  if (!id) showList();
  else getJSON('data/' + encodeURIComponent(id) + '.json').then(showViewer).catch(function () {
    var e = $('err'); e.hidden = false; e.innerHTML = '수업 “' + esc(id) + '” 을(를) 찾지 못했어요. <a href="./">목록으로</a>';
  });
})();
