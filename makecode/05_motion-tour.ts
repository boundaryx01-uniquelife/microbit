// =============================================================
// [로보독 마이크로비트] 5. 동작 둘러보기
// 본체 버튼을 누를 때마다 다른 동작 묶음을 보여 줍니다. (시뮬레이터 확인용, 실물에서도 동작)
// 1번째 = 자세 둘러보기(앉기·물구나무·기지개·인사)
// 2번째 = 사각형 걷기(앞으로 1초 → 시계방향 90° 회전, 4번)
// 3번째 = 다리 높이·모터 각도 바꾸기
// ※ 꽂은 마이크로비트의 A·B 버튼은 가려지므로 본체 버튼(전원 스위치 옆)을 씁니다.
// =============================================================

let 차례 = 0
let 버튼이전 = false
robodog.gesture(deflib.Posture.Ready)
robodog.headLedExp(deflib.LedExpression.SparklingEyes)

function 자세둘러보기 () {
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
}

function 사각형걷기 () {
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
}

function 다리바꾸기 () {
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
}

// 본체 버튼: 누르는 순간 한 번만 반응
basic.forever(function () {
    let 버튼지금 = robodog.getButton()
    if (버튼지금 && !(버튼이전)) {
        차례 = 차례 % 3 + 1
        if (차례 == 1) {
            자세둘러보기()
        } else if (차례 == 2) {
            사각형걷기()
        } else {
            다리바꾸기()
        }
    }
    버튼이전 = 버튼지금
    basic.pause(50)
})
