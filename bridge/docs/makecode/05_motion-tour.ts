// =============================================================
// [로보독 마이크로비트] 5. 동작 둘러보기
// 버튼마다 다른 동작 묶음을 보여 줍니다. (시뮬레이터 확인용, 실물에서도 동작)
// A = 자세 둘러보기(앉기·물구나무·기지개·인사)
// B = 사각형 걷기(앞으로 1초 → 시계방향 90° 회전, 4번)
// A+B = 다리 높이·모터 각도 바꾸기
// =============================================================

robodog.gesture(deflib.Posture.Ready)
robodog.headLedExp(deflib.LedExpression.SparklingEyes)
basic.showIcon(IconNames.Happy)

input.onButtonPressed(Button.A, function () {
    robodog.gesture(deflib.Posture.SitDown)
    robodog.soundPlay(deflib.SoundEffect.Bark, deflib.SoundVolume.Medium)
    basic.pause(2000)
    robodog.gesture(deflib.Posture.Handstand)
    robodog.headLedExp(deflib.LedExpression.RollingEyes)
    basic.pause(2000)
    robodog.gesture(deflib.Posture.Stretch)
    robodog.headLedExp(deflib.LedExpression.EyesClosed)
    basic.pause(2000)
    robodog.gesture(deflib.Posture.SayHello)
    robodog.headLedExp(deflib.LedExpression.ILoveYou)
    robodog.soundPlay(deflib.SoundEffect.Hello, deflib.SoundVolume.Medium)
    basic.pause(3000)
    robodog.gesture(deflib.Posture.Ready)
    robodog.headLedExp(deflib.LedExpression.SparklingEyes)
})

input.onButtonPressed(Button.B, function () {
    for (let index = 0; index < 4; index++) {
        robodog.bodyLed(0, 255, 0)
        robodog.move(deflib.MoveDirection.Forward, 30)
        basic.pause(1000)
        robodog.stop()
        robodog.bodyLed(0, 0, 255)
        robodog.rotation(deflib.RotateDirection.Clockwise, 90, 60)
        basic.pause(1500)
    }
    robodog.bodyLed(0, 0, 0)
    robodog.gesture(deflib.Posture.Ready)
})

input.onButtonPressed(Button.AB, function () {
    robodog.legBend(deflib.LegGroup.FrontLegs, 20)
    basic.pause(1500)
    robodog.legBend(deflib.LegGroup.AllLegs, 100)
    basic.pause(1500)
    robodog.leg(deflib.LegSelection.RightFront, 100, 80)
    basic.pause(1500)
    robodog.motor(deflib.LegSelection.LeftFront, -60, 40)
    basic.pause(1500)
    robodog.headLedPrint(deflib.HeadLedSide.Both, "A")
    basic.pause(1500)
    robodog.gesture(deflib.Posture.Ready)
    robodog.headLedExp(deflib.LedExpression.SparklingEyes)
})
