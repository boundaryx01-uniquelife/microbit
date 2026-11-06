// =============================================================
// [다리 마이크로비트] USB로 컴퓨터에 꽂아 두는 마이크로비트
// 역할: AI 브리지 웹 프로그램이 보낸 숫자(0~9)를 받아서
//       라디오로 로보독 등에 꽂힌 마이크로비트에게 전달합니다.
//
// ⚠ 이 프로젝트에는 로보독 확장(kocoafab/robodog)을 추가하지 마세요!
//   로보독 확장은 시리얼 통신을 로봇 쪽 핀(P0/P1)으로 바꿔 버려서
//   컴퓨터와 USB 통신이 끊깁니다.
//
// 사용법: MakeCode 새 프로젝트 → 상단 'JavaScript' 탭 → 아래 코드 붙여넣기
//         → '블록' 탭으로 돌아가 확인 → 다운로드
// =============================================================

// 모둠마다 다른 번호를 쓰세요(1~255). 로보독 쪽 코드와 같아야 합니다.
let 모둠번호 = 1
radio.setGroup(모둠번호)
radio.setTransmitPower(7)
serial.setBaudRate(BaudRate.BaudRate115200)
basic.showString("B" + 모둠번호)

serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let 받은글자 = serial.readUntil(serial.delimiters(Delimiters.NewLine))
    let 번호 = parseInt(받은글자)
    if (번호 >= 0 && 번호 <= 9) {
        radio.sendNumber(번호)
        basic.showNumber(번호)
    }
})

// A 버튼: 0(멈춤) 보내기 — 비상 정지
input.onButtonPressed(Button.A, function () {
    radio.sendNumber(0)
    basic.showIcon(IconNames.No)
})
