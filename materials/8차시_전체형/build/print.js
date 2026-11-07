const L = require('./lib');
const { K, C, W, IMG, para, h, small, label, lines, gap, tiny, image, table, box, section, makeDoc, save, AlignmentType: AL, VerticalAlign, BorderStyle, Paragraph, TextRun, ShadingType, HeightRule, WidthType, Table, TableRow, TableCell } = L;
const OUT = '/home/user/microbit/materials/8차시_전체형/인쇄용_준비물.docx';
const pages = [];
const M = { top: 500, right: 500, bottom: 700, left: 500 };
const PW = 11906 - 1000; // 10906
const CUT = C.line;
const px = (cm) => Math.round(cm / 2.54 * 96);
const pg = (kids, footer) => pages.push(section([...kids, tiny()], { noHeader: true, margin: M, footer: '8차시 전체형 · 인쇄용 준비물 · ' + footer }));

// generic cut-line grid: cols x rows, every cell built by fn(i) -> {t:[...], fill?}
function grid(cols, rows, rowH, n, fn, o = {}) {
  const cw = Math.floor(PW / cols);
  const widths = Array(cols).fill(cw); widths[cols - 1] = PW - cw * (cols - 1);
  const trs = [];
  for (let r = 0; r < rows; r++) {
    const cells = [];
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const spec = i < n ? fn(i) : { t: '' };
      cells.push(L.cell({ valign: VerticalAlign.CENTER, dashed: true, borderColor: CUT, ...spec, t: spec.t === '' ? [tiny()] : spec.t }, { w: widths[c] }));
    }
    trs.push(new TableRow({ cantSplit: true, height: { value: rowH, rule: HeightRule.EXACT }, children: cells }));
  }
  return new Table({ width: { size: PW, type: WidthType.DXA }, columnWidths: widths, rows: trs });
}
const ctr = (t, o = {}) => para(t, { align: AL.CENTER, ...o });
const title = (t, sub) => [para(t, { sz: 26, bold: true, color: C.blue, after: 40, before: 0 }), ...(sub ? [para(sub, { sz: 16, color: C.sub, after: 60 })] : [])];

// ---- 1~4 색 카드
[['빨강', 'c_red'], ['노랑', 'c_yellow'], ['초록', 'c_green'], ['주황', 'c_orange']].forEach(([name, img], i) => {
  K(1, 1);
  pg([grid(2, 2, 7700, 4, () => ({ t: [image(IMG + img + '.png', px(7), { after: 120 }), ctr(name, { sz: 22, bold: true, color: C.sub, after: 0 })] }))], `색 카드 ${i + 1}/4 (${name})`);
});

// ---- 5 모둠번호 라벨
{
  const rows = [];
  for (let n = 1; n <= 8; n++) rows.push([`로보독 R${n}`, `PC용 B${n}`, `03용 R${n}`, `04용 R${n}`]);
  const widths = [2726, 2726, 2726, 2728];
  const trs = rows.map((r) => new TableRow({ cantSplit: true, height: { value: 1450, rule: HeightRule.EXACT },
    children: r.map((t, i) => L.cell({ t: [para(t, { sz: 40, bold: true, color: C.blue, align: AL.CENTER, after: 0 })], dashed: true, borderColor: CUT }, { w: widths[i] })) }));
  pg([
    ...title('모둠번호 라벨', '점선을 따라 잘라 로보독·마이크로비트·USB 마이크로비트에 붙여요. 같은 모둠은 번호가 같아야 해요. (R = 로보독 쪽 라디오, B = PC용 USB 마이크로비트)'),
    new Table({ width: { size: PW, type: WidthType.DXA }, columnWidths: widths, rows: trs }),
    gap(200),
    new Table({ width: { size: PW, type: WidthType.DXA }, columnWidths: [PW], rows: [new TableRow({ height: { value: 1700, rule: HeightRule.EXACT }, children: [
      L.cell({ t: [para('로보독 이름:  ______________________________', { sz: 36, bold: true, align: AL.CENTER, after: 0 }), para('(1차시 이름 짓기 · 모둠번호 ____ )', { sz: 18, color: C.sub, align: AL.CENTER, after: 0 })], dashed: true, borderColor: CUT }, { w: PW })] })] }),
  ], '모둠번호 라벨');
}

