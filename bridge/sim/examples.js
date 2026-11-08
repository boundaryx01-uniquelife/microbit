// 자동 생성 파일 (tests/build-sim-examples.js) — 직접 고치지 마세요
export const GROUPS = [
 {
  "id": "button",
  "title": "🔘 본체 버튼으로 해 보기",
  "note": "마이크로비트 1개. 로보독 아래쪽 전원 스위치 옆 버튼을 눌러 시작해요"
 },
 {
  "id": "radio",
  "title": "📡 라디오 리모컨으로 해 보기",
  "note": "마이크로비트 2개(리모컨 + 로보독) 또는 AI 브리지. 숫자를 보내 로보독을 움직여요"
 },
 {
  "id": "check",
  "title": "🛠 점검·둘러보기",
  "note": "수업 전 점검과 동작 구경"
 }
];
export const EXAMPLES = [
 {
  "id": "10_button-bark",
  "group": "button",
  "order": 1,
  "title": "① 버튼 누르면 멍멍 (가장 쉬움)",
  "level": "쉬움",
  "sim": [
   "[▶ 실행]을 누르세요",
   "로보독 화면 바로 위 [본체 버튼 누르기]를 누르세요",
   "로보독이 눈을 반짝이고 \"멍멍\" 한 뒤 앞발을 들어 인사해요",
   "여러 번 눌러 보세요. 누를 때마다 다시 해요"
  ],
  "real": [
   "MakeCode에 코드를 넣고 로보독 마이크로비트에 내려받기",
   "로보독 등에 꽂고 전원 켜기",
   "본체 버튼(아래쪽 전원 스위치 옆) 누르기"
  ],
  "code": "// =============================================================\n// [본체 버튼 ①] 버튼을 누르면 멍멍! (가장 쉬움, 처음 해 보는 사람용)\n// 확장: kocoafab/robodog\n//\n// 무엇을 하나요? 로보독 본체 버튼을 누를 때마다\n//   눈이 반짝 → \"멍멍\" → 앞발 들어 인사 → 다시 서기\n//\n// 본체 버튼은 어디? 로보독 아래쪽, 전원 스위치 바로 옆의 작은 버튼이에요.\n//   (등에 꽂은 마이크로비트의 A·B 버튼은 가려져서 누를 수 없어요)\n//\n// 코드 읽는 법\n//   이전버튼/지금버튼: \"방금 눌렀나?\"를 알기 위해 두 번 비교해요.\n//   지금은 눌렸고(지금버튼) 조금 전엔 안 눌렸으면(!이전버튼) → 한 번 누른 것!\n// =============================================================\n\nlet 이전버튼 = false\nrobodog.gesture(deflib.Posture.Ready)\n\nbasic.forever(function () {\n    let 지금버튼 = robodog.getButton()\n    if (지금버튼 && !(이전버튼)) {\n        // 여기 안에 \"버튼을 눌렀을 때 할 일\"을 차례대로 적어요\n        robodog.headLedExp(deflib.LedExpression.SparklingEyes)\n        robodog.soundPlay(deflib.SoundEffect.Bark, deflib.SoundVolume.Medium)\n        robodog.gesture(deflib.Posture.SayHello)\n        basic.pause(2000)\n        robodog.gesture(deflib.Posture.Ready)\n    }\n    이전버튼 = 지금버튼\n    basic.pause(50)\n})\n"
 },
 {
  "id": "01_hello-robodog",
  "group": "button",
  "order": 2,
  "title": "② 누를 때마다 다음 장면 (순서대로)",
  "level": "쉬움",
  "sim": [
   "[▶ 실행]을 누르세요",
   "로보독 화면 바로 위 [본체 버튼 누르기]를 누르세요 → 인사",
   "한 번 더 → 조금 걷기",
   "한 번 더 → 앉기, 그다음은 다시 인사부터"
  ],
  "real": [
   "코드를 로보독 마이크로비트에 내려받기",
   "로보독 등에 꽂고 전원 켜기",
   "본체 버튼을 누를 때마다 다음 장면"
  ],
  "code": "// =============================================================\n// [로보독 마이크로비트] 1. 안녕, 로보독! (순차 구조)\n// 확장: kocoafab/robodog (MakeCode 확장에서 전체 이름 입력)\n// 활동: 로보독 본체 버튼을 누를 때마다 다음 장면을 보여 줍니다.\n//       1번째 = 인사, 2번째 = 조금 걷기, 3번째 = 앉기 → 다시 1번째\n// ※ 로보독 등에 꽂은 마이크로비트의 A·B 버튼은 가려져서 누를 수 없어요.\n//   그래서 로보독 본체 아래쪽, 전원 스위치 옆의 '본체 버튼'을 씁니다.\n// =============================================================\n\nlet 차례 = 0\nlet 버튼이전 = false\nrobodog.gesture(deflib.Posture.Ready)\nrobodog.headLedExp(deflib.LedExpression.SparklingEyes)\n\nfunction 본체버튼을눌렀을때 () {\n    차례 = 차례 % 3 + 1\n    if (차례 == 1) {\n        // 인사 장면\n        robodog.bodyLed(0, 0, 255)\n        robodog.soundPlay(deflib.SoundEffect.Hello, deflib.SoundVolume.Medium)\n        basic.pause(1000)\n        robodog.gesture(deflib.Posture.SayHello)\n        basic.pause(3000)\n        robodog.gesture(deflib.Posture.Ready)\n    } else if (차례 == 2) {\n        // 앞으로 조금 걷고 멈추기 (책상 위에서는 속도 30 이하!)\n        robodog.bodyLed(0, 255, 0)\n        robodog.move(deflib.MoveDirection.Forward, 30)\n        basic.pause(1000)\n        robodog.stop()\n        robodog.gesture(deflib.Posture.Ready)\n    } else {\n        // 앉기\n        robodog.bodyLed(255, 160, 0)\n        robodog.stop()\n        robodog.gesture(deflib.Posture.SitDown)\n    }\n}\n\n// 본체 버튼: 누르는 '순간'에 한 번만 반응하도록 바로 전 상태와 비교\nbasic.forever(function () {\n    let 버튼지금 = robodog.getButton()\n    if (버튼지금 && !(버튼이전)) {\n        본체버튼을눌렀을때()\n    }\n    버튼이전 = 버튼지금\n    basic.pause(50)\n})\n"
 },
 {
  "id": "02_distance-rule",
  "group": "button",
  "order": 3,
  "title": "③ 버튼 누르면 걷다가 장애물 앞에서 멈춤 (거리센서)",
  "level": "보통",
  "sim": [
   "[▶ 실행]을 누르세요 (앞에 빨간 장애물이 저절로 놓여요)",
   "로보독 화면 바로 위 [본체 버튼 누르기]를 누르세요",
   "앞으로 걷다가 장애물이 가까워지면 멈추고 몸통이 빨개져요",
   "[장애물 지우기]·[장애물 놓기]로 바꿔 가며 다시 해 보세요"
  ],
  "real": [
   "코드를 로보독 마이크로비트에 내려받기",
   "바닥에 놓고 앞 30~40cm에 상자 놓기",
   "본체 버튼 누르기 → 상자 앞에서 멈추는지 보기"
  ],
  "code": "// =============================================================\n// [로보독 마이크로비트] 2. 규칙으로 반응하기 (센서 + 조건문)\n// 활동: 거리센서 값이 가까우면 멈추고 경고, 멀면 천천히 걷기.\n// 수업 포인트: \"사람이 정한 규칙(만약 ~라면)\"으로 움직이는 로봇.\n//              다음 차시의 \"데이터로 배우는 AI\"와 비교합니다.\n// 본체 버튼(전원 스위치 옆) = 걷기 시작 / 멈춤 (켜자마자 걷지 않아요)\n//   ※ 꽂은 마이크로비트의 A·B 버튼은 가려지므로 본체 버튼을 씁니다.\n// 멈춰 있는 동안에도 몸통 불빛으로 거리를 알려 줍니다: 빨강 = 가까움, 초록 = 멂.\n// ※ 거리센서 값의 단위는 실물로 확인하세요. 멈춘 상태에서 손을 앞에 대 보며 불빛이 바뀌는 거리를 보고\n//   모둠이 \"가까움\" 기준값을 정해 아래 숫자를 바꾸세요.\n// ※ 로보독 마이크로비트에서는 '음악' 블록을 쓰지 마세요(로봇 통신 핀과 겹칠 수 있음).\n// ※ 계속 걷는 예제입니다. 거리센서는 앞의 물체만 보고 책상 끝(낭떠러지)은 못 봅니다 → 바닥이나 울타리 안에서 시험하세요.\n// =============================================================\n\nlet 가까움기준 = 20\nlet 걷는중 = false\nlet 지금상태 = 0\nlet 버튼이전 = false\nlet 불빛상태 = 0\nrobodog.gesture(deflib.Posture.Ready)\nrobodog.headLedExp(deflib.LedExpression.EyesClosed)\n\n// 본체 버튼은 '걷는중' 값만 바꾸고, 로봇 명령은 아래 무한 반복 한 곳에서만 내립니다\nbasic.forever(function () {\n    let 버튼지금 = robodog.getButton()\n    if (버튼지금 && !(버튼이전)) {\n        걷는중 = !(걷는중)\n    }\n    버튼이전 = 버튼지금\n    basic.pause(50)\n})\n\nbasic.forever(function () {\n    if (!(걷는중)) {\n        if (지금상태 != 0) {\n            지금상태 = 0\n            불빛상태 = 0\n            robodog.stop()\n            robodog.gesture(deflib.Posture.Ready)\n            robodog.headLedExp(deflib.LedExpression.EyesClosed)\n        }\n        // 멈춘 채로 거리만 불빛으로 보여 주기(기준값 정할 때 사용)\n        let 멈춤거리 = robodog.getTof()\n        let 새불빛 = 멈춤거리 > 0 && 멈춤거리 < 가까움기준 ? 1 : 2\n        if (새불빛 != 불빛상태) {\n            불빛상태 = 새불빛\n            if (불빛상태 == 1) {\n                robodog.bodyLed(255, 0, 0)\n            } else {\n                robodog.bodyLed(0, 255, 0)\n            }\n        }\n    } else {\n        let 거리 = robodog.getTof()\n        if (거리 == 0) {\n            // 센서 값을 아직 못 받았거나 오류 → 안전하게 멈춤\n            if (지금상태 != 3) {\n                지금상태 = 3\n                robodog.stop()\n                basic.showIcon(IconNames.Confused)\n            }\n        } else if (거리 < 가까움기준) {\n            if (지금상태 != 1) {\n                지금상태 = 1\n                robodog.stop()\n                robodog.bodyLed(255, 0, 0)\n                robodog.headLedExp(deflib.LedExpression.SharpEyes)\n                robodog.soundPlay(deflib.SoundEffect.MoveAside, deflib.SoundVolume.Medium)\n                basic.showIcon(IconNames.No)\n            }\n        } else {\n            if (지금상태 != 2) {\n                지금상태 = 2\n                robodog.bodyLed(0, 255, 0)\n                robodog.headLedExp(deflib.LedExpression.SparklingEyes)\n                robodog.move(deflib.MoveDirection.Forward, 25)\n                basic.showIcon(IconNames.Yes)\n            }\n        }\n    }\n    basic.pause(100)\n})\n"
 },
 {
  "id": "12_button-explore",
  "group": "button",
  "order": 4,
  "title": "④ 버튼 누르면 탐험 (벽 만나면 방향 바꾸기)",
  "level": "도전",
  "sim": [
   "오른쪽 [환경]에서 [바닥(벽 있음)]을 고르세요",
   "[▶ 실행]을 누르세요",
   "로보독 화면 바로 위 [본체 버튼 누르기]를 누르세요",
   "두리번거리고 \"멍멍\" 한 뒤 걸어요. 벽 가까이 가면 돌아서 다시 걸어요",
   "걷는 중에 한 번 더 누르면 멈춰요 (15초가 지나도 멈춰요)"
  ],
  "real": [
   "코드를 로보독 마이크로비트에 내려받기",
   "상자나 책으로 울타리를 만든 바닥에 놓기",
   "본체 버튼 누르기 → 탐험 시작, 다시 누르면 멈춤"
  ],
  "code": "// =============================================================\n// [본체 버튼 ④] 버튼을 누르면 탐험 출발! (벽을 만나면 방향 바꾸기)\n// 확장: kocoafab/robodog\n//\n// 무엇을 하나요?\n//   1) 본체 버튼을 누르면 두리번거리며 표정을 3번 바꾸고 \"멍멍\"\n//   2) 앞으로 걷다가 벽(물체)이 20cm보다 가까우면 아무 방향으로 돌아서 다시 걷기\n//   3) 15초가 지나거나, 걷는 중에 본체 버튼을 한 번 더 누르면 멈춤\n//\n// ※ 거리센서는 앞의 물체만 봐요. 책상 끝(낭떠러지)은 못 보니 바닥이나 울타리 안에서 하세요.\n// =============================================================\n\nlet 이전버튼 = false\nlet 탐험중 = false\nlet 시작시간 = 0\nlet 벽거리 = 20\nrobodog.gesture(deflib.Posture.Ready)\n\nfunction 두리번 () {\n    robodog.headLedExp(deflib.LedExpression.RollingEyes)\n    robodog.rotation(deflib.RotateDirection.Counterclockwise, 30, 80)\n    basic.pause(800)\n    robodog.headLedExp(deflib.LedExpression.SharpEyes)\n    robodog.rotation(deflib.RotateDirection.Clockwise, 60, 80)\n    basic.pause(1200)\n    robodog.headLedExp(deflib.LedExpression.BigEyes)\n    robodog.rotation(deflib.RotateDirection.Counterclockwise, 30, 80)\n    basic.pause(800)\n    robodog.soundPlay(deflib.SoundEffect.Bark, deflib.SoundVolume.Medium)\n    basic.pause(800)\n}\n\nfunction 멈추기 () {\n    robodog.stop()\n    탐험중 = false\n    robodog.bodyLed(0, 0, 255)\n    robodog.headLedExp(deflib.LedExpression.Blink)\n}\n\nbasic.forever(function () {\n    let 지금버튼 = robodog.getButton()\n    if (지금버튼 && !(이전버튼)) {\n        if (탐험중) {\n            멈추기()\n        } else {\n            탐험중 = true\n            두리번()\n            robodog.bodyLed(0, 255, 0)\n            시작시간 = input.runningTime()\n            robodog.move(deflib.MoveDirection.Forward, 30)\n        }\n    }\n    이전버튼 = 지금버튼\n    if (탐험중) {\n        if (input.runningTime() - 시작시간 > 15000) {\n            멈추기()\n        } else if (robodog.getTof() < 벽거리) {\n            // 벽이다! 멈추고 30~180도 사이 아무 방향으로 돌기\n            robodog.stop()\n            if (randint(0, 1) == 0) {\n                robodog.rotation(deflib.RotateDirection.Clockwise, randint(30, 180), 60)\n            } else {\n                robodog.rotation(deflib.RotateDirection.Counterclockwise, randint(30, 180), 60)\n            }\n            basic.pause(2000)\n            robodog.move(deflib.MoveDirection.Forward, 30)\n        }\n    }\n    basic.pause(50)\n})\n"
 },
 {
  "id": "20_remote-sender",
  "group": "radio",
  "order": 1,
  "title": "① 리모컨 쪽 코드 (손에 드는 마이크로비트)",
  "level": "쉬움",
  "sim": [
   "이 코드는 리모컨(두 번째 마이크로비트)용이에요. 시뮬레이터에서는 보내는 모습만 볼 수 있어요",
   "[▶ 실행]을 누르세요",
   "로보독 화면 위 [🅰 마이크로비트] 줄의 [A]·[B]를 눌러 보세요 → 기록 창에 \"라디오 보냄: 1\"처럼 나와요",
   "로보독이 받는 모습은 ② 또는 ③ 예제에서 확인해요"
  ],
  "real": [
   "마이크로비트를 1개 더 준비해요(리모컨용)",
   "이 코드를 리모컨 마이크로비트에 내려받고 배터리팩 연결",
   "로보독 마이크로비트에는 ② 또는 ③ 코드를 넣기",
   "리모컨 화면에 나온 숫자(모둠 번호)가 로보독 코드의 모둠번호와 같은지 확인",
   "A = 1, B = 2, A+B = 3을 보내요"
  ],
  "code": "// =============================================================\n// [라디오 리모컨 ①] 리모컨 쪽 코드 — \"두 번째\" 마이크로비트에 넣어요\n// (로보독에 꽂은 마이크로비트가 아니라, 손에 드는 마이크로비트)\n//\n// 준비물: 마이크로비트 2개\n//   ㉠ 리모컨: 이 코드를 넣고 배터리팩 연결 → 손에 들기\n//   ㉡ 로보독: [라디오 리모컨 ②] 또는 [③] 코드를 넣고 로보독 등에 꽂기\n//\n// 버튼 약속(숫자 보내기)\n//   A 버튼 = 1      B 버튼 = 2      A+B 함께 = 3\n// 리모컨과 로보독의 모둠 번호가 같아야 해요(아래 모둠번호 = 1, 라디오 그룹이라고도 해요).\n//   여러 모둠이 함께 하면 모둠마다 1, 2, 3 … 다른 번호로 바꾸세요(양쪽 모두!).\n// =============================================================\n\nlet 모둠번호 = 1\nradio.setGroup(모둠번호)\nbasic.showNumber(모둠번호)\n\ninput.onButtonPressed(Button.A, function () {\n    radio.sendNumber(1)\n    basic.showArrow(ArrowNames.North)\n})\ninput.onButtonPressed(Button.B, function () {\n    radio.sendNumber(2)\n    basic.showIcon(IconNames.No)\n})\ninput.onButtonPressed(Button.AB, function () {\n    radio.sendNumber(3)\n    basic.showIcon(IconNames.Heart)\n})\n"
 },
 {
  "id": "21_remote-dog",
  "group": "radio",
  "order": 2,
  "title": "② 리모컨으로 움직이기 (로보독 쪽)",
  "level": "쉬움",
  "sim": [
   "[▶ 실행]을 누르세요",
   "로보독 화면 바로 위 [📡 리모컨] 줄에서 [1]을 누르세요 → 앞으로 걸어요 (리모컨 A 버튼과 같아요)",
   "[2] → 멈춰요 (리모컨 B)",
   "[3] → 오른쪽으로 돌아요 (리모컨 A+B)",
   "걷는 중에 [본체 버튼 누르기] → 언제든 멈춰요"
  ],
  "real": [
   "리모컨 마이크로비트에 ① 코드, 로보독 마이크로비트에 이 코드",
   "로보독을 바닥에 놓고 전원 켜기",
   "리모컨 A = 걷기, B = 멈추기, A+B = 돌기",
   "위험하면 본체 버튼으로 멈추기"
  ],
  "code": "// =============================================================\n// [라디오 리모컨 ②] 리모컨으로 움직이는 로보독 — 로보독에 꽂는 마이크로비트용\n// 확장: kocoafab/robodog\n//\n// 리모컨(20_remote-sender)에서 오는 숫자에 따라\n//   1 (A 버튼)   = 앞으로 걷기 (몸통 초록)\n//   2 (B 버튼)   = 멈추기     (몸통 빨강)\n//   3 (A+B 함께) = 오른쪽으로 90도 돌기 (몸통 파랑)\n// 안전: 로보독 본체 버튼을 누르면 언제든 멈춰요.\n// 모둠 번호는 리모컨과 같아야 해요.\n// =============================================================\n\nlet 모둠번호 = 1\nlet 이전버튼 = false\nradio.setGroup(모둠번호)\nrobodog.gesture(deflib.Posture.Ready)\nrobodog.headLedExp(deflib.LedExpression.SparklingEyes)\n\nradio.onReceivedNumber(function (receivedNumber) {\n    if (receivedNumber == 1) {\n        robodog.bodyLed(0, 255, 0)\n        robodog.move(deflib.MoveDirection.Forward, 25)\n    } else if (receivedNumber == 2) {\n        robodog.stop()\n        robodog.bodyLed(255, 0, 0)\n    } else if (receivedNumber == 3) {\n        robodog.stop()\n        robodog.bodyLed(0, 0, 255)\n        robodog.rotation(deflib.RotateDirection.Clockwise, 90, 50)\n    }\n})\n\n// 안전장치: 본체 버튼 = 멈춤\nbasic.forever(function () {\n    let 지금버튼 = robodog.getButton()\n    if (지금버튼 && !(이전버튼)) {\n        robodog.stop()\n        robodog.bodyLed(255, 0, 0)\n    }\n    이전버튼 = 지금버튼\n    basic.pause(50)\n})\n"
 },
 {
  "id": "22_remote-tricks",
  "group": "radio",
  "order": 3,
  "title": "③ 리모컨으로 재주 부리기 (걷지 않음)",
  "level": "쉬움",
  "sim": [
   "[▶ 실행]을 누르세요",
   "로보독 화면 위 [📡 리모컨] 줄에서 [1] → 앞발 들어 인사",
   "[2] → 앉기, 한 번 더 [2] → 서기",
   "[3] → 눈 반짝 + \"멍멍\""
  ],
  "real": [
   "리모컨 마이크로비트에 ① 코드, 로보독 마이크로비트에 이 코드",
   "책상 위에서 해도 돼요(걷지 않아요)",
   "리모컨 A = 인사, B = 앉기/서기, A+B = 멍멍"
  ],
  "code": "// =============================================================\n// [라디오 리모컨 ③] 리모컨으로 재주 부리기 — 로보독에 꽂는 마이크로비트용\n// 확장: kocoafab/robodog\n//\n// 리모컨(20_remote-sender, 같은 코드 그대로)에서 오는 숫자에 따라\n//   1 (A 버튼)   = 앞발 들어 인사 + \"안녕\"\n//   2 (B 버튼)   = 앉기 ↔ 서기 (누를 때마다 바뀜)\n//   3 (A+B 함께) = 반짝 눈 + \"멍멍\"\n// 걷지 않아서 책상 위에서도 안전하게 해 볼 수 있어요.\n// =============================================================\n\nlet 모둠번호 = 1\nlet 앉음 = false\nradio.setGroup(모둠번호)\nrobodog.gesture(deflib.Posture.Ready)\n\nradio.onReceivedNumber(function (receivedNumber) {\n    if (receivedNumber == 1) {\n        앉음 = false\n        robodog.headLedExp(deflib.LedExpression.ThankYou)\n        robodog.soundPlay(deflib.SoundEffect.Hello, deflib.SoundVolume.Medium)\n        robodog.gesture(deflib.Posture.SayHello)\n        basic.pause(2000)\n        robodog.gesture(deflib.Posture.Ready)\n    } else if (receivedNumber == 2) {\n        앉음 = !(앉음)\n        if (앉음) {\n            robodog.gesture(deflib.Posture.SitDown)\n        } else {\n            robodog.gesture(deflib.Posture.Ready)\n        }\n    } else if (receivedNumber == 3) {\n        robodog.headLedExp(deflib.LedExpression.SparklingEyes)\n        robodog.soundPlay(deflib.SoundEffect.Bark, deflib.SoundVolume.Medium)\n    }\n})\n"
 },
 {
  "id": "03_ai-traffic-dog",
  "group": "radio",
  "order": 4,
  "title": "④ AI 신호등 안내견 (AI 브리지가 리모컨)",
  "level": "보통",
  "sim": [
   "[▶ 실행]을 누르세요",
   "로보독 화면 위 [📡 리모컨] 줄의 [계속 보내기]를 켜세요",
   "[3] 초록 → 걷기, [2] 노랑 → 기다리기, [1] 빨강 → 멈추고 \"비켜\"",
   "같은 컴퓨터에서 AI 브리지를 켜 두면 카드 인식 결과가 자동으로 와요"
  ],
  "real": [
   "USB 마이크로비트에 00_bridge-receiver, 로보독 마이크로비트에 이 코드",
   "AI 브리지에서 카드 4장을 학습하고 연결",
   "카메라에 카드를 보여 주면 로보독이 반응해요"
  ],
  "code": "// =============================================================\n// [로보독 마이크로비트] 3. AI 신호등 안내견\n// 원 교안: 스크래치 인공지능 교안 CH10을 마이크로비트용으로 재구성\n//\n// 준비: AI 브리지에서 1=빨강, 2=노랑, 3=초록, 4=배경 카드를 학습\n//       USB 마이크로비트(00_bridge-receiver)와 같은 모둠번호 사용\n// 받는 숫자: 0=멈춤, 1=빨강, 2=노랑, 3=초록, 4=배경\n// 안전장치: ① 2초 동안 신호가 안 오면 어떤 상태든 멈춤\n//           ② 로보독 본체 버튼(전원 스위치 옆) = 멈춤 잠금 ↔ 풀기 (누를 때마다 바뀜, 잠그면 눈에 X)\n//           ※ 꽂은 마이크로비트의 A·B 버튼은 가려져서 누를 수 없어요.\n// ※ 로보독 마이크로비트에서는 '음악' 블록을 쓰지 마세요(로봇 통신 핀과 겹칠 수 있음).\n// ※ 계속 걷는 예제입니다. 거리센서는 앞의 물체만 보고 책상 끝(낭떠러지)은 못 봅니다 → 바닥이나 울타리 안에서 시험하세요.\n// =============================================================\n\nlet 모둠번호 = 1\nlet 받은신호 = 0\nlet 현재신호 = -1\nlet 마지막수신 = 0\nlet 멈춤잠금 = false\nradio.setGroup(모둠번호)\nrobodog.gesture(deflib.Posture.Ready)\n// 켤 때 모둠번호를 로보독 눈에 잠깐 보여 줌(등에 꽂은 마이크로비트 화면은 가려질 수 있어요)\nrobodog.headLedPrint(deflib.HeadLedSide.Both, \"\" + 모둠번호)\nbasic.pause(1400)\nrobodog.headLedClear()\n\nfunction 신호에반응하기 (신호: number) {\n    if (신호 == 1) {\n        // 빨강: 멈추고 비켜!\n        robodog.stop()\n        robodog.bodyLed(255, 0, 0)\n        robodog.headLedExp(deflib.LedExpression.SharpEyes)\n        robodog.soundPlay(deflib.SoundEffect.MoveAside, deflib.SoundVolume.Medium)\n        basic.showIcon(IconNames.No)\n    } else if (신호 == 2) {\n        // 노랑: 기다려\n        robodog.stop()\n        robodog.bodyLed(255, 160, 0)\n        robodog.headLedExp(deflib.LedExpression.Blink)\n        robodog.soundPlay(deflib.SoundEffect.Wait, deflib.SoundVolume.Medium)\n        basic.showIcon(IconNames.Asleep)\n    } else if (신호 == 3) {\n        // 초록: 출발! (책상 위라면 속도 25 이하)\n        robodog.bodyLed(0, 255, 0)\n        robodog.headLedExp(deflib.LedExpression.SparklingEyes)\n        robodog.soundPlay(deflib.SoundEffect.Start, deflib.SoundVolume.Medium)\n        robodog.move(deflib.MoveDirection.Forward, 25)\n        basic.showIcon(IconNames.Yes)\n    } else {\n        // 0(멈춤) 또는 4(배경): 제자리에서 기다리기\n        robodog.stop()\n        robodog.bodyLed(0, 0, 0)\n        robodog.headLedExp(deflib.LedExpression.EyesClosed)\n        basic.clearScreen()\n    }\n}\n\n// 라디오는 받은 값만 기록하고, 실제 동작은 아래 무한 반복에서 한 곳에서만 처리\nradio.onReceivedNumber(function (받은수) {\n    받은신호 = 받은수\n    마지막수신 = input.runningTime()\n})\n\n// 본체 버튼: 누를 때마다 멈춤 잠금 ↔ 풀기\nlet 버튼이전 = false\nbasic.forever(function () {\n    let 버튼지금 = robodog.getButton()\n    if (버튼지금 && !(버튼이전)) {\n        멈춤잠금 = !(멈춤잠금)\n    }\n    버튼이전 = 버튼지금\n    basic.pause(50)\n})\n\nbasic.forever(function () {\n    if (멈춤잠금) {\n        // 잠금: 라디오를 무시하고 멈춤, 눈에 X\n        if (현재신호 != -2) {\n            현재신호 = -2\n            robodog.stop()\n            robodog.bodyLed(255, 0, 0)\n            robodog.headLedPrint(deflib.HeadLedSide.Both, \"X\")\n            basic.showIcon(IconNames.No)\n        }\n    } else {\n        let 할일 = 받은신호\n        if (input.runningTime() - 마지막수신 > 2000) {\n            // 신호가 끊김 → 안전하게 멈춤\n            할일 = 0\n        }\n        if (할일 != 현재신호) {\n            현재신호 = 할일\n            신호에반응하기(현재신호)\n        }\n    }\n    basic.pause(50)\n})\n"
 },
 {
  "id": "04_ai-team-template",
  "group": "radio",
  "order": 5,
  "title": "⑤ 우리 모둠 AI 로보독 (빈 틀)",
  "level": "도전",
  "sim": [
   "[▶ 실행]을 누르세요",
   "[📡 리모컨] 줄의 [계속 보내기]를 켜세요 (2초 동안 신호가 없으면 멈추는 안전장치가 있어요)",
   "[📡 리모컨] 줄에서 1~3을 눌러 보며 번호마다 무엇을 하는지 보세요",
   "코드의 '번호에맞게행동하기' 안에서 번호마다 할 행동을 우리 모둠 생각대로 바꿔 보세요"
  ],
  "real": [
   "AI 브리지에서 우리 모둠 카드를 학습",
   "번호마다 행동을 정해 코드 고치기",
   "로보독 마이크로비트에 내려받아 시험"
  ],
  "code": "// =============================================================\n// [로보독 마이크로비트] 4. 우리 모둠 AI 로보독 (프로젝트 틀)\n// 모둠이 정한 문제에 맞게 '번호에맞게행동하기' 함수 안의 1~3번 행동을 채우세요.\n//\n// 예시 주제 (원 교안을 마이크로비트용으로 바꾼 것)\n//  - 급식 알레르기 탐지견: 1=땅콩 그림, 2=우유 그림, 3=안전한 음식 → 경고/확인/안심\n//  - 내 물건 알아보는 반려견: 1=내 필통, 2=친구 필통 → 반가움/경계\n//    (사람 얼굴 대신 물건·배지를 학습시켜 개인정보 문제를 피합니다)\n//  - 교실 도우미견: 1=조용히 손 모양, 2=정리 시간 카드 → 알림 동작\n//\n// 안전장치(지우지 마세요): 2초 동안 신호가 없으면 멈춤, 로보독 본체 버튼 = 멈춤 잠금 ↔ 풀기(잠그면 눈에 X)\n// ※ 꽂은 마이크로비트의 A·B 버튼은 가려지므로 본체 버튼(전원 스위치 옆)을 씁니다.\n// ※ 로보독 마이크로비트에서는 '음악' 블록을 쓰지 마세요(로봇 통신 핀과 겹칠 수 있음).\n// =============================================================\n\nlet 모둠번호 = 1\nlet 받은신호 = 0\nlet 현재신호 = -1\nlet 마지막수신 = 0\nlet 멈춤잠금 = false\nradio.setGroup(모둠번호)\nrobodog.gesture(deflib.Posture.Ready)\n// 켤 때 모둠번호를 로보독 눈에 잠깐 보여 줌(등에 꽂은 마이크로비트 화면은 가려질 수 있어요)\nrobodog.headLedPrint(deflib.HeadLedSide.Both, \"\" + 모둠번호)\nbasic.pause(1400)\nrobodog.headLedClear()\n\nfunction 번호에맞게행동하기 (번호: number) {\n    if (번호 == 1) {\n        // TODO: 1번을 보았을 때 행동\n        robodog.stop()\n        robodog.bodyLed(255, 0, 0)\n        robodog.soundPlay(deflib.SoundEffect.Growl, deflib.SoundVolume.Medium)\n    } else if (번호 == 2) {\n        // TODO: 2번을 보았을 때 행동\n        robodog.stop()\n        robodog.bodyLed(0, 0, 255)\n        robodog.gesture(deflib.Posture.SayHello)\n    } else if (번호 == 3) {\n        // TODO: 3번을 보았을 때 행동\n        robodog.stop()\n        robodog.bodyLed(0, 255, 0)\n        robodog.headLedExp(deflib.LedExpression.ILoveYou)\n    } else {\n        // 0(멈춤) 또는 4(배경): 기본 자세\n        robodog.stop()\n        robodog.bodyLed(0, 0, 0)\n        robodog.gesture(deflib.Posture.Ready)\n    }\n}\n\nradio.onReceivedNumber(function (받은수) {\n    받은신호 = 받은수\n    마지막수신 = input.runningTime()\n})\n\n// 본체 버튼: 누를 때마다 멈춤 잠금 ↔ 풀기\nlet 버튼이전 = false\nbasic.forever(function () {\n    let 버튼지금 = robodog.getButton()\n    if (버튼지금 && !(버튼이전)) {\n        멈춤잠금 = !(멈춤잠금)\n    }\n    버튼이전 = 버튼지금\n    basic.pause(50)\n})\n\nbasic.forever(function () {\n    if (멈춤잠금) {\n        // 잠금: 라디오를 무시하고 멈춤, 눈에 X\n        if (현재신호 != -2) {\n            현재신호 = -2\n            robodog.stop()\n            robodog.bodyLed(255, 0, 0)\n            robodog.headLedPrint(deflib.HeadLedSide.Both, \"X\")\n            basic.showIcon(IconNames.No)\n        }\n    } else {\n        let 할일 = 받은신호\n        if (input.runningTime() - 마지막수신 > 2000) {\n            // 신호가 끊김 → 안전하게 멈춤\n            할일 = 0\n        }\n        if (할일 != 현재신호) {\n            현재신호 = 할일\n            번호에맞게행동하기(현재신호)\n        }\n    }\n    basic.pause(50)\n})\n"
 },
 {
  "id": "23_remote-safe-dog",
  "group": "radio",
  "order": 6,
  "title": "⑥ 리모컨 + 장애물 앞 자동 멈춤 (도전)",
  "level": "도전",
  "sim": [
   "[▶ 실행]을 누르세요",
   "[📡 리모컨] 줄에서 [1]을 누르세요 → 앞으로 걸어요",
   "앞에 벽(오른쪽 [환경] → 바닥(벽 있음))이나 장애물이 가까워지면 스스로 멈추고 몸통이 주황색이 돼요",
   "[3] → 오른쪽으로 돌기, 그다음 [1] → 앞이 비었으니 다시 걸어요",
   "[2] 또는 [본체 버튼 누르기] → 언제든 멈춤"
  ],
  "real": [
   "리모컨 마이크로비트에 ① 코드, 로보독 마이크로비트에 이 코드",
   "멈춘 채로 손을 앞에 대 보며 가까움 기준값(20)을 모둠이 정하기",
   "바닥에서 리모컨 A로 걷게 하고, 상자 앞에서 스스로 멈추는지 보기"
  ],
  "code": "// =============================================================\n// [라디오 리모컨 ⑥] 리모컨 + 장애물 자동 멈춤 — 로보독에 꽂는 마이크로비트용\n// 확장: kocoafab/robodog\n//\n// ② 리모컨으로 움직이기에 \"거리센서 안전장치\"를 더한 도전 예제예요.\n//   1 (A 버튼)   = 앞으로 걷기 (몸통 초록)\n//   2 (B 버튼)   = 멈추기     (몸통 빨강)\n//   3 (A+B 함께) = 오른쪽으로 90도 돌기 (몸통 파랑)\n//   걷는 중에 앞이 가까우면 스스로 멈춰요(몸통 주황, 눈 찡그림).\n//   앞이 다시 비면 리모컨이 \"걷기\"인 동안 다시 걸어요.\n// 안전: 로보독 본체 버튼을 누르면 언제든 멈춰요.\n// 모둠 번호는 리모컨(20_remote-sender)과 같아야 해요.\n// ※ 거리센서 기준값(가까움기준)은 실물에서 손을 대 보며 모둠이 정하세요.\n// =============================================================\n\nlet 모둠번호 = 1\nlet 가까움기준 = 20\n// 리모컨이 원하는 동작: 0 = 멈춤, 1 = 걷기\nlet 원하는동작 = 0\n// 지금 로보독 상태: 0 = 멈춤, 1 = 걷는 중, 2 = 장애물 때문에 멈춤\nlet 지금상태 = 0\nlet 돌기요청 = false\nlet 이전버튼 = false\nradio.setGroup(모둠번호)\nrobodog.gesture(deflib.Posture.Ready)\nrobodog.headLedExp(deflib.LedExpression.SparklingEyes)\n\n// 리모컨 숫자는 \"원하는 동작\"만 바꾸고, 로봇 명령은 아래 무한 반복 한 곳에서만 내려요\nradio.onReceivedNumber(function (receivedNumber) {\n    if (receivedNumber == 1) {\n        원하는동작 = 1\n    } else if (receivedNumber == 2) {\n        원하는동작 = 0\n    } else if (receivedNumber == 3) {\n        원하는동작 = 0\n        돌기요청 = true\n    }\n})\n\nbasic.forever(function () {\n    // 안전장치: 본체 버튼 = 멈춤\n    let 지금버튼 = robodog.getButton()\n    if (지금버튼 && !(이전버튼)) {\n        원하는동작 = 0\n    }\n    이전버튼 = 지금버튼\n\n    let 거리 = robodog.getTof()\n    let 앞이가까움 = 거리 > 0 && 거리 < 가까움기준\n\n    if (돌기요청) {\n        돌기요청 = false\n        robodog.stop()\n        robodog.bodyLed(0, 0, 255)\n        robodog.rotation(deflib.RotateDirection.Clockwise, 90, 50)\n        지금상태 = 0\n    } else if (원하는동작 == 1 && 앞이가까움) {\n        if (지금상태 != 2) {\n            지금상태 = 2\n            robodog.stop()\n            robodog.bodyLed(255, 120, 0)\n            robodog.headLedExp(deflib.LedExpression.SharpEyes)\n        }\n    } else if (원하는동작 == 1) {\n        if (지금상태 != 1) {\n            지금상태 = 1\n            robodog.bodyLed(0, 255, 0)\n            robodog.headLedExp(deflib.LedExpression.SparklingEyes)\n            robodog.move(deflib.MoveDirection.Forward, 25)\n        }\n    } else {\n        if (지금상태 != 0) {\n            지금상태 = 0\n            robodog.stop()\n            robodog.bodyLed(255, 0, 0)\n            robodog.headLedExp(deflib.LedExpression.SparklingEyes)\n        }\n    }\n    basic.pause(50)\n})\n"
 },
 {
  "id": "00_check-robodog",
  "group": "check",
  "order": 1,
  "title": "연결·배터리 점검 (수업 전)",
  "level": "쉬움",
  "sim": [
   "[▶ 실행]을 누르세요",
   "눈이 하트, 몸통 불빛이 배터리 색(초록 = 충분)",
   "로보독 화면 바로 위 [본체 버튼 누르기]를 누르세요 → 앉기 ↔ 서기"
  ],
  "real": [
   "로보독 마이크로비트에 내려받고 전원 켜기",
   "눈 하트 = 통신 OK, 몸통 초록 = 배터리 OK",
   "본체 버튼 → 앉기·서기 되면 준비 끝"
  ],
  "code": "// =============================================================\n// [로보독 마이크로비트] 0. 연결·배터리 점검 (수업 전 1분)\n// 확장: kocoafab/robodog\n// 1) 켜면: 눈 = 하트(통신 OK), 몸통 불빛 = 배터리 (초록 60% 이상 / 노랑 30~60% / 빨강 30% 미만 → 충전)\n//    다리는 움직이지 않아요(일부러).\n// 2) 본체 버튼(전원 스위치 옆)을 누를 때마다 앉기 ↔ 서기 → 버튼·모터 OK\n// 안 될 때: 눈이 하트가 아니면 통신(마이크로비트를 끝까지 꽂았는지),\n//           앉기·서기가 어긋나거나 떨리면 배터리 충전 → 그래도 어긋나면 다리 영점(코코아팹 문의)\n// ※ 배터리 % 값의 정확도는 실물에서 확인이 필요해요.\n// =============================================================\n\nlet 앉음 = false\nlet 이전 = false\nrobodog.headLedExp(deflib.LedExpression.ILoveYou)\n\nfunction 배터리불빛 () {\n    let 배터리 = robodog.getBattery()\n    if (배터리 >= 60) {\n        robodog.bodyLed(0, 255, 0)\n    } else if (배터리 >= 30) {\n        robodog.bodyLed(255, 160, 0)\n    } else {\n        robodog.bodyLed(255, 0, 0)\n    }\n}\n\nbasic.pause(500)\n배터리불빛()\n\nbasic.forever(function () {\n    let 지금 = robodog.getButton()\n    if (지금 && !(이전)) {\n        앉음 = !(앉음)\n        if (앉음) {\n            robodog.gesture(deflib.Posture.SitDown)\n        } else {\n            robodog.gesture(deflib.Posture.Ready)\n        }\n        배터리불빛()\n    }\n    이전 = 지금\n    basic.pause(50)\n})\n"
 },
 {
  "id": "05_motion-tour",
  "group": "check",
  "order": 2,
  "title": "동작 둘러보기 (자세·걷기·다리)",
  "level": "쉬움",
  "sim": [
   "[▶ 실행]을 누르세요",
   "로보독이 자세 4가지, 사각형 걷기, 다리 움직임을 차례로 보여 줘요"
  ],
  "real": [
   "로보독 마이크로비트에 내려받기",
   "넓은 바닥에 놓고 전원 켜기"
  ],
  "code": "// =============================================================\n// [로보독 마이크로비트] 5. 동작 둘러보기\n// 본체 버튼을 누를 때마다 다른 동작 묶음을 보여 줍니다. (시뮬레이터 확인용, 실물에서도 동작)\n// 1번째 = 자세 둘러보기(앉기·물구나무·기지개·인사)\n// 2번째 = 사각형 걷기(앞으로 1초 → 시계방향 90° 회전, 4번)\n// 3번째 = 다리 높이·다리 하나 바꾸기\n// ※ 꽂은 마이크로비트의 A·B 버튼은 가려지므로 본체 버튼(전원 스위치 옆)을 씁니다.\n// =============================================================\n\nlet 차례 = 0\nlet 버튼이전 = false\nrobodog.gesture(deflib.Posture.Ready)\nrobodog.headLedExp(deflib.LedExpression.SparklingEyes)\n\nfunction 자세둘러보기 () {\n    robodog.gesture(deflib.Posture.SitDown)\n    robodog.soundPlay(deflib.SoundEffect.Bark, deflib.SoundVolume.Medium)\n    basic.pause(2000)\n    robodog.gesture(deflib.Posture.Handstand)\n    robodog.headLedExp(deflib.LedExpression.RollingEyes)\n    basic.pause(2000)\n    robodog.gesture(deflib.Posture.Stretch)\n    robodog.headLedExp(deflib.LedExpression.EyesClosed)\n    basic.pause(2000)\n    robodog.gesture(deflib.Posture.SayHello)\n    robodog.headLedExp(deflib.LedExpression.ILoveYou)\n    robodog.soundPlay(deflib.SoundEffect.Hello, deflib.SoundVolume.Medium)\n    basic.pause(3000)\n    robodog.gesture(deflib.Posture.Ready)\n    robodog.headLedExp(deflib.LedExpression.SparklingEyes)\n}\n\nfunction 사각형걷기 () {\n    for (let index = 0; index < 4; index++) {\n        robodog.bodyLed(0, 255, 0)\n        robodog.move(deflib.MoveDirection.Forward, 30)\n        basic.pause(1000)\n        robodog.stop()\n        robodog.bodyLed(0, 0, 255)\n        robodog.rotation(deflib.RotateDirection.Clockwise, 90, 60)\n        basic.pause(1500)\n    }\n    robodog.bodyLed(0, 0, 0)\n    robodog.gesture(deflib.Posture.Ready)\n}\n\nfunction 다리바꾸기 () {\n    // ※ '다리 하나'·'모터' 블록은 처음 쓸 때 고르지 않은 다리에 값을 보내지 않아요(실물에서 따로 노는 원인).\n    //   그래서 모드마다 먼저 '모든 다리'를 같은 값으로 맞춘 뒤, 다리 하나만 바꿉니다.\n    // 1) 걷기 높이: 모두 70 → 앞다리만 낮게(인사하듯) → 모두 높게\n    robodog.legBend(deflib.LegGroup.AllLegs, 70)\n    basic.pause(800)\n    robodog.legBend(deflib.LegGroup.FrontLegs, 20)\n    basic.pause(1500)\n    robodog.legBend(deflib.LegGroup.AllLegs, 100)\n    basic.pause(1500)\n    // 2) 다리 하나: 네 다리를 먼저 같은 자세로 → 오른 앞다리만 앞으로 쭉\n    robodog.leg(deflib.LegSelection.AllLegs, 70, 0)\n    basic.pause(800)\n    robodog.leg(deflib.LegSelection.RightFront, 100, 80)\n    basic.pause(1500)\n    robodog.leg(deflib.LegSelection.AllLegs, 70, 0)\n    basic.pause(800)\n    robodog.headLedPrint(deflib.HeadLedSide.Both, \"A\")\n    basic.pause(1000)\n    robodog.gesture(deflib.Posture.Ready)\n    robodog.headLedExp(deflib.LedExpression.SparklingEyes)\n    // 모터 각도 블록(robodog.motor)은 어깨·무릎 각도를 직접 정해서, 각도 0이 실물에서 어떤 자세인지 확인한 뒤 쓰세요.\n}\n\n// 본체 버튼: 누르는 순간 한 번만 반응\nbasic.forever(function () {\n    let 버튼지금 = robodog.getButton()\n    if (버튼지금 && !(버튼이전)) {\n        차례 = 차례 % 3 + 1\n        if (차례 == 1) {\n            자세둘러보기()\n        } else if (차례 == 2) {\n            사각형걷기()\n        } else {\n            다리바꾸기()\n        }\n    }\n    버튼이전 = 버튼지금\n    basic.pause(50)\n})\n"
 }
];
