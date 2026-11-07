// =============================================================
// [무선 확장] 7. 로보독 카메라로 하는 신호등 안내견 — 색상 인식
// 확장: kocoafab/robodog-radio  (※ kocoafab/robodog 와 함께 넣지 마세요)
// 마이크로비트는 손에 들고 씁니다(라디오로 무선 제어).
//
// 준비: 로보독 카메라에 색을 학습(코코블록 PC 프로그램으로 하는 것으로 보임 — 방법 확인 필요)
//   Class1 = 빨강, Class2 = 노랑, Class3 = 초록 (스크래치 AI 교안 CH10과 같은 방법)
// 색상인식 값: 받은 번호를 그대로 씀(0 = 인식 안 됨, 1~ = 학습한 Class로 가정 — 범위는 실물 확인 필요)
// 안전: 인식이 2초 동안 안 되면 멈춤, A = 멈춤 잠금, B = 풀기
// ※ 무선 확장(v0.0.1)은 실물 동작이 아직 확인되지 않았습니다.
// 라디오 밴드: 같은 교실에서는 모둠마다 다른 밴드(예: 1모둠 7, 2모둠 17, 3모둠 27 …)를 쓰세요. 무선 확장은 라디오 그룹이 14로 고정이라
//   밴드가 같으면 다른 모둠 로보독도 움직일 수 있어요(추정). 로보독 본체의 밴드 설정 방법은 확인 필요.
// 비상 정지: A 버튼 외에 로보독 전원 스위치를 끄는 법을 먼저 알려 주세요.
// =============================================================

let 라디오밴드 = 7
let 현재 = -1
let 마지막인식 = 0
let 멈춤잠금 = false
robodog.rfBand(라디오밴드)
robodog.gesture(deflib.Posture.Ready)
robodog.aiDetection(deflib.AiMode.ColorDetect)
basic.showIcon(IconNames.Target)

input.onButtonPressed(Button.A, function () {
    멈춤잠금 = true
})

input.onButtonPressed(Button.B, function () {
    멈춤잠금 = false
})

basic.forever(function () {
    let 색 = robodog.getColorDetect()
    if (색 > 0) {
        마지막인식 = input.runningTime()
    }
    let 할일 = 색
    if (멈춤잠금 || input.runningTime() - 마지막인식 > 2000) {
        할일 = 0
    }
    if (할일 != 현재) {
        현재 = 할일
        if (할일 == 1) {
            robodog.stop()
            robodog.bodyLed(255, 0, 0)
            robodog.soundPlay(deflib.SoundEffect.MoveAside, deflib.SoundVolume.Medium)
            basic.showIcon(IconNames.No)
        } else if (할일 == 2) {
            robodog.stop()
            robodog.bodyLed(255, 160, 0)
            robodog.soundPlay(deflib.SoundEffect.Wait, deflib.SoundVolume.Medium)
            basic.showIcon(IconNames.Asleep)
        } else if (할일 == 3) {
            robodog.bodyLed(0, 255, 0)
            robodog.soundPlay(deflib.SoundEffect.Start, deflib.SoundVolume.Medium)
            robodog.move(deflib.MoveDirection.Forward, 25)
            basic.showIcon(IconNames.Yes)
        } else {
            robodog.stop()
            robodog.bodyLed(0, 0, 0)
            basic.clearScreen()
        }
    }
    basic.pause(50)
})
