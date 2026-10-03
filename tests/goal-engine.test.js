import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNKNOWN, QUESTION_BY_ID, stageOf, applyQuestionOrder } from '../lib/goal/questions.js';
import {
  answer,
  skip,
  nextQuestion,
  isComplete,
  buildProfile,
  validateProfile,
  parseAmount,
  visibleQuestions,
} from '../lib/goal/engine.js';

// 기준 달: 2026년 10월 (docs/demo-persona.md와 같음)
const NOW = new Date(2026, 9, 15);

function answerAll(steps) {
  let answers = {};
  for (const [id, value] of steps) {
    const result = answer(answers, id, value, { now: NOW });
    assert.equal(result.error, null, `${id}: ${result.error}`);
    answers = result.answers;
  }
  return answers;
}

// 시연 인물 정하은 (docs/demo-persona.md 3장 입력값)
const HAEUN = [
  ['income', 245],
  ['has_debt', 'yes'],
  ['debt', { remain: 420, monthly: 15 }],
  ['fixed_items', { 통신비: 9, 구독: 3, 보험: 7, 교통비: 13, '가족 용돈': 20 }],
  ['saving_now', 73],
  ['saved', 680],
  ['employment', '정규직'],
  ['age', 27],
  ['region', { sido: '서울', sigungu: '마포구' }],
  ['goal', { amount: 1500, months: 12 }],
  ['purposes', ['주거', '비상자금']],
  [
    'cuttable',
    [
      { item: '통신비', monthly: 5 },
      { item: '구독', monthly: 3 },
    ],
  ],
  ['housing_type', '월세'],
  ['deposit', 1000],
  ['rent', { rent: 60, maintenance: 8 }],
  ['move_in', '2027-09'],
  ['commute_after', 6],
  ['loan_plan', '아니요'],
];

test('정하은으로 답하면 시연 문서와 같은 숫자의 프로필이 나온다', () => {
  const answers = answerAll(HAEUN);
  assert.equal(isComplete(answers), true);
  const p = buildProfile(answers, { now: NOW });
  assert.deepEqual(validateProfile(p), []);
  assert.equal(p.money.fixed, 67); // 고정지출 52 + 학자금 15
  assert.equal(p.money.variable, 105); // 245 - 67 - 73
  assert.equal(p.money.saved, 680);
  assert.equal(p.detail['주거'].move_in_months, 11); // 2026.10 → 2027.09
  assert.equal(p.detail['주거'].rent + p.detail['주거'].maintenance, 68);
  assert.equal(p.detail['주거'].commute_after, 6);
  assert.deepEqual(p.detail['비상자금'], {});
  assert.equal(p.base_month, '2026-10');
});

test('비상자금은 추가 질문이 없다 (이미 아는 정보로 계산)', () => {
  const answers = answerAll(HAEUN);
  const groups = visibleQuestions(answers).map(q => q.group);
  assert.equal(groups.includes('비상자금'), false);
});

test('교통비를 안 쓰면 독립 후 교통비를 묻지 않는다', () => {
  const steps = HAEUN.filter(([id]) => id !== 'commute_after').map(([id, v]) =>
    id === 'fixed_items' ? [id, { 통신비: 9, 구독: 3 }] : [id, v],
  );
  const answers = answerAll(steps.map(([id, v]) => (id === 'saving_now' ? [id, 73] : [id, v])));
  assert.equal(isComplete(answers), true);
  assert.equal(
    visibleQuestions(answers).some(q => q.id === 'commute_after'),
    false,
  );
});

test('빚이 없으면 빚 금액과 "빚 상환" 목적을 묻지 않는다', () => {
  const answers = answerAll([
    ['goal', { amount: 1500, months: 12 }],
    ['income', 245],
    ['has_debt', 'no'],
  ]);
  assert.equal(nextQuestion(answers).id, 'fixed_items');
  const purposes = visibleQuestions(answers).find(q => q.id === 'purposes');
  assert.equal(
    purposes.options(answers).some(o => o.value === '빚 상환'),
    false,
  );
});

