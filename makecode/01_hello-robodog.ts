// =============================================================
// [로보독 마이크로비트] 1. 안녕, 로보독! (순차 구조)
// 확장: kocoafab/robodog (MakeCode 확장에서 전체 이름 입력)
// 활동: 버튼을 누르면 로보독이 순서대로 인사합니다.
// =============================================================

robodog.gesture(deflib.Posture.Ready)
basic.showIcon(IconNames.Happy)

// A 버튼: 인사 장면
input.onButtonPressed(Button.A, function () {
    robodog.headLedExp(deflib.LedExpression.SparklingEyes)
    robodog.bodyLed(0, 0, 255)
    robodog.soundPlay(deflib.SoundEffect.Hello, deflib.SoundVolume.Medium)
    basic.pause(1000)
    robodog.gesture(deflib.Posture.SayHello)
    basic.pause(3000)
    robodog.gesture(deflib.Posture.Ready)
})

// B 버튼: 앞으로 조금 걷고 멈추기 (책상 위에서는 속도 30 이하!)
input.onButtonPressed(Button.B, function () {
    robodog.move(deflib.MoveDirection.Forward, 30)
    basic.pause(1000)
    robodog.stop()
    robodog.gesture(deflib.Posture.Ready)
})

// A+B: 앉기
input.onButtonPressed(Button.AB, function () {
    robodog.stop()
    robodog.gesture(deflib.Posture.SitDown)
})
