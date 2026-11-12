// 소품·지도 순수 함수 시험 (node, 브라우저 없음). 실행: node tests/sim-props.mjs
import * as P from '../bridge/sim/props.js';
import * as M from '../bridge/sim/maps.js';

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${ok ? '' : detail}`); };
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
const fresh = () => P.emptyProps();

// ---- 색·바닥 ----
{
  const p = fresh();
  p.chips.push({ x: 10, y: 10, w: 8, h: 8, color: 'red' });
  p.tracks.push({ pts: [[0, 50], [100, 50]], closed: false, width: 4 });
  check('colorAt: 칩 > 선 > 바닥색', P.colorAt(p, 12, 12).name === 'red' && P.colorAt(p, 50, 50).name === 'black' && P.colorAt(p, 50, 80, [1, 2, 3]).rgb.join() === '1,2,3');
  check('onLine: 선 폭/2 안쪽만', P.onLine(p, 50, 51.9) && !P.onLine(p, 50, 52.1));
  p.chips.push({ x: 48, y: 48, w: 6, h: 6, color: 'green' });
  check('칩이 선을 덮어도 onLine 은 선으로 읽음, 색은 칩', P.onLine(p, 50, 50) && P.colorAt(p, 50, 50).name === 'green');
  check('색 표: 6색 고정', P.COLOR_NAMES.join() === 'red,yellow,green,blue,black,white' && P.colorRGB('red')[0] > 200);
}
// ---- 충돌·광선 ----
{
  const p = fresh();
  p.boxes.push({ x: 40, y: 20, w: 20, h: 10 });
  p.objects.push({ x: 100, y: 100, r: 5, color: 'blue' });
  check('obstacleHit: 상자·물체(원) 닿음/안 닿음', P.obstacleHit(p, 50, 36, 7) && !P.obstacleHit(p, 50, 40, 7) && P.obstacleHit(p, 100, 92, 4) && !P.obstacleHit(p, 100, 80, 4));
  check('raycast: 상자 앞면까지 거리(센서 시작점 기준)', near(P.raycast(p, 50, 100, 0, 0, 500), 70) && near(P.raycast(p, 50, 100, 0, 8, 500), 62));
  check('raycast: 물체(원) 앞면 거리', near(P.raycast(p, 100, 150, 0), 45));
  check('raycast: max 초과·못 맞힘 = Infinity', P.raycast(p, 50, 100, 0, 0, 50) === Infinity && P.raycast(p, 50, 100, 180) === Infinity && P.raycast(p, 20, 100, 270) === Infinity);
  check('raycast: heading 90 = 오른쪽(물체까지 45cm)', near(P.raycast(p, 50, 100, 90), 45));
  const hit = P.raycastHit(p, 100, 150, 0);
  check('raycastHit: 맞은 소품 종류', hit.kind === 'object' && hit.prop === p.objects[0]);
}
// ---- 카메라용 ----
{
  const p = fresh();
  p.objects.push({ x: 100, y: 40, r: 4, color: 'red' }, { x: 100, y: 80, r: 4, color: 'green' }, { x: 160, y: 100, r: 4, color: 'blue' }, { x: 100, y: 200, r: 4, color: 'yellow' });
  const v = P.objectsInView(p, 100, 100, 0, 60, 100);
  check('objectsInView: 시야 안, 가까운 순서', v.length === 2 && v[0].color === 'green' && v[1].color === 'red' && v[0].dist < v[1].dist, JSON.stringify(v.map(x => x.color)));
  check('objectsInView: 거리·시야각 밖 제외, 오른쪽 90° 보면 파랑', P.objectsInView(p, 100, 100, 90, 40, 100).map(x => x.color).join() === 'blue');
  p.boxes.push({ x: 90, y: 55, w: 20, h: 4 });
  check('objectsInView: 상자에 가린 물체 제외', P.objectsInView(p, 100, 100, 0, 60, 100).map(x => x.color).join() === 'green');
  check('bearing: 오른쪽 물체는 +각', P.objectsInView(p, 100, 100, 0, 200, 100).find(x => x.color === 'blue').bearing > 0);
}
// ---- 프리셋 ----
{
  const ok = [];
  for (const [k] of P.TRACK_KINDS) {
    for (const [w, h] of [[240, 160], [140, 260], [300, 200]]) {
      const t = P.trackPreset(k, w, h), inside = t.pts.every(([x, y]) => x >= 0 && y >= 0 && x <= w && y <= h), st = P.startOnTrack(t);
      ok.push(inside && t.pts.length >= 2 && st && P.onLine({ tracks: [t] }, st.x, st.y));
    }
  }
  check('trackPreset 5종 × 3 크기: 장면 안, 출발 자리는 선 위', ok.every(Boolean), ok.join());
  check('oval/figure8/square 닫힘, straight/scurve 열림', P.trackPreset('oval', 240, 160).closed && P.trackPreset('figure8', 240, 160).closed && P.trackPreset('square', 240, 160).closed && !P.trackPreset('straight', 240, 160).closed && !P.trackPreset('scurve', 240, 160).closed);
  const o = P.trackPreset('oval', 240, 160), s = P.startOnTrack(o);
  check('startOnTrack(oval): 왼쪽 변 가운데에서 위(0°)를 봄', near(s.heading, 0, 1e-6) && near(s.x, o.pts[0][0]));
}
// ---- 자동 설정 ----
{
  const world = { size: { w: 300, h: 200 }, walls: false, start: { x: 150, y: 100, heading: 0 } };
  const robot = () => ({ x: 150, y: 100, heading: 0, radius: 9 });
  let p = fresh(), r = robot();
  let n = P.ensureFor(['color:red'], p, r, world);
  const c = p.chips[0];
  check('color:red → 앞에 빨간 칩 1개 + 안내', p.chips.length === 1 && c.color === 'red' && P.colorAt(p, c.x + 4, c.y + 4).name === 'red' && c.y + 4 < 100 && n.length === 1 && /빨간 컬러칩/.test(n[0]) && /끌어서/.test(n[0]), n.join());
  check('칩이 로봇 아래가 아님', Math.hypot(c.x + 4 - 150, c.y + 4 - 100) > 9 + 4);
  const snap = JSON.stringify(p);
  n = P.ensureFor(['color:red', 'distance'], p, robot(), world);
  check('다시 실행: 빨강 칩은 중복·이동 없음(상자만 새로)', p.chips.length === 1 && JSON.stringify(p.chips) === JSON.stringify(JSON.parse(snap).chips) && p.boxes.length === 1);
  const before = JSON.stringify(p);
  check('모두 있으면 아무것도 안 바꿈·안내 없음', P.ensureFor(['color:red', 'distance'], p, robot(), world).length === 0 && JSON.stringify(p) === before);
  // 사용자가 옮긴 칩
  p = fresh(); p.chips.push({ x: 200, y: 20, w: 8, h: 8, color: 'red' });
  P.ensureFor(['color:red'], p, robot(), world);
  check('사용자 칩(빨강)이 이미 있으면 그대로(옮기지 않음)', p.chips.length === 1 && p.chips[0].x === 200 && p.chips[0].y === 20);
  // 선
  p = fresh(); r = robot(); const w2 = JSON.parse(JSON.stringify(world));
  n = P.ensureFor(['line'], p, r, w2);
  check('line → 빈 장면에 선 생성, 로봇·시작을 선 위로', p.tracks.length === 1 && P.onLine(p, r.x, r.y) && w2.start.x === r.x && /검은 선 트랙/.test(n[0]), JSON.stringify(r));
  n = P.ensureFor(['line', 'color:red'], p, r, w2);
  const rc = p.chips[0];
  check('선이 있으면 빨간 칩은 선 위(앞쪽)에', n.length === 1 && P.onLine(p, rc.x + 4, rc.y + 4) && /선 위/.test(n[0]), n.join());
  p = fresh(); p.tracks.push({ pts: [[10, 10], [200, 10]], closed: false, width: 4 }); const tsnap = JSON.stringify(p.tracks);
  P.ensureFor(['line'], p, robot(), world);
  check('선이 이미 있으면 새로 깔지 않음', JSON.stringify(p.tracks) === tsnap);
  // 거리
  p = fresh(); P.ensureFor(['distance'], p, robot(), world);
  check('distance → 앞에 상자, 광선에 맞음', p.boxes.length === 1 && isFinite(P.raycast(p, 150, 100, 0, 8, 500)));
  p = fresh(); P.ensureFor(['distance'], p, robot(), { size: { w: 120, h: 260 }, walls: true });
  check('벽이 있는 장면은 상자를 더하지 않음', p.boxes.length === 0);
  p = fresh(); p.boxes.push({ x: 5, y: 5, w: 10, h: 10 });
  check('사용자 상자가 있으면 거리 필요를 이미 충족', P.ensureFor(['distance'], p, robot(), world).length === 0 && p.boxes.length === 1);
  p = fresh(); n = P.ensureFor(['object:green'], p, robot(), world);
  check('object:green → 초록 물체', p.objects.length === 1 && p.objects[0].color === 'green' && /초록 물체/.test(n[0]) && P.objectsInView(p, 150, 100, 0, 60, 200).length === 1);
}
// ---- 편집 순수 함수 ----
{
  const p = fresh();
  const b = P.addProp(p, 'box', 50, 50), o = P.addProp(p, 'object', 80, 50, { color: 'blue' }), ch = P.addProp(p, 'chip', 50, 80, { color: 'yellow' }), t = P.addProp(p, 'track', 0, 0, { pts: [[10, 120], [110, 120]] });
  check('addProp: 중심 기준 배치·색', b.x === 44 && b.w === 12 && o.color === 'blue' && ch.x === 46 && ch.color === 'yellow' && t.pts.length === 2);
  check('hitTest: 물체>상자>칩>선, 빈 곳은 null', P.hitTest(p, 80, 50, 3).kind === 'object' && P.hitTest(p, 50, 50, 3).kind === 'box' && P.hitTest(p, 50, 80, 3).kind === 'chip' && P.hitTest(p, 60, 120, 3).kind === 'track' && P.hitTest(p, 200, 200, 3) === null);
  const i = P.insertTrackPoint(t, 60, 123);
  check('insertTrackPoint: 가장 가까운 변 위에 끼움', i === 1 && t.pts.length === 3 && near(t.pts[1][1], 120, 0.01) && near(t.pts[1][0], 60, 0.01));
  check('hitTest(points): 점 우선, 점이 아니면 선(seg)', P.hitTest(p, 62, 121, 4, { items: false, points: true }).part === 'point' && P.hitTest(p, 30, 120, 2, { items: false, points: true }).part === 'seg');
  check('removeTrackPoint: 점 제거 → 2점 아래면 선 삭제', P.removeTrackPoint(p, t, 1) === 'point' && P.removeTrackPoint(p, t, 0) === 'track' && p.tracks.length === 0);
  check('removeProp', P.removeProp(p, 'box', b) && !p.boxes.length && !P.removeProp(p, 'box', b));
  const sq = P.trackPreset('square', 100, 100); sq.pts.splice(3); sq.closed = true;
  P.removeTrackPoint({ tracks: [sq] }, sq, 0);
  check('닫힌 선은 점이 2개로 줄면 열린 선으로', sq.closed === false && sq.pts.length === 2);
}
// ---- 저장·불러오기 ----
{
  const p = fresh(); P.addProp(p, 'box', 50, 50); P.addProp(p, 'object', 80, 50, { color: 'green' }); P.addProp(p, 'chip', 20, 20, { color: 'blue' }); p.tracks.push(P.trackPreset('oval', 200, 150));
  const text = P.exportScene(p, { scene: 'x', size: { w: 200, h: 150 } }), r = P.parseScene(text);
  check('exportScene → parseScene 왕복이 같음', r.ok && JSON.stringify(r.props) === JSON.stringify(p) && r.meta.scene === 'x');
  check('parseScene: 깨진 글·엉뚱한 JSON 은 오류 안내', !P.parseScene('{bad').ok && !P.parseScene('[1,2]').ok && !P.parseScene('{"a":1}').ok);
  const bad = P.normalizeProps({ boxes: [{ x: 'a', y: NaN, w: -5, h: 1e9 }, null, 3], objects: [{ x: 1, y: 2, r: 999, color: 'pink' }], chips: [{ x: 1, y: 1, color: 'nope' }], tracks: [{ pts: [[1, 2]] }, { pts: [[0, 0], [10, 10], ['a', 1]], closed: true, width: 99 }] });
  check('normalizeProps: 나쁜 값 고침(크기·색·점 개수·폭 제한)', bad.boxes.length === 1 && bad.boxes[0].w === 1 && bad.boxes[0].h === 400 && bad.objects[0].r === 40 && bad.objects[0].color === 'red' && bad.chips[0].color === 'red' && bad.tracks.length === 1 && bad.tracks[0].pts.length === 2 && bad.tracks[0].closed === false && bad.tracks[0].width === 20, JSON.stringify(bad));
  const store = {}; globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  check('saveScene → loadScene 왕복', P.saveScene('k', p, { a: 1 }) && JSON.stringify(P.loadScene('k').props) === JSON.stringify(p) && P.loadScene('none') === null);
  globalThis.localStorage = { getItem() { throw new Error('막힘'); }, setItem() { throw new Error('막힘'); } };
  check('저장소가 막혀도 오류 없이 false/null', P.saveScene('k', p) === false && P.loadScene('k') === null);
  const dst = fresh(); P.assignProps(dst, p);
  check('assignProps: 같은 객체에 내용만 바꿈', JSON.stringify(dst) === JSON.stringify(p) && dst.boxes !== p.boxes);
}
// ---- 지도 라이브러리 ----
{
  const ids = M.MAP_LIST.map(m => m.id);
  check('내장 지도: 레벨 1~4 모두 있음, id 중복 없음', [1, 2, 3, 4].every(l => M.MAP_LIST.some(m => m.level === l)) && new Set(ids).size === ids.length && ids.length >= 11, ids.length);
  const all = ids.map(id => M.buildMap(id));
  check('모든 지도 로드 오류 0(크기·선·시작 자리 정상, 시작은 장면 안)', all.every(m => m && m.size.w > 0 && m.props.tracks.length > 0 && m.start && m.start.x > 0 && m.start.y > 0 && m.start.x < m.size.w && m.start.y < m.size.h
    && m.props.tracks.every(t => t.pts.every(([x, y]) => x >= 0 && y >= 0 && x <= m.size.w && y <= m.size.h))), all.map(m => m && m.id).join());
  check('시작 자리는 선 위(로봇 중심 앞 센서 쪽 포함)', all.every(m => P.onLine(m.props, m.start.x, m.start.y) || P.onLine(m.props, m.start.x + Math.sin(m.start.heading * Math.PI / 180) * 7, m.start.y - Math.cos(m.start.heading * Math.PI / 180) * 7)), all.filter(m => !P.onLine(m.props, m.start.x, m.start.y)).map(m => m.id).join());
  check('buildMap 은 매번 새 복사본', M.buildMap('l1-oval').props !== M.buildMap('l1-oval').props && M.buildMap('nope') === null);
  // 끊긴 선
  const gp = M.buildMap('l3-gaps').props;
  check('끊긴 선 지도: 틈 가운데는 선 밖, 틈 앞뒤는 선 위, 틈 ≤20cm·앞 직선 ≥5cm', !P.onLine(gp, 50, 201) && !P.onLine(gp, 50, 121) && P.onLine(gp, 50, 240) && P.onLine(gp, 50, 150) && P.onLine(gp, 50, 60));
  // 타일 컴파일
  const g1 = M.parseGrid(['S1 I1 C2', '. . I0']);
  const c1 = M.compileTiles(g1, { width: 1.8 });
  check('compileTiles: 칸 이어짐(한 줄로 병합)·크기·시작 자리', c1.size.w === 90 && c1.size.h === 60 && c1.tracks.length === 1 && c1.start.heading === 90 && near(c1.start.x, 15) && near(c1.start.y, 15), JSON.stringify(c1.tracks.map(t => t.pts.length)));
  const pr = { tracks: c1.tracks };
  const L = c1.tracks[0].pts; let cont = true;
  for (let i = 0; i < L.length - 1; i++) for (let u = 0; u <= 1; u += 0.1) cont = cont && P.onLine(pr, L[i][0] + (L[i + 1][0] - L[i][0]) * u, L[i][1] + (L[i + 1][1] - L[i][1]) * u);
  const mids = [[30, 15], [60, 30], [75, 60]];   // 칸 경계 가운데 (S→I, I→C, C→I 이어지는 곳 중 C 의 S 출구와 아래 I 의 N 입구)
  check('타일 경계 가운데에서 선이 끊기지 않음', cont && [[30, 15], [60, 15], [75, 30]].every(([x, y]) => P.onLine(pr, x, y)), mids.join());
  // 모든 RCJ 지도의 이음새 시험: 이웃한 두 칸의 선 끝점이 서로 이어지는지(열린 끝점은 시작·도착·틈·교차로 가지만)
  for (const id of ['l4-rcj-a', 'l4-rcj-b', 'l4-rcj-c']) {
    const m = M.buildMap(id), g = m.tiles, ends = [];
    m.props.tracks.forEach(t => { if (!t.closed) ends.push(t.pts[0], t.pts[t.pts.length - 1]); });
    // 칸 안쪽(가장자리가 아닌) 열린 끝은 시작(칸 가운데)·도착(칸 가운데)·틈 끝·교차로 가지 끝뿐이어야 함 → 끊긴 선(틈)이 있는 A 를 빼고는 칸 경계 위 끝점의 이웃 칸이 비어 있지 않거나 가지임
    check(`${id}: 칸 격자 ${g.cols}×${g.rows}=${g.cols * 30}×${g.rows * 30}cm, 사용 칸 ≥8, 시작·도착 칸 있음`, m.size.w === g.cols * 30 && m.size.h === g.rows * 30 && g.cells.flat().filter(c => c.t !== 'empty').length >= 8 && g.cells.flat().some(c => c.t === 'start') && g.cells.flat().some(c => c.t === 'goal'));
    check(`${id}: 규칙 수치 — 선 1.8cm(1~2), 선이 가장자리에서 ≥10cm, 흰 바닥`, m.props.tracks.every(t => t.width === 1.8) && m.props.tracks.every(t => t.pts.every(([x, y]) => Math.min(x, y, m.size.w - x, m.size.h - y) >= 10 - 1e-6)) && !m.props.chips.some(c => c.color === 'white'));
    const greens = m.props.chips.filter(c => c.color === 'green');
    check(`${id}: 초록 표식은 25×25mm`, greens.every(c => c.w === 2.5 && c.h === 2.5));
    check(`${id}: 출처·"공식 맵 아님" 표기`, /robocupap\.org\/RCAP2025_Rules\/Rescue-Line-Entry-Rules-2025\.pdf/.test(m.source) && /공식 대회 맵 아님/.test(M.RCJ_LABEL) && /Rescue Line Entry 2025/.test(M.RCJ_LABEL));
  }
  const A = M.buildMap('l4-rcj-a');
  const gapTiles = A.tiles.cells.flat().filter(c => c.t === 'gap').length;
  check('RCJ A: 끊긴 선 칸(틈 16cm ≤20, 앞뒤 곧은 선 ≥5cm), 틈 가운데는 선 밖', gapTiles === 1 && !P.onLine(A.props, 75, 45) && P.onLine(A.props, 75 - 9, 45) && P.onLine(A.props, 75 + 9, 45));
  const B = M.buildMap('l4-rcj-b'), mk = B.props.chips.find(c => c.color === 'green');
  check('RCJ B: 초록 표식이 교차로 바로 앞(0~6cm), 돌 쪽(위=왼쪽) 선 옆에 붙음', mk && mk.x + 2.5 < 75 - 0.9 && mk.x + 2.5 > 75 - 8 && mk.y + 2.5 <= 75 - 0.9 && mk.y > 75 - 6 && P.colorAt(B.props, mk.x + 1, mk.y + 1).name === 'green');
  const C = M.buildMap('l4-rcj-c'), ob = C.props.boxes[0];
  check('RCJ C: 장애물이 가장자리에서 ≥25cm, 가까운 다른 선(교차로 가지) ≥25cm 밖', ob && Math.min(ob.x, ob.y, C.size.w - ob.x - ob.w, C.size.h - ob.y - ob.h) >= 25 && C.props.tracks.every(t => P.distToTrack(t, ob.x + 5, ob.y + 5) <= 6 || P.distToTrack(t, ob.x + 5, ob.y + 5) >= 25));
  // 직각 교차로 지도에는 초록 표식이 없다(직진)
  check('레벨 3 교차로: 표식(초록 칩) 없음', !M.buildMap('l3-cross').props.chips.some(c => c.color === 'green'));
  // 지도 글 왕복
  const m0 = M.buildMap('l4-rcj-b'), rt = M.parseMapJSON(M.mapToJSON(m0));
  check('지도 JSON 내보내기→가져오기 왕복(크기·시작·소품·타일)', rt.ok && JSON.stringify(rt.map.props) === JSON.stringify(m0.props) && JSON.stringify(rt.map.size) === JSON.stringify(m0.size) && JSON.stringify(rt.map.start) === JSON.stringify(m0.start) && JSON.stringify(rt.map.tiles) === JSON.stringify(m0.tiles));
  check('지도 JSON: 나쁜 입력은 오류 문구', !M.parseMapJSON('x').ok && !M.parseMapJSON('{"size":{"w":1,"h":1}}').ok && !M.parseMapJSON('{"size":{"w":99999,"h":10}}').ok);
  // 내 지도(이름으로 여러 개)
  const store = {}; globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const mine = { ...M.buildMap('l1-oval') }; mine.props.boxes.push({ x: 100, y: 70, w: 12, h: 12 });
  check('내 지도 이름으로 저장 2개 → 목록·불러오기 같은 소품', M.saveCustom('가', mine) && M.saveCustom('나', M.buildMap('l2-square')) && M.listCustom().join() === '가,나' && JSON.stringify(M.loadCustom('가').props) === JSON.stringify(mine.props) && M.loadCustom('가').title === '가' && M.loadCustom('없음') === null);
  check('내 지도 삭제·빈 이름 거부', M.deleteCustom('가') && M.listCustom().join() === '나' && !M.saveCustom('  ', mine));
  globalThis.localStorage = { getItem() { throw new Error('막힘'); }, setItem() { throw new Error('막힘'); } };
  check('저장소가 막혀도 오류 없음', M.listCustom().length === 0 && M.saveCustom('x', mine) === false && M.loadCustom('x') === null);
  // 8자·교차 포함 모양에서도 normalize 후 유효
  check('타일 형식 normalizeGrid: 잘못된 칸은 빈칸', M.normalizeGrid({ cells: [[{ t: 'zzz', r: 9 }, { t: 'line', r: 5 }]] }).cells[0].map(c => c.t + c.r).join() === 'empty0,line1' && M.normalizeGrid({}) === null);
}

const fail = results.filter(x => !x).length;
console.log(`\n결과: ${results.length - fail} 통과 / ${fail} 실패 (총 ${results.length})`);
process.exit(fail ? 1 : 0);
