// 시연 인물 정하은의 입력값 (docs/demo-persona.md, PR #7). 금액 단위: 만 원.
// 엔진(A)의 입력 데이터 구조가 정해지면 이 형태를 그 구조에 맞춥니다.
// [가정] 표시는 팀 결정·출처 확인 전 임시값입니다.
export const DEMO_PERSONA = {
  asOf: { year: 2026, month: 10 },
  profile: {
    name: '정하은',
    age: 27,
    job: '중소 콘텐츠 회사 마케팅팀',
    employment: 'regular',
    tenure: '입사 1년 차',
    home: '경기 고양시 (부모님 집)',
  },
  // ① 목표와 내 돈 상황
  goal: { amount: 1500, months: 12 },
  money: {
    income: 245,
    fixed: [
      { label: '통신비', now: 9, after: 9 },
      { label: '구독', now: 3, after: 3 },
      { label: '보험', now: 7, after: 7 },
      { label: '교통비', now: 13, after: 6 },
      { label: '부모님 용돈', now: 20, after: 20 },
      { label: '학자금 상환', now: 15, after: 15 },
    ],
    variable: { now: 105, after: 100 }, // [가정] 독립 후 변동 생활비
    saved: 680,
    debts: [{ label: '학자금 대출', balance: 420, monthly: 15 }],
  },
  // ② 지역과 목적
  region: '서울 마포구',
  purposes: ['housing', 'emergency'],
  // ③ 목적별 상세 정보
  housing: {
    type: 'monthly',
    deposit: 1000,
    rent: 60,
    maintenance: 8,
    moveInMonths: 11,
    loan: 0,
    // [가정] [C 확인] 이사·초기 비용은 서비스가 추정
    initialCosts: [
      { label: '중개수수료', amount: 28 },
      { label: '이사비', amount: 30 },
      { label: '가전·가구·생활용품', amount: 142 },
    ],
  },
  emergency: { months: 3 }, // [가정] 결정 #2 전 임시값 (정규직 3개월)
  // 리포트 '아낄 수 있는 것': 위에서부터 누적해서 줄입니다.
  savingCuts: [
    { label: '통신비 알뜰폰으로 바꾸기', short: '통신비', cut: 5 },
    { label: '구독 3개 정리하기', short: '구독', cut: 3 },
    { label: '외식·쇼핑 줄이기', short: '외식·쇼핑', cut: 20 },
  ],
};
