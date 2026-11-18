// =============================================================
// [포니봇 마이크로비트] 6. 블루투스 이름 확인하기 (연결 전 1분)
// 웹앱 [기기 연결] 목록에는 "BBC micro:bit [다섯 글자]"가 여러 개 보여요.
// 이 코드를 넣으면 내 마이크로비트의 다섯 글자를 보여 줘요 → 목록에서 같은 이름을 고르세요.
// 포니봇 화면(OLED) = 다섯 글자 이름, 마이크로비트 LED = 이름이 흘러가요(A 버튼 = 다시 보기)
// 연결되면 ✔, 끊기면 ✖. 이름을 마스킹테이프에 적어 포니봇에 붙여 두면 다음 시간에 편해요.
// ※ 블루투스를 쓰는 코드는 라디오 블록과 함께 쓸 수 없어요.
// =============================================================
bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)
})
bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.No)
})
input.onButtonPressed(Button.A, function () {
    basic.showString(control.deviceName())
})
bluetooth.startUartService()
aiPonybot.stopAllMotors()
aiPonybot.clear()
aiPonybot.showString("BT NAME:", 0, 0, 1)
aiPonybot.showString(control.deviceName(), 0, 2, 1)
basic.showString(control.deviceName())
