// =============================================================
// [라디오 리모컨 ②] 리모컨으로 움직이는 로보독 — 로보독에 꽂는 마이크로비트용
// 확장: kocoafab/robodog
//
// 리모컨(20_remote-sender)에서 오는 숫자에 따라
//   1 (A 버튼)   = 앞으로 걷기 (몸통 초록)
//   2 (B 버튼)   = 멈추기     (몸통 빨강)
//   3 (A+B 함께) = 오른쪽으로 90도 돌기 (몸통 파랑)
// 안전: 로보독 본체 버튼을 누르면 언제든 멈춰요.
// 그룹 번호는 리모컨과 같아야 해요.
// =============================================================

let 그룹 = 1
let 이전버튼 = false
radio.setGroup(그룹)
robodog.gesture(deflib.Posture.Ready)
robodog.headLedExp(deflib.LedExpression.SparklingEyes)

radio.onReceivedNumber(function (receivedNumber) {
    if (receivedNumber == 1) {
        robodog.bodyLed(0, 255, 0)
        robodog.move(deflib.MoveDirection.Forward, 25)
    } else if (receivedNumber == 2) {
        robodog.stop()
        robodog.bodyLed(255, 0, 0)
    } else if (receivedNumber == 3) {
        robodog.stop()
        robodog.bodyLed(0, 0, 255)
        robodog.rotation(deflib.RotateDirection.Clockwise, 90, 50)
    }
})

// 안전장치: 본체 버튼 = 멈춤
basic.forever(function () {
    let 지금버튼 = robodog.getButton()
    if (지금버튼 && !(이전버튼)) {
        robodog.stop()
        robodog.bodyLed(255, 0, 0)
    }
    이전버튼 = 지금버튼
    basic.pause(50)
})
