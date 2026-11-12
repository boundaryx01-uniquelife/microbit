// =============================================================
// [포니봇 마이크로비트] 2. 규칙으로 반응하기 (센서 + 조건문)
// 확장: https://github.com/boundary-x/ai_ponybot_basic
// 활동: 앞의 거리가 가까우면 멈추고, 멀면 천천히 앞으로.
// 수업 포인트: "사람이 정한 규칙(만약 ~라면)"으로 움직이는 로봇.
//              다음 차시의 "데이터로 배우는 AI"와 비교합니다.
// A 버튼 = 출발 / 멈춤 (켜자마자 움직이지 않아요), B 버튼 = 멈춤
// 멈춰 있는 동안에도 포니봇 화면에 거리(cm)가 보여요 → 손을 대 보며 "가까움" 기준을 모둠이 정하세요.
// ⚠ 포니봇 거리센서는 반사가 안 오면 0이 아니라 500(최댓값)을 돌려줍니다.
//    "아주 멀다"로 착각해 계속 달리지 않도록, 0이거나 500 이상이면 '못 읽음'으로 보고 멈춥니다.
// ※ 거리센서는 앞의 물체만 보고 책상 끝(낭떠러지)은 못 봅니다 → 바닥이나 울타리 안에서 시험하세요.
// =============================================================

let 가까움기준 = 20
let 속도 = 80
let 달리는중 = false
let 지금상태 = -1
aiPonybot.stopAllMotors()
aiPonybot.clear()

input.onButtonPressed(Button.A, function () {
    달리는중 = !(달리는중)
})
input.onButtonPressed(Button.B, function () {
    달리는중 = false
})

// 버튼은 '달리는중' 값만 바꾸고, 모터 명령은 아래 무한 반복 한 곳에서만 내립니다
basic.forever(function () {
    let 거리 = aiPonybot.ping(aiPonybot.PingUnit.Centimeters)
    aiPonybot.showString("CM:     ", 0, 2, 1)
    aiPonybot.showNumber(거리, 24, 2, 1)
    let 새상태 = 0
    if (!(달리는중)) {
        새상태 = 0
    } else if (거리 == 0 || 거리 >= 500) {
        새상태 = 3
    } else if (거리 < 가까움기준) {
        새상태 = 1
    } else {
        새상태 = 2
    }
    if (새상태 != 지금상태) {
        지금상태 = 새상태
        if (지금상태 == 0) {
            // 멈춤(대기)
            aiPonybot.stopAllMotors()
            aiPonybot.showString("WAIT    ", 0, 0, 1)
            basic.showIcon(IconNames.Asleep)
        } else if (지금상태 == 1) {
            // 가까움 → 멈춤
            aiPonybot.stopAllMotors()
            aiPonybot.showString("TOO NEAR", 0, 0, 1)
            basic.showIcon(IconNames.No)
        } else if (지금상태 == 2) {
            // 멂 → 천천히 앞으로
            aiPonybot.showString("GO      ", 0, 0, 1)
            basic.showIcon(IconNames.Yes)
            aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 속도)
        } else {
            // 못 읽음 → 안전하게 멈춤
            aiPonybot.stopAllMotors()
            aiPonybot.showString("NO SIGNL", 0, 0, 1)
            basic.showIcon(IconNames.Confused)
        }
    }
    basic.pause(100)
})
