# v4 입력·정책 (1번) 작업 안내

## 들어간 것

| 파일 | 내용 |
| --- | --- |
| `lib/goal/questions.js` | 공통 질문 12개 + 목적별 추가 질문. 건너뛰기·분기 규칙(`when`) 포함 |
| `lib/goal/engine.js` | 다음 질문 고르기, 답 검증, 답 고치기, 프로필 JSON 만들기, 프로필 검사 |
| `lib/goal/store.js` | localStorage 저장 (`finpath.answers`, `finpath.profile`) |
| `lib/goal/policies.js` | 목적·지역·나이·주거 형태로 정책 거르기, step별 묶기 |
| `data/policies.json` | 손으로 정리한 시연용 정책 5개 (확인 기준일 포함) |
| `scripts/fetch-policies.mjs` | 온통청년 API로 정책 받아 합치기 (인증키 승인 후 사용) |
| `components/goal/GoalQuestions.js`, `app/goal/page.js` | `/goal` 입력 화면, 답변 확인·고치기, 맞춤 정책 목록 |
| `tests/goal-engine.test.js`, `tests/policies.test.js` | 시연 인물 기준 테스트 |

## 2·3번이 쓰는 법

```js
import { loadProfile } from '../lib/goal/store.js';
import { validateProfile } from '../lib/goal/engine.js';
import { filterPolicies, groupByStep } from '../lib/goal/policies.js';
import policyData from '../data/policies.json';

const profile = loadProfile(); // 질문을 다 마쳤으면 객체, 아니면 null
const problems = validateProfile(profile); // [] 이면 정상
const byStep = groupByStep(filterPolicies(profile, policyData));
```

프로필 규칙
- 금액은 전부 만 원 단위 정수예요.
- `money.fixed`는 **빚 상환액을 포함한** 매달 고정지출 합계예요. 항목별 값은 `money.fixed_items`(빚 상환액 제외)에 있어요.
- `money.variable`(변동 생활비)은 묻지 않고 `월급 − 고정지출 − 지금 저축액`으로 계산해요.
- 빚이 없으면 `money.debt`는 `null`이에요.
- "모름"은 값이 `null`이고 그 질문 id가 `unknowns`에 들어가요.
- 고르지 않은 목적은 `detail`에 없어요. 비상자금은 추가 질문이 없어서 `detail.비상자금`은 빈 객체예요.
- 입주·결혼 시기는 `"2027-09"` 형식이고, 기준 달(`base_month`)부터의 개월 수(`move_in_months`, `wedding_months`)도 같이 넣어요.
- 주거가 월세면 `rent`(월세)와 `maintenance`(관리비)가 따로 있어요. 교통비를 적은 사람에게는 독립 후 교통비(`commute_after`)를 추가로 물어요.

## 시연 인물 정하은 (docs/demo-persona.md)

`tests/goal-engine.test.js`에 정하은의 답이 그대로 들어 있어요. 이 답으로 만든 프로필은 시연 문서와 같은 숫자가 나와요.
고정지출 67(항목 52 + 학자금 15), 변동 생활비 105, 모아둔 돈 680, 입주까지 11개월, 월세+관리비 68, 독립 후 교통비 6.

## 2번과 맞춰야 할 것

정책의 `step` 값을 타임라인 단계 이름과 맞춰주세요. 지금은 임시로 `housing_budget`(주거비 정하기), `housing_deposit`(보증금 마련), `saving_method`(저축 방법)를 쓰고 있어요.

## 정책 데이터

- `data/policies.json`: 화면이 쓰는 확정 목록 11개 (공식 안내·보도자료로 확인, 확인 기준일 포함). 정하은 기준으로 10개가 나와요.
- `step` 임시 값: `housing_budget`(주거비), `housing_deposit`(보증금·대출), `move_in_cost`(이사·초기 비용), `contract_check`(계약 전 확인), `housing_search`(집 찾기), `saving_method`(저축 방법). 2번 타임라인 단계 이름에 맞춰 바꿔주세요.

## 보조금24 API

정부 부처·지자체 혜택을 모은 보조금24 API(공공데이터포털, 자동승인)로 청년 주거·저축 혜택을 받아와요.

- `scripts/fetch-policies.mjs`: 목록 전체(약 1만 건)를 받아 키워드로 1차로 고르고, 후보마다 지원조건에서 나이(JA0110/JA0111)를 받아 청년 대상만 남겨요. 결과는 `data/policies-gov24.json`.
- `lib/goal/gov24.js`: 응답 항목을 정책 형식으로 바꿔요. 지역은 소관기관명(예: 서울특별시 마포구)에서, 단계(step)는 이름 키워드로 정해요.
- 화면은 손으로 확인한 `data/policies.json`을 먼저 보여주고, API 항목은 이름이 겹치지 않을 때만 뒤에 붙여요. API 항목에는 "보조금24에서 가져옴"이 표시돼요.
- 처음에는 `data/policies-gov24.json`이 비어 있어서, API를 안 돌려도 화면은 그대로 동작해요.

