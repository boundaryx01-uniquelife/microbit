// =============================================================
// [본체 버튼 ①] 버튼을 누르면 멍멍! (가장 쉬움, 처음 해 보는 사람용)
// 확장: kocoafab/robodog
//
// 무엇을 하나요? 로보독 본체 버튼을 누를 때마다
//   눈이 반짝 → "멍멍" → 앞발 들어 인사 → 다시 서기
//
// 본체 버튼은 어디? 로보독 아래쪽, 전원 스위치 바로 옆의 작은 버튼이에요.
//   (등에 꽂은 마이크로비트의 A·B 버튼은 가려져서 누를 수 없어요)
//
// 코드 읽는 법
//   이전버튼/지금버튼: "방금 눌렀나?"를 알기 위해 두 번 비교해요.
//   지금은 눌렸고(지금버튼) 조금 전엔 안 눌렸으면(!이전버튼) → 한 번 누른 것!
// =============================================================

let 이전버튼 = false
robodog.gesture(deflib.Posture.Ready)

basic.forever(function () {
    let 지금버튼 = robodog.getButton()
    if (지금버튼 && !(이전버튼)) {
        // 여기 안에 "버튼을 눌렀을 때 할 일"을 차례대로 적어요
        robodog.headLedExp(deflib.LedExpression.SparklingEyes)
        robodog.soundPlay(deflib.SoundEffect.Bark, deflib.SoundVolume.Medium)
        robodog.gesture(deflib.Posture.SayHello)
        basic.pause(2000)
        robodog.gesture(deflib.Posture.Ready)
    }
    이전버튼 = 지금버튼
    basic.pause(50)
})
