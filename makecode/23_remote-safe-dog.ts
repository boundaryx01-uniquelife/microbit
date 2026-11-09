// =============================================================
// [라디오 리모컨 ⑥] 리모컨 + 장애물 자동 멈춤 — 로보독에 꽂는 마이크로비트용
// 확장: kocoafab/robodog
//
// ② 리모컨으로 움직이기에 "거리센서 안전장치"를 더한 도전 예제예요.
//   1 (A 버튼)   = 앞으로 걷기 (몸통 초록)
//   2 (B 버튼)   = 멈추기     (몸통 빨강)
//   3 (A+B 함께) = 오른쪽으로 90도 돌기 (몸통 파랑)
//   걷는 중에 앞이 가까우면 스스로 멈춰요(몸통 주황, 눈 찡그림).
//   앞이 다시 비면 리모컨이 "걷기"인 동안 다시 걸어요.
// 안전: 로보독 본체 버튼을 누르면 언제든 멈춰요.
// 모둠 번호는 리모컨(20_remote-sender)과 같아야 해요.
// ※ 거리센서 기준값(가까움기준)은 실물에서 손을 대 보며 모둠이 정하세요.
// =============================================================

let 모둠번호 = 1
let 가까움기준 = 20
// 리모컨이 원하는 동작: 0 = 멈춤, 1 = 걷기
let 원하는동작 = 0
// 지금 로보독 상태: 0 = 멈춤, 1 = 걷는 중, 2 = 장애물 때문에 멈춤
let 지금상태 = 0
let 돌기요청 = false
let 이전버튼 = false
radio.setGroup(모둠번호)
robodog.gesture(deflib.Posture.Ready)
robodog.headLedExp(deflib.LedExpression.SparklingEyes)

// 리모컨 숫자는 "원하는 동작"만 바꾸고, 로봇 명령은 아래 무한 반복 한 곳에서만 내려요
radio.onReceivedNumber(function (receivedNumber) {
    if (receivedNumber == 1) {
        원하는동작 = 1
    } else if (receivedNumber == 2) {
        원하는동작 = 0
    } else if (receivedNumber == 3) {
        원하는동작 = 0
        돌기요청 = true
    }
})

basic.forever(function () {
    // 안전장치: 본체 버튼 = 멈춤
    let 지금버튼 = robodog.getButton()
    if (지금버튼 && !(이전버튼)) {
        원하는동작 = 0
    }
    이전버튼 = 지금버튼

    let 거리 = robodog.getTof()
    let 앞이가까움 = 거리 > 0 && 거리 < 가까움기준

    if (돌기요청) {
        돌기요청 = false
        robodog.stop()
        robodog.bodyLed(0, 0, 255)
        robodog.rotation(deflib.RotateDirection.Clockwise, 90, 50)
        지금상태 = 0
    } else if (원하는동작 == 1 && 앞이가까움) {
        if (지금상태 != 2) {
            지금상태 = 2
            robodog.stop()
            robodog.bodyLed(255, 120, 0)
            robodog.headLedExp(deflib.LedExpression.SharpEyes)
        }
    } else if (원하는동작 == 1) {
        if (지금상태 != 1) {
            지금상태 = 1
            robodog.bodyLed(0, 255, 0)
            robodog.headLedExp(deflib.LedExpression.SparklingEyes)
            robodog.move(deflib.MoveDirection.Forward, 25)
        }
    } else {
        if (지금상태 != 0) {
            지금상태 = 0
            robodog.stop()
            robodog.bodyLed(255, 0, 0)
            robodog.headLedExp(deflib.LedExpression.SparklingEyes)
        }
    }
    basic.pause(50)
})