실행

1. 공공데이터포털 마이페이지 → 활용신청 상세 → 일반 인증키(Decoding) 복사
2. 저장소 루트 `.env`에 `GOV24_API_KEY=키` (`.env`는 저장소에 안 올라가요)
3. `node scripts/fetch-policies.mjs` → 만들어진 `data/policies-gov24.json`을 커밋

승인 직후 1~2시간(길게는 24시간)은 인증 오류가 날 수 있어요. 오류가 나면 기존 파일은 그대로 둬요.
브라우저에서 API를 직접 부르지 않아요. GitHub Pages에서는 인증키가 그대로 노출되기 때문이에요.

## 2차 다듬기 (질문 상세화 · 입력 화면 · 정책 지역)

### 목적을 더 자세히 묻는 질문 (enrich)

계산에 꼭 필요하진 않지만 목적을 정확히 파악하고 정책을 고르는 데 쓰는 질문이에요. 화면에서는 순서대로 묻지만, 답이 없어도 프로필은 만들어져요(`isComplete`가 enrich 질문은 건너뜀). 그래서 기존 시연 데이터와 테스트는 그대로 동작해요.

| 질문 id | 단계 | 내용 | 프로필 위치 |
| --- | --- | --- | --- |
| `debt_type` | ① | 빚 종류 (학자금 대출, 신용대출, 카드론·현금서비스, 기타) | `money.debt.type` |
| `work_years` | ① | 일한 기간 (입사 전, 1년 미만, 1~3년, 3년 이상) | `work_years` |
| `living_now` | ② | 지금 사는 형태 (부모님 집, 월세, 전세, 기숙사·기타) | `living_now` |
| `emergency_reason` | ③ 비상자금 | 대비 상황 (일을 쉬거나 이직할 때, 갑작스러운 지출, 둘 다) | `detail.비상자금.reason` |
| `housing_goal` | ③ 주거 | 주거 계획 (첫 독립, 이사, 내 집 마련). 내 집 마련이면 집 형태를 매매로 정하고 다시 묻지 않음 | `detail.주거.housing_goal` |

- 목적 선택지마다 한 줄 설명이 붙어요 (예: 비상자금 "갑자기 일을 쉬거나 큰 지출이 생겨도 버틸 돈").
- 빚이 있으면 "빚 상환"을 고르지 않아도 빚 관련 지원(학자금 이자 지원 등)이 정책 목록에 나와요.

### 입력 화면

- 지역: 시·도를 고르면 그 시·도의 시·군·구 목록에서 고르게 바꿨어요. 목록에 없는 이름은 받지 않아요. 목록은 `lib/goal/regions.js` (보조금24 지역 판별과 같이 씀).
- 빠른 선택: 금액·기간 질문 아래에 자주 쓰는 값 버튼이 있어요 (예: 월급 200만·250만·300만·350만). 누르면 값이 채워지고 "다음"으로 넘어가요.
- 읽어 주기: 금액을 입력하면 "1,500만 원 = 15,000,000원", 기간은 "36개월 → 3년"처럼 바로 보여줘요. 원 단위로 잘못 입력하는 실수를 잡기 좋아요.
- 진행 표시: 위쪽 ①~⑤ 단계 막대 하나로 합쳤어요. 지금 단계 막대가 답한 만큼 차고 "3/7"이 같이 보여요. (이전 흐름 보기에서는 예전 막대 그대로)

### 정책 지역 판별

- 보조금24 서비스ID 앞 7자리는 소관기관의 행정기관코드예요. 앞 3자리로 시·도를 먼저 정하고(예: 484… 광양시 → 전남, 646… 전라남도), 시·군·구 기관이면 이름에서 시·군·구를 찾아요.
- 코드가 없는 기관(중앙부처, 공공기관)은 소관기관명으로 정하고, 지자체인데 시·도를 모르면 수집에서 빼요.
- 이미 받아둔 `data/policies-gov24.json`은 이 규칙으로 고쳐 두었어요 (`repaired_at`). 전국으로 잘못 들어가 있던 전남·광주·강원 정책 20여 건이 제 지역으로 옮겨졌고, 주거·저축과 관계없는 10건(육아용품, 영농 등)은 뺐어요.
