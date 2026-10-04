// 리포트 점수와 비교에 쓰는 기준값. 값마다 출처와 기준 시점을 같이 둡니다.
// 원칙(기획안 v4 3. 원칙): 팀이 출처를 확인한 기준으로만 비교하고, 초안이면 '일반적으로'라고 씁니다.
// 값을 바꿀 때는 source·asOf도 함께 고치고, tests/score.test.js의 기대값을 확인해 주세요.

export const BENCHMARKS = {
  // 청년 가구가 매달 남기는 돈의 비율 (흑자액 ÷ 소득)
  youthSaveRate: {
    value: 24.7,
    unit: '%',
    label: '청년 가구(가구주 39세 이하) 평균',
    detail: '월평균 흑자액 124.3만 원 ÷ 월평균 소득 503.6만 원',
    source: '통계청 가계동향조사 2025년 3분기',
    asOf: '2025년 3분기',
    note: '가구 단위 통계라 1인 가구보다 소득이 커요. 비교용 참고값이에요.',
  },
  // 청년 임차가구의 월소득 대비 월임대료 비율 (RIR, 중위수)
  youthRentRate: {
    value: 16.0,
    unit: '%',
    label: '청년 임차가구 중간값',
    detail: '월소득 대비 월임대료 비율(RIR), 중위수',
    source: '국토교통부 2024년도 주거실태조사',
    asOf: '2024년',
  },
  // 임대료 과부담 기준
  rentBurdenLimit: {
    value: 30,
    unit: '%',
    label: '임대료 과부담 기준',
    detail: '월소득 대비 월임대료가 30%를 넘으면 과부담으로 봐요',
    source: '국토교통부 주거실태조사 RIR 기준',
    asOf: '2024년',
  },
  // 빚 상환 부담: 공식 통계가 아닌 일반적인 권장선이라 초안으로 표시합니다.
  debtRateLimit: {
    value: 20,
    unit: '%',
    label: '일반적인 상환 부담 권장선',
    detail: '매달 갚는 돈이 월급의 20%를 넘지 않게 권해요',
    source: null,
    asOf: null,
    draft: true,
  },
};

export const sourceLine = b =>
  b.source
    ? `${b.label} ${b.value}${b.unit} (${b.source})`
    : `${b.label} ${b.value}${b.unit} (일반적인 기준, 출처 확인 중)`;
