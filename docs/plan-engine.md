# 2번 계산·개인화 엔진 (`lib/plan/`)

1번이 만든 프로필 JSON을 받아, 목적별 필요 금액·배분 규칙 A/B 타임라인·개인화 진단을 계산합니다.
금액은 만 원 단위, 예적금 이자와 투자 수익률은 넣지 않습니다. 기준 비율은 아직 출처 확인 전 초안이라 화면에는 "일반적으로"로 표현해야 합니다.

```js
import { loadProfile } from '../lib/goal/store.js';
import { buildPlan } from '../lib/plan/index.js';

const plan = buildPlan(loadProfile()); // 프로필이 없으면 null이므로 먼저 확인
```

## 파일

| 파일 | 역할 |
| --- | --- |
| `config.js` | 기준값 표 (비상자금 개월 수, 한도 비율, 기준값, 이사·초기 비용). **출처가 정해지면 여기만 고칩니다** |
| `inputs.js` | 프로필 → 계산 입력. "모름"은 기준값으로 채우고 `usedDefaults`에 남김 |
| `purposes.js` | 월 현금흐름, 목적별 필요 금액 (비상자금·주거·결혼·투자·빚 상환) |
| `simulate.js` | 규칙 A·B 배분 시뮬레이션 (개월 단위) |
| `budget.js` | 개인화 판단: 월급의 몇 %를 모을지, 생활비 상한, 기간 늘리기, 월세 상한 |
| `extras.js` | 리포트용 파생 숫자: 그래프 데이터(`series`), 핵심 지표(`metrics`), 일정(`milestones`), 부족분 해결(`fixes`), 요약(`summary`) |
| `steps.js` | 지도 단계 카드: `buildPlanRoadmap(plan, policies)` |
| `demoProfile.js` | 입력이 없을 때 쓰는 시연 인물(정하은) 프로필 |
| `index.js` | `buildPlan(profile)` |

## 결과 구조 (`buildPlan`)

| 키 | 내용 |
| --- | --- |
| `cashflow` | 지금 / 독립 후의 생활비·저축·저축률, 주거비 비율 |
| `goals[]` | 목적별 `target`(필요 금액), `deadline`, `basis[]`(계산 근거 문장) |
| `core` | 핵심 숫자 세 개: `goal`(내 목표) / `needed`(실제 필요) / `collectable`(모을 수 있는 돈), 부족분 `gap`, 완료 시점 |
| `scenarios.A`, `scenarios.B` | 규칙별 목표 완성 개월(`done`)·라벨(`doneLabels`)·`milestones[]`·독립 직후 비상자금(`emergencyAtMove`)·`thinMonths`·기한 시점 부족분(`atDeadline`) |
| `comparison` | A·B 비교: B가 몇 개월 빠른지, B의 비상자금 보호가 얇은 기간, `safer`, 한 줄 문장 |
| `budget` | 개인화 결과 (아래) |
| `recommended` | 개인화 계획대로 모을 때의 규칙 A·B 결과 |
| `savings[]` | 절약 항목 누적 → 앞당겨지는 개월 (규칙 A) |
| `diagnosis` | 버틸 수 있는 기간, 저축률, 빚 완납 시점 |
| `text[]` | 화면에 바로 쓸 수 있는 개인화 문장 |
| `usedDefaults` | 모른다고 답해서 기준값으로 채운 항목 (화면에 "기준값 사용" 표시용) |

## 개인화 규칙 (`budget`)

1. **필요 저축**: 기한 순으로 "그때까지 필요한 돈 − 모아둔 돈"을 기한 개월 수로 나눠 매달 필요한 돈과 월급 대비 비율(`required`)을 구합니다. 비상자금은 첫 기한까지 채우는 것으로 봅니다.
2. **판정** (`verdict`)
   - `on_track`: 지금 저축으로 충분
   - `cut_spending`: 줄일 수 있다고 답한 지출을 줄이면 가능 (`plan.cutNeeded`)
   - `extend`: 저축 여력(지금 저축 + 줄일 수 있는 지출, 월급의 상한 비율 이내)으로는 무리 → 그 속도로 기간을 늘림 (`period.from → to`)
   - `no_room`: 저축 여력이 없음
3. **생활비 상한**: `월급 − 계획 저축 − 월세·관리비` = `plan.livingMax` (월세 외 모든 지출의 상한)
4. **월세 부담**: 월세·관리비가 월급의 상한 비율을 넘거나 독립 후 저축률이 최소 기준보다 낮으면 `burdenHigh`. 비상자금을 `+1개월치` 더 쌓도록 목표를 키워 기간이 늘어납니다. 독립 후 저축을 지키는 월세 상한은 `housing.affordable.max`입니다.
5. 모든 판단 문장의 이유는 `reasons[]`에 담깁니다.

## 규칙 A·B

- **A**: 비상자금 전부 → 나머지 목표(기한 급한 순) → 투자(남는 돈, 월 배분액까지만)
- **B**: 비상자금 50%(`partialEmergencyRatio`) → 나머지 목표 → 남은 비상자금 → 투자
- 주거 목표가 완성되면(독립) 그 뒤 저축은 `cashflow.after.save`로 계산합니다.
- 정하은 정답지(`docs/demo-persona.md` 4-4)와 같은 숫자가 `tests/plan.test.js`에서 확인됩니다.
  A: 비상자금 1개월·주거 17개월 / B: 주거 12개월, 독립 직후 비상자금 356, 32개월에 완성.

## 가정과 한계 (팀 확인 필요)

- 독립 후 변동 생활비는 프로필에 없어서 기본은 지금과 같게 봅니다. 정답지의 105 → 100은 `buildPlan(profile, { assumptions: { variableAfterDelta: -5 } })`로 넣습니다.
- 지역별 시세는 `config.defaults.byRegion`이 비어 있어 전국 공통 기준값을 씁니다. (결정 #5, 지역 데이터는 3번)
- 이사·초기 비용, 한도 비율, 비상자금 개월 수는 전부 출처 확인 전 초안입니다. (결정 #2, #4)
- 전세 대출 이자, 학자금 완납 후 늘어나는 저축은 시뮬레이션에 넣지 않았습니다. (`diagnosis.debt`로 완납 시점만 안내)

## 화면 연결

| 화면 | 쓰는 것 |
| --- | --- |
| `/map` 위쪽 "자금 배분" (`components/flow/MoneyOrder.js`) | `plan.recommended.A/B`, `plan.budget.planGoals`, `plan.fixes`. 규칙 A·B를 고르지 않고 나란히 보여줌 |
| `/map` "실행 로드맵" 단계 카드 (`FinancialMap.js`) | `buildPlanRoadmap(plan, policies)`. 단계 id가 `data/policies.json`의 `step`과 같아 정책이 붙음 |
| `/report`, 지도의 "맞춤 리포트 받기" 팝업 | `ReportSheet({ plan, demo })`. 프로필은 `components/report/usePlan.js`가 `loadProfile()`로 읽고, 없으면 시연 인물 |

- 지도 단계의 완료 표시는 `localStorage`의 `finpath.plan-done`에 저장합니다.
- 옛 `computeReport.js`·`demoPersona.js`는 화면에서 쓰지 않지만 옛 테스트가 있어 남겨 두었습니다.
