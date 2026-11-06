// =============================================================
// [로보독 마이크로비트] 4. 우리 모둠 AI 로보독 (프로젝트 틀)
// 모둠이 정한 문제에 맞게 1~4번 행동을 채워 넣으세요.
//
// 예시 주제 (원 교안을 초등용으로 바꾼 것)
//  - 급식 알레르기 탐지견: 1=땅콩 그림, 2=우유 그림, 3=안전한 음식 → 경고/안심 표현
//  - 내 물건 알아보는 반려견: 1=내 필통, 2=친구 필통 → 반가움/경계 표현
//    (사람 얼굴 대신 물건·배지를 학습시켜 개인정보 문제를 피합니다)
//  - 교실 도우미견: 1=조용히 손 모양, 2=정리 시간 카드 → 알림 동작
// =============================================================

let 모둠번호 = 1
let 현재신호 = -1
radio.setGroup(모둠번호)
robodog.gesture(deflib.Posture.Ready)
basic.showString("R" + 모둠번호)

radio.onReceivedNumber(function (받은수) {
    if (받은수 == 현재신호) {
        return
    }
    현재신호 = 받은수
    if (받은수 == 1) {
        // TODO: 1번을 보았을 때 행동
        robodog.bodyLed(255, 0, 0)
        robodog.soundPlay(deflib.SoundEffect.Growl, deflib.SoundVolume.Medium)
    } else if (받은수 == 2) {
        // TODO: 2번을 보았을 때 행동
        robodog.bodyLed(0, 0, 255)
        robodog.gesture(deflib.Posture.SayHello)
    } else if (받은수 == 3) {
        // TODO: 3번을 보았을 때 행동
        robodog.bodyLed(0, 255, 0)
        robodog.headLedExp(deflib.LedExpression.ILoveYou)
    } else {
        // 0 또는 4(배경): 기본 자세
        robodog.stop()
        robodog.bodyLed(0, 0, 0)
        robodog.gesture(deflib.Posture.Ready)
    }
})

input.onButtonPressed(Button.A, function () {
    현재신호 = 0
    robodog.stop()
    robodog.gesture(deflib.Posture.Ready)
})
