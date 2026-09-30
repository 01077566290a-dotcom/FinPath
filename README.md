# FinPath · 1·2단계 정보 수집 데모

자연어 → 이벤트·슬롯 추출 → 검증·병합 → 규칙 엔진 → 부족한 정보 → 선택형 질문을 검증하는 데모입니다. **이번 기본 화면은 타임라인을 생성하지 않습니다.**

## 실행

Next.js App Router, JavaScript, React를 사용합니다. Node.js 22 이상을 권장합니다.

```sh
npm ci
npm run dev
```

<http://localhost:3000>에서 확인합니다. `npm run build`로 운영 빌드, `npm start`로 빌드 실행, `npm test`로 테스트합니다. 설치 버전은 package-lock.json에 고정됩니다.

## 함께 작업하기

1. `main`에 직접 push하지 않고, 작업마다 브랜치를 만듭니다. 예: `git switch -c feature/map-screen`
2. 커밋 전에 `npm test`가 통과하는지 확인합니다.
3. GitHub에서 `main`으로 Pull Request를 열고, 팀원 리뷰 후 병합합니다.
4. 작업을 시작하기 전에 `git switch main && git pull`로 최신 상태를 받습니다.

줄바꿈은 `.gitattributes`로 LF에 고정되어 Windows·Mac 간 차이가 diff에 나타나지 않습니다. 디자인 목업(`FinPath_design_mockup/`)은 저장소에 포함하지 않으므로 팀 내에서 따로 공유합니다.

## 데모 확인

1. ‘취업 + 독립’ 예시를 선택하고 분석합니다.
2. 취업·독립·주거계약과 입사 예정·독립 시기·월세·저축액을 확인합니다.
3. 이미 확보한 정보는 제외하고 월소득 → 계약 시기 → 보증금에 답합니다.
4. 공유 월소득을 한 번만 묻고, 수집 완료 시 질문이 사라집니다.
5. ‘현재 JSON 보기’와 ‘추출 결과 · 규칙 판단 보기’에서 근거를 확인합니다.

이벤트 상태와 확보한 슬롯은 직접 수정할 수 있습니다. 슬롯을 ‘다시 확인하기’로 비우면 필요한 경우 다시 질문합니다. ‘새 입력으로 다시 분석’은 이전 답변을 초기화해 새 세션으로 분석합니다. ‘처음부터’는 입력과 결과를 모두 초기화합니다.

## 폴더와 역할

```text
app/
  layout.js / page.js / globals.css   App Router 진입점과 스타일
  legacy/[[...path]]/route.js          기존 타임라인 데모 정적 라우트
components/
  Demo.js                            프론트 상태와 흐름 연결
  InputPanel.js                      자연어 입력·예시
  UnderstandingPanel.js              추출 정보와 직접 수정
  QuestionPanel.js                    한 번에 한 질문
  ResultPanel.js                      완료·보류·해당 없음
  DebugPanel.js                       규칙 근거와 JSON
lib/
  schema.js                          enum·선택지·금액 경계값
  extractors/index.js                 extract(text), adapter 교체 지점
  extractors/ruleExtractor.js         자연어 → events + slots만 담당
  validator.js                       validateExtraction: 값 검증
  state.js                           createInitialState, mergeExtraction, applyAnswer
  rules.js                           EVENT_RULES, SLOT_PRIORITY, evaluateRules
  questions.js                       고정 QUESTIONS, selectNextQuestion
  pipeline.js                        analyzeInput: 해석 → 검증 → 병합
tests/
  collection.test.js                 10개 예시·통합 흐름·경계 테스트
  timeline.test.js                   기존 타임라인 회귀 테스트
```

## 데이터 흐름과 계약

```text
extract(text) → validateExtraction → mergeExtraction
                                         ↓
                                   evaluateRules
                                         ↓
                                selectNextQuestion
                                         ↓
                                    applyAnswer
                                         └── evaluateRules로 반복
```

해석기 반환은 `{ events: [{ type, status, evidence }], slots: { ... } }`입니다. 슬롯은 schema의 enum 또는 null만 허용합니다. UI 상태의 meta는 확인한 미정 이벤트와 정보 출처를 기록하며 해석기 반환 계약에는 포함되지 않습니다.

## 보완한 정책

