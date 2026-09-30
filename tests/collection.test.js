import test from 'node:test';
import assert from 'node:assert/strict';
import { ruleExtractor, normalizeMoney } from '../lib/extractors/ruleExtractor.js';
import { createExtractor } from '../lib/extractors/index.js';
import { emptySlots, moneyBucket } from '../lib/schema.js';
import { validateExtraction } from '../lib/validator.js';
import { createInitialState, applyAnswer, mergeExtraction } from '../lib/state.js';
import { evaluateRules, EVENT_RULES, SLOT_PRIORITY } from '../lib/rules.js';
import { selectNextQuestion, QUESTIONS, eventQuestion } from '../lib/questions.js';
import { analyzeInput } from '../lib/pipeline.js';

const examples = [
  ['이번에 취업했어요.', { EMPLOYMENT: 'yes' }, {}],
  ['아직 취업은 못 했어요.', { EMPLOYMENT: 'no' }, {}],
  ['취업 준비 중인데 곧 될 것 같아요.', { EMPLOYMENT: 'uncertain' }, {}],
  ['다음 달에 입사해요.', { EMPLOYMENT: 'planned' }, { employment_timing: 'upcoming' }],
  ['첫 월급 260만 원 받았어요.', { SALARY: 'yes' }, { salary_timing: 'received', monthly_income: '200_300' }],
  ['취업하면 독립하고 싶어요.', { EMPLOYMENT: 'planned', INDEPENDENCE: 'planned' }, {}],
  ['반년 뒤쯤 월세로 자취하려고 해요. 천만 원 정도 모아뒀어요.', { INDEPENDENCE: 'planned', HOUSING: 'planned' }, { move_timing: 'm6', housing_type: 'monthly', savings: '500_2000' }],
  ['입사 2년 차고 전세로 이사하려고 해요.', { EMPLOYMENT: 'yes', INDEPENDENCE: 'planned', HOUSING: 'planned' }, { employment_timing: 'y1_3', housing_type: 'jeonse' }],
  ['전세대출을 5000만원 정도 받을 생각이에요.', { LOAN: 'planned' }, { loan_type: 'housing', loan_amount: '1000_5000' }],
  ['요즘 돈 관리가 너무 어려워요.', {}, {}],
];
for (const [i, [text, events, slots]] of examples.entries()) test(`프롬프트 예시 ${i + 1}: ${text}`, async () => {
  const result = await ruleExtractor(text);
  assert.deepEqual(Object.fromEntries(result.events.map(e => [e.type, e.status])), events);
  for (const [key, value] of Object.entries(slots)) assert.equal(result.slots[key], value, key);
  assert.deepEqual(validateExtraction(result).issues, []);
});
test('금액을 만원 단위로 정규화하고 경계값을 일관되게 처리한다', () => {
  for (const [text, amount] of [['180만원', 180], ['천만 원', 1000], ['3천', 3000], ['1억 5천만원', 15000], ['5000000원', 500], ['1.5억 원', 15000]]) assert.equal(normalizeMoney(text), amount, text);
  for (const [slot, cases] of Object.entries({ monthly_income: [[199, 'lt200'], [200, '200_300'], [300, '200_300'], [301, 'gt300']], savings: [[0, 'none'], [499, 'lt500'], [500, '500_2000'], [2000, '500_2000'], [2001, 'gt2000']], deposit: [[999, 'lt1000'], [1000, '1000_5000'], [5000, '1000_5000'], [5001, 'gt5000']], loan_amount: [[5000, '1000_5000'], [5001, 'gt5000']] })) for (const [amount, value] of cases) assert.equal(moneyBucket(slot, amount), value);
});
test('같은 문장 안의 저축·소득·보증금·대출 금액을 섞지 않는다', async () => {
  const result = await ruleExtractor('월급 260만원, 저축 3000만원, 보증금 5000만원, 대출 1000만원 받을 예정이에요.');
  assert.equal(result.slots.monthly_income, '200_300');
  assert.equal(result.slots.savings, 'gt2000');
  assert.equal(result.slots.deposit, '1000_5000');
  assert.equal(result.slots.loan_amount, '1000_5000');
});
test('소수 금액의 마침표를 문장 경계로 오인하지 않는다', async () => {
  assert.equal((await ruleExtractor('보증금 1.5억 원으로 계약할 예정이에요.')).slots.deposit, 'gt5000');
});
test('복합 시나리오에서는 이미 확보한 값을 묻지 않고 공유 소득을 한 번만 질문한다', async () => {
  let { state } = await analyzeInput('다음 달 취업해서 반년 뒤 월세로 자취하려고 해요. 지금 천만 원 정도 모았습니다.', createInitialState());
  assert.deepEqual(evaluateRules(state).missingSlots, ['monthly_income', 'contract_timing', 'deposit']);
  const questions = [];
  for (const value of ['200_300', 'm3', '1000_5000']) {
    const question = selectNextQuestion(evaluateRules(state));
    questions.push(question.key); state = applyAnswer(state, question, value);
  }
  assert.deepEqual(questions, ['monthly_income', 'contract_timing', 'deposit']);
  assert.equal(evaluateRules(state).status, 'complete');
  assert.equal(selectNextQuestion(evaluateRules(state)), null);
});
test('미정 확인은 일반 질문보다 먼저 하며 다시 미정을 선택해도 반복하지 않는다', async () => {
  let { state } = await analyzeInput('취업 준비 중인데 곧 될 것 같아요. 반년 뒤 자취하려고 해요.', createInitialState());
  const q = selectNextQuestion(evaluateRules(state));
  assert.equal(q.kind, 'event');
  state = applyAnswer(state, q, 'uncertain');
  assert.equal(selectNextQuestion(evaluateRules(state)).kind, 'slot');
  assert.deepEqual(evaluateRules(state).deferredEvents, ['EMPLOYMENT']);
  for (let count = 0; count < 20; count++) {
    const next = selectNextQuestion(evaluateRules(state));
    if (!next) break;
    state = applyAnswer(state, next, next.options[0].value);
  }
  assert.equal(evaluateRules(state).status, 'deferred');
  assert.equal(selectNextQuestion(evaluateRules(state)), null);
  state = applyAnswer(state, eventQuestion('EMPLOYMENT'), 'planned');
  assert.equal(selectNextQuestion(evaluateRules(state)).key, 'employment_timing');
});
test('이벤트 미인식과 해당 없음은 정보 수집 완료로 오인하지 않는다', async () => {
  for (const [text, expected] of [['돈 관리가 어려워요', 'unrecognized'], ['아직 취업은 못 했어요', 'not_applicable']]) {
    const { state } = await analyzeInput(text, createInitialState());
    assert.equal(evaluateRules(state).status, expected);
    assert.equal(selectNextQuestion(evaluateRules(state)), null);
  }
});
test('검증기는 잘못된 이벤트·슬롯·enum 및 임의 키를 제외한다', () => {
  const { data, issues } = validateExtraction({ events: [{ type: 'FAKE', status: 'yes', evidence: 'x' }, { type: 'EMPLOYMENT', status: 'oops', evidence: 'x' }], slots: { monthly_income: 260, savings: '500_2000', injected: true } });
  assert.equal(data.events.length, 0); assert.equal(data.slots.monthly_income, null); assert.equal(data.slots.savings, '500_2000'); assert.equal(issues.length, 4);
});
test('null 추출은 기존 답변을 지우지 않으며 상태 병합은 원본을 변경하지 않는다', () => {
  const original = createInitialState();
  const answered = applyAnswer(original, QUESTIONS.monthly_income, '200_300');
  const merged = mergeExtraction(answered, { events: [], slots: emptySlots() });
  assert.equal(original.slots.monthly_income, null); assert.equal(merged.slots.monthly_income, '200_300');
  assert.throws(() => applyAnswer(original, QUESTIONS.monthly_income, 'invalid'));
});
test('모든 규칙 슬롯에 질문과 우선순위가 존재한다 (salary_timing 포함)', () => {
  for (const statuses of Object.values(EVENT_RULES)) for (const slots of Object.values(statuses)) for (const key of slots) { assert.ok(QUESTIONS[key]); assert.ok(SLOT_PRIORITY.includes(key)); }
});
test('같은 계약의 비동기 해석기를 주입해도 나머지 엔진을 수정할 필요가 없다', async () => {
  const adapter = createExtractor(async () => ({ events: [{ type: 'SALARY', status: 'yes', evidence: 'mock' }], slots: { ...emptySlots(), salary_timing: 'received', monthly_income: '200_300' } }));
  const { state } = await analyzeInput('교체된 해석기', createInitialState(), adapter);
  assert.equal(evaluateRules(state).status, 'complete');
  await assert.rejects(() => adapter(''));
});
test('한 이벤트의 부정 표현을 다른 절의 계획에 적용하지 않는다', async () => {
  const result = await ruleExtractor('아직 취업은 못 했지만 독립하려고 해요. 대출은 안 받을 생각이에요.');
  assert.deepEqual(Object.fromEntries(result.events.map(e => [e.type, e.status])), { EMPLOYMENT: 'no', INDEPENDENCE: 'planned', LOAN: 'no' });
});
test('예정에서 이미 취업으로 수정하면 모순되는 입사 예정값만 재확인한다', async () => {
  let { state } = await analyzeInput('다음 달 입사해요. 예상 월급 260만원.', createInitialState());
  state = applyAnswer(state, eventQuestion('EMPLOYMENT'), 'yes');
  assert.equal(state.slots.employment_timing, null);
  assert.equal(state.slots.monthly_income, '200_300');
});
