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
  var API = '/api/lesson-sync';
  function api(method, body, q) {
    return fetch(API + (q || ''), { method: method, cache: 'no-store', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); });
  }
  function joinURL(lesson, room) { return '?l=' + encodeURIComponent(lesson) + '&room=' + room; }

  function showList() {
    $('list').hidden = false;
    var pre = params.get('room'); if (pre && /^\d{4}$/.test(pre)) $('joincode').value = pre;
    $('joinform').onsubmit = function (e) {
      e.preventDefault();
      var code = $('joincode').value.replace(/\D/g, ''), msg = $('joinmsg');
      if (!/^\d{4}$/.test(code)) { msg.textContent = '숫자 4개를 넣어 주세요.'; return; }
      msg.textContent = '';
      api('GET', null, '?room=' + code).then(function (j) {
        if (j._status === 200 && j.lesson) location.href = joinURL(j.lesson, code) + '#' + ((j.slide | 0) + 1);
        else if (j._status === 404) msg.textContent = '그 코드의 수업이 없어요. 숫자를 다시 확인해 주세요.';
        else msg.textContent = '지금 연결할 수 없어요. 잠시 뒤 다시 해 보세요.';
      }, function () { msg.textContent = '지금 연결할 수 없어요. 인터넷 연결을 확인해 주세요.'; });
    };
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
  function hl(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<em>$1</em>'); }
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
        return '<div class="cd c-' + cc(c.color) + (c.icon ? ' has-icon' : '') + '">' + (c.icon ? img(c.icon, c.head, 'cicon') : '') + '<h3>' + (c.badge ? circle(c.badge, c.color) : '') + '<span>' + esc(c.head) + '</span></h3><ul>' +
          c.lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul></div>';
      }).join('') + '</div>' + foot(s);
    },
    flow: function (s) {
      var n = s.nodes.length;
      var nodes = s.nodes.map(function (nd, i) {
        return (i ? '<span class="arr" aria-hidden="true">→</span>' : '') + '<div class="nd c-' + cc(nd.color) + (nd.icon ? ' has-icon' : '') + '">' + (nd.icon ? img(nd.icon, nd.label, 'nicon') : '') + (nd.tag ? '<em>' + esc(nd.tag) + '</em>' : '') + '<b>' + esc(nd.label) + '</b>' + (nd.sub ? '<small>' + esc(nd.sub) + '</small>' : '') + '</div>';
      }).join('');
      var loop = s.loop ? '<div class="loop" style="width:' + ((n - 1) / n * 100 - 2).toFixed(1) + '%" aria-hidden="true"></div>' : '';
      var strip = s.strip && s.strip.length ? '<div class="strip">' + s.strip.map(esc).join(' <i aria-hidden="true">→</i> ') + '</div>' : '';
      var low = (s.image || strip) ? '<div class="low">' + img(s.image, s.title) + strip + '</div>' : '';
      return '<div class="flowwrap"><div class="flow n' + n + '">' + nodes + '</div>' + loop + low + '</div>';
    },
    question: function (s) {
      var big = s.big === '?' ? '<div class="q q-mark" aria-hidden="true">?</div>' : '<div class="q q-text">' + esc(s.big) + '</div>';
      var pic = s.image && s.caption ? '<div class="capwrap">' + img(s.image, s.title) + '<div class="cap">' + esc(s.caption) + '</div></div>' : img(s.image, s.title);
      return '<div class="qa ' + (s.image ? 'has-img' : '') + '"><div class="qt">' + big + (s.sub ? '<p>' + esc(s.sub) + '</p>' : '') + '</div>' + pic + '</div>';
    },
    image: function (s) {
      var side = '';
      if (s.points && s.points.length) side += '<ul class="bul">' + s.points.map(function (p) { return '<li>' + hl(p) + '</li>'; }).join('') + '</ul>';
      if (s.callout) side += '<div class="callout">' + hl(s.callout) + '</div>';
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

  // 바닥글·머리표: "2차시 소개형 · 1교시", 머리표 "1교시 · 3/12"
  function shortTitle(d) { return String(d.title || '').split(' — ')[0]; }
  function chapterPos(slides) {
    var cnt = {}, seen = {};
    slides.forEach(function (s) { cnt[s.ch] = (cnt[s.ch] || 0) + 1; });
    return slides.map(function (s) { seen[s.ch] = (seen[s.ch] || 0) + 1; return { n: seen[s.ch], of: cnt[s.ch] }; });
  }
  function slideHTML(s, i, total, ctx) {
    var fn = R[s.type] || R.points;
    var plain = (s.type === 'cover');
    var head = plain ? '' : '<h2 class="st">' + esc(s.title) + '</h2>';
    var pos = ctx.pos[i];
    var chip = plain ? '' : '<span class="chip">' + esc(s.ch) + '교시 · ' + pos.n + '/' + pos.of + '</span>';
    return '<div class="slide t-' + esc(s.type) + '" data-type="' + esc(s.type) + '">' + chip + head +
      '<div class="sbody">' + (R[s.type] ? fn(s) : '') + '</div>' +
      '<div class="sf"><span>' + esc(ctx.short) + ' · ' + esc(s.ch) + '교시</span><span>' + (i + 1) + '</span></div></div>';
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
    var ctx = { short: shortTitle(d), pos: chapterPos(slides) };
    document.title = d.title + ' · 수업 슬라이드';
    $('viewer').hidden = false;
    document.body.classList.add('is-viewer');

    var sel = $('chsel');
    sel.innerHTML = (d.chapters || []).map(function (c) { return '<option value="' + c.n + '">' + c.n + '교시 · ' + esc(c.title) + '</option>'; }).join('');
    if (!(d.chapters || []).length) sel.hidden = true;

    function fromHash() { var n = parseInt((location.hash || '').replace('#', ''), 10); return n >= 1 && n <= total ? n - 1 : 0; }

    function render() {
      var s = slides[cur];
      $('stage').innerHTML = slideHTML(s, cur, total, ctx);
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
      if (sync.host) pushSoon();
    }
    // 글이 많은 장: 넘치면 그 장의 글자 크기를 조금씩 줄여 상자 안에 맞춤(최소 62%)
    function shrink() {
      var b = document.querySelector('#stage .sbody'); if (!b) return;
      var over = function () { var sl = b.closest('.slide'); return b.scrollHeight - b.clientHeight > 1 || b.scrollWidth - b.clientWidth > 1 || (sl && sl.scrollWidth - sl.clientWidth > 1); };
      b.style.fontSize = '';
      for (var f = 0.96; f >= 0.62 && over(); f -= 0.04) b.style.fontSize = f.toFixed(2) + 'em';
    }
    var remote = false;
    function go(n) {
      n = Math.max(0, Math.min(total - 1, n));
      if (!remote && sync.follow && n !== cur) setFollow(false);   // 학생이 직접 넘기면 따라가기 잠시 멈춤
      if (n !== cur) { cur = n; render(); }
    }

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

    $('more').onclick = function () { var b = $('bar'), on = !b.classList.contains('open'); b.classList.toggle('open', on); $('more').setAttribute('aria-expanded', on ? 'true' : 'false'); };
    $('prev').onclick = function () { go(cur - 1); };
    $('next').onclick = function () { go(cur + 1); };
    sel.onchange = function () {
      var n = parseInt(sel.value, 10);
      for (var i = 0; i < total; i++) if (slides[i].ch === n) { go(i); break; }
    };
    window.addEventListener('hashchange', function () { go(fromHash()); });

    // 교사 모드 비밀번호: 바꾸려면 새 번호의 SHA-256 값으로 TEACHER_PIN_HASH 를 바꿈(현재 0000)
    // 정적 사이트라 학생이 노트를 못 보게 막는 '가림막'일 뿐, 보안 장치는 아님
    var TEACHER_PIN_HASH = '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0';
    function unlocked() { return store.get('lessonTeacherOK') === TEACHER_PIN_HASH; }
    function hashPin(t) {
      if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error('no crypto'));
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)).then(function (b) {
        return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      });
    }
    function setTeacher(on) {
      document.body.classList.toggle('teacher', on);
      $('notes').hidden = !on; $('teacher').setAttribute('aria-pressed', on ? 'true' : 'false');
      $('teacher').classList.toggle('primary', on);
      store.set('lessonTeacher', on ? '1' : '0'); fit();
    }
    function teacher(on) {
      if (!on || unlocked()) { setTeacher(on); return; }
      var d = $('pindlg'); $('pinmsg').textContent = ''; $('pin').value = '';
      if (d.showModal && !d.open) d.showModal(); else d.setAttribute('open', '');
      $('pin').focus();
    }
    function closePin() { var d = $('pindlg'); if (d.close) d.close(); else d.removeAttribute('open'); }
    $('pinform').onsubmit = function (e) {
      e.preventDefault();
      hashPin($('pin').value.trim()).then(function (h) {
        if (h === TEACHER_PIN_HASH) { store.set('lessonTeacherOK', h); closePin(); setTeacher(true); }
        else { $('pinmsg').textContent = '비밀번호가 맞지 않아요.'; $('pin').select(); }
      }, function () { $('pinmsg').textContent = '이 브라우저에서는 확인할 수 없어요(https 주소로 열어 주세요).'; });
    };
    $('pincancel').onclick = closePin;
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

    /* ---------- 함께 보기: 교사(host)가 넘기면 학생(follow)이 따라감 ---------- */
    var sync = { host: null, room: null, follow: false, timer: null, pushT: null, lastT: 0, fails: 0 };
    var HKEY = 'lessonHost:' + id;
    var pill = $('syncpill');
    function setPill(text, cls, label) { pill.hidden = !text; pill.textContent = text || ''; pill.className = 'syncpill ' + (cls || ''); pill.setAttribute('aria-label', label || text || ''); }

    // 교사
    function hostPill() { setPill('학생 코드 ' + sync.host.room, '', '학생 연결 중, 수업 코드 ' + sync.host.room + ' (눌러서 코드 크게 보기)'); }
    function pushSoon() { clearTimeout(sync.pushT); sync.pushT = setTimeout(push, 120); }
    function push() {
      if (!sync.host) return;
      var h = sync.host;
      api('POST', { op: 'set', room: h.room, key: h.key, slide: cur, lesson: id }).then(function (j) {
        if (sync.host !== h) return;   // 그사이 연결을 끝냈으면 무시
        if (j._status === 404 || j._status === 403) { endHost(); setPill('학생 연결이 끝났어요', 'off'); $('syncmsg').textContent = '연결 시간이 지나 끝났어요. 다시 [학생 연결]을 누르세요.'; }
        else if (j._status !== 200) setPill('학생 연결: 다시 시도 중…', 'paused');
        else hostPill();
      }, function () { if (sync.host === h) setPill('학생 연결: 인터넷 확인', 'paused'); });
    }
    function showDlg() {
      var d = $('syncdlg');
      $('synccode').textContent = sync.host ? sync.host.room : '····';
      $('syncurl').textContent = location.host + location.pathname.replace(/index\.html$/, '');
      if (d.showModal && !d.open) d.showModal(); else d.setAttribute('open', '');
    }
    function startHost() {
      if (sync.host) { showDlg(); return; }
      $('syncmsg').textContent = '코드를 만드는 중…'; showDlg();
      api('POST', { op: 'create', lesson: id }).then(function (j) {
        if (j._status !== 200 || !j.room) { $('syncmsg').textContent = j._status === 429 ? '너무 자주 눌렀어요. 1분 뒤 다시 해 보세요.' : '지금 연결을 만들 수 없어요. 잠시 뒤 다시 해 보세요.'; return; }
        sync.host = { room: j.room, key: j.key }; store.set(HKEY, JSON.stringify(sync.host));
        document.body.classList.add('hosting');
        $('synccode').textContent = j.room; $('syncmsg').textContent = '학생 화면은 선생님이 넘기는 장으로 2~3초 안에 따라와요.';
        hostPill(); push();
      }, function () { $('syncmsg').textContent = '인터넷 연결을 확인해 주세요.'; });
    }
    function endHost() { clearTimeout(sync.pushT); sync.host = null; try { localStorage.removeItem(HKEY); } catch (e) {} document.body.classList.remove('hosting'); setPill(''); }
    $('syncbtn').onclick = startHost;
    $('syncstop').onclick = function () { endHost(); $('syncdlg').close ? $('syncdlg').close() : $('syncdlg').removeAttribute('open'); };
    $('syncclose').onclick = function () { $('syncdlg').close ? $('syncdlg').close() : $('syncdlg').removeAttribute('open'); };

    // 학생
    function setFollow(on) {
      sync.follow = on;
      if (on) { setPill('선생님 화면 따라가는 중 · ' + sync.room, '', '선생님 화면을 따라가는 중. 누르면 혼자 넘겨 보기'); poll(); }
      else setPill('↩ 선생님 화면으로', 'paused', '혼자 보는 중. 누르면 선생님 화면으로 돌아가기');
    }
    function poll() {
      clearTimeout(sync.timer);
      if (!sync.room) return;
      if (document.hidden) { sync.timer = setTimeout(poll, 3000); return; }
      api('GET', null, '?room=' + sync.room).then(function (j) {
        if (j._status === 404) { sync.room = null; sync.follow = false; setPill('수업 연결이 끝났어요', 'off'); return; }
        if (j._status !== 200) throw new Error(j._status);
        sync.fails = 0;
        if (j.lesson && j.lesson !== id) { location.replace(joinURL(j.lesson, sync.room) + '#' + ((j.slide | 0) + 1)); return; }
        if (sync.follow && j.slide !== cur) { remote = true; go(j.slide); remote = false; }
        sync.timer = setTimeout(poll, 2500);
      }).catch(function () {
        sync.fails++;
        if (sync.follow) setPill('연결 중…', 'paused', '선생님 화면에 다시 연결하는 중');
        sync.timer = setTimeout(function () { if (sync.follow) setFollow(true); else poll(); }, Math.min(15000, 2500 * sync.fails));
      });
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden && sync.room) poll(); });
    pill.onclick = function () {
      if (sync.host) showDlg();
      else if (sync.room) setFollow(!sync.follow);
    };

    cur = fromHash();
    setTeacher(store.get('lessonTeacher') === '1' && unlocked());
    var room = params.get('room');
    if (room && /^\d{4}$/.test(room)) { sync.room = room; }
    else { try { var hh = JSON.parse(store.get(HKEY) || 'null'); if (hh && hh.room && hh.key) { sync.host = hh; document.body.classList.add('hosting'); hostPill(); } } catch (e) {} }
    render();
    if (sync.room) setFollow(true);
    window.__lesson = { go: go, total: total, cur: function () { return cur; }, sync: sync };
  }

  if (!id) showList();
  else getJSON('data/' + encodeURIComponent(id) + '.json').then(showViewer).catch(function () {
    var e = $('err'); e.hidden = false; e.innerHTML = '수업 “' + esc(id) + '” 을(를) 찾지 못했어요. <a href="./">목록으로</a>';
  });
})();
