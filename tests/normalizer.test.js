import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../lib/normalizer/index.js';
import { parseTime, timeBucket } from '../lib/normalizer/time.js';
import { parseAmount } from '../lib/normalizer/amount.js';
import { createSpanExtractor } from '../lib/extractors/spanExtractor.js';
import { analyzeInput } from '../lib/pipeline.js';
import { createInitialState } from '../lib/state.js';
import { evaluateRules } from '../lib/rules.js';
import { selectNextQuestion } from '../lib/questions.js';

const event = (name, status, text = name) => ({ kind: 'event', event: name, status, text });
const span = (kind, about, text) => ({ kind, about, text });

test('시간 조각: 상대 표현은 개월 수로, 달력 날짜는 추정하지 않는다', () => {
  for (const [text, expected] of [
    ['다음 달', { tense: 'future', months: 1 }],
    ['이번 달', { tense: 'future', months: 0 }],
    ['반년 뒤쯤', { tense: 'future', months: 6 }],
    ['3개월 후', { tense: 'future', months: 3 }],
    ['1년 뒤', { tense: 'future', months: 12 }],
    ['입사 2년 차', { tense: 'tenure', months: 24 }],
    ['내년 2월', { tense: 'calendar', months: null }],
    ['8월쯤', { tense: 'calendar', months: null }],
    ['언젠가', { tense: 'unknown', months: null }],
  ])
    assert.deepEqual(parseTime(text), expected, text);
  assert.equal(timeBucket('move_timing', 6), 'm6');
  assert.equal(timeBucket('move_timing', 13), null);
});

test('금액 조각: 범위·매달 납입은 값을 만들지 않는다', () => {
  assert.deepEqual(parseAmount('천만 원 정도'), { kind: 'value', manwon: 1000 });
  assert.equal(parseAmount('250~350만원').manwon, null);
  assert.equal(parseAmount('250~350만원').kind, 'range');
  assert.equal(parseAmount('매달 50만원').kind, 'flow');
  assert.equal(parseAmount('잘 모르겠어요').kind, 'unknown');
  assert.equal(parseAmount('없어요').kind, 'none');
});

test('PDF 예시: 다음 달 취업, 반년 뒤 월세 자취, 천만 원 → 고용 형태와 월소득만 질문한다', async () => {
  const spans = [
    event('EMPLOYMENT', 'planned', '취업해서'),
    span('time', 'EMPLOYMENT', '다음 달'),
    event('INDEPENDENCE', 'planned', '자취하려고'),
    span('time', 'INDEPENDENCE', '반년 뒤쯤'),
    span('choice', 'housing_type', '월세로'),
    span('amount', 'savings', '천만 원 정도'),
  ];
  const { state, issues } = await analyzeInput(
    '...',
    createInitialState(),
    createSpanExtractor(async () => spans),
  );
  assert.deepEqual(issues, []);
  assert.equal(state.slots.employment_timing, 'upcoming');
  assert.equal(state.slots.move_timing, 'm6');
  assert.equal(state.slots.housing_type, 'monthly');
  assert.equal(state.slots.savings, '500_2000');
  const result = evaluateRules(state);
  assert.deepEqual(result.missingSlots, ['employment_type', 'monthly_income']);
  assert.equal(selectNextQuestion(result).key, 'employment_type');
});

test('귀속 규칙에 없는 조합은 버리고 재질문으로 남긴다', () => {
  const { slots, issues } = normalize([
    event('INDEPENDENCE', 'planned'),
    span('amount', 'move_timing', '3개월'),
    span('time', 'savings', '다음 달'),
  ]);
  assert.equal(slots.move_timing, null);
  assert.equal(slots.savings, null);
  assert.equal(issues.length, 2);
});

test('같은 슬롯에 서로 다른 값이 오면 채우지 않는다', () => {
  const { slots, issues } = normalize([
    span('amount', 'monthly_income', '250만원'),
    span('amount', 'monthly_income', '350만원'),
    span('amount', 'monthly_income', '250만원'),
  ]);
  assert.equal(slots.monthly_income, null);
  assert.equal(issues.length, 1);
});

test('이벤트 상태와 모순되거나 애매한 조각은 채우지 않는다', () => {
  assert.equal(
    normalize([event('EMPLOYMENT', 'yes'), span('time', 'EMPLOYMENT', '다음 달')]).slots.employment_timing,
    null,
  );
  assert.equal(
    normalize([event('INDEPENDENCE', 'no'), span('time', 'INDEPENDENCE', '다음 달')]).slots.move_timing,
    null,
  );
  assert.equal(
    normalize([event('INDEPENDENCE', 'planned'), span('time', 'INDEPENDENCE', '내년 2월')]).slots.move_timing,
    null,
  );
  assert.equal(normalize([span('amount', 'savings', '매달 50만원')]).slots.savings, null);
  assert.equal(normalize([span('amount', 'monthly_income', '250~350만원')]).slots.monthly_income, null);
  assert.equal(normalize([span('choice', 'housing_type', '월세나 전세')]).slots.housing_type, null);
  assert.equal(normalize([span('time', 'INDEPENDENCE', '다음 달')]).slots.move_timing, 'm3');
});

test('월급·입사 시기와 "모르겠어요" 처리', () => {
  assert.equal(normalize([event('SALARY', 'yes'), span('time', 'SALARY', '이번 달')]).slots.salary_timing, 'received');
  assert.equal(
    normalize([event('SALARY', 'planned'), span('time', 'SALARY', '이번 달')]).slots.salary_timing,
    'this_month',
  );
  assert.equal(
    normalize([event('SALARY', 'planned'), span('time', 'SALARY', '3개월 뒤')]).slots.salary_timing,
    'later',
  );
  assert.equal(
    normalize([event('EMPLOYMENT', 'yes'), span('time', 'EMPLOYMENT', '입사 2년 차')]).slots.employment_timing,
    'y1_3',
  );
  assert.equal(normalize([span('amount', 'monthly_income', '잘 모르겠어요')]).slots.monthly_income, 'unknown');
  assert.equal(normalize([span('amount', 'deposit', '아직 미정')]).slots.deposit, 'undecided');
  assert.equal(normalize([span('amount', 'savings', '없어요')]).slots.savings, 'none');
});

test('잘못된 입력은 예외 없이 빈 결과가 된다', () => {
  for (const bad of [
    null,
    undefined,
    'x',
    [null, 1, {}],
    [{ kind: 'event', event: 'WRONG', status: 'yes', text: 'a' }],
  ])
    assert.deepEqual(normalize(bad).events, []);
});
