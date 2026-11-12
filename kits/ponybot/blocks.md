# ai-ponybot-basic (1.3.1) 블록 표

출처: `boundary-x/ai_ponybot_basic` @63fa6aac90447084e7acdcb65d267ec43be7cc0b. 숨김(hidden) = 블록으로 보이지 않는 함수.  
의존성: `core`

## namespace `aiPonybot`

| 함수 | 블록 글자(소스) | 번역(_locales) | 인자(형, 범위, 기본) | 반환 | blockId | group | 숨김 |
|---|---|---|---|---|---|---|---|
| `servo` | \|%index\|서보모터\|%degree\|각도로 이동 |  | index: Servo; degree: number [0..180] | void | aiponybot_motor_servo | 서보모터 제어 |  |
| `runMotor` | \|%index\|모터\|%direction\|방향\|%speed\|속도로 회전 |  | index: Motor =Motor.Motor1; direction: Direction; speed: number [0..255] | void | aiponybot_motor_runMotor | 모터 제어(심화) |  |
| `runMecanum` | \|메카넘\|%direction\|방향\|%speed\|속도로 이동 |  | direction: Mecanum; speed: number [0..255] | void | aiponybot_motor_runMecanum | 모터 제어(기초) |  |
| `stopMotor` | \|%index\|모터 정지 |  | index: Motor =Motor.Motor1 | void | aiponybot_motor_stopMotor | 모터 제어(심화) |  |
| `stopAllMotors` | \|모든 모터 정지 |  |  | void | aiponybot_motor_stopAllMotors | 모터 제어(기초) |  |
| `runNormal` | \|포니봇\|%direction\|방향\|%speed\|속도로 이동 |  | direction: DirectionControl; speed: number [0..255] | void | aiponybot_motor_runNormal | 모터 제어(기초) |  |
| `checkTwoLineState` | 두 라인 센서의 값이 %state |  | state: TwoLineState | boolean | checkTwoLineState | 라인 감지 센서 |  |
| `checkSingleLineSensor` | %channel 라인 센서의 값이 %state |  | channel: LineSensorChannel; state: LineState | boolean | checkSingleLineSensor | 라인 감지 센서 |  |
| `readLineSensor` | %channel 라인 센서 값 읽기 |  | channel: LineSensorChannel | number | readLineSensor | 라인 감지 센서 |  |
| `ping` | %unit 단위로 측정한 거리 |  | unit: PingUnit; maxCmDistance: ? =500 | number | aiponybot_sonar_ping | 거리 감지 센서 |  |
| `initColorSensor` | 컬러센서 초기화 : %version |  | version: SensorVersion | void | aiponybot_color_init_version | 색상 감지 센서 |  |
| `getLight` | 밝기(B) 값 읽기 |  |  | number | aiponybot_color_tcs34725_get_light | 색상 감지 센서 |  |
| `getRed` | 빨간색(R) 색상 값 읽기 |  |  | number | aiponybot_color_tcs34725_get_red | 색상 감지 센서 |  |
| `getGreen` | 초록색(G) 색상 값 읽기 |  |  | number | aiponybot_color_tcs34725_get_green | 색상 감지 센서 |  |
| `getBlue` | 파란색(B) 색상 값 읽기 |  |  | number | aiponybot_color_tcs34725_get_blue | 색상 감지 센서 |  |
| `isColorAdvanced` | 감지된 색상이 %color (임계값 %threshold) |  | color: DetectedColor; threshold: number [10..100] =40 | boolean | aiponybot_color_sensor_is_color_advanced | 색상 감지 센서 |  |
| `isColorInRange` | R: %minR ~ %maxR, G: %minG ~ %maxG, B: %minB ~ %maxB |  | minR: number [0..255] =0; maxR: number [0..255] =255; minG: number [0..255] =0; maxG: number [0..255] =255; minB: number [0..255] =0; maxB: number [0..255] =255 | boolean | aiponybot_color_sensor_is_in_range | 색상 감지 센서 |  |
| `invert` | 디스플레이 색상 반전 %on |  | on: boolean =true | void |  | 디스플레이 제어 |  |
| `clear` | 디스플레이 지우기 |  |  | void |  | 디스플레이 제어 |  |
| `display` | 디스플레이 화면 %on |  | on: boolean =1 | void |  | 디스플레이 제어 |  |
| `pixel` | 픽셀 출력 - 위치: x %x y %y, 색상: %color |  | x: number [0..127] =0; y: number [0..63] =0; color: number [0..1] =1 | void |  | 디스플레이 제어(도형) |  |
| `showString` | 문장 출력 - 내용: %text, 위치: %column열 %row행, 색상: %color |  | text: string =AI ponybot; column: number [0..120] =0; row: number [0..7] =0; color: number [0..1] =1 | void |  | 디스플레이 제어(데이터) |  |
| `showNumber` | 숫자 출력 - 내용: %number, 위치: %column열 %row행, 색상: %color |  | number: number =777; column: number [0..120] =0; row: number [0..7] =0; color: number [0..1] =1 | void |  | 디스플레이 제어(데이터) |  |
| `printString` | 문장 출력 - 내용: %text, 줄바꿈: %newline |  | text: string =AI ponybot; newline: boolean =True | void |  | 디스플레이 제어(데이터) |  |
| `printNumber` | 숫자 출력 - 내용: %number, 줄바꿈: %newline |  | number: number =777; newline: boolean =True | void |  | 디스플레이 제어(데이터) |  |
| `horizontalLine` | 수평선 출력 - 위치: x %x y %y, 길이: %length, 색상: %color |  | x: number [0..127] =0; y: number [0..63] =0; length: number [1..128] =16; color: number [0..1] =1 | void |  | 디스플레이 제어(도형) |  |
| `verticalLine` | 수직선 출력 - 위치: x %x y %y, 길이: %length, 색상: %color |  | x: number [0..127] =0; y: number [0..63] =0; length: number [1..128] =16; color: number [0..1] =1 | void |  | 디스플레이 제어(도형) |  |
| `rectangle` | 사각형 출력 - x1 %x1 y1 %y1 x2 %x2 y2 %y2, 색상: %color |  | x1: number; y1: number; x2: number; y2: number; color: number =1 | void |  | 디스플레이 제어(도형) |  |
| `parseUARTUnified` | 블루투스 수신 값: %data 에서 사물 %type 을 %format 으로 추출 |  | data: string; type: UARTDataType; format: ReturnFormat | any |  | AI 데이터 활용 |  |
| `parseColorUnified` | 블루투스 수신 값: %data 에서 컬러 %color 을 %format 으로 추출 |  | data: string; color: ColorDataType; format: ReturnFormat | any |  | AI 데이터 활용 |  |
| `parseFaceUnified` | 블루투스 수신 값: %data 에서 얼굴 %type 추출 |  | data: string; type: FaceDataType | number |  | AI 데이터 활용 |  |
| `parseHandPoseUnified` | 블루투스 수신 값: %data 에서 핸드포즈 %type 을 %format 으로 추출 |  | data: string; type: HandDataType; format: ReturnFormat | any |  | AI 데이터 활용 |  |

