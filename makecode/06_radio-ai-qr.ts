// =============================================================
// [무선 확장] 6. QR 카드로 움직이는 로보독 — 로보독 내장 AI 카메라 사용
// 확장: kocoafab/robodog-radio  (※ kocoafab/robodog 와 함께 넣지 마세요)
//   MakeCode 확장 검색창에 https://github.com/kocoafab/robodog-radio 입력
// 마이크로비트는 로보독에 꽂지 않고 손에 들고 씁니다(라디오로 무선 제어).
// QR 인식은 학습이 필요 없어 실물 점검용으로 가장 좋습니다.
//
// 준비: 아래 글자를 담은 QR 카드(무료 QR 생성기로 만들기, 영문 8자 이내)
//   GO = 앞으로, STOP = 멈춤, LEFT = 왼쪽 90°, RIGHT = 오른쪽 90°, HELLO = 인사
// 버튼: A = 멈춤 잠금, B = 잠금 풀기
// ※ 무선 확장(v0.0.1)은 실물 동작이 아직 확인되지 않았습니다. 로봇 펌웨어 지원 여부를 먼저 확인하세요.
// =============================================================

let 라디오밴드 = 7
let 이전값 = ""
let 멈춤잠금 = false
robodog.rfBand(라디오밴드)
robodog.gesture(deflib.Posture.Ready)
robodog.aiDetection(deflib.AiMode.QrCode)
basic.showString("QR")

input.onButtonPressed(Button.A, function () {
    멈춤잠금 = true
    robodog.stop()
    basic.showIcon(IconNames.No)
})

input.onButtonPressed(Button.B, function () {
    멈춤잠금 = false
    이전값 = ""
    basic.showIcon(IconNames.Yes)
})

basic.forever(function () {
    let 값 = robodog.getQrCode()
    if (멈춤잠금 || 값 == 이전값) {
        basic.pause(100)
        return
    }
    이전값 = 값
    if (값 == "GO") {
        robodog.bodyLed(0, 255, 0)
        robodog.move(deflib.MoveDirection.Forward, 25)
        basic.pause(1500)
        robodog.stop()
    } else if (값 == "STOP") {
        robodog.stop()
        robodog.bodyLed(255, 0, 0)
        robodog.soundPlay(deflib.SoundEffect.Wait, deflib.SoundVolume.Medium)
    } else if (값 == "LEFT") {
        robodog.rotation(deflib.RotateDirection.Counterclockwise, 90, 60)
    } else if (값 == "RIGHT") {
        robodog.rotation(deflib.RotateDirection.Clockwise, 90, 60)
    } else if (값 == "HELLO") {
        robodog.gesture(deflib.Posture.SayHello)
        robodog.soundPlay(deflib.SoundEffect.Hello, deflib.SoundVolume.Medium)
        basic.pause(3000)
        robodog.gesture(deflib.Posture.Ready)
    }
    if (값 != "") {
        basic.showString(값.charAt(0))
    }
    basic.pause(100)
})
