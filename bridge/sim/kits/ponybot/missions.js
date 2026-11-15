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
  {
    id: 'p2-empty', lesson: '2교시', star: true, title: '도전 · 500의 함정',
    story: '길잡이: "어? 벽이 없는 넓은 곳에 왔더니 포니봇이 멈추질 않아! 거리 값이 500이래."',
    goal: '앞에 아무것도 없어서 거리가 500(못 읽음)이면, A 버튼을 눌러도 출발하지 않게 고쳐요.',
    scene: 'free', noAuto: true,
    predict: { q: '벽이 없는 곳에서 거리센서는 500을 돌려줘요. 지금 규칙(거리 ≥ 20 이면 앞으로)으로 A 버튼을 누르면?', choices: ['출발하지 않는다', '끝없이 달린다', '조금 가다 멈춘다'], answer: 1, why: '500은 "아주 멀다"가 아니라 "못 읽었다"는 뜻인데, 규칙은 500 ≥ 20 이라서 안전하다고 판단해요.' },
    code: HEAD('도전 · 500의 함정', ['벽이 없으면 거리 = 500 (반사가 돌아오지 않아 못 읽음).', '지금 규칙은 500을 "멀다"로 보고 끝없이 달려요.', '고칠 것: 거리가 500 이상이면 달리지 않게 조건을 더해 보세요.']) + 'let 가까움기준 = 20\nlet 속도 = 200\nlet 달리는중 = false\naiPonybot.stopAllMotors()\ninput.onButtonPressed(Button.A, function () {\n    달리는중 = true\n})\ninput.onButtonPressed(Button.B, function () {\n    달리는중 = false\n})\nbasic.forever(function () {\n    if (달리는중 && aiPonybot.ping(aiPonybot.PingUnit.Centimeters) >= 가까움기준) {\n        aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 속도)\n    } else {\n        aiPonybot.stopAllMotors()\n    }\n    basic.pause(100)\n})\n',
    checks: [
      { label: 'A 버튼 누르기', test: (m) => m.pressed.A },
      { label: 'A 버튼을 누르고 3초 기다리기', test: (m) => m.tA >= 3, now: (m) => (m.tA >= 0 ? `${Math.min(3, m.tA).toFixed(0)}초` : '') },
      { label: '그동안 출발하지 않기(3cm 안)', test: (m) => m.tA >= 3 && m.path <= 3, now: (m) => (m.path > 3 ? `${m.path.toFixed(0)}cm 움직였어요 — [처음으로] 뒤 다시` : '') },
    ],
    hints: [
      '지금 조건은 "거리 ≥ 가까움기준"이에요. 500도 이 조건에 맞아요. 조건이 하나 더 필요해요.',
      '논리 서랍의 "그리고" 블록으로 조건을 하나 더 붙여요: 거리 < 500.',
      '만약 (달리는중 그리고 거리 ≥ 가까움기준 그리고 거리 < 500) 이면 앞으로, 아니면 정지.',
    ],
    learn: '센서가 "못 읽었을 때" 돌려주는 값을 알아야 해요. 포니봇 거리센서는 500이 못 읽음이에요. 못 읽으면 멈추는 쪽이 안전해요.',
    real: '실물을 넓은 곳에 두고 화면의 거리 값이 500으로 나오는지 확인해요(실물 확인 항목이에요).',
  },
  // ---------------- 3교시: 배워서 반응하기(AI 신호 = 라디오 숫자) ----------------
  {
    id: 'p3-signal', lesson: '3교시', title: '미션 1 · 초록 출발, 빨강 멈춤',
    story: '길잡이: "세 번째 경기장은 신호 경기장! AI가 본 카드 번호가 라디오로 날아와. 3은 초록, 1은 빨강이야."',
    goal: '라디오 숫자 3을 받으면 출발하고, 1을 받으면 멈추게 해요.',
    scene: 'free', noAuto: true, how: '▶ 실행을 누른 뒤 미리보기 아래 📡 숫자 3, 그다음 1 (AI 브리지를 켜 두면 카드로도 돼요)',
    predict: { q: '지금 코드는 3(초록)만 알아요. 3을 보낸 뒤 1(빨강)을 보내면?', choices: ['빨간 신호니까 멈춘다', '멈추지 않고 계속 간다', '뒤로 간다'], answer: 1, why: '로봇은 "1이면 멈춰"라는 규칙이 없으면 1이 빨강이라는 것도, 멈춰야 한다는 것도 몰라요.' },
    code: HEAD('미션 1 · 초록 출발, 빨강 멈춤', ['AI가 본 카드 번호가 라디오 숫자로 와요: 1=빨강, 2=노랑, 3=초록.', '지금은 3을 받으면 출발만 해요.', '고칠 것: 1을 받으면 멈추게 해 보세요.'])
      + 'let 속도 = 80\nradio.setGroup(1)\naiPonybot.stopAllMotors()\nradio.onReceivedNumber(function (받은수) {\n    if (받은수 == 3) {\n        basic.showIcon(IconNames.Yes)\n        aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 속도)\n    }\n})\n',
    checks: [
      { label: '숫자 3을 받고 출발하기(8cm 넘게)', test: (m) => m.radio[3] > 0 && m.seg[3] && Math.hypot(m.seg[3].dx, m.seg[3].dy) >= 8 },
      { label: '숫자 1 받기', test: (m) => m.radio[1] > 0 },
      { label: '1을 받은 뒤 멈추기', test: (m) => m.lastRadio === 1 && m.moved && m.still >= 1 && m.sinceRadio < m.still + 1.2, now: (m) => (m.lastRadio === 1 ? (m.still > 0 ? '멈춤' : '아직 달리는 중') : '') },
    ],
    hints: [
      '"받은수 == 3 이면" 블록이 하나 있어요. 1일 때 할 일은 어디에 적어야 할까요?',
      '"만약 ~이면" 블록의 톱니(+)를 눌러 "아니면서 만약"을 더하고 조건을 받은수 == 1 로 해요.',
      '만약 받은수 == 3 이면 앞으로 이동, 아니면서 만약 받은수 == 1 이면 모든 모터 정지.',
    ],
    learn: '카드를 알아보는 것은 AI가 "배워서" 하고, 번호마다 무엇을 할지는 사람이 "규칙"으로 정해요. 둘이 이어져야 로봇이 움직여요.',
    real: 'AI 브리지에서 초록·빨강 카드를 가르치고, 같은 모둠번호의 실물 포니봇이 카드에 반응하는지 확인해요.',
  },
  {
    id: 'p3-lost', lesson: '3교시', title: '미션 2 · 신호가 끊기면?',
    story: '길잡이: "큰일이야! 달리는 중에 컴퓨터가 꺼지면 빨간 카드를 보여 줄 수도 없잖아!"',
    goal: '3을 한 번만 보내요. 2초 동안 아무 신호도 안 오면 포니봇이 스스로 멈추게 해요.',
    scene: 'free', noAuto: true, how: '▶ 실행을 누른 뒤 📡 숫자 3을 한 번만 (1이나 0은 누르지 않아요)',
    predict: { q: '3을 한 번 보낸 뒤 컴퓨터가 꺼져서 아무 신호도 못 보내면?', choices: ['조금 있다가 스스로 멈춘다', '끝없이 달린다', '출발한 곳으로 돌아온다'], answer: 1, why: '"멈춰" 신호가 와야만 멈추는 규칙이라서, 신호가 끊기면 멈출 방법이 없어요.' },
    code: HEAD('미션 2 · 신호가 끊기면?', ['3이면 출발, 1이면 멈춰요. 그런데 신호가 끊기면 멈추지 못해요.', '"마지막수신"에 신호가 온 시각이 저장돼요.', '고칠 것: 무한 반복 안에서, 지금 시각 - 마지막수신 > 2000 이면 멈추게 해 보세요.'])
      + 'let 속도 = 80\nlet 마지막수신 = 0\nradio.setGroup(1)\naiPonybot.stopAllMotors()\nradio.onReceivedNumber(function (받은수) {\n    마지막수신 = input.runningTime()\n    if (받은수 == 3) {\n        aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 속도)\n    } else if (받은수 == 1) {\n        aiPonybot.stopAllMotors()\n    }\n})\nbasic.forever(function () {\n    basic.pause(100)\n})\n',
    checks: [
      { label: '숫자 3을 받고 출발하기(8cm 넘게)', test: (m) => m.radio[3] > 0 && m.maxForward >= 8 },
      { label: '멈춤 신호(0·1)는 보내지 않기', test: (m) => m.radio[3] > 0 && !m.radio[0] && !m.radio[1], now: (m) => (m.radio[0] || m.radio[1] ? '멈춤 신호를 보냈어요 — ▶ 실행부터 다시' : '') },
      { label: '신호가 끊긴 지 2초쯤 뒤 스스로 멈추기', test: (m) => m.radio[3] > 0 && !m.radio[0] && !m.radio[1] && m.moved && m.sinceRadio >= 2.5 && m.still >= 0.5 && m.maxForward <= 60, now: (m) => (m.sinceRadio >= 0 ? `마지막 신호 뒤 ${m.sinceRadio.toFixed(0)}초` : '') },
    ],
    hints: [
      '"마지막으로 신호가 온 때"에서 지금까지 얼마나 지났는지 알면 돼요. 지금 시각은 입력 서랍의 "작동 시간(ms)"이에요.',
      '무한 반복 안에 "만약 (작동 시간 - 마지막수신) > 2000 이면 모든 모터 정지"를 넣어요.',
      '무한 반복: 만약 input.runningTime() - 마지막수신 > 2000 이면 aiPonybot.stopAllMotors() → 일시중지 100.',
    ],
    learn: '신호가 "오는 것"만 믿으면 위험해요. 신호가 "안 오는 것"도 살펴서 스스로 멈추는 안전장치(감시)가 필요해요. AI 브리지가 같은 번호를 0.5초마다 다시 보내는 것도 이 때문이에요.',
    real: '실물에서 초록 카드로 출발시킨 뒤 AI 브리지 창을 닫거나 USB 마이크로비트를 뽑아, 2초 안에 멈추는지 확인해요.',
  },
  // ---------------- 4교시: 우리 모둠 AI 포니봇 ----------------
  {
    id: 'p4-team', lesson: '4교시', title: '미션 · 번호마다 다른 행동',
    story: '길잡이: "마지막 경기장은 너희가 만드는 경기장이야! 카드 번호마다 포니봇이 다르게 움직이게 해 봐."',
    goal: '숫자 1과 2를 받으면 서로 다른 방향으로 8cm 넘게 움직이고, 각각 스스로 멈추게 해요.',
    scene: 'free', noAuto: true, how: '▶ 실행을 누른 뒤 📡 숫자 1, 멈추면 2',
    predict: { q: '틀에는 1번 행동만 들어 있어요. 그대로 2를 보내면?', choices: ['1번과 같은 행동을 한다', '아무 일도 일어나지 않는다', '오류가 나서 멈춘다'], answer: 1, why: '2일 때 무엇을 할지 정해 주지 않았기 때문에 로봇은 아무것도 하지 않아요.' },
    code: HEAD('미션 · 번호마다 다른 행동', ['1을 받으면 왼쪽 옆으로 조금 가고 멈춰요.', '고칠 것: 2를 받았을 때의 행동을 설계표대로 만들어 보세요(1번과 다른 방향).', '안전: 움직인 뒤에는 꼭 "모든 모터 정지". 2초 감시 블록은 지우지 마세요.'])
      + 'let 속도 = 80\nlet 마지막수신 = 0\nradio.setGroup(1)\naiPonybot.stopAllMotors()\nradio.onReceivedNumber(function (받은수) {\n    마지막수신 = input.runningTime()\n    if (받은수 == 1) {\n        basic.showArrow(ArrowNames.West)\n        aiPonybot.runMecanum(aiPonybot.Mecanum.Left, 속도)\n        basic.pause(1500)\n        aiPonybot.stopAllMotors()\n    }\n})\nbasic.forever(function () {\n    if (input.runningTime() - 마지막수신 > 2000) {\n        aiPonybot.stopAllMotors()\n    }\n    basic.pause(100)\n})\n',
    checks: [
      { label: '1을 받으면 8cm 넘게 움직이고 멈추기', test: (m) => m.seg[1] && m.seg[1].done && Math.hypot(m.seg[1].dx, m.seg[1].dy) >= 8, now: (m) => (m.seg[1] ? `${Math.hypot(m.seg[1].dx, m.seg[1].dy).toFixed(0)}cm` : '') },
      { label: '2를 받으면 8cm 넘게 움직이고 멈추기', test: (m) => m.seg[2] && m.seg[2].done && Math.hypot(m.seg[2].dx, m.seg[2].dy) >= 8, now: (m) => (m.seg[2] ? `${Math.hypot(m.seg[2].dx, m.seg[2].dy).toFixed(0)}cm` : '') },
      { label: '두 행동의 방향이 서로 다르기', test: (m) => { const a = m.seg[1], b = m.seg[2]; if (!a || !b || !a.done || !b.done) return false; const la = Math.hypot(a.dx, a.dy), lb = Math.hypot(b.dx, b.dy); return la >= 8 && lb >= 8 && (a.dx * b.dx + a.dy * b.dy) / (la * lb) < 0.7; } },
    ],
    hints: [
      '"받은수 == 1 이면" 묶음을 잘 보세요. 2일 때도 같은 모양의 묶음이 필요해요.',
      '"만약"의 톱니(+)로 "아니면서 만약 받은수 == 2"를 더하고, 그 안에 메카넘 이동(다른 방향) → 일시중지 → 모든 모터 정지를 넣어요.',
      '아니면서 만약 받은수 == 2 이면: 메카넘 → 방향 이동 → 일시중지 1500 → 모든 모터 정지.',
    ],
    learn: 'AI가 알려 주는 것은 "몇 번 카드인가"뿐이에요. 그 번호가 무슨 뜻이고 로봇이 무엇을 할지는 우리 모둠이 설계해요.',
    real: '모둠 카드를 AI 브리지에 가르치고, 실물 포니봇이 설계표대로 움직이는지 시연해요. 틀리면 AI(사진) 문제인지 코드 문제인지 나눠 봐요.',
  },
];
