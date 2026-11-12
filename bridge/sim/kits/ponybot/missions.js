// 포니봇 미션(행동 판정): 코드 글자가 아니라 시뮬레이터 속 로봇이 '실제로 한 일'로 통과를 판정한다.
// 수업 슬라이드의 mission 장(bridge/lessons/data/*.json 의 "mission": "<id>")과 짝.
// m(측정값, 실행 시작 기준): pressed{A,B}, forward·side(cm, 출발 방향 기준 지금 위치), maxForward·maxSide·minSide, path(움직인 거리 합),
//   headDev(몸 방향이 가장 많이 틀어진 각도), moved(한 번이라도 움직임), still(마지막으로 멈춘 뒤 지난 초), home(출발점까지 거리), bumped
// ※ 시뮬레이터는 추정 모델 — 통과해도 실물에서 다시 확인해야 한다(각 미션 real).
const HEAD = (title, lines) => `// [포니봇 미션] ${title}\n${lines.map((l) => '// ' + l).join('\n')}\n`;

export const MISSIONS = [
  {
    id: 'p1-go-stop', lesson: '1교시', title: '미션 1 · 멈추지 않는 포니봇',
    story: '길잡이: "출발 신호는 잘 만들었는데… 포니봇이 경기장 밖까지 달려가 버렸어!"',
    goal: 'A 버튼을 누르면 앞으로 15cm 넘게 갔다가, 스스로 멈추게 고쳐요.',
    scene: 'free',
    predict: { q: '먼저 그대로 실행하고 A 버튼을 누르면 포니봇은 어떻게 될까요?', choices: ['조금 가다가 스스로 멈춘다', '멈추지 않고 계속 간다', '움직이지 않는다'], answer: 1, why: '"앞으로 이동" 뒤에 멈추라는 블록이 없어요. 로봇은 시키지 않은 일은 하지 않아요.' },
    code: HEAD('미션 1 · 멈추지 않는 포니봇', ['A 버튼을 누르면 앞으로 가요. 그런데 멈추지 않아요!', '고칠 것: 얼마 동안 간 뒤(일시중지) 멈추게(모든 모터 정지) 해 보세요.'])
      + 'let 속도 = 80\naiPonybot.stopAllMotors()\nbasic.showIcon(IconNames.Happy)\ninput.onButtonPressed(Button.A, function () {\n    aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 속도)\n})\n',
    checks: [
      { label: 'A 버튼 누르기', test: (m) => m.pressed.A },
      { label: '앞으로 15cm 넘게 가기', test: (m) => m.maxForward >= 15, now: (m) => `지금 ${Math.max(0, m.maxForward).toFixed(0)}cm` },
      { label: '스스로 멈추기(1초 넘게 가만히)', test: (m) => m.moved && m.still >= 1, now: (m) => (m.moved ? (m.still > 0 ? '멈춤' : '달리는 중') : '') },
      { label: '경기장 안에서 멈추기(앞으로 60cm 안)', test: (m) => m.maxForward <= 60, now: (m) => (m.maxForward > 60 ? '너무 멀리 갔어요 — [처음으로] 뒤 다시' : '') },
    ],
    hints: [
      '블록은 위에서 아래로 차례대로 실행돼요. "앞으로 이동" 아래에 무엇이 더 있어야 할까요?',
      '기본 서랍의 "일시중지(ms)"로 얼마 동안 갈지 정하고, 그 아래에 AI ponybot 서랍의 "모든 모터 정지"를 놓아요.',
      'A 버튼 안: 메카넘 ↑ 방향 이동 → 일시중지 2000 → 모든 모터 정지. (2000ms = 2초)',
    ],
    learn: '로봇은 시킨 일만 해요. "가라" 다음에 "얼마 동안"과 "멈춰라"를 차례대로 알려 줘야 해요(순차 구조).',
    real: '실물 포니봇에 넣고, 바닥에서 A 버튼을 눌러 같은 거리에서 멈추는지 확인해요. 속도와 거리는 실물과 다를 수 있어요.',
  },
  {
    id: 'p1-crab', lesson: '1교시', title: '미션 2 · 게걸음으로 비키기',
    story: '길잡이: "앞에 고깔이 있어! 몸을 돌리지 말고 옆으로 비켜 볼래?"',
    goal: 'A 버튼을 누르면 몸은 앞을 본 채로 오른쪽 옆으로 15cm 넘게 가서 멈춰요.',
    scene: 'free',
    predict: { q: '"메카넘 → 방향" 블록을 쓰면 포니봇의 몸은 어디를 볼까요?', choices: ['오른쪽으로 몸을 돌린 다음 간다', '앞을 본 채로 옆으로 미끄러지듯 간다', '제자리에서 빙글 돈다'], answer: 1, why: '메카넘 바퀴는 비스듬한 롤러 덕분에 몸을 돌리지 않고도 옆으로 갈 수 있어요.' },
    code: HEAD('미션 2 · 게걸음으로 비키기', ['지금은 A 버튼을 누르면 앞으로 가요.', '고칠 것: 방향을 → (오른쪽 옆)으로 바꿔 보세요. 몸은 앞을 본 채로!'])
      + 'let 속도 = 80\naiPonybot.stopAllMotors()\nbasic.showArrow(ArrowNames.North)\ninput.onButtonPressed(Button.A, function () {\n    aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 속도)\n    basic.pause(2000)\n    aiPonybot.stopAllMotors()\n})\n',
    checks: [
      { label: 'A 버튼 누르기', test: (m) => m.pressed.A },
      { label: '오른쪽 옆으로 15cm 넘게 가기', test: (m) => m.maxSide >= 15, now: (m) => `지금 ${Math.max(0, m.maxSide).toFixed(0)}cm` },
      { label: '몸 방향은 그대로(10° 안)', test: (m) => m.moved && m.headDev <= 10, now: (m) => (m.moved ? `${m.headDev.toFixed(0)}° 틀어짐` : '') },
      { label: '앞으로는 거의 안 가기(8cm 안)', test: (m) => m.moved && m.maxForward <= 8, now: (m) => (m.maxForward > 8 ? `앞으로 ${m.maxForward.toFixed(0)}cm 갔어요` : '') },
      { label: '스스로 멈추기', test: (m) => m.moved && m.still >= 1 },
    ],
    hints: [
      '"메카넘 [방향] 방향 [속도]로 이동" 블록의 화살표를 눌러 보세요. 방향이 9가지 있어요.',
      '화살표 ↑ 를 → 로 바꿔요. "포니봇 ↷ 방향 이동"(제자리 돌기) 블록은 쓰지 않아요.',
      'A 버튼 안: 메카넘 → 방향 이동 → 일시중지 2000 → 모든 모터 정지.',
    ],
    learn: '메카넘 바퀴는 네 바퀴가 도는 방향을 다르게 해서 옆·대각선으로도 가요. 같은 "이동" 블록도 방향 값에 따라 전혀 다른 움직임이 돼요.',
    real: '실물에서 → 방향이 정말 오른쪽 옆인지 확인해요(바퀴 방향은 실물 확인이 필요한 항목이에요).',
  },
  {
    id: 'p1-square', lesson: '1교시', star: true, title: '도전 · 네모 한 바퀴',
    story: '길잡이: "마지막 도전! 몸을 한 번도 돌리지 않고 네모를 그려 제자리로 돌아올 수 있을까?"',
    goal: 'A 버튼을 누르면 앞 → 오른쪽 → 뒤 → 왼쪽으로 네모를 그리고 출발한 자리(10cm 안)로 돌아와 멈춰요.',
    scene: 'free',
    predict: { q: '앞·오른쪽·뒤·왼쪽을 같은 시간씩 가면 포니봇은 어디에 있을까요?', choices: ['출발한 자리 근처로 돌아온다', '훨씬 먼 곳에 있다', '제자리에서 돌기만 한다'], answer: 0, why: '같은 빠르기로 같은 시간씩 반대 방향으로 가면 간 만큼 되돌아와요.' },
    code: HEAD('도전 · 네모 한 바퀴', ['앞으로 갔다가 오른쪽으로 가는 데까지만 만들어져 있어요.', '이어서 뒤(↓), 왼쪽(←)을 더해 네모를 완성하고 마지막에 멈추세요.'])
      + 'let 속도 = 80\naiPonybot.stopAllMotors()\ninput.onButtonPressed(Button.A, function () {\n    aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 속도)\n    basic.pause(2000)\n    aiPonybot.runMecanum(aiPonybot.Mecanum.Right, 속도)\n    basic.pause(2000)\n    aiPonybot.stopAllMotors()\n})\n',
    checks: [
      { label: 'A 버튼 누르기', test: (m) => m.pressed.A },
      { label: '네 방향 모두 가기(움직인 거리 50cm 넘게)', test: (m) => m.path >= 50, now: (m) => `지금 ${m.path.toFixed(0)}cm` },
      { label: '몸 방향은 그대로(10° 안)', test: (m) => m.moved && m.headDev <= 10 },
      { label: '출발한 자리로 돌아와 멈추기(10cm 안)', test: (m) => m.path >= 50 && m.still >= 1 && m.home <= 10, now: (m) => (m.path >= 50 ? `출발점에서 ${m.home.toFixed(0)}cm` : '') },
    ],
    hints: [
      '네모는 변이 4개예요. 지금 코드에는 방향이 몇 개 있나요?',
      '"메카넘 이동 → 일시중지" 묶음을 두 번 더 복사해서 방향을 ↓ 와 ← 로 바꿔요.',
      '↑ 2000 → → 2000 → ↓ 2000 → ← 2000 → 모든 모터 정지. 네 변의 시간이 같아야 제자리로 와요.',
    ],
    learn: '같은 묶음(이동 → 기다리기)을 방향만 바꿔 되풀이했어요. 되풀이되는 묶음은 나중에 "반복" 블록으로 줄일 수 있어요.',
    real: '실물은 바닥 미끄러짐 때문에 제자리로 정확히 못 올 수 있어요. 얼마나 어긋나는지 재 보고 이유를 이야기해요.',
  },
];
