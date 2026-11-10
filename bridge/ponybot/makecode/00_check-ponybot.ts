// =============================================================
// [포니봇 마이크로비트] 0. 연결·센서 점검 (수업 전 1분)
// 확장: https://github.com/boundary-x/ai_ponybot_basic
// ⚠ 바퀴가 바닥에 닿지 않게 포니봇을 상자 위에 올려 두고 시험하세요.
// 1) 켜면: 마이크로비트 화면 = 하트, 포니봇 화면(OLED) = "PONYBOT OK" + 거리(cm) + 라인 센서 값
//    → 손을 앞에 대면 거리 숫자가 줄어야 해요. 검은 선 위에 올리면 라인 값이 바뀌어요.
// 2) A 버튼: 바퀴 점검(앞 → 뒤 → 오른쪽 옆 → 왼쪽 옆, 각 1초) 뒤 정지
// 3) B 버튼: 즉시 모든 모터 정지
// 안 될 때: 화면이 안 켜지면 마이크로비트를 끝까지 꽂았는지·배터리 확인.
//           바퀴 방향이 화면 글자와 다르면 기록해 두고 선생님께 알리기(실물 확인 항목).
// ※ 점검 속도(점검속도)는 실물에서 바퀴가 확실히 도는 값으로 선생님이 정하세요.
// =============================================================

let 점검속도 = 80
let 점검중 = false
basic.showIcon(IconNames.Heart)
aiPonybot.stopAllMotors()
aiPonybot.clear()
aiPonybot.showString("PONYBOT OK", 0, 0, 1)

function 바퀴점검 (글자: string, 방향: aiPonybot.Mecanum) {
    aiPonybot.showString("          ", 0, 6, 1)
    aiPonybot.showString(글자, 0, 6, 1)
    aiPonybot.runMecanum(방향, 점검속도)
    basic.pause(1000)
    aiPonybot.stopAllMotors()
    basic.pause(300)
}

input.onButtonPressed(Button.A, function () {
    if (점검중) {
        return
    }
    점검중 = true
    바퀴점검("FORWARD", aiPonybot.Mecanum.Forward)
    바퀴점검("BACKWARD", aiPonybot.Mecanum.Backward)
    바퀴점검("RIGHT", aiPonybot.Mecanum.Right)
    바퀴점검("LEFT", aiPonybot.Mecanum.Left)
    aiPonybot.stopAllMotors()
    aiPonybot.showString("DONE      ", 0, 6, 1)
    점검중 = false
})

input.onButtonPressed(Button.B, function () {
    aiPonybot.stopAllMotors()
    aiPonybot.showString("STOP      ", 0, 6, 1)
})

// 센서 값 표시(0.3초마다)
basic.forever(function () {
    let 거리 = aiPonybot.ping(aiPonybot.PingUnit.Centimeters)
    aiPonybot.showString("CM:     ", 0, 2, 1)
    aiPonybot.showNumber(거리, 24, 2, 1)
    aiPonybot.showString("LINE L:  R: ", 0, 4, 1)
    aiPonybot.showNumber(aiPonybot.readLineSensor(aiPonybot.LineSensorChannel.Left), 42, 4, 1)
    aiPonybot.showNumber(aiPonybot.readLineSensor(aiPonybot.LineSensorChannel.Right), 66, 4, 1)
    basic.pause(300)
})