- **미정 반복 방지:** uncertain 상태는 슬롯보다 먼저 확인합니다. 다시 미정을 선택하면 해당 이벤트를 보류하고 다른 확정 이벤트를 계속 수집합니다. 미정 이벤트가 남으면 전체 완료가 아닌 보류로 표시합니다. 상태를 수정하면 다시 계산합니다.
- **미인식 / 해당 없음 / 완료 구분:** 이벤트가 없으면 재입력을 안내합니다. 모두 no이면 추가 정보 없음, 활성 이벤트의 필요 슬롯을 모두 확보하면 완료입니다.
- **질문 누락 방지:** salary_timing을 우선순위에 추가했습니다. 모든 규칙 슬롯에 질문과 우선순위가 존재하는지 테스트합니다.
- **이미 발생한 주거계약:** HOUSING yes는 주거 형태·보증금·저축을 확인하며 계약 예정 시기는 묻지 않습니다.
- **금액 경계:** 단위는 만원. 소득 `<200`, `200~300(양 끝 포함)`, `>300`. 저축 `0`, `0초과~500미만`, `500~2000(포함)`, `>2000`. 보증금·대출 `<1000`, `1000~5000(포함)`, `>5000`. 따라서 5000만원 대출은 1000_5000입니다.
- **명시 정보만 연결:** 전세대출만으로 주거계약 이벤트를 만들지 않습니다. 이사 시기를 계약 시기로 복사하지 않습니다. upcoming은 ‘입사 예정’으로 표시하며 정밀한 날짜로 과장하지 않습니다.
- **공유 슬롯:** 전체 상태에 한 번만 저장합니다. 이벤트를 no로 바꾸면 해당 이벤트의 질문은 사라지지만 공유 정보는 유지합니다.
- **미정 슬롯:** undecided도 유효한 답변입니다. 정보 수집 완료가 계획 확정을 뜻하지는 않으며 최종 JSON에 미정이 그대로 남습니다.

## AI 해석기로 교체

lib/extractors/aiExtractor.js에서 동일한 비동기 반환 계약을 구현한 뒤 lib/extractors/index.js의 adapter만 바꿉니다. createExtractor(adapter)로 입력 검사를 재사용합니다. 비동기 mock adapter를 주입하는 통합 테스트가 포함되어 있습니다.

실제 API 키와 SDK 호출은 Next.js 서버 라우트에 두고, aiExtractor가 해당 라우트를 호출하도록 구현해야 합니다. 현재 버전에는 AI 호출·키·서버 수집 엔드포인트가 없습니다.

## 범위와 한계

- DB·로그인·외부 API·상품 추천·뉴스·알림 없음. 정보 수집 데모는 메모리 상태만 사용하며 새로고침하면 초기화됩니다.
- 규칙 해석은 제공된 문장과 일반적인 표현을 지원하는 구조 검증용입니다. 복잡한 부정 범위, 여러 인물·시점, 모호하거나 충돌하는 진술을 완전히 이해하지 않습니다. 화면에서 직접 수정할 수 있습니다.
- 동일 이벤트가 여러 절에 등장하면 마지막 언급을 사용합니다. 슬롯의 새 명시값은 기존 값을 갱신하고 null 추출은 기존 답변을 지우지 않습니다.
- 저축만 말하면 저축 슬롯은 확보하되, 이벤트가 없으므로 수집 완료로 처리하지 않습니다.
- 입사 기간은 3년 초과까지 구분합니다. 독립 1년 이내·계약 6개월 이내의 구간은 유지하며 그 밖의 계획은 schema와 해석 규칙을 함께 확장해야 합니다.

데모1 오분류 보완과 아직 지원하지 않는 이벤트 후보는 [엔진 점검 기록](docs/demo1-engine-review.md)에 정리했습니다. 향후 화면은 자연어 입력 → 다음 화면에서 해석 결과와 추가 정보 수집으로 나누며, 이번 엔진 점검에서는 화면 전환을 변경하지 않았습니다.

## 기존 타임라인 데모

이전 index.html, src/, server.mjs는 보존했습니다. Next.js 실행 중 <http://localhost:3000/legacy>에서 확인하거나 `npm run legacy`로 <http://localhost:5173>에서 별도 실행합니다. 기존 데모만 localStorage를 사용하며 새 정보 수집 데모와 연결하지 않습니다. 이전 설명은 docs/legacy.md에 있습니다.
