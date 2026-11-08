// =============================================================
// [본체 버튼 ④] 버튼을 누르면 탐험 출발! (벽을 만나면 방향 바꾸기)
// 확장: kocoafab/robodog
//
// 무엇을 하나요?
//   1) 본체 버튼을 누르면 두리번거리며 표정을 3번 바꾸고 "멍멍"
//   2) 앞으로 걷다가 벽(물체)이 20cm보다 가까우면 아무 방향으로 돌아서 다시 걷기
//   3) 15초가 지나거나, 걷는 중에 본체 버튼을 한 번 더 누르면 멈춤
//
// ※ 거리센서는 앞의 물체만 봐요. 책상 끝(낭떠러지)은 못 보니 바닥이나 울타리 안에서 하세요.
// =============================================================

let 이전버튼 = false
let 탐험중 = false
let 시작시간 = 0
let 벽거리 = 20
robodog.gesture(deflib.Posture.Ready)

function 두리번 () {
    robodog.headLedExp(deflib.LedExpression.RollingEyes)
    robodog.rotation(deflib.RotateDirection.Counterclockwise, 30, 80)
    basic.pause(800)
    robodog.headLedExp(deflib.LedExpression.SharpEyes)
    robodog.rotation(deflib.RotateDirection.Clockwise, 60, 80)
    basic.pause(1200)
    robodog.headLedExp(deflib.LedExpression.BigEyes)
    robodog.rotation(deflib.RotateDirection.Counterclockwise, 30, 80)
    basic.pause(800)
    robodog.soundPlay(deflib.SoundEffect.Bark, deflib.SoundVolume.Medium)
    basic.pause(800)
}

function 멈추기 () {
    robodog.stop()
    탐험중 = false
    robodog.bodyLed(0, 0, 255)
    robodog.headLedExp(deflib.LedExpression.Blink)
}

basic.forever(function () {
    let 지금버튼 = robodog.getButton()
    if (지금버튼 && !(이전버튼)) {
        if (탐험중) {
            멈추기()
        } else {
            탐험중 = true
            두리번()
            robodog.bodyLed(0, 255, 0)
            시작시간 = input.runningTime()
            robodog.move(deflib.MoveDirection.Forward, 30)
        }
    }
    이전버튼 = 지금버튼
    if (탐험중) {
        if (input.runningTime() - 시작시간 > 15000) {
            멈추기()
        } else if (robodog.getTof() < 벽거리) {
            // 벽이다! 멈추고 30~180도 사이 아무 방향으로 돌기
            robodog.stop()
            if (randint(0, 1) == 0) {
                robodog.rotation(deflib.RotateDirection.Clockwise, randint(30, 180), 60)
            } else {
                robodog.rotation(deflib.RotateDirection.Counterclockwise, randint(30, 180), 60)
            }
            basic.pause(2000)
            robodog.move(deflib.MoveDirection.Forward, 30)
        }
    }
    basic.pause(50)
})