// ---- 6 안전 포스터
{
  const w3 = [3635, 3635, 3636];
  const way = (img, t, color) => L.cell({ t: [image(IMG + img + '.png', px(3.2), { before: 100, after: 100 }), para(t, { sz: 26, bold: true, align: AL.CENTER, after: 0 })], borderColor: color, valign: VerticalAlign.CENTER }, { w: w3[0] });
  pg([
    gap(300),
    para('로보독 안전 약속', { sz: 80, bold: true, color: C.blue, align: AL.CENTER, after: 200, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.blue, space: 8 } } }),
    gap(500),
    para('1  떨어뜨리지 않기', { sz: 72, bold: true, align: AL.CENTER, after: 360 }),
    para('2  천천히 (속도 30 이하)', { sz: 72, bold: true, align: AL.CENTER, after: 360 }),
    para('3  위험하면 바로 멈추기', { sz: 72, bold: true, color: C.red, align: AL.CENTER, after: 700 }),
    para('멈추는 방법', { sz: 36, bold: true, color: C.blue, after: 100 }),
    new Table({ width: { size: PW, type: WidthType.DXA }, columnWidths: w3, rows: [new TableRow({ height: { value: 3600, rule: HeightRule.EXACT }, children: [
      way('i_stop', '화면 ■ 멈춤 / Esc', C.red), way('i_button', '본체 버튼 (눈에 X)', C.orange), way('i_power', '전원 스위치', C.green)] })] }),
    gap(300),
    para('신호가 2초 끊기면 로보독이 스스로 멈춰요.', { sz: 28, align: AL.CENTER, color: C.sub, after: 0 }),
  ], '안전 포스터 (교실 게시)');
}

// ---- 7~8 문제 카드
const PROB = [
  ['환경', C.green, ['분리배출을 헷갈려서 일반 쓰레기통에 재활용품이 들어가요.', '교실에 아무도 없는데 불이 켜져 있어요.', '급식 잔반이 너무 많이 남아요.', '비 오는 날 우산을 두고 가서 우산이 쌓여요.']],
  ['사회적 약자', C.blue, ['시각장애인이 횡단보도 앞에서 신호를 알기 어려워요.', '땅콩 알레르기가 있는 친구가 급식 반찬을 알아보기 어려워요.', '휠체어 친구가 복도 장애물을 피하기 어려워요.', '한글을 막 배운 동생이 안내 표지를 이해하기 어려워요.']],
  ['정서', C.orange, ['쉬는 시간에 혼자 있는 친구가 외로워요.', '시험 전에 긴장해서 마음이 불안해요.', '칭찬을 받으면 좋은데 칭찬할 기회가 적어요.', '학교에 오기 싫은 아침이 있어요.']],
  ['재난', C.red, ['불이 났을 때 어느 쪽으로 대피할지 헷갈려요.', '지진이 나면 책상 밑으로 가야 하는데 잊어버려요.', '계단에서 사람이 몰려 위험해요.', '비상구 앞에 물건이 쌓여 있어요.']],
];
function probPage(a, b, no) {
  const items = [];
  [a, b].forEach(([area, col, txt]) => txt.forEach((t) => items.push([area, col, t])));
  items.push(['내가 만든 문제', C.sub, null], ['내가 만든 문제', C.sub, null]);
  pg([grid(2, 5, 3100, 10, (i) => {
    const [area, col, t] = items[i];
    const band = para(area, { sz: 22, bold: true, color: C.white, fill: col, align: AL.CENTER, after: 120 });
    return { t: [band, t ? para(t, { sz: 30, after: 0, align: AL.LEFT }) : para('내가 만든 문제:', { sz: 24, bold: true, color: C.sub, after: 0 })], valign: VerticalAlign.TOP, mt: 90 };
  })], `문제 카드 ${no}/2`);
}
K(1, 1);
probPage(PROB[0], PROB[1], 1); probPage(PROB[2], PROB[3], 2);

