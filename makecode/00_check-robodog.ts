// =============================================================
// [로보독 마이크로비트] 0. 연결·배터리 점검 (수업 전 1분)
// 확장: kocoafab/robodog
// 1) 켜면: 눈 = 하트(통신 OK), 몸통 불빛 = 배터리 (초록 60% 이상 / 노랑 30~60% / 빨강 30% 미만 → 충전)
//    다리는 움직이지 않아요(일부러).
// 2) 본체 버튼(전원 스위치 옆)을 누를 때마다 앉기 ↔ 서기 → 버튼·모터 OK
// 안 될 때: 눈이 하트가 아니면 통신(마이크로비트를 끝까지 꽂았는지),
//           앉기·서기가 어긋나거나 떨리면 배터리 충전 → 그래도 어긋나면 다리 영점(코코아팹 문의)
// ※ 배터리 % 값의 정확도는 실물에서 확인이 필요해요.
// =============================================================

let 앉음 = false
let 이전 = false
robodog.headLedExp(deflib.LedExpression.ILoveYou)

function 배터리불빛 () {
    let 배터리 = robodog.getBattery()
    if (배터리 >= 60) {
        robodog.bodyLed(0, 255, 0)
    } else if (배터리 >= 30) {
        robodog.bodyLed(255, 160, 0)
    } else {
        robodog.bodyLed(255, 0, 0)
    }
}

basic.pause(500)
배터리불빛()

basic.forever(function () {
    let 지금 = robodog.getButton()
    if (지금 && !(이전)) {
        앉음 = !(앉음)
        if (앉음) {
            robodog.gesture(deflib.Posture.SitDown)
        } else {
            robodog.gesture(deflib.Posture.Ready)
        }
        배터리불빛()
    }
    이전 = 지금
    basic.pause(50)
})
