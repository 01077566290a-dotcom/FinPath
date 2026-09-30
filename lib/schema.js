export const EVENTS = { EMPLOYMENT: '취업', SALARY: '월급', INDEPENDENCE: '독립', HOUSING: '주거계약', LOAN: '대출' };
export const STATUSES = { yes: '현재·이미 발생', planned: '예정', no: '해당 없음', uncertain: '미정' };
const options = entries => entries.map(([value, label]) => ({ value, label }));
export const SLOTS = {
  employment_timing: { label: '입사 시기', options: options([['upcoming', '입사 예정'], ['lt1y', '입사 1년 미만'], ['y1_3', '입사 1~3년'], ['gt3y', '입사 3년 초과']]) },
  salary_timing: { label: '월급 시기', options: options([['received', '이미 받음'], ['this_month', '이번 달 예정'], ['later', '다음 달 이후']]) },
  monthly_income: { label: '월소득', options: options([['lt200', '200만원 미만'], ['200_300', '200~300만원'], ['gt300', '300만원 초과']]) },
  move_timing: { label: '독립 시기', options: options([['m3', '3개월 이내'], ['m6', '3개월 초과~6개월 이내'], ['y1', '6개월 초과~1년 이내'], ['undecided', '미정']]) },
  housing_type: { label: '주거 형태', options: options([['monthly', '월세'], ['jeonse', '전세'], ['undecided', '미정']]) },
  savings: { label: '저축액', options: options([['none', '없음'], ['lt500', '500만원 미만'], ['500_2000', '500~2,000만원'], ['gt2000', '2,000만원 초과']]) },
  contract_timing: { label: '계약 예정 시기', options: options([['m1', '1개월 이내'], ['m3', '1개월 초과~3개월 이내'], ['m6', '3개월 초과~6개월 이내'], ['undecided', '미정']]) },
  deposit: { label: '보증금', options: options([['lt1000', '1,000만원 미만'], ['1000_5000', '1,000~5,000만원'], ['gt5000', '5,000만원 초과'], ['undecided', '미정']]) },
  loan_type: { label: '대출 종류', options: options([['housing', '주거'], ['student', '학자금'], ['credit', '신용'], ['other', '기타'], ['undecided', '미정']]) },
  loan_amount: { label: '대출 금액', options: options([['lt1000', '1,000만원 미만'], ['1000_5000', '1,000~5,000만원'], ['gt5000', '5,000만원 초과'], ['undecided', '미정']]) },
};
// 금액 단위: 만원. 중간 구간은 양 끝을 포함하며 gt*는 상한 초과.
export const MONEY_BOUNDS = { monthly_income: [200, 300], savings: [500, 2000], deposit: [1000, 5000], loan_amount: [1000, 5000] };
export function moneyBucket(slot, amount) {
  if (!Number.isFinite(amount) || amount < 0 || !MONEY_BOUNDS[slot]) return null;
  if (slot === 'savings' && amount === 0) return 'none';
  const [low, high] = MONEY_BOUNDS[slot];
  return amount < low ? `lt${low}` : amount <= high ? `${low}_${high}` : `gt${high}`;
}
export const emptySlots = () => Object.fromEntries(Object.keys(SLOTS).map(key => [key, null]));
export const slotLabel = (key, value) => SLOTS[key]?.options.find(option => option.value === value)?.label || '미확인';
// 질문과 수정 선택지가 모두 같은 제약을 사용합니다.
export function availableOptions(key, events = {}) {
  return SLOTS[key].options.filter(({ value }) => {
    if (key === 'employment_timing') {
      if (events.EMPLOYMENT?.status === 'yes') return value !== 'upcoming';
      if (events.EMPLOYMENT?.status === 'planned') return value === 'upcoming';
    }
    if (key === 'salary_timing') {
      if (events.SALARY?.status === 'yes') return value === 'received';
      if (events.SALARY?.status === 'planned') return value !== 'received';
    }
    return true;
  });
}
