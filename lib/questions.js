import { EVENTS, SLOTS, availableOptions } from './schema.js';
const texts = {
  employment_timing: '입사 시기는 어느 쪽에 해당하나요?',
  salary_timing: '월급은 언제 받았거나 받을 예정인가요?',
  monthly_income: '현재 또는 예상 월소득은 어느 정도인가요?',
  move_timing: '언제쯤 독립할 계획인가요?',
  housing_type: '월세와 전세 중 생각해 둔 형태가 있나요?',
  savings: '현재 모아 둔 돈은 어느 정도인가요?',
  contract_timing: '주거 계약은 언제 할 예정인가요?',
  deposit: '현재 또는 예상 보증금은 어느 정도인가요?',
  loan_type: '어떤 종류의 대출인가요?',
  loan_amount: '현재 또는 예상 대출 금액은 어느 정도인가요?',
};
export const QUESTIONS = Object.fromEntries(
  Object.keys(SLOTS).map(key => [key, { kind: 'slot', key, text: texts[key], options: SLOTS[key].options }]),
);
export function eventQuestion(type) {
  return {
    kind: 'event',
    key: type,
    text: `현재 ${EVENTS[type]} 상태와 가장 가까운 것은 무엇인가요?`,
    options: [
      { value: 'yes', label: '이미 발생·현재 진행 중' },
      { value: 'planned', label: '예정·계획 있음' },
      { value: 'uncertain', label: '준비 중·미정 (보류)' },
      { value: 'no', label: '아직 하지 않음·해당 없음' },
    ],
  };
}
export function selectNextQuestion(result) {
  if (result.pendingEvents.length) return eventQuestion(result.pendingEvents[0]);
  const key = result.missingSlots[0];
  return key
    ? { ...QUESTIONS[key], options: availableOptions(key, result.events), requiredBy: result.requiredBy[key] }
    : null;
}
