// 3단계 규칙 표. 경계값과 귀속 규칙은 여기서만 바꿉니다. 시간 단위: 개월, 상한 포함.
// 금액 경계는 schema.js의 MONEY_BOUNDS를 그대로 사용합니다.
export const TIME_BUCKETS = {
  move_timing: [
    [3, 'm3'],
    [6, 'm6'],
    [12, 'y1'],
  ],
  contract_timing: [
    [1, 'm1'],
    [3, 'm3'],
    [6, 'm6'],
  ],
  employment_tenure: [
    [11, 'lt1y'],
    [36, 'y1_3'],
    [Infinity, 'gt3y'],
  ],
};
// 이 표에 없는 (kind, about) 조합은 버리고 재질문으로 넘깁니다.
// 입사·월급 시기는 이벤트 상태에 따라 값이 달라져서 index.js에서 따로 처리합니다.
export const SLOT_BINDING = [
  { kind: 'time', about: 'INDEPENDENCE', slot: 'move_timing', bucket: 'move_timing' },
  { kind: 'time', about: 'HOUSING', slot: 'contract_timing', bucket: 'contract_timing' },
  { kind: 'time', about: 'EMPLOYMENT', slot: 'employment_timing' },
  { kind: 'time', about: 'SALARY', slot: 'salary_timing' },
  { kind: 'amount', about: 'savings', slot: 'savings' },
  { kind: 'amount', about: 'monthly_income', slot: 'monthly_income' },
  { kind: 'amount', about: 'deposit', slot: 'deposit' },
  { kind: 'amount', about: 'loan_amount', slot: 'loan_amount' },
  { kind: 'choice', about: 'housing_type', slot: 'housing_type' },
  { kind: 'choice', about: 'loan_type', slot: 'loan_type' },
];
// "모르겠어요"류가 금액 슬롯에서 어떤 값이 되는지.
export const UNKNOWN_VALUE = {
  monthly_income: 'unknown',
  savings: 'unknown',
  deposit: 'undecided',
  loan_amount: 'undecided',
};
// 범주형 조각 사전. 두 값 이상 일치하면 모호하므로 채우지 않습니다.
export const CHOICE_DICT = {
  housing_type: [
    [/월세/, 'monthly'],
    [/전세(?!\s*대출)/, 'jeonse'],
  ],
  loan_type: [
    [/전세\s*대출|주택\s*대출|주거\s*대출|주택|주거/, 'housing'],
    [/학자금/, 'student'],
    [/신용/, 'credit'],
  ],
};
