// =============================================================
// [로보독 마이크로비트] 5. 동작 둘러보기
// 본체 버튼을 누를 때마다 다른 동작 묶음을 보여 줍니다. (시뮬레이터 확인용, 실물에서도 동작)
// 1번째 = 자세 둘러보기(앉기·물구나무·기지개·인사)
// 2번째 = 사각형 걷기(앞으로 1초 → 시계방향 90° 회전, 4번)
// 3번째 = 다리 높이·다리 하나 바꾸기
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
    // ※ '다리 하나'·'모터' 블록은 처음 쓸 때 고르지 않은 다리에 값을 보내지 않아요(실물에서 따로 노는 원인).
    //   그래서 모드마다 먼저 '모든 다리'를 같은 값으로 맞춘 뒤, 다리 하나만 바꿉니다.
    // 1) 걷기 높이: 모두 70 → 앞다리만 낮게(인사하듯) → 모두 높게
    robodog.legBend(deflib.LegGroup.AllLegs, 70)
    basic.pause(800)
    robodog.legBend(deflib.LegGroup.FrontLegs, 20)
    basic.pause(1500)
    robodog.legBend(deflib.LegGroup.AllLegs, 100)
    basic.pause(1500)
    // 2) 다리 하나: 네 다리를 먼저 같은 자세로 → 오른 앞다리만 앞으로 쭉
    robodog.leg(deflib.LegSelection.AllLegs, 70, 0)
    basic.pause(800)
    robodog.leg(deflib.LegSelection.RightFront, 100, 80)
    basic.pause(1500)
    robodog.leg(deflib.LegSelection.AllLegs, 70, 0)
    basic.pause(800)
    robodog.headLedPrint(deflib.HeadLedSide.Both, "A")
    basic.pause(1000)
    robodog.gesture(deflib.Posture.Ready)
    robodog.headLedExp(deflib.LedExpression.SparklingEyes)
    // 모터 각도 블록(robodog.motor)은 어깨·무릎 각도를 직접 정해서, 각도 0이 실물에서 어떤 자세인지 확인한 뒤 쓰세요.
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
