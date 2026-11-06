// =============================================================
// [USB 마이크로비트] 컴퓨터에 USB로 꽂아 두는 마이크로비트
// (켜면 B1, B2…가 한 번 흘러가고, 그 뒤에는 받은 번호가 표시됩니다)
// 역할: AI 브리지 웹 프로그램이 보낸 숫자(0~9)를 받아서
//       라디오로 로보독 등에 꽂힌 마이크로비트에게 전달합니다.
//
// ⚠ 이 프로젝트에는 로보독 확장(kocoafab/robodog)을 추가하지 마세요!
//   로보독 확장은 시리얼 통신을 로봇 쪽 핀(P0/P1)으로 바꿔 버려서
//   컴퓨터와 USB 통신이 끊깁니다.
//
// 사용법: MakeCode 새 프로젝트 → 위쪽 'JavaScript' 탭 → 아래 코드 붙여넣기
//         → '블록' 탭으로 돌아가 확인 → 다운로드
// 버튼: A = 멈춤 잠금(로보독에 0을 계속 보냄), B = 멈춤 풀기
// =============================================================

// 모둠마다 다른 번호를 쓰세요(1~99). 로보독 쪽 코드와 같아야 합니다.
let 모둠번호 = 1
let 멈춤잠금 = false
let 받은번호 = -1
let 표시한번호 = -2
radio.setGroup(모둠번호)
radio.setTransmitPower(7)
serial.setBaudRate(BaudRate.BaudRate115200)
basic.showString("B" + 모둠번호)

// 받자마자 라디오로 전달만 하고(빠르게), 화면 표시는 아래 무한 반복에서
serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let 번호 = parseInt(serial.readUntil(serial.delimiters(Delimiters.NewLine)))
    if (!(멈춤잠금) && 번호 >= 0 && 번호 <= 9) {
        radio.sendNumber(번호)
        받은번호 = 번호
    }
})

input.onButtonPressed(Button.A, function () {
    멈춤잠금 = true
    radio.sendNumber(0)
})

input.onButtonPressed(Button.B, function () {
    멈춤잠금 = false
})

basic.forever(function () {
    if (멈춤잠금) {
        // 잠금 중에는 0을 계속 보냄
        radio.sendNumber(0)
        if (표시한번호 != -1) {
            표시한번호 = -1
            basic.showIcon(IconNames.No)
        }
    } else if (받은번호 != 표시한번호) {
        표시한번호 = 받은번호
        if (표시한번호 >= 0) {
            basic.showNumber(표시한번호)
        } else {
            basic.clearScreen()
        }
    }
    basic.pause(300)
})
