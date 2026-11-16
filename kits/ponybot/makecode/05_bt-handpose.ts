// =============================================================
// [포니봇 마이크로비트] 5. 손 모양으로 조종하기 (블루투스 · KNN 핸드포즈 분류 웹앱)
// 원본: 바운더리엑스 연수 교안 예제(MakeCode 공유 09250-41024-18617-49026)
//       → 원본의 다섯 번째 조건 "ID45"를 "ID5"로 고친 것(그대로면 오른쪽 가리키기에서 안 움직임)
// 웹앱: https://boundary-x.github.io/ai_handpose_recognition/
// 받는 글자: ID1 주먹=멈춤 · ID2 보=앞으로 · ID3 브이=뒤로 · ID4 왼쪽 가리키기=왼쪽 옆 · ID5 오른쪽 가리키기=오른쪽 옆
//            stop(손이 화면에서 사라짐)과 그 밖의 글자 = 멈춤
// 포니봇 화면(OLED) 첫 줄 = 블루투스 이름(웹앱 [기기 연결]에서 이 이름을 고르세요), 둘째 줄 = 받은 글자
// ※ 블루투스를 쓰는 코드는 라디오 블록과 함께 쓸 수 없어요. 속도 80은 예시 값(선생님이 정해요).
// =============================================================
bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    데이터 = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))
    if (데이터 == "ID1") {
        aiPonybot.stopAllMotors()
    } else if (데이터 == "ID2") {
        aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 80)
    } else if (데이터 == "ID3") {
        aiPonybot.runMecanum(aiPonybot.Mecanum.Backward, 80)
    } else if (데이터 == "ID4") {
        aiPonybot.runMecanum(aiPonybot.Mecanum.Left, 80)
    } else if (데이터 == "ID5") {
        aiPonybot.runMecanum(aiPonybot.Mecanum.Right, 80)
    } else {
        aiPonybot.stopAllMotors()
    }
})
bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)
    music.play(music.builtinPlayableSoundEffect(soundExpression.hello), music.PlaybackMode.UntilDone)
})
bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.No)
    music.play(music.builtinPlayableSoundEffect(soundExpression.sad), music.PlaybackMode.UntilDone)
})
let 데이터 = ""
bluetooth.startUartService()
basic.forever(function () {
    aiPonybot.showString(control.deviceName(), 0, 0, 1)
    aiPonybot.showString("data : " + 데이터, 0, 1, 1)
})