test('월세가 아니면 월세·관리비를 묻지 않고, 대출 예정일 때만 대출액을 묻는다', () => {
  let answers = answerAll(HAEUN);
  answers = answer(answers, 'housing_type', '전세', { now: NOW }).answers;
  assert.equal(answers.rent, undefined);
  answers = answer(answers, 'loan_plan', '예', { now: NOW }).answers;
  assert.equal(nextQuestion(answers).id, 'loan_amount');
});

test('기획안 v4 순서: ① 목표와 내 돈 상황 → ② 지역과 목적 → ③ 목적별 상세', () => {
  assert.equal(nextQuestion({}).id, 'goal');
  const order = visibleQuestions(answerAll(HAEUN)).map(q => stageOf(q));
  assert.deepEqual(
    order,
    [...order].sort((x, y) => x - y),
  );
  assert.equal(stageOf(QUESTION_BY_ID.region), 2);
  assert.equal(stageOf(QUESTION_BY_ID.purposes), 2);
  assert.equal(stageOf(QUESTION_BY_ID.deposit), 3);
});

test('이전 흐름(classic)으로 바꾸면 예전 순서로 묻고, 다시 기획안 순서로 돌아온다', () => {
  try {
    applyQuestionOrder('classic');
    assert.equal(nextQuestion({}).id, 'income');
    const answers = answerAll([
      ['income', 245],
      ['has_debt', 'no'],
    ]);
    assert.equal(nextQuestion(answers).id, 'fixed_items');
  } finally {
    applyQuestionOrder('plan');
  }
  assert.equal(nextQuestion({}).id, 'goal');
});

test('"모름"은 null과 unknowns로 기록된다', () => {
  const steps = HAEUN.filter(([id]) => id !== 'commute_after').map(([id, v]) =>
    id === 'fixed_items' || id === 'deposit' ? [id, UNKNOWN] : [id, v],
  );
  const p = buildProfile(answerAll(steps), { now: NOW });
  assert.equal(p.money.fixed, null);
  assert.equal(p.money.variable, null);
  assert.equal(p.detail['주거'].deposit, null);
  assert.deepEqual(p.unknowns.sort(), ['deposit', 'fixed_items']);
});

test('답을 고쳐서 질문이 사라지면 그 답도 지워진다', () => {
  let answers = answerAll(HAEUN);
  answers = answer(answers, 'purposes', ['비상자금'], { now: NOW }).answers;
  assert.equal(answers.housing_type, undefined);
  assert.equal(answers.commute_after, undefined);
  assert.equal(buildProfile(answers, { now: NOW }).detail['주거'], undefined);
});

test('앞뒤가 안 맞는 값은 막는다', () => {
  const base = answerAll(HAEUN.slice(0, 4));
  assert.notEqual(answer(base, 'saving_now', 200).error, null); // 245 - 67 = 178보다 많음
  const before = answerAll(HAEUN.slice(0, 11));
  assert.notEqual(answer(before, 'cuttable', [{ item: '통신비', monthly: 20 }]).error, null); // 9만 원보다 많이 줄임
  assert.notEqual(answer({}, 'move_in', '2026-05', { now: NOW }).error, null); // 지난 달
});

test('잘못된 값은 저장하지 않고 오류 문장을 돌려준다', () => {
  assert.notEqual(answer({}, 'income', -5).error, null);
  assert.notEqual(answer({}, 'income', UNKNOWN).error, null);
  assert.notEqual(answer({}, 'purposes', ['주거', '결혼', '투자', '비상자금']).error, null);
  assert.equal(skip({}, 'partner_share').error, null);
});

test('금액 입력 정리', () => {
  assert.equal(parseAmount('1,000만'), 1000);
  assert.equal(parseAmount('250'), 250);
  assert.ok(Number.isNaN(parseAmount('없음')));
});
