// =============================================================
// [무선 확장] 8. 얼굴을 바라보는 로보독 — 얼굴 추적 + 인식 위치
// 확장: kocoafab/robodog-radio  (※ kocoafab/robodog 와 함께 넣지 마세요)
// 마이크로비트는 손에 들고 씁니다(라디오로 무선 제어).
//
// 준비: 로보독 카메라에 얼굴 Class1을 학습(방법 확인 필요)
//   (초등 수업에서는 얼굴 대신 사진·그림 카드 사용을 권장, 개인정보 주의)
// 동작: 인식된 위치 X가 -30보다 작으면 왼쪽으로, 30보다 크면 오른쪽으로 15°씩 돌아 바라봄
//   (X의 범위 -128~127, 부호 방향, 기준 30, 15°는 확인 안 된 값 — 실물에서 조정. 얼굴 추적 모드에서 로봇이 스스로 움직이는지도 확인 필요)
// 버튼: A = 멈춤 잠금, B = 풀기
// ※ 무선 확장(v0.0.1)은 실물 동작이 아직 확인되지 않았습니다.
// 라디오 밴드: 같은 교실에서는 모둠마다 다른 밴드(예: 1모둠 7, 2모둠 17, 3모둠 27 …)를 쓰세요. 무선 확장은 라디오 그룹이 14로 고정이라
//   밴드가 같으면 다른 모둠 로보독도 움직일 수 있어요(추정). 로보독 본체의 밴드 설정 방법은 확인 필요.
// 비상 정지: A 버튼 외에 로보독 전원 스위치를 끄는 법을 먼저 알려 주세요.
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
