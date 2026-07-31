# 장기전 (Body Defense Protocol)

몸속 순환계를 무대로 한 **세포 진화 타워디펜스** 게임입니다. 미분화 세포를 심고
폐·간·심장 세포로 진화시켜, 하루 8개 시간대(웨이브)에 걸쳐 밀려오는 침입자
(세균·미세먼지·독소·지방·바이러스·만성 염증)를 막아냅니다.

[vinext](https://github.com/cloudflare/vinext)(Cloudflare Workers 위의 Next.js)
로 구동되며, 클라이언트 캔버스에서 게임 시뮬레이션이 돌아갑니다.

## 시작하기

```bash
npm install
npm run dev      # 로컬 개발 서버
npm run build    # 프로덕션 빌드 검증
npm test         # 빌드 + 밸런스 데이터 테스트
npm run lint     # ESLint
```

Node.js `>=22.13.0` 필요 (테스트는 `.ts` 직접 import를 위해 Node의 타입 스트리핑 사용).

## 게임 구조

게임 코드는 `app/defense/` 에 있습니다.

| 파일 | 역할 |
| --- | --- |
| `balance.ts` | 밸런스 데이터 (장기·적·타워 스탯, 웨이브 구성, 습관 카드) |
| `types.ts` | 공유 타입 정의 |
| `game-engine.ts` | 시뮬레이션 + 캔버스 렌더링 (`DefenseEngine` 클래스) |
| `DefenseGame.tsx` | React HUD·조작 UI, 엔진과 연결 |
| `page.tsx` | `/defense` 라우트 |

### 핵심 시스템

- **세포 타워**: 슬롯에 미분화 세포(stem)를 심고 → 계열(폐/간/심장) 분화 →
  최종 전문화의 3단계로 진화. 슬롯마다 "지역 적성"이 있어 적합 계열은 비용 할인.
- **장기 본부**: 폐·간·심장은 레벨업으로 주변 같은 계열 세포를 강화하고,
  액티브 스킬(심호흡/해독/혈류 조절, 단축키 Q/W/E)을 발동.
- **생리 압박 (physiology)**: 침입자 유형별로 관할 장기의 부담도(strain)가 쌓이고,
  70을 넘으면 해당 계열 세포의 위력이 감소한다. 스킬 사용·수면 카드로 회복.
- **순환 루프**: 침입자는 제거될 때까지 혈관 루프를 계속 돈다. 동시 생존
  침입자가 60기를 넘으면 순환계 붕괴(패배).
- **습관 카드**: 웨이브 클리어 후 생활 습관을 하나 선택 (영구/즉시/다음 웨이브 효과).
- **콤보·조기 시작·배속**: 연속 처치 보상 배수, 준비 시간 조기 종료 이자, 1/2/3배속.

### 밸런스 조정

전투/경제 수치는 전부 `app/defense/balance.ts` 의 `GAME_BALANCE`, `ORGANS`,
`ENEMIES`, `CELL_TOWERS`, `WAVES`, `HABIT_CARDS` 에 모여 있습니다. 수정 후
`npm test` 로 데이터 불변식(웨이브 순서, 스탯 양수, 배율 단조 증가 등)을 검증하세요.

## 인프라 (선택)

이 프로젝트는 vinext 스타터 위에 얹혀 있어, Cloudflare D1 / Drizzle 바인딩이
준비되어 있습니다 (`db/schema.ts`, `drizzle.config.ts`, `.openai/hosting.json`).
현재 게임은 서버 영속성을 사용하지 않으며, 최고 기록 저장 등을 붙일 때
활용할 수 있습니다.

- `.openai/hosting.json`: 선택적 D1/R2 바인딩 선언
- `vite.config.ts`: 로컬 개발용 바인딩 시뮬레이션
- `npm run db:generate`: 스키마 변경 후 Drizzle 마이그레이션 생성