// ---- 9 매트릭스
{
  const big = (ch, t) => ({ t: [para(ch, { sz: 140, bold: true, color: 'D5DBEA', after: 0 }), para(t || '', { sz: 20, color: C.sub, after: 0 })], valign: VerticalAlign.TOP });
  const widths = [1300, 4803, 4803];
  const hc = (t) => L.cell({ t: [para(t, { sz: 26, bold: true, color: C.white, align: AL.CENTER, after: 0 })], fill: C.blue }, { w: 0 });
  const mk = (t, w, o = {}) => L.cell({ t: [para(t, { sz: 26, bold: true, color: o.color || C.white, align: AL.CENTER, after: 0 })], fill: o.fill || C.blue }, { w });
  pg([
    ...title('2×2 매트릭스 판', '모둠당 1장 + 포스트잇. A3로 확대하면 더 좋아요. 문제를 포스트잇에 써서 알맞은 칸에 붙여요.'),
    new Table({ width: { size: PW, type: WidthType.DXA }, columnWidths: widths, rows: [
      new TableRow({ height: { value: 700, rule: HeightRule.EXACT }, children: [mk('', widths[0]), mk('해결 가능성 높음', widths[1]), mk('해결 가능성 낮음', widths[2])] }),
      new TableRow({ height: { value: 6500, rule: HeightRule.EXACT }, children: [mk('중요성 높음', widths[0]), L.cell(big('A'), { w: widths[1] }), L.cell(big('B'), { w: widths[2] })] }),
      new TableRow({ height: { value: 6500, rule: HeightRule.EXACT }, children: [mk('중요성 낮음', widths[0]), L.cell(big('C'), { w: widths[1] }), L.cell(big('D'), { w: widths[2] })] }),
    ] }),
  ], '매트릭스 판');
}

// ---- 10 그림 카드 — 급식 알레르기 탐지견
{
  const cards = [['peanut', '땅콩'], ['peanut', '땅콩'], ['milk', '우유'], ['milk', '우유'], ['rice', '밥 (안전한 음식)'], ['apple', '사과 (안전한 음식)'], null, null];
  pg([
    ...title('그림 카드 — 급식 알레르기 탐지견', '큰 단순 그림 + 글자는 아래에 작게. 카드끼리 모양·색이 충분히 달라야 AI가 구분하기 쉬워요. 사진·얼굴은 쓰지 않아요. 빈 카드는 모둠이 직접 그려요.'),
    grid(2, 4, 3550, 8, (i) => cards[i]
      ? { t: [image(IMG + cards[i][0] + '.png', px(4.6), { after: 40 }), ctr(cards[i][1], { sz: 18, color: C.sub, after: 0 })] }
      : { t: [ctr('빈 카드', { sz: 22, bold: true, color: C.line, after: 60 }), ctr('우리 모둠이 그려요 (큰 그림 하나)', { sz: 17, color: C.line, after: 0 })] }),
  ], '그림 카드 · 급식 알레르기 탐지견');
}

// ---- 11 그림 카드 — 내 물건 알아보는 반려견
{
  const cards = [['case', '내 필통', C.blue], ['case', '친구 필통', C.orange], ['badge', '내 배지', C.blue], ['badge', '친구 배지', C.orange]];
  pg([
    ...title('그림 카드 — 내 물건 알아보는 반려견', '필통·배지 이름표 템플릿. 사람 사진은 쓰지 않고 물건·배지만 써요. 아래 큰 칸에 “내 물건 / 친구 물건” 구분용 스티커를 붙여요.'),
    grid(2, 2, 7200, 4, (i) => ({ t: [
      image(IMG + cards[i][0] + '.png', px(6), { after: 100 }),
      ctr(cards[i][1], { sz: 40, bold: true, color: cards[i][2], after: 160 }),
      para('[ 스티커 붙이는 곳 ]', { sz: 26, color: C.sub, align: AL.CENTER, before: 200, after: 0 }),
    ] })),
  ], '그림 카드 · 내 물건 알아보는 반려견');
}

// ---- 12 그림 카드 — 교실 도우미견
{
  const cards = [['hand_open', '조용히'], ['fist', '모여'], ['clock', '정리 시간'], null];
  pg([
    ...title('그림 카드 — 교실 도우미견', '손 모양 그림 카드를 기본으로 써요. 실제 손으로 할 때는 손만 카메라에 보이게 하고, 얼굴이 나오지 않게 해요.'),
    grid(2, 2, 7200, 4, (i) => cards[i]
      ? { t: [image(IMG + cards[i][0] + '.png', px(6.5), { after: 120 }), ctr(cards[i][1], { sz: 44, bold: true, after: 0 })] }
      : { t: [ctr('빈 카드', { sz: 28, bold: true, color: C.line, after: 80 }), ctr('우리 모둠이 그려요', { sz: 20, color: C.line, after: 0 })] }),
  ], '그림 카드 · 교실 도우미견');
}

