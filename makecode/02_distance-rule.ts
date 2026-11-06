// =============================================================
// [로보독 마이크로비트] 2. 규칙으로 반응하기 (센서 + 조건문)
// 활동: 거리센서 값이 가까우면 멈추고 경고, 멀면 천천히 걷기.
// 수업 포인트: "사람이 정한 규칙(만약 ~라면)"으로 움직이는 로봇.
//              다음 차시의 "데이터로 배우는 AI"와 비교합니다.
// 버튼: A = 지금 거리센서 값 보기(로봇은 움직이지 않음)
//       B = 걷기 시작 / 멈춤 (켜자마자 걷지 않아요)
// ※ 거리센서 값의 단위는 실물로 확인하세요. 먼저 A 버튼으로 값을 보고
//   모둠이 "가까움" 기준값을 정해 아래 숫자를 바꾸세요.
// ※ 로보독 마이크로비트에서는 '음악' 블록을 쓰지 마세요(로봇 통신 핀과 겹칠 수 있음).
// =============================================================

let 가까움기준 = 20
let 걷는중 = false
let 지금상태 = 0
robodog.gesture(deflib.Posture.Ready)
basic.showIcon(IconNames.Asleep)

input.onButtonPressed(Button.A, function () {
    basic.showNumber(robodog.getTof())
})

input.onButtonPressed(Button.B, function () {
    걷는중 = !(걷는중)
    if (!(걷는중)) {
        지금상태 = 0
        robodog.stop()
        robodog.gesture(deflib.Posture.Ready)
        basic.showIcon(IconNames.Asleep)
    }
})

basic.forever(function () {
    if (걷는중) {
        let 거리 = robodog.getTof()
        if (거리 == 0) {
            // 센서 값을 아직 못 받았거나 오류 → 안전하게 멈춤
            if (지금상태 != 3) {
                지금상태 = 3
                robodog.stop()
                basic.showIcon(IconNames.Confused)
            }
        } else if (거리 < 가까움기준) {
            if (지금상태 != 1) {
                지금상태 = 1
                robodog.stop()
                robodog.bodyLed(255, 0, 0)
                robodog.headLedExp(deflib.LedExpression.SharpEyes)
                robodog.soundPlay(deflib.SoundEffect.MoveAside, deflib.SoundVolume.Medium)
                basic.showIcon(IconNames.No)
            }
        } else {
            if (지금상태 != 2) {
                지금상태 = 2
                robodog.bodyLed(0, 255, 0)
                robodog.headLedExp(deflib.LedExpression.SparklingEyes)
                robodog.move(deflib.MoveDirection.Forward, 25)
                basic.showIcon(IconNames.Yes)
            }
        }
    }
    basic.pause(100)
})
