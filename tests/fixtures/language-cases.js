// 데모1 회귀 데이터: 모호한 정보의 기대값 null은 의도적인 재질문입니다.
// 새 표현은 구현보다 먼저 이 목록에 기대 결과와 함께 추가합니다.
export const languageCases = [
  // 진행 중인 상환·자취는 현재(yes)로 봅니다. '준비하고 있어요'는 여전히 미정입니다.
  { text: '학자금 대출을 갚고 있어요.', events: { LOAN: 'yes' }, slots: { loan_type: 'student' } },
  { text: '대출 1500만원 상환 중이에요.', events: { LOAN: 'yes' }, slots: { loan_amount: '1000_5000' } },
  {
    text: '월세로 자취하고 있어요.',
    events: { INDEPENDENCE: 'yes', HOUSING: 'yes' },
    slots: { housing_type: 'monthly' },
  },
  { text: '독립을 준비하고 있어요.', events: { INDEPENDENCE: 'uncertain' }, slots: {} },
  // 조사 '이·일·사·오'를 숫자로 읽지 않습니다. (예: 대출이 2천 → 22,000만원으로 오인하던 버그)
  { text: '학자금 대출이 2천 정도 남아 있어요.', events: { LOAN: 'yes' }, slots: { loan_amount: '1000_5000' } },
  { text: '월급이 삼백만원이에요.', events: { SALARY: 'uncertain' }, slots: { monthly_income: '200_300' } },
  // 고용 형태는 후속 질문을 줄이기 위해 문장에서도 찾습니다.
  {
    text: '계약직으로 6개월 일하게 됐어요.',
    events: { EMPLOYMENT: 'yes' },
    slots: { employment_type: 'contract' },
  },
  { text: '프리랜서로 일하고 있어요.', events: { EMPLOYMENT: 'yes' }, slots: { employment_type: 'freelance' } },
  { text: '정규직으로 다음 달 입사해요.', events: { EMPLOYMENT: 'planned' }, slots: { employment_type: 'regular' } },
  {
    text: '월급 260만원인데 6개월 뒤 독립하려고 해요.',
    events: { SALARY: 'uncertain', INDEPENDENCE: 'planned' },
    slots: { monthly_income: '200_300', salary_timing: null, move_timing: 'm6' },
  },
  {
    text: '보증금 1억원인데 대출은 없어요.',
    events: { HOUSING: 'uncertain', LOAN: 'no' },
    slots: { deposit: 'gt5000' },
  },
  { text: '매달 50만원 모아두고 있어요.', events: {}, slots: { savings: null } },
  {
    text: '이번 달 첫 월급 260만원 받았어요.',
    events: { SALARY: 'yes' },
    slots: { salary_timing: 'received', monthly_income: '200_300' },
  },
  {
    text: '취업했는데 다음 달 독립할 예정이에요.',
    events: { EMPLOYMENT: 'yes', INDEPENDENCE: 'planned' },
    slots: { employment_timing: null, move_timing: 'm3' },
  },
  {
    text: '월급은 260만원이고 대출은 안 받을 거예요.',
    events: { SALARY: 'uncertain', LOAN: 'no' },
    slots: { monthly_income: '200_300' },
  },
  { text: '저축은 매달 50만원 하고 있어요.', events: {}, slots: { savings: null } },
  { text: '저축은 500만원 있어요.', events: {}, slots: { savings: '500_2000' } },
  { text: '입사 13년 차예요.', events: { EMPLOYMENT: 'yes' }, slots: { employment_timing: 'gt3y' } },
  { text: '입사 12개월 차예요.', events: { EMPLOYMENT: 'yes' }, slots: { employment_timing: 'y1_3' } },
  { text: '입사 11개월 차예요.', events: { EMPLOYMENT: 'yes' }, slots: { employment_timing: 'lt1y' } },
  { text: '입사 36개월 차예요.', events: { EMPLOYMENT: 'yes' }, slots: { employment_timing: 'y1_3' } },
  { text: '월급 250~350만원 예상해요.', events: { SALARY: 'uncertain' }, slots: { monthly_income: null } },
  { text: '월급 250만원~350만원 예상해요.', events: { SALARY: 'uncertain' }, slots: { monthly_income: null } },
  {
    text: '월급 260만 받고 있어요.',
    events: { SALARY: 'yes' },
    slots: { salary_timing: 'received', monthly_income: '200_300' },
  },
  { text: '내년 2월에 독립할 예정이에요.', events: { INDEPENDENCE: 'planned' }, slots: { move_timing: null } },
  { text: '1년 뒤 독립할 예정이에요.', events: { INDEPENDENCE: 'planned' }, slots: { move_timing: 'y1' } },
  {
    text: '전세대출은 안 받고 월세로 자취하려고 해요.',
    events: { LOAN: 'no', INDEPENDENCE: 'planned', HOUSING: 'planned' },
    slots: { housing_type: 'monthly' },
  },
  { text: '퇴사했어요.', events: {}, slots: {} },
];