// ---- 13 신호등 안내견 보조 카드
{
  const w3 = [3635, 3635, 3636];
  const circ = ['c_red', 'c_yellow', 'c_green'];
  const word = [['정지', C.red], ['기다려', 'C98F00'], ['출발', C.green]];
  const cell3 = (spec, w) => L.cell({ dashed: true, borderColor: CUT, ...spec }, { w });
  pg([
    ...title('신호등 안내견 보조 카드 (5차시 연결 설명용, 선택)', '위 줄: 빨강·노랑·초록 카드 / 아래 줄: 그 위에 놓는 글자 카드'),
    new Table({ width: { size: PW, type: WidthType.DXA }, columnWidths: w3, rows: [
      new TableRow({ height: { value: 6400, rule: HeightRule.EXACT }, children: circ.map((c, i) => cell3({ t: [image(IMG + c + '.png', px(5.6), { after: 0 })] }, w3[i])) }),
      new TableRow({ height: { value: 6000, rule: HeightRule.EXACT }, children: word.map((wd, i) => cell3({ t: [para(wd[0], { sz: 80, bold: true, color: wd[1], align: AL.CENTER, after: 0 })] }, w3[i])) }),
    ] }),
  ], '신호등 안내견 보조 카드');
}

// ---- 14 로보독 행동 카드 (20장)
{
  const acts = [
    ...['안녕', '기다려', '비켜', '출발', '멍멍', '으르렁'].map((t) => ['소리', t, C.blue]),
    ...['찢눈 (화난 눈)', '깜박', '반짝 눈', '하트 눈', '눈 감음'].map((t) => ['표정', t, C.orange]),
    ...['인사', '앉기', '기지개', '준비'].map((t) => ['자세', t, C.green]),
    ...[['빨강', 'c_red'], ['노랑', 'c_yellow'], ['초록', 'c_green'], ['파랑', 'c_blue'], ['주황', 'c_orange']].map(([t, im]) => ['몸통 불빛', t, C.sub, im]),
  ];
  pg([
    ...title('로보독 행동 카드 (설계·코딩 보조, 7차시)', '소리 6 · 표정 5 · 자세 4 · 몸통 불빛 5 = 20장. 물구나무·점프는 넣지 않았어요(안전). 카드 뒷면에는 블록 이름(편집기에 보이는 한국어)을 교사가 확인한 뒤 적어요.'),
    grid(4, 5, 2750, 20, (i) => {
      const [cat, name, col, im] = acts[i];
      return { t: [
        para(cat, { sz: 17, bold: true, color: C.white, fill: col, align: AL.CENTER, after: 80 }),
        ...(im ? [image(IMG + im + '.png', px(1.7), { after: 60 })] : []),
        ctr(name, { sz: im ? 26 : 30, bold: true, after: 0 }),
      ], valign: VerticalAlign.CENTER, mt: 80 };
    }),
  ], '행동 카드');
}

// ---- 15~16 칭찬 쪽지
{
  const slip = () => ({ t: [
    para('______________ 모둠에게', { sz: 26, bold: true, color: C.blue, after: 120 }),
    para('좋았던 점 (구체적으로)', { sz: 19, bold: true, color: C.sub, after: 0 }), ...lines(2, 470),
    para('더 좋아질 점', { sz: 19, bold: true, color: C.sub, before: 140, after: 0 }), ...lines(2, 470),
    para('쓴 모둠 ______', { sz: 20, color: C.sub, align: AL.RIGHT, before: 120, after: 0 }),
  ], valign: VerticalAlign.TOP, mt: 120 });
  pg([
    ...title('동료 칭찬 쪽지 (12장 중 1/2)'),
    box([
      para('사용 예시', { sz: 18, bold: true, color: C.blue, after: 20 }),
      para('“3모둠에게 — 좋았던 점: 카드를 여러 각도로 모아서 AI가 헷갈리지 않았어요. 더 좋아질 점: 배경 사진을 조금 더 모으면 좋겠어요. 쓴 모둠 5”', { sz: 19, after: 0 }),
    ], { w: PW }),
    gap(100),
    grid(2, 3, 4400, 6, slip),
  ], '칭찬 쪽지 1/2');
  pg([
    ...title('동료 칭찬 쪽지 (12장 중 2/2)'),
    gap(100),
    grid(2, 3, 4400, 6, slip),
  ], '칭찬 쪽지 2/2');
}

