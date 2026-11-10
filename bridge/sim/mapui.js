// 지도 라이브러리 화면(고르기·타일 편집·내 지도 저장·가져오기/내보내기) — 교구와 무관. props.js 의 편집기와 함께 씀
//  attachMapLibrary(el, { editor, host })
//   host = { getProps(), getSize(), getStart(), apply({size,start,props?,title}), robotToStart() }
//   apply 는 월드 크기·시작 자리·소품을 바꾸고 로봇을 시작 자리로 돌려놓는 일을 맡는다(교구마다 다름).
import { LEVELS, MAP_LIST, buildMap, RCJ_LABEL, RCJ_URL, TILE_TYPES, emptyGrid, normalizeGrid, compileTiles, mapToJSON, parseMapJSON, listCustom, saveCustom, loadCustom, deleteCustom } from './maps.js';
import { cloneProps } from './props.js';

const el = (tag, attrs = {}, kids = []) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'text') e.textContent = v; else e.setAttribute(k, v); }
  for (const c of [].concat(kids)) if (c) e.appendChild(c);
  return e;
};
const CELL = 36;

// 선택 옵션(교구마다): mapLabel(map) = 목록에 보일 이름, tiles:false = 타일 편집 칸을 숨김(선 지도를 만들 필요 없는 교구)
export function attachMapLibrary(host_el, { editor, host, mapLabel = null, tiles = true }) {
  const lib = { cur: { id: null, title: '', custom: false, source: '', note: '', level: 0 }, grid: null, tileType: 'line', rot: 0, rotateMode: false, tileOn: false };
  const say = (t) => { status.textContent = t; if (editor && editor.say) editor.say(t); };
  const snapshot = () => ({ id: lib.cur.custom ? 'custom' : lib.cur.id, title: lib.cur.title, size: { ...host.getSize() }, start: { ...host.getStart() }, props: cloneProps(host.getProps()), tiles: lib.grid ? JSON.parse(JSON.stringify(lib.grid)) : null, source: lib.cur.source, note: lib.cur.note });
  lib.snapshot = snapshot;

  // ---- 틀 ----
  const root = el('div', { class: 'pe-map pe-lib' });
  const status = el('p', { id: 'map-status', role: 'status', 'aria-live': 'polite', style: 'flex:1 1 100%;margin:0;font-weight:700;font-size:14px' });
  const banner = el('p', { id: 'map-banner', style: 'flex:1 1 100%;margin:0;font-size:13px;line-height:1.5;overflow-wrap:anywhere' });
  const pick = el('select', { id: 'map-pick', 'aria-label': '지도 고르기', style: 'max-width:100%;min-width:0;font:inherit;padding:8px' }, [el('option', { value: '', text: '지도 고르기…' })]);
  for (const lv of [1, 2, 3, 4]) {
    const g = el('optgroup', { label: LEVELS[lv] });
    for (const m of MAP_LIST.filter(x => x.level === lv)) g.appendChild(el('option', { value: m.id, text: mapLabel ? mapLabel(m) : m.title }));
    pick.appendChild(g);
  }
  const customGroup = el('optgroup', { label: '내 지도(저장한 것)' });
  pick.appendChild(customGroup);
  const rowPick = el('div', { class: 'pe-row' }, [el('label', { for: 'map-pick', text: '지도', style: 'font-size:13.5px;font-weight:700' }), pick]);
  const btn = (text, fn, id) => { const b = el('button', { type: 'button', text, id }); b.addEventListener('click', fn); return b; };
  const rowStart = el('div', { class: 'pe-row' }, [btn('🤖 로봇 시작 자리로', () => { host.robotToStart(); say('로봇을 이 지도의 시작 자리에 놓았어요.'); }, 'map-tostart')]);

  // ---- 내 지도 ----
  const nameIn = el('input', { id: 'map-name', type: 'text', maxlength: '30', placeholder: '내 지도 이름', 'aria-label': '내 지도 이름', style: 'font:inherit;padding:8px;min-width:0;flex:1 1 120px' });
  const savedSel = el('select', { id: 'map-saved', 'aria-label': '저장한 내 지도', style: 'font:inherit;padding:8px;min-width:0;max-width:100%' });
  const refreshSaved = () => {
    const names = listCustom(), keep = savedSel.value;
    savedSel.textContent = ''; customGroup.textContent = '';
    savedSel.appendChild(el('option', { value: '', text: names.length ? '저장한 지도 고르기' : '(저장한 지도 없음)' }));
    for (const n of names) { savedSel.appendChild(el('option', { value: n, text: n })); customGroup.appendChild(el('option', { value: 'c:' + n, text: n })); }
    if (names.includes(keep)) savedSel.value = keep;
  };
  const rowSave = el('div', { class: 'pe-row' }, [nameIn, btn('💾 이름으로 저장', () => {
    const n = nameIn.value.trim(); if (!n) { say('저장할 이름을 먼저 쓰세요.'); return; }
    if (saveCustom(n, snapshot())) { lib.cur.title = n; lib.cur.custom = true; refreshSaved(); savedSel.value = n; render(); say(`'${n}' 지도를 저장했어요 (이 브라우저에만 저장돼요. 다른 컴퓨터는 내보내기로 나눠요).`); } else say('저장할 수 없어요 (브라우저 저장소가 막혀 있어요).');
  }, 'map-save')]);
  const rowLoad = el('div', { class: 'pe-row' }, [savedSel,
    btn('📂 불러오기', () => { const m = loadCustom(savedSel.value); if (!m) { say('불러올 지도를 고르세요.'); return; } load(m, true); nameIn.value = m.title; say(`'${m.title}' 지도를 불러왔어요.`); }, 'map-load'),
    btn('🗑 삭제', () => { const n = savedSel.value; if (n && deleteCustom(n)) { refreshSaved(); say(`'${n}' 지도를 지웠어요.`); } else say('지울 지도를 고르세요.'); }, 'map-del')]);

  // ---- 나누기(JSON) ----
  const ta = el('textarea', { id: 'map-json', 'aria-label': '지도 글자(JSON)', spellcheck: 'false', hidden: '' });
  const file = el('input', { type: 'file', accept: '.json,application/json', id: 'map-file', hidden: '' });
  const importText = (text) => { const r = parseMapJSON(text); if (!r.ok) { say(r.error); return false; } load(r.map, true); nameIn.value = r.map.title; say(`'${r.map.title}' 지도를 가져왔어요.`); return true; };
  lib.exportText = () => mapToJSON({ ...snapshot(), id: lib.cur.id || 'custom' });
  lib.importText = importText;
  file.addEventListener('change', () => { const f = file.files && file.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => importText(String(rd.result)); rd.readAsText(f); file.value = ''; });
  const rowShare = el('div', { class: 'pe-row' }, [
    btn('내보내기(글자)', () => { ta.hidden = false; ta.value = lib.exportText(); ta.select(); say('글자를 복사해 두거나 [파일로 저장]을 누르세요. 선생님이 만든 지도를 학생에게 나눌 때 써요.'); }, 'map-export'),
    btn('가져오기(글자)', () => { if (ta.hidden) { ta.hidden = false; ta.value = ''; say('가져올 글자를 붙여 넣고 [가져오기]를 다시 누르세요.'); } else importText(ta.value); }, 'map-import'),
    btn('파일로 저장', () => { const a = el('a', { href: URL.createObjectURL(new Blob([lib.exportText()], { type: 'application/json' })), download: (lib.cur.title || 'map').replace(/[^\w가-힣-]+/g, '_') + '.json' }); document.body.appendChild(a); a.click(); a.remove(); }, 'map-download'),
    btn('파일 열기', () => file.click(), 'map-open'), file]);

  // ---- 타일 편집 ----
  const tileOn = el('input', { type: 'checkbox', id: 'tile-on', 'aria-label': '타일로 만들기' });
  const colsSel = el('select', { id: 'tile-cols', 'aria-label': '가로 칸 수', style: 'font:inherit;padding:6px' }), rowsSel = el('select', { id: 'tile-rows', 'aria-label': '세로 칸 수', style: 'font:inherit;padding:6px' });
  for (let i = 3; i <= 10; i++) colsSel.appendChild(el('option', { value: String(i), text: i + '칸' }));
  for (let i = 2; i <= 8; i++) rowsSel.appendChild(el('option', { value: String(i), text: i + '칸' }));
  const palette = el('div', { class: 'pe-row', role: 'group', 'aria-label': '타일 종류' });
  const palBtns = [];
  const palAdd = (id, text) => { const b = el('button', { type: 'button', 'data-tile': id, text, 'aria-pressed': 'false' }); b.addEventListener('click', () => { if (id === 'rotate') lib.rotateMode = true; else { lib.rotateMode = false; lib.tileType = id; } renderPal(); }); palBtns.push(b); palette.appendChild(b); };
  for (const t of TILE_TYPES) palAdd(t.id, t.ko);
  palAdd('rotate', '↻ 칸 돌리기');
  const rotBtn = btn('방향 0°', () => { lib.rot = (lib.rot + 1) % 4; renderPal(); }, 'tile-rot');
  rotBtn.setAttribute('aria-label', '새로 놓을 타일의 방향 바꾸기');
  const tc = el('canvas', { id: 'tile-canvas', 'aria-label': '타일 격자 (칸을 눌러 타일을 놓아요)', style: 'max-width:100%;height:auto;touch-action:manipulation;border:1px solid var(--line-strong,#999);border-radius:8px;background:#f4f4f4;cursor:pointer' });
  const tileBox = el('div', { class: 'pe-row', id: 'tile-box' });
  tileBox.append(
    el('div', { class: 'pe-row' }, [el('label', {}, [tileOn, el('span', { text: ' 타일로 만들기(켜면 선·컬러칩이 타일로 다시 만들어져요. 상자·물체는 그대로)' })])]),
    el('div', { class: 'pe-row' }, [el('span', { text: '크기', style: 'font-size:13.5px' }), colsSel, el('span', { text: '×' }), rowsSel, el('span', { text: '한 칸 = 30cm', style: 'font-size:13px' }), rotBtn]),
    palette, tc,
    el('p', { class: 'note', text: '칸을 누르면 고른 타일이 놓여요. 타일은 선이 칸 가장자리 가운데에서 이어지게 만들어져요. 점 편집이나 컬러칩은 타일 뒤에 더할 수 있어요(타일을 다시 고치면 선·칩이 다시 만들어져요).', style: 'margin:0;flex:1 1 100%;font-size:13px' }));
  const tileDet = el('details', { id: 'tile-det' }, [el('summary', { text: '타일로 지도 만들기', style: 'cursor:pointer;font-weight:700;min-height:36px;display:flex;align-items:center' }), tileBox]);

  const renderPal = () => {
    for (const b of palBtns) b.setAttribute('aria-pressed', String(b.dataset.tile === 'rotate' ? lib.rotateMode : (!lib.rotateMode && b.dataset.tile === lib.tileType)));
    rotBtn.textContent = `방향 ${lib.rot * 90}°`;
  };
  const drawTiles = () => {
    const g = lib.grid; if (!g) { tc.width = CELL * 4; tc.height = CELL * 2; tc.getContext('2d').clearRect(0, 0, tc.width, tc.height); return; }
    tc.width = g.cols * CELL; tc.height = g.rows * CELL;
    const c = tc.getContext('2d'); c.fillStyle = '#fbfbfb'; c.fillRect(0, 0, tc.width, tc.height);
    c.strokeStyle = '#ccc'; c.lineWidth = 1;
    for (let x = 0; x <= g.cols; x++) { c.beginPath(); c.moveTo(x * CELL + .5, 0); c.lineTo(x * CELL + .5, tc.height); c.stroke(); }
    for (let y = 0; y <= g.rows; y++) { c.beginPath(); c.moveTo(0, y * CELL + .5); c.lineTo(tc.width, y * CELL + .5); c.stroke(); }
    g.cells.forEach((row, cy) => row.forEach((cell, cx) => {
      if (cell.t === 'empty') return;
      const one = compileTiles({ cols: 1, rows: 1, cells: [[cell]] }, { tile: 30, width: 2 }), k = CELL / 30;
      c.save(); c.translate(cx * CELL, cy * CELL); c.strokeStyle = '#161616'; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
      for (const t of one.tracks) { c.beginPath(); t.pts.forEach(([x, y], i) => (i ? c.lineTo(x * k, y * k) : c.moveTo(x * k, y * k))); c.stroke(); }
      if (cell.t === 'goal') { c.fillStyle = '#3262c8'; c.fillRect(CELL / 2 - 6, CELL / 2 - 6, 12, 12); }
      if (cell.t === 'start') { c.fillStyle = '#1fa463'; c.beginPath(); c.arc(CELL / 2, CELL / 2, 4, 0, 7); c.fill(); }
      c.restore();
    }));
  };
  const syncTilePanel = () => {
    tileOn.checked = lib.tileOn;
    if (lib.grid) { colsSel.value = String(lib.grid.cols); rowsSel.value = String(lib.grid.rows); }
    drawTiles();
  };
  const gridIsEmpty = () => !lib.grid || lib.grid.cells.every(r => r.every(c => c.t === 'empty'));
  const markCustom = () => {
    if (!lib.cur.custom) { lib.cur.base = lib.cur.title; lib.cur.custom = true; lib.cur.title = lib.cur.base ? `내 지도 (${lib.cur.base} 고침)` : '내 지도'; render(); }
  };
  // 타일 → 월드 (선·칩 갈아 끼움)
  const applyTiles = () => {
    const g = lib.grid, P = host.getProps(), size = { w: g.cols * 30, h: g.rows * 30 };
    if (gridIsEmpty()) { P.tracks = []; P.chips = []; host.apply({ size, start: { x: size.w / 2, y: size.h / 2, heading: 0 } }); return; }
    const width = lib.cur.level === 4 ? 1.8 : ((P.tracks[0] && P.tracks[0].width) || 4);
    const c = compileTiles(g, { tile: 30, width });
    P.tracks = c.tracks; P.chips = c.chips;
    host.apply({ size: c.size, start: c.start });
  };
  lib.setTile = (cx, cy, type, r) => {   // 시험·화면 공용
    if (!lib.grid) lib.grid = emptyGrid(Math.max(3, Math.round(host.getSize().w / 30)), Math.max(2, Math.round(host.getSize().h / 30)));
    if (cx < 0 || cy < 0 || cx >= lib.grid.cols || cy >= lib.grid.rows) return false;
    const cell = lib.grid.cells[cy][cx];
    if (type === 'rotate') { if (cell.t !== 'empty') cell.r = (cell.r + 1) % 4; } else { cell.t = type; cell.r = type === 'empty' ? 0 : r || 0; }
    lib.tileOn = true; markCustom(); applyTiles(); syncTilePanel(); return true;
  };
  lib.resizeTiles = (cols, rows) => {
    const old = lib.grid || emptyGrid(cols, rows), g = emptyGrid(cols, rows);
    for (let y = 0; y < Math.min(rows, old.rows); y++) for (let x = 0; x < Math.min(cols, old.cols); x++) g.cells[y][x] = { ...old.cells[y][x] };
    lib.grid = g; lib.tileOn = true; markCustom(); applyTiles(); syncTilePanel();
  };
  tc.addEventListener('pointerdown', (ev) => {
    if (!lib.grid) return;
    const r = tc.getBoundingClientRect(), cx = Math.floor((ev.clientX - r.left) / r.width * lib.grid.cols), cy = Math.floor((ev.clientY - r.top) / r.height * lib.grid.rows);
    lib.setTile(cx, cy, lib.rotateMode ? 'rotate' : lib.tileType, lib.rot);
  });
  tileOn.addEventListener('change', () => {
    lib.tileOn = tileOn.checked;
    if (lib.tileOn && !lib.grid) { lib.grid = emptyGrid(Math.max(3, Math.round(host.getSize().w / 30)), Math.max(2, Math.round(host.getSize().h / 30))); say('빈 타일 격자를 만들었어요. 칸을 눌러 타일을 놓으면 지금의 선은 타일 선으로 바뀌어요.'); }
    syncTilePanel();
  });
  colsSel.addEventListener('change', () => lib.resizeTiles(+colsSel.value, lib.grid ? lib.grid.rows : +rowsSel.value));
  rowsSel.addEventListener('change', () => lib.resizeTiles(lib.grid ? lib.grid.cols : +colsSel.value, +rowsSel.value));

  // ---- 불러오기 ----
  function render() {
    status.textContent = `현재 지도: ${lib.cur.title || '(없음)'}${lib.cur.custom ? ' — 고쳐서 내 지도가 되었어요. [이름으로 저장]을 눌러 두세요.' : ''}`;
    const rcj = /robocupap/.test(lib.cur.source || '');
    banner.textContent = '';
    if (rcj) { banner.appendChild(el('strong', { text: RCJ_LABEL })); banner.appendChild(document.createTextNode(' ')); banner.appendChild(el('a', { href: RCJ_URL, target: '_blank', rel: 'noopener', text: '규칙 문서' })); }
    if (lib.cur.note) banner.appendChild(el('span', { text: (rcj ? ' ' : '') + lib.cur.note }));
    banner.style.display = banner.childNodes.length ? '' : 'none';
  }
  function load(map, asCustom) {
    lib.cur = { id: map.id, title: map.title, custom: !!asCustom, base: '', source: map.source || '', note: map.note || '', level: map.level || 0 };
    lib.grid = map.tiles ? normalizeGrid(map.tiles) : null; lib.tileOn = !!lib.grid;
    if (editor) { editor.sel = null; editor.activeTrack = null; }
    host.apply({ size: map.size, start: map.start, props: map.props, title: map.title });
    if (editor && editor.refresh) editor.refresh();
    render(); syncTilePanel();
  }
  lib.load = load;
  lib.loadBuiltin = (id) => { const m = buildMap(id); if (!m) return false; load(m, false); pick.value = id; say(`'${m.title}' 지도를 깔았어요. 고치면 '내 지도'가 돼요.`); return true; };
  lib.loadCustomByName = (n) => { const m = loadCustom(n); if (!m) return false; load(m, true); return true; };
  pick.addEventListener('change', () => { const v = pick.value; if (!v) return; if (v.startsWith('c:')) lib.loadCustomByName(v.slice(2)); else lib.loadBuiltin(v); });
  if (editor) editor.listeners.push((reason) => { if (lib.cur.id || lib.cur.custom) markCustom(); else { lib.cur.custom = true; lib.cur.title = '내 지도'; render(); } });

  root.append(status, banner, rowPick, rowStart, rowSave, rowLoad, rowShare, ta);
  host_el.append(root); if (tiles) host_el.append(tileDet);
  refreshSaved(); renderPal(); render(); syncTilePanel();
  lib.refreshSaved = refreshSaved;
  return lib;
}
