// =============================================================
// [로보독 마이크로비트] 4. 우리 모둠 AI 로보독 (프로젝트 틀)
// 모둠이 정한 문제에 맞게 '번호에맞게행동하기' 함수 안의 1~3번 행동을 채우세요.
//
// 예시 주제 (원 교안을 마이크로비트용으로 바꾼 것)
//  - 급식 알레르기 탐지견: 1=땅콩 그림, 2=우유 그림, 3=안전한 음식 → 경고/확인/안심
//  - 내 물건 알아보는 반려견: 1=내 필통, 2=친구 필통 → 반가움/경계
//    (사람 얼굴 대신 물건·배지를 학습시켜 개인정보 문제를 피합니다)
//  - 교실 도우미견: 1=조용히 손 모양, 2=정리 시간 카드 → 알림 동작
//
// 안전장치(지우지 마세요): 2초 동안 신호가 없으면 멈춤, A=멈춤 잠금, B=잠금 풀기
// ※ 로보독 마이크로비트에서는 '음악' 블록을 쓰지 마세요(로봇 통신 핀과 겹칠 수 있음).
// =============================================================

let 모둠번호 = 1
let 받은신호 = 0
let 현재신호 = -1
let 마지막수신 = 0
let 멈춤잠금 = false
radio.setGroup(모둠번호)
robodog.gesture(deflib.Posture.Ready)
basic.showString("R" + 모둠번호)

function 번호에맞게행동하기 (번호: number) {
    if (번호 == 1) {
        // TODO: 1번을 보았을 때 행동
        robodog.stop()
        robodog.bodyLed(255, 0, 0)
        robodog.soundPlay(deflib.SoundEffect.Growl, deflib.SoundVolume.Medium)
    } else if (번호 == 2) {
        // TODO: 2번을 보았을 때 행동
        robodog.stop()
        robodog.bodyLed(0, 0, 255)
        robodog.gesture(deflib.Posture.SayHello)
    } else if (번호 == 3) {
        // TODO: 3번을 보았을 때 행동
        robodog.stop()
        robodog.bodyLed(0, 255, 0)
        robodog.headLedExp(deflib.LedExpression.ILoveYou)
    } else {
        // 0(멈춤) 또는 4(배경): 기본 자세
        robodog.stop()
        robodog.bodyLed(0, 0, 0)
        robodog.gesture(deflib.Posture.Ready)
    }
}

radio.onReceivedNumber(function (받은수) {
    받은신호 = 받은수
    마지막수신 = input.runningTime()
})

input.onButtonPressed(Button.A, function () {
    멈춤잠금 = true
})

input.onButtonPressed(Button.B, function () {
    멈춤잠금 = false
})

basic.forever(function () {
    let 할일 = 받은신호
    if (멈춤잠금 || input.runningTime() - 마지막수신 > 2000) {
        할일 = 0
    }
    if (할일 != 현재신호) {
        현재신호 = 할일
        번호에맞게행동하기(현재신호)
        if (멈춤잠금) {
            basic.showIcon(IconNames.No)
        } else {
            basic.showNumber(현재신호)
        }
    }
    basic.pause(50)
})
