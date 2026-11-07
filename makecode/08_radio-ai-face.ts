// =============================================================
// [무선 확장] 8. 얼굴을 바라보는 로보독 — 얼굴 추적 + 인식 위치
// 확장: kocoafab/robodog-radio  (※ kocoafab/robodog 와 함께 넣지 마세요)
// 마이크로비트는 손에 들고 씁니다(라디오로 무선 제어).
//
// 준비: 코코블록 PC 프로그램에서 얼굴 Class1을 학습
//   (초등 수업에서는 얼굴 대신 사진·그림 카드 사용을 권장, 개인정보 주의)
// 동작: 인식된 위치 X가 -30보다 작으면 왼쪽으로, 30보다 크면 오른쪽으로 15°씩 돌아 바라봄
// 버튼: A = 멈춤 잠금, B = 풀기
// ※ 무선 확장(v0.0.1)은 실물 동작이 아직 확인되지 않았습니다.
// =============================================================

let 라디오밴드 = 7
let 멈춤잠금 = false
robodog.rfBand(라디오밴드)
robodog.gesture(deflib.Posture.Ready)
robodog.faceTracking(deflib.AiClass.Class1)
basic.showIcon(IconNames.Happy)

input.onButtonPressed(Button.A, function () {
    멈춤잠금 = true
    robodog.stop()
    basic.showIcon(IconNames.No)
})

input.onButtonPressed(Button.B, function () {
    멈춤잠금 = false
    basic.showIcon(IconNames.Happy)
})

basic.forever(function () {
    if (!(멈춤잠금) && robodog.getFaceTracking() > 0) {
        let x = robodog.getAiPosition(deflib.AiPositionAxis.X)
        robodog.headLedExp(deflib.LedExpression.SparklingEyes)
        if (x < -30) {
            robodog.rotation(deflib.RotateDirection.Counterclockwise, 15, 50)
        } else if (x > 30) {
            robodog.rotation(deflib.RotateDirection.Clockwise, 15, 50)
        }
        basic.pause(400)
    } else {
        robodog.headLedExp(deflib.LedExpression.Blink)
        basic.pause(200)
    }
})
