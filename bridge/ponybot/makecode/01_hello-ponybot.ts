// =============================================================
// [포니봇 마이크로비트] 1. 안녕, 포니봇! (순차 구조)
// 확장: https://github.com/boundary-x/ai_ponybot_basic
// 활동: A 버튼을 누를 때마다 다음 장면을 보여 줍니다.
//       1번째 = 인사(제자리 살짝 돌기), 2번째 = 앞으로 조금, 3번째 = 옆으로 조금(메카넘 바퀴!), 4번째 = 멈춤 → 다시 1번째
// B 버튼 = 언제든 멈춤
// ※ 바닥이나 울타리 안에서 시험하세요(책상 끝을 볼 수 있는 센서가 없어요).
// ※ 속도 값은 선생님이 실물로 정한 값으로 바꾸세요.
// =============================================================

let 속도 = 80
let 차례 = 0
aiPonybot.stopAllMotors()
aiPonybot.clear()
aiPonybot.showString("HELLO!", 0, 0, 1)
basic.showIcon(IconNames.Happy)

input.onButtonPressed(Button.A, function () {
    차례 = 차례 % 4 + 1
    aiPonybot.clear()
    if (차례 == 1) {
        // 인사: 오른쪽으로 살짝, 왼쪽으로 살짝
        aiPonybot.showString("HI!", 0, 0, 1)
        basic.showIcon(IconNames.Happy)
        aiPonybot.runNormal(aiPonybot.DirectionControl.Clockwise, 속도)
        basic.pause(300)
        aiPonybot.runNormal(aiPonybot.DirectionControl.CounterClockwise, 속도)
        basic.pause(300)
        aiPonybot.stopAllMotors()
    } else if (차례 == 2) {
        // 앞으로 1초 가고 멈추기
        aiPonybot.showString("FORWARD", 0, 0, 1)
        basic.showArrow(ArrowNames.North)
        aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 속도)
        basic.pause(1000)
        aiPonybot.stopAllMotors()
    } else if (차례 == 3) {
        // 옆으로 1초: 바퀴형 로봇인데 옆으로 갈 수 있어요
        aiPonybot.showString("RIGHT", 0, 0, 1)
        basic.showArrow(ArrowNames.East)
        aiPonybot.runMecanum(aiPonybot.Mecanum.Right, 속도)
        basic.pause(1000)
        aiPonybot.stopAllMotors()
    } else {
        aiPonybot.showString("STOP", 0, 0, 1)
        basic.showIcon(IconNames.Asleep)
        aiPonybot.stopAllMotors()
    }
})

input.onButtonPressed(Button.B, function () {
    aiPonybot.stopAllMotors()
    basic.showIcon(IconNames.No)
})
