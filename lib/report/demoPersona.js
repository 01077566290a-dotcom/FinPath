// 시연 인물 정하은의 입력값 (docs/demo-persona.md). 금액 단위: 만 원.
// 입력 화면(①~③)과 리포트 편집 패널이 같은 형태로 값을 넘깁니다. 형태 검증은 normalizeReportInput에서 합니다.
// [가정] 표시는 팀 결정·출처 확인 전 임시값입니다.
export const DEMO_PERSONA = {
  asOf: { year: 2026, month: 10 },
  profile: {
    name: '정하은',
    age: 27,
    employment: 'regular',
    tenure: '입사 1년 차',
  },
  region: '서울 마포구',
  purposes: ['housing', 'emergency'],
  // ① 목표: 사용자가 생각한 목표
  goal: { amount: 1500, months: 12 },
  // ① 내 돈 상황 (고정지출에는 빚 상환액이 포함됩니다)
  money: {
    income: 245,
    fixedNow: 67,
    fixedAfter: 60, // 독립하면 교통비 13 → 6
    livingNow: 105,
    livingAfter: 100, // [가정] 공과금·장보기는 늘고 외식은 줄어든다고 봄
    saved: 680,
    debt: { label: '학자금 대출', balance: 420, monthly: 15 },
  },
  // ③ 주거 (월세)
  housing: {
    type: 'monthly',
    deposit: 1000,
    monthlyCost: 68, // 월세 60 + 관리비 8
    moveInMonths: 11,
    loan: 0,
    initialCost: 200, // [가정] [C 확인] 중개수수료 28 + 이사비 30 + 가전·가구 142
  },
  emergency: { months: 3 }, // [가정] 결정 #2 전 임시값 (정규직 3개월)
  // 아낄 수 있는 것 (위에서부터 누적해서 줄입니다)
  savingCuts: [
    { id: 'phone', label: '통신비 알뜰폰으로 바꾸기', cut: 5 },
    { id: 'subs', label: '구독 3개 정리하기', cut: 3 },
    { id: 'eatout', label: '외식·쇼핑 줄이기', cut: 20 },
  ],
};
