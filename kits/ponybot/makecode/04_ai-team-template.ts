// =============================================================
// [포니봇 마이크로비트] 4. 우리 모둠 AI 포니봇 (프로젝트 틀)
// 확장: https://github.com/boundary-x/ai_ponybot_basic
// 모둠이 정한 문제에 맞게 '번호에맞게행동하기' 함수 안의 1~3번 행동을 채우세요.
//
// 예시 주제
//  - 교실 배달 로봇: 1=1모둠 카드 → 왼쪽 옆으로, 2=2모둠 카드 → 오른쪽 옆으로, 3=도착 카드 → 멈추고 알림
//  - 분리수거 도우미: 1=종이, 2=플라스틱, 3=캔 그림 → 서로 다른 방향 표시
//  - 길 안내 로봇: 1=왼쪽 화살표 카드, 2=오른쪽 화살표 카드, 3=정지 카드
//    (사람 얼굴 대신 카드·물건을 학습시켜 개인정보 문제를 피합니다)
//
// 안전장치(지우지 마세요): 2초 동안 신호가 없으면 멈춤, B 버튼 = 멈춤 잠금 ↔ 풀기(잠그면 화면에 X·"LOCK"),
//                         움직이는 행동은 짧게(1초 이내) 하고 반드시 멈추기
// ※ 바닥이나 울타리 안에서 시험하세요. 속도는 선생님이 정한 값으로.
// =============================================================

let 모둠번호 = 1
let 속도 = 80
let 받은신호 = 0
let 현재신호 = -1
let 마지막수신 = 0
let 멈춤잠금 = false
radio.setGroup(모둠번호)
aiPonybot.stopAllMotors()
aiPonybot.clear()
aiPonybot.showString("GROUP", 0, 0, 1)
aiPonybot.showNumber(모둠번호, 36, 0, 1)
basic.showString("R" + 모둠번호)

function 번호에맞게행동하기 (번호: number) {
    aiPonybot.clear()
    if (번호 == 1) {
        // TODO: 1번을 보았을 때 행동 (예: 왼쪽 옆으로 조금)
        aiPonybot.showString("ONE", 0, 0, 1)
        basic.showArrow(ArrowNames.West)
        aiPonybot.runMecanum(aiPonybot.Mecanum.Left, 속도)
        basic.pause(700)
        aiPonybot.stopAllMotors()
    } else if (번호 == 2) {
        // TODO: 2번을 보았을 때 행동 (예: 오른쪽 옆으로 조금)
        aiPonybot.showString("TWO", 0, 0, 1)
        basic.showArrow(ArrowNames.East)
        aiPonybot.runMecanum(aiPonybot.Mecanum.Right, 속도)
        basic.pause(700)
        aiPonybot.stopAllMotors()
    } else if (번호 == 3) {
        // TODO: 3번을 보았을 때 행동 (예: 멈추고 하트)
        aiPonybot.stopAllMotors()
        aiPonybot.showString("THREE", 0, 0, 1)
        basic.showIcon(IconNames.Heart)
    } else {
        // 0(멈춤) 또는 4(배경): 기다리기
        aiPonybot.stopAllMotors()
        basic.clearScreen()
    }
}

radio.onReceivedNumber(function (받은수) {
    받은신호 = 받은수
    마지막수신 = input.runningTime()
})

input.onButtonPressed(Button.B, function () {
    멈춤잠금 = !(멈춤잠금)
    if (멈춤잠금) {
        aiPonybot.stopAllMotors()
    }
})

basic.forever(function () {
    if (멈춤잠금) {
        if (현재신호 != -2) {
            현재신호 = -2
            aiPonybot.stopAllMotors()
            aiPonybot.clear()
            aiPonybot.showString("LOCK", 0, 0, 1)
            basic.showIcon(IconNames.No)
        }
    } else {
        let 할일 = 받은신호
        if (input.runningTime() - 마지막수신 > 2000) {
            할일 = 0
        }
        if (할일 != 현재신호) {
            현재신호 = 할일
            번호에맞게행동하기(현재신호)
        }
    }
    basic.pause(50)
})
