# ai-ponybot-light (?) 블록 표

출처: `boundary-x/ai_ponybot_light` @0723938d4a3b0b261c0adccf6f831b9de7be9cba. 숨김(hidden) = 블록으로 보이지 않는 함수.  
의존성: `core`, `ws2812b`

## namespace `(global)`

### enum `NeoPixelColors`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `Red` | 0xFF0000 | 빨간색(red) |  |
| `Orange` | 0xFFA500 | 주황색(orange) |  |
| `Yellow` | 0xFFFF00 | 노란색(yellow) |  |
| `Green` | 0x00FF00 | 초록색(green) |  |
| `Blue` | 0x0000FF | 파란색(blue) |  |
| `Indigo` | 0x000080 | 남색(indigo) |  |
| `Violet` | 0x8a2be2 | 보라색(violet) |  |
| `White` | 0xFFFFFF | 흰색(white) |  |
| `Black` | 0x000000 | 끄기 |  |

### enum `NeoPixelMode`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `RGB` | 1 | RGB (GRB format) |  |
| `RGBW` | 2 | RGB+W |  |
| `RGB_RGB` | 3 | RGB (RGB format) |  |

## namespace `neopixel`

| 함수 | 블록 글자(소스) | 번역(_locales) | 인자(형, 범위, 기본) | 반환 | blockId | group | 숨김 |
|---|---|---|---|---|---|---|---|
| `create` | %pin\|에 연결된 %numLeds\|개의 %mode\|타입 라이트 |  | pin: DigitalPin =DigitalPin.P8; numLeds: number =4; mode: NeoPixelMode | Strip | neopixel_create | 라이트 제어(기초) |  |
| `rgb` | 빨강(R): %red\|초록(G): %green\|파랑(B): %blue |  | red: number [0..255]; green: number [0..255]; blue: number [0..255] | number | neopixel_rgb | 색상 블록 |  |
| `pickColorPackRGB` | 색상 선택 %color |  | color: number | number | pick_color_packrgb | 색상 블록 |  |
| `getColors` | %color |  | color: NeoPixelColors | number | neopixel_colors | 색상 블록 |  |
| `hsl` | 색조(H): %hue\|채도(S): %saturation\|명도(L): %luminance |  | hue: number; saturation: number; luminance: number | number | neopixelHSL | 색상 블록 |  |

### enum `HueInterpolationDirection`

| 멤버 | 값 | 블록 글자(소스) | 번역(_locales) |
|---|---|---|---|
| `Clockwise` | 0 |  |  |
| `CounterClockwise` | 1 |  |  |
| `Shortest` | 2 |  |  |

