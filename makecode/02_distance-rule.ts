// =============================================================
// [로보독 마이크로비트] 2. 규칙으로 반응하기 (센서 + 조건문)
// 활동: 거리센서 값이 가까우면 멈추고 경고, 멀면 천천히 걷기.
// 수업 포인트: "사람이 정한 규칙(만약 ~라면)"으로 움직이는 로봇.
//              다음 차시의 "데이터로 배우는 AI"와 비교합니다.
// ※ 거리센서 값의 단위는 실물로 확인하세요. 먼저 마이크로비트 LED로
//   값을 보고 기준값(가까움)을 정하는 활동부터 하세요.
// =============================================================

let 가까움기준 = 20
robodog.gesture(deflib.Posture.Ready)

// A 버튼: 지금 거리센서 값 보기 (기준값 정하기 활동)
input.onButtonPressed(Button.A, function () {
    basic.showNumber(robodog.getTof())
})

basic.forever(function () {
    let 거리 = robodog.getTof()
    if (거리 > 0 && 거리 < 가까움기준) {
        robodog.stop()
        robodog.bodyLed(255, 0, 0)
        robodog.headLedExp(deflib.LedExpression.SharpEyes)
        robodog.soundPlay(deflib.SoundEffect.MoveAside, deflib.SoundVolume.Medium)
        basic.pause(1500)
    } else {
        robodog.bodyLed(0, 255, 0)
        robodog.headLedExp(deflib.LedExpression.SparklingEyes)
        robodog.move(deflib.MoveDirection.Forward, 25)
    }
    basic.pause(100)
})