### enum `Mecanum`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `LeftForward` | 1 | ↖ |  |
| `Forward` | 2 | ↑ |  |
| `RightForward` | 3 | ↗ |  |
| `Left` | 4 | ← |  |
| `Stop` | 5 | s |  |
| `Right` | 6 | → |  |
| `LeftBackward` | 7 | ↙ |  |
| `Backward` | 8 | ↓ |  |
| `RightBackward` | 9 | ↘ |  |

### enum `DirectionControl`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `Forward` | 1 | ↑ |  |
| `Backward` | 2 | ↓ |  |
| `Clockwise` | 3 | ↶ |  |
| `CounterClockwise` | 4 | ↷ |  |

### enum `Stepper`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `Stepper42` | 1 | 42 |  |
| `Stepper28` | 2 | 28 |  |

### enum `Servo`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `Servo1` | 0x01 | 서보 1 |  |
| `Servo2` | 0x02 | 서보 2 |  |
| `Servo3` | 0x03 | 서보 3 |  |
| `Servo4` | 0x04 | 서보 4 |  |
| `Servo5` | 0x05 | 서보 5 |  |
| `Servo6` | 0x06 | 서보 6 |  |
| `Servo7` | 0x07 | 서보 7 |  |
| `Servo8` | 0x08 | 서보 8 |  |

