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

  // ---------------- 2교시: 규칙으로 반응하기(거리센서) ----------------
  {
    id: 'p2-wall', lesson: '2교시', title: '미션 1 · 책 앞에서 멈추기',
    story: '길잡이: "두 번째 경기장! 저 앞에 책이 세워져 있어. 부딪히면 실격이야!"',
    goal: 'A 버튼으로 출발해서, 책에 부딪히지 않고 책 앞 10~25cm에서 스스로 멈추게 해요.',
    scene: 'relay', how: '▶ 실행을 누른 뒤 오른쪽 A 버튼',
    predict: { q: '지금 코드는 거리센서를 쓰지 않아요. 그대로 달리면 어떻게 될까요?', choices: ['책 앞에서 알아서 멈춘다', '책에 부딪힌다', '출발하지 않는다'], answer: 1, why: '거리를 재서 "가까우면 멈춰"라고 정해 주지 않으면 로봇은 앞에 무엇이 있는지 몰라요.' },
    code: HEAD('미션 1 · 책 앞에서 멈추기', ['A 버튼을 누르면 계속 앞으로 가요. 책에 부딪혀요!', '고칠 것: "만약 거리 < 20 이면 멈추고, 아니면 앞으로"가 되게 해 보세요.', '거리 블록: AI ponybot 서랍의 "센티미터 단위로 측정한 거리"'])
      + 'let 속도 = 200\nlet 달리는중 = false\naiPonybot.stopAllMotors()\ninput.onButtonPressed(Button.A, function () {\n    달리는중 = true\n})\ninput.onButtonPressed(Button.B, function () {\n    달리는중 = false\n})\nbasic.forever(function () {\n    if (달리는중) {\n        aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 속도)\n    } else {\n        aiPonybot.stopAllMotors()\n    }\n    basic.pause(100)\n})\n',
    checks: [
      { label: 'A 버튼으로 출발해 책 쪽으로 100cm 넘게 가기', test: (m) => m.pressed.A && m.maxForward >= 100, now: (m) => `지금 ${Math.max(0, m.maxForward).toFixed(0)}cm` },
      { label: '책에 부딪히지 않기', test: (m) => m.moved && !m.bumped, now: (m) => (m.bumped ? '부딪혔어요 — [처음으로] 뒤 다시' : '') },
      { label: '책 앞 10~25cm에서 멈추기', test: (m) => m.moved && m.still >= 1 && m.dist >= 10 && m.dist <= 25, now: (m) => `책까지 ${m.dist >= 500 ? '?' : m.dist.toFixed(0)}cm` },
    ],
    hints: [
      '사람은 눈으로 보고 멈춰요. 포니봇의 "눈"은 무엇이었죠? 그 값을 "만약 ~이면" 블록에 넣어야 해요.',
      '논리 서랍의 "만약 ~이면 / 아니면"과 비교 블록( < )을 써요. 왼쪽 칸에는 "센티미터 단위로 측정한 거리", 오른쪽 칸에는 20.',
      '무한 반복 안: 만약 (달리는중 그리고 거리 ≥ 20) 이면 앞으로 이동, 아니면 모든 모터 정지.',
    ],
    learn: '센서 값과 기준값을 비교해서 행동을 고르는 것이 "규칙"이에요. 만약 (거리 < 기준) 이면 멈춘다 — 이 규칙은 사람이 정했어요.',
    real: '실물에서는 책 대신 상자를 세우고, 멈춘 뒤 자로 거리를 재요. 속도가 빠르면 더 가까이 가서 멈출 수 있어요.',
  },
  {
    id: 'p2-far', lesson: '2교시', title: '미션 2 · 기준값 바꾸기',
    story: '길잡이: "이번엔 책에서 더 멀리, 여유 있게 멈춰 볼까? 숫자 하나만 바꾸면 돼!"',
    goal: '책 앞 30~45cm에서 멈추게 "가까움기준" 숫자를 바꿔요.',
    scene: 'relay',
    predict: { q: '"가까움기준"을 20에서 40으로 바꾸면 포니봇은 어디서 멈출까요?', choices: ['책에서 더 먼 곳에서 멈춘다', '책에 더 가까이 가서 멈춘다', '똑같은 곳에서 멈춘다'], answer: 0, why: '기준값이 커지면 더 멀리서부터 "가깝다"고 판단해서 일찍 멈춰요.' },
    code: HEAD('미션 2 · 기준값 바꾸기', ['거리 규칙이 완성되어 있어요. 지금은 책 앞 20cm쯤에서 멈춰요.', '고칠 것: 맨 위 "가까움기준" 숫자 하나만 바꿔서 30~45cm에서 멈추게 해 보세요.']) + 'let 가까움기준 = 20\nlet 속도 = 200\nlet 달리는중 = false\naiPonybot.stopAllMotors()\ninput.onButtonPressed(Button.A, function () {\n    달리는중 = true\n})\ninput.onButtonPressed(Button.B, function () {\n    달리는중 = false\n})\nbasic.forever(function () {\n    if (달리는중 && aiPonybot.ping(aiPonybot.PingUnit.Centimeters) >= 가까움기준) {\n        aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 속도)\n    } else {\n        aiPonybot.stopAllMotors()\n    }\n    basic.pause(100)\n})\n',
    checks: [
      { label: 'A 버튼으로 출발해 책 쪽으로 100cm 넘게 가기', test: (m) => m.pressed.A && m.maxForward >= 100, now: (m) => `지금 ${Math.max(0, m.maxForward).toFixed(0)}cm` },
      { label: '책에 부딪히지 않기', test: (m) => m.moved && !m.bumped },
      { label: '책 앞 30~45cm에서 멈추기', test: (m) => m.moved && m.still >= 1 && m.dist >= 30 && m.dist <= 45, now: (m) => `책까지 ${m.dist >= 500 ? '?' : m.dist.toFixed(0)}cm` },
    ],
    hints: [
      '규칙은 "거리가 기준값보다 작으면 멈춘다"예요. 더 멀리서 멈추려면 기준값이 커져야 할까요, 작아져야 할까요?',
      '맨 위 "가까움기준에 20 저장" 블록의 숫자만 바꿔요. 다른 블록은 그대로 둬요.',
      '가까움기준을 40으로 바꿔요. 조금 지나쳐서 멈추니까 35~38cm쯤에서 멈출 거예요.',
    ],
    learn: '규칙은 그대로 두고 기준값(숫자)만 바꿔도 로봇의 행동이 달라져요. 알맞은 기준값은 사람이 실험해서 정해요.',
    real: '실물에서 손을 대 보며 우리 모둠의 "가까움" 기준값을 정하고 활동지에 적어요.',
  },
];
