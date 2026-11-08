// =============================================================
// [라디오 리모컨 ③] 리모컨으로 재주 부리기 — 로보독에 꽂는 마이크로비트용
// 확장: kocoafab/robodog
//
// 리모컨(20_remote-sender, 같은 코드 그대로)에서 오는 숫자에 따라
//   1 (A 버튼)   = 앞발 들어 인사 + "안녕"
//   2 (B 버튼)   = 앉기 ↔ 서기 (누를 때마다 바뀜)
//   3 (A+B 함께) = 반짝 눈 + "멍멍"
// 걷지 않아서 책상 위에서도 안전하게 해 볼 수 있어요.
// =============================================================

let 그룹 = 1
let 앉음 = false
radio.setGroup(그룹)
robodog.gesture(deflib.Posture.Ready)

radio.onReceivedNumber(function (receivedNumber) {
    if (receivedNumber == 1) {
        앉음 = false
        robodog.headLedExp(deflib.LedExpression.ThankYou)
        robodog.soundPlay(deflib.SoundEffect.Hello, deflib.SoundVolume.Medium)
        robodog.gesture(deflib.Posture.SayHello)
        basic.pause(2000)
        robodog.gesture(deflib.Posture.Ready)
    } else if (receivedNumber == 2) {
        앉음 = !(앉음)
        if (앉음) {
            robodog.gesture(deflib.Posture.SitDown)
        } else {
            robodog.gesture(deflib.Posture.Ready)
        }
    } else if (receivedNumber == 3) {
        robodog.headLedExp(deflib.LedExpression.SparklingEyes)
        robodog.soundPlay(deflib.SoundEffect.Bark, deflib.SoundVolume.Medium)
    }
})