// ---- 17 갤러리 워크
{
  const f = (t, hh) => new TableRow({ height: { value: hh, rule: HeightRule.ATLEAST }, children: [L.cell({ t: [para(t, { sz: 22, bold: true, after: 0 })], fill: C.bg }, { w: 2800 }), L.cell({ t: [tiny()] }, { w: PW - 2800 })] });
  pg([
    ...title('갤러리 워크 종이', '책상 위에 올려 두는 종이예요. A3로 확대 복사하거나, 두 장을 이어 붙여 써도 돼요.'),
    new Table({ width: { size: PW, type: WidthType.DXA }, columnWidths: [2800, PW - 2800], rows: [f('모둠 이름', 700), f('로보독 이름', 700), f('주제', 700), f('문제 정의 한 문장', 1300), f('설계표 1줄 (번호 → 행동)', 1300)] }),
    gap(200),
    para('쪽지를 붙이는 곳 (다른 모둠이 칭찬 쪽지를 붙여요)', { sz: 24, bold: true, color: C.blue, after: 80 }),
    new Table({ width: { size: PW, type: WidthType.DXA }, columnWidths: [PW], rows: [new TableRow({ height: { value: 6400, rule: HeightRule.EXACT }, children: [L.cell({ t: [tiny()], dashed: true, borderColor: CUT }, { w: PW })] })] }),
  ], '갤러리 워크 종이');
}

// ---- 18 한 쪽 안내 (교사 보관)
K(1, 1);
{
  const guide = [
    ['1~4쪽', '색 카드 (빨강·노랑·초록·주황)', '4장씩 A4 1장', '컬러, 학급 1~2부 (주황은 실험 1장씩)'],
    ['5쪽', '모둠번호 라벨, 로보독 이름 칸', '모둠 1~8', '컬러/흑백 모두 가능, 학급 1부'],
    ['6쪽', '안전 포스터', '1장', '교실 게시, 컬러'],
    ['7~8쪽', '문제 카드 (4영역 + 빈 카드)', '영역별 색 띠', '컬러, 모둠 수만큼'],
    ['9쪽', '2×2 매트릭스 판', '모둠당 1장', 'A3 확대 권장 + 포스트잇'],
    ['10~12쪽', '그림 카드 3종 (알레르기·내 물건·도우미)', '카드 8·4·4장', '컬러, 사진·얼굴 금지'],
    ['13쪽', '신호등 안내견 보조 카드', '선택', '컬러'],
    ['14쪽', '로보독 행동 카드 20장', '7차시', '컬러, 뒷면에 블록 이름은 교사가 확인 후'],
    ['15~16쪽', '칭찬 쪽지 12장', '8차시', '흑백 가능'],
    ['17쪽', '갤러리 워크 종이', '모둠당 1장', 'A3 확대 또는 A4 2장'],
  ];
  const order = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [{ t: String(n), align: AL.CENTER, bold: true }, `${n}모둠`, '', '', '']);
  pg([
    ...title('한 쪽 안내 (교사 보관)', '카드 인쇄 가이드 · 라벨 번호표 · 8차시 발표 순서표'),
    para('인쇄 가이드 (컬러 인쇄 필수, 카드류는 8모둠이면 학급 수에 맞춰 1~2부)', { sz: 20, bold: true, color: C.blue, after: 40 }),
    table([1100, 3800, 2000, 3006], guide.map((r) => [{ t: r[0], bold: true, fill: C.bg, align: AL.CENTER }, r[1], r[2], r[3]]), { header: ['쪽', '내용', '단위', '인쇄 메모'], h: 360, hh: 300, sz: 17 }),
    para('라벨 번호표', { sz: 20, bold: true, color: C.blue, before: 160, after: 40 }),
    table([1500, 2100, 2100, 2100, 2106], [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [{ t: `모둠 ${n}`, bold: true, fill: C.bg, align: AL.CENTER }, `R${n}`, `B${n}`, `R${n}`, `R${n}`].map((x) => (typeof x === 'string' ? { t: x, align: AL.CENTER } : x))),
      { header: ['모둠', '로보독 (R)', 'PC용 USB (B)', '03용 (R)', '04용 (R)'], h: 330, hh: 300, sz: 17 }),
    para('8차시 발표 순서표 (모둠 1분 30초 + 교체 30초)', { sz: 20, bold: true, color: C.blue, before: 160, after: 40 }),
    table([800, 1400, 2600, 2900, 2206], order.map((r) => r), { header: ['순서', '모둠', '로보독 이름', '주제', '시작 시각'], h: 400, hh: 300, sz: 17 }),
  ], '한 쪽 안내 (교사 보관)');
}

save(makeDoc(pages, '8차시 전체형 인쇄용 준비물'), OUT);