### enum `Motor`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `Motor4` | 0x4 | 모터 4 |  |
| `Motor1` | 0x1 | 모터 1 |  |
| `Motor3` | 0x3 | 모터 3 |  |
| `Motor2` | 0x2 | 모터 2 |  |

### enum `Direction`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `Clockwise` | 1 | 정회전 |  |
| `CounterClockwise` | -1 | 역회전 |  |

### enum `StepperPair`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `Motors1And2` | 0x1 |  |  |
| `Motors3And4` | 0x2 |  |  |

### enum `TwoLineState`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `OffOff` | 0 | ◌ ◌  |  |
| `OnOn` | 1 | ● ● |  |
| `OnOff` | 2 | ● ◌ |  |
| `OffOn` | 3 | ◌ ● |  |

### enum `LineState`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `Off` | 0 | ◌ |  |
| `On` | 1 | ● |  |

### enum `LineSensorChannel`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `Left` | 1 | 왼쪽 |  |
| `Right` | 2 | 오른쪽 |  |

### enum `PingUnit`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `MicroSeconds` | 0 | 마이크로초 |  |
| `Centimeters` | 1 | 센티미터 |  |
| `Inches` | 2 | 인치 |  |

### enum `DetectedColor`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `Red` | 0 | 빨간색 |  |
| `Green` | 1 | 초록색 |  |
| `Blue` | 2 | 파란색 |  |
| `Yellow` | 3 | 노란색 |  |

### enum `SensorVersion`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `V1` | 1 | 검은색 모듈(V1) |  |
| `V2` | 2 | 보라색 모듈(V2) |  |

### enum `Display`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `On` | 1 | ON |  |
| `Off` | 0 | OFF |  |

### enum `UARTDataType`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `X` | 0 | X 좌표 |  |
| `Y` | 1 | Y 좌표 |  |
| `W` | 2 | 너비 |  |
| `H` | 3 | 높이 |  |
| `D` | 4 | 객체 수 |  |

### enum `ColorDataType`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `R` | 0 | 빨간색(R) |  |
| `G` | 1 | 초록색(G) |  |
| `B` | 2 | 파랑색(B) |  |
| `I` | 3 | 클래스 ID(I) |  |

### enum `ReturnFormat`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `String` | 0 | 문자형 |  |
| `Number` | 1 | 정수형 |  |

### enum `FaceDataType`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `X` | 0 | X 좌표 |  |
| `Y` | 1 | Y 좌표 |  |
| `Z` | 2 | 거리(Z) |  |
| `Yaw` | 3 | 좌우회전(Yaw) |  |
| `Pitch` | 4 | 상하각도(Pitch) |  |
| `Mouth` | 5 | 입벌림 |  |
| `LeftEye` | 6 | 왼쪽 눈 |  |
| `RightEye` | 7 | 오른쪽 눈 |  |
| `Roll` | 8 | 기울기(Roll) |  |
| `Smile` | 9 | 웃음 |  |
| `Visible` | 10 | 얼굴 감지 여부 |  |

### enum `HandDataType`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `LeftDir` | 0 | 왼쪽 방향 |  |
| `LeftSpeed` | 1 | 왼쪽 속도 |  |
| `RightDir` | 2 | 오른쪽 방향 |  |
| `RightSpeed` | 3 | 오른쪽 속도 |  |

## namespace `aiPonybot.smbus`

| 함수 | 블록 글자(소스) | 번역(_locales) | 인자(형, 범위, 기본) | 반환 | blockId | group | 숨김 |
|---|---|---|---|---|---|---|---|
| `writeByte` |  |  | address: number; register: number; value: number | void |  |  | 예 |
| `writeBuffer` |  |  | address: number; register: number; value: Buffer | void |  |  | 예 |
| `readBuffer` |  |  | address: number; register: number; length: number | Buffer |  |  | 예 |
| `readNumber` |  |  | address: number; register: number; format: NumberFormat =NumberFormat.UInt8LE | number |  |  | 예 |
| `unpack` |  |  | format: string; buffer: Buffer | number[] |  |  | 예 |

