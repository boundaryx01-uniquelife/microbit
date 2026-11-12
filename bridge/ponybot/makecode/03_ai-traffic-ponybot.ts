// =============================================================
// [포니봇 마이크로비트] 3. AI 신호등 포니봇
// 확장: https://github.com/boundary-x/ai_ponybot_basic
//
// 준비: AI 브리지(?kit=ponybot)에서 1=빨강, 2=노랑, 3=초록, 4=배경 카드를 학습
//       USB 마이크로비트(00_bridge-receiver)와 같은 모둠번호 사용
// 받는 숫자: 0=멈춤, 1=빨강, 2=노랑, 3=초록, 4=배경
// 안전장치: ① 2초 동안 신호가 안 오면 어떤 상태든 멈춤
//           ② B 버튼 = 멈춤 잠금 ↔ 풀기 (누를 때마다 바뀜, 잠그면 화면에 X·"LOCK")
//           ③ 초록이어도 앞이 가깝거나(가까움기준) 거리센서가 못 읽으면(0 또는 500 이상) 멈춤
// ※ 포니봇 거리센서는 반사가 안 오면 500을 돌려줘요(0이 아님).
// ※ 계속 달리는 예제입니다. 책상 끝(낭떠러지)은 못 봅니다 → 바닥이나 울타리 안에서 시험하세요.
// ※ 공식 스마트폰 앱(블루투스)과 함께 쓰지 마세요. 이 예제는 라디오로 받습니다.
// =============================================================

let 모둠번호 = 1
let 속도 = 80
let 가까움기준 = 20
let 받은신호 = 0
let 현재행동 = -1
let 마지막수신 = 0
let 멈춤잠금 = false
radio.setGroup(모둠번호)
aiPonybot.stopAllMotors()
aiPonybot.clear()
aiPonybot.showString("GROUP", 0, 0, 1)
aiPonybot.showNumber(모둠번호, 36, 0, 1)
basic.showString("R" + 모둠번호)

// 행동 번호: 0 멈춤·대기, 1 빨강, 2 노랑, 3 초록 출발, 5 앞이 막힘, 6 잠금
function 행동하기 (행동: number) {
    aiPonybot.clear()
    if (행동 == 1) {
        // 빨강: 멈추고 비켜!
        aiPonybot.stopAllMotors()
        aiPonybot.showString("RED STOP", 0, 0, 1)
        basic.showIcon(IconNames.No)
    } else if (행동 == 2) {
        // 노랑: 기다려
        aiPonybot.stopAllMotors()
        aiPonybot.showString("YELLOW WAIT", 0, 0, 1)
        basic.showIcon(IconNames.Asleep)
    } else if (행동 == 3) {
        // 초록: 출발!
        aiPonybot.showString("GREEN GO", 0, 0, 1)
        basic.showIcon(IconNames.Yes)
        aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 속도)
    } else if (행동 == 5) {
        // 초록이지만 앞이 막힘(또는 거리 못 읽음) → 멈춤
        aiPonybot.stopAllMotors()
        aiPonybot.showString("BLOCKED", 0, 0, 1)
        basic.showIcon(IconNames.Confused)
    } else if (행동 == 6) {
        aiPonybot.stopAllMotors()
        aiPonybot.showString("LOCK", 0, 0, 1)
        basic.showIcon(IconNames.No)
    } else {
        // 0(멈춤) 또는 4(배경): 제자리에서 기다리기
        aiPonybot.stopAllMotors()
        basic.clearScreen()
    }
}

// 라디오는 받은 값만 기록하고, 실제 동작은 아래 무한 반복 한 곳에서만 처리
radio.onReceivedNumber(function (받은수) {
    받은신호 = 받은수
    마지막수신 = input.runningTime()
})

input.onButtonPressed(Button.B, function () {
    멈춤잠금 = !(멈춤잠금)
})

basic.forever(function () {
    let 할일 = 받은신호
    if (input.runningTime() - 마지막수신 > 2000) {
        // 신호가 끊김 → 안전하게 멈춤
        할일 = 0
    }
    if (할일 == 3) {
        let 거리 = aiPonybot.ping(aiPonybot.PingUnit.Centimeters)
        if (거리 == 0 || 거리 >= 500 || 거리 < 가까움기준) {
            할일 = 5
        }
    }
    if (멈춤잠금) {
        할일 = 6
    }
    if (할일 != 현재행동) {
        현재행동 = 할일
        행동하기(현재행동)
    }
    basic.pause(50)
})
