// makecode/*.ts → bridge/sim/examples.js (시뮬레이터 예제 목록) 생성
// 실행: node tests/build-sim-examples.js
// group: button(본체 버튼) / radio(라디오 리모컨) / check(점검·둘러보기)
// sim: 시뮬레이터에서 따라 하기, real: 실물에서 따라 하기 (처음 하는 사람 기준, 한 줄에 한 동작)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const dir = path.join(root, 'makecode');
const RUN = '[▶ 실행]을 누르세요';
const BTN = '오른쪽 [로보독 본체 버튼 누르기]를 누르세요';
const META = {
  '10_button-bark': { group: 'button', order: 1, title: '① 버튼 누르면 멍멍 (가장 쉬움)', level: '쉬움',
    sim: [RUN, BTN, '로보독이 눈을 반짝이고 "멍멍" 한 뒤 앞발을 들어 인사해요', '여러 번 눌러 보세요. 누를 때마다 다시 해요'],
    real: ['MakeCode에 코드를 넣고 로보독 마이크로비트에 내려받기', '로보독 등에 꽂고 전원 켜기', '본체 버튼(아래쪽 전원 스위치 옆) 누르기'] },
  '01_hello-robodog': { group: 'button', order: 2, title: '② 누를 때마다 다음 장면 (순서대로)', level: '쉬움',
    sim: [RUN, BTN + ' → 인사', '한 번 더 → 조금 걷기', '한 번 더 → 앉기, 그다음은 다시 인사부터'],
    real: ['코드를 로보독 마이크로비트에 내려받기', '로보독 등에 꽂고 전원 켜기', '본체 버튼을 누를 때마다 다음 장면'] },
  '02_distance-rule': { group: 'button', order: 3, title: '③ 버튼 누르면 걷다가 장애물 앞에서 멈춤 (거리센서)', level: '보통',
    sim: [RUN + ' (앞에 빨간 장애물이 저절로 놓여요)', BTN, '앞으로 걷다가 장애물이 가까워지면 멈추고 몸통이 빨개져요', '[장애물 지우기]·[장애물 놓기]로 바꿔 가며 다시 해 보세요'],
    real: ['코드를 로보독 마이크로비트에 내려받기', '바닥에 놓고 앞 30~40cm에 상자 놓기', '본체 버튼 누르기 → 상자 앞에서 멈추는지 보기'] },
  '12_button-explore': { group: 'button', order: 4, title: '④ 버튼 누르면 탐험 (벽 만나면 방향 바꾸기)', level: '도전',
    sim: ['오른쪽 [환경]에서 [바닥(벽 있음)]을 고르세요', RUN, BTN, '두리번거리고 "멍멍" 한 뒤 걸어요. 벽 가까이 가면 돌아서 다시 걸어요', '걷는 중에 한 번 더 누르면 멈춰요 (15초가 지나도 멈춰요)'],
    real: ['코드를 로보독 마이크로비트에 내려받기', '상자나 책으로 울타리를 만든 바닥에 놓기', '본체 버튼 누르기 → 탐험 시작, 다시 누르면 멈춤'] },
  '20_remote-sender': { group: 'radio', order: 1, title: '① 리모컨 쪽 코드 (손에 드는 마이크로비트)', level: '쉬움',
    sim: ['이 코드는 리모컨(두 번째 마이크로비트)용이에요. 시뮬레이터에서는 보내는 모습만 볼 수 있어요', RUN, '오른쪽 마이크로비트의 [A]·[B]를 눌러 보세요 → 기록 창에 "라디오 보냄: 1"처럼 나와요', '로보독이 받는 모습은 ② 또는 ③ 예제에서 확인해요'],
    real: ['마이크로비트를 1개 더 준비해요(리모컨용)', '이 코드를 리모컨 마이크로비트에 내려받고 배터리팩 연결', '로보독 마이크로비트에는 ② 또는 ③ 코드를 넣기', '리모컨 화면에 나온 그룹 숫자가 로보독 코드의 그룹과 같은지 확인', 'A = 1, B = 2, A+B = 3을 보내요'] },
  '21_remote-dog': { group: 'radio', order: 2, title: '② 리모컨으로 움직이기 (로보독 쪽)', level: '쉬움',
    sim: [RUN, '오른쪽 [라디오로 숫자 보내기]에서 [1]을 누르세요 → 앞으로 걸어요 (리모컨 A 버튼과 같아요)', '[2] → 멈춰요 (리모컨 B)', '[3] → 오른쪽으로 돌아요 (리모컨 A+B)', '걷는 중에 [로보독 본체 버튼 누르기] → 언제든 멈춰요'],
    real: ['리모컨 마이크로비트에 ① 코드, 로보독 마이크로비트에 이 코드', '로보독을 바닥에 놓고 전원 켜기', '리모컨 A = 걷기, B = 멈추기, A+B = 돌기', '위험하면 본체 버튼으로 멈추기'] },
  '22_remote-tricks': { group: 'radio', order: 3, title: '③ 리모컨으로 재주 부리기 (걷지 않음)', level: '쉬움',
    sim: [RUN, '[라디오로 숫자 보내기]에서 [1] → 앞발 들어 인사', '[2] → 앉기, 한 번 더 [2] → 서기', '[3] → 눈 반짝 + "멍멍"'],
    real: ['리모컨 마이크로비트에 ① 코드, 로보독 마이크로비트에 이 코드', '책상 위에서 해도 돼요(걷지 않아요)', '리모컨 A = 인사, B = 앉기/서기, A+B = 멍멍'] },
  '03_ai-traffic-dog': { group: 'radio', order: 4, title: '④ AI 신호등 안내견 (AI 브리지가 리모컨)', level: '보통',
    sim: [RUN, '[라디오로 숫자 보내기] 아래 [마지막 숫자 계속 보내기]를 켜세요', '[3] 초록 → 걷기, [2] 노랑 → 기다리기, [1] 빨강 → 멈추고 "비켜"', '같은 컴퓨터에서 AI 브리지를 켜 두면 카드 인식 결과가 자동으로 와요'],
    real: ['USB 마이크로비트에 00_bridge-receiver, 로보독 마이크로비트에 이 코드', 'AI 브리지에서 카드 4장을 학습하고 연결', '카메라에 카드를 보여 주면 로보독이 반응해요'] },
  '04_ai-team-template': { group: 'radio', order: 5, title: '⑤ 우리 모둠 AI 로보독 (빈 틀)', level: '도전',
    sim: [RUN, '[마지막 숫자 계속 보내기]를 켜세요 (2초 동안 신호가 없으면 멈추는 안전장치가 있어요)', '[라디오로 숫자 보내기]에서 1~3을 눌러 보며 번호마다 무엇을 하는지 보세요', "코드의 '번호에맞게행동하기' 안에서 번호마다 할 행동을 우리 모둠 생각대로 바꿔 보세요"],
    real: ['AI 브리지에서 우리 모둠 카드를 학습', '번호마다 행동을 정해 코드 고치기', '로보독 마이크로비트에 내려받아 시험'] },
  '00_check-robodog': { group: 'check', order: 1, title: '연결·배터리 점검 (수업 전)', level: '쉬움',
    sim: [RUN, '눈이 하트, 몸통 불빛이 배터리 색(초록 = 충분)', BTN + ' → 앉기 ↔ 서기'],
    real: ['로보독 마이크로비트에 내려받고 전원 켜기', '눈 하트 = 통신 OK, 몸통 초록 = 배터리 OK', '본체 버튼 → 앉기·서기 되면 준비 끝'] },
  '05_motion-tour': { group: 'check', order: 2, title: '동작 둘러보기 (자세·걷기·다리)', level: '쉬움',
    sim: [RUN, '로보독이 자세 4가지, 사각형 걷기, 다리 움직임을 차례로 보여 줘요'],
    real: ['로보독 마이크로비트에 내려받기', '넓은 바닥에 놓고 전원 켜기'] },
};
const GROUPS = [
  { id: 'button', title: '🔘 본체 버튼으로 해 보기', note: '마이크로비트 1개. 로보독 아래쪽 전원 스위치 옆 버튼을 눌러 시작해요' },
  { id: 'radio', title: '📡 라디오 리모컨으로 해 보기', note: '마이크로비트 2개(리모컨 + 로보독) 또는 AI 브리지. 숫자를 보내 로보독을 움직여요' },
  { id: 'check', title: '🛠 점검·둘러보기', note: '수업 전 점검과 동작 구경' },
];
const list = fs.readdirSync(dir).filter(f => f.endsWith('.ts') && META[f.replace('.ts', '')])
  .map(f => { const id = f.replace('.ts', ''); return { id, ...META[id], code: fs.readFileSync(path.join(dir, f), 'utf8') }; })
  .sort((a, b) => GROUPS.findIndex(g => g.id === a.group) - GROUPS.findIndex(g => g.id === b.group) || a.order - b.order);
const out = '// 자동 생성 파일 (tests/build-sim-examples.js) — 직접 고치지 마세요\n'
  + 'export const GROUPS = ' + JSON.stringify(GROUPS, null, 1) + ';\n'
  + 'export const EXAMPLES = ' + JSON.stringify(list, null, 1) + ';\n';
fs.writeFileSync(path.join(root, 'bridge', 'sim', 'examples.js'), out);
console.log('examples:', list.map(e => e.id).join(', '));
