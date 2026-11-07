// =============================================================
// [로보독 마이크로비트] 1. 안녕, 로보독! (순차 구조)
// 확장: kocoafab/robodog (MakeCode 확장에서 전체 이름 입력)
// 활동: 로보독 본체 버튼을 누를 때마다 다음 장면을 보여 줍니다.
//       1번째 = 인사, 2번째 = 조금 걷기, 3번째 = 앉기 → 다시 1번째
// ※ 로보독 등에 꽂은 마이크로비트의 A·B 버튼은 가려져서 누를 수 없어요.
//   그래서 로보독 본체 아래쪽, 전원 스위치 옆의 '본체 버튼'을 씁니다.
// =============================================================

let 차례 = 0
let 버튼이전 = false
robodog.gesture(deflib.Posture.Ready)
robodog.headLedExp(deflib.LedExpression.SparklingEyes)

function 본체버튼을눌렀을때 () {
    차례 = 차례 % 3 + 1
    if (차례 == 1) {
        // 인사 장면
        robodog.bodyLed(0, 0, 255)
        robodog.soundPlay(deflib.SoundEffect.Hello, deflib.SoundVolume.Medium)
        basic.pause(1000)
        robodog.gesture(deflib.Posture.SayHello)
        basic.pause(3000)
        robodog.gesture(deflib.Posture.Ready)
    } else if (차례 == 2) {
        // 앞으로 조금 걷고 멈추기 (책상 위에서는 속도 30 이하!)
        robodog.bodyLed(0, 255, 0)
        robodog.move(deflib.MoveDirection.Forward, 30)
        basic.pause(1000)
        robodog.stop()
        robodog.gesture(deflib.Posture.Ready)
    } else {
        // 앉기
        robodog.bodyLed(255, 160, 0)
        robodog.stop()
        robodog.gesture(deflib.Posture.SitDown)
    }
}

// 본체 버튼: 누르는 '순간'에 한 번만 반응하도록 바로 전 상태와 비교
basic.forever(function () {
    let 버튼지금 = robodog.getButton()
    if (버튼지금 && !(버튼이전)) {
        본체버튼을눌렀을때()
    }
    버튼이전 = 버튼지금
    basic.pause(50)
})
