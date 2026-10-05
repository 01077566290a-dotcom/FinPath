import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNKNOWN, QUESTION_BY_ID, PURPOSES, stageOf, applyQuestionOrder } from '../lib/goal/questions.js';
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

test('월급 수정은 기존 저축과 지출을 재검증하고 실패하면 원래 답을 유지한다', () => {
  const original = { income: 245, saving_now: 73 };
  const invalid = answer(original, 'income', 50);
  assert.match(invalid.error, /매달 모으는 돈을 먼저/);
  assert.equal(invalid.answers, original);
  assert.deepEqual(original, { income: 245, saving_now: 73 });

  const fixed = { ...original, fixed_items: { 통신비: 30 }, has_debt: 'yes', debt: { remain: 100, monthly: 15 } };
  assert.match(answer(fixed, 'income', 100).error, /매달 모으는 돈을 먼저/);
  assert.match(answer(fixed, 'income', 40).error, /고정지출과 빚 상환액/);
  const loweredSaving = answer(original, 'saving_now', 40).answers;
  const valid = answer(loweredSaving, 'income', 50);
  assert.equal(valid.error, null);
  assert.equal(valid.answers.income, 50);
  assert.equal(valid.answers.saving_now, 40);
  assert.equal(answer(original, 'income', 300).error, null);
  assert.equal(answer({}, 'income', 50).error, null);
});

function answerAll(steps) {
  let answers = {};
  for (const [id, value] of steps) {
    const result = answer(answers, id, value, { now: NOW });
    assert.equal(result.error, null, `${id}: ${result.error}`);
    answers = result.answers;
  }
  return answers;
}

// 시연 인물 정하은 (docs/demo-persona.md 3장 입력값). 목적을 먼저 답해요.
// 고정지출 항목·줄일 지출은 입력 흐름에서 묻지 않지만(inFlow: false) 시연 데이터에는 남아 있어요.
const HAEUN = [
  ['purposes', ['주거', '비상자금']],
  ['goal', { amount: 1500, months: 12 }],
  ['income', 245],
  ['saving_now', 73],
  ['saved', 680],
  ['has_debt', 'yes'],
  ['debt', { remain: 420, monthly: 15 }],
  ['fixed_items', { 통신비: 9, 구독: 3, 보험: 7, 교통비: 13, '가족 용돈': 20 }],
  ['employment', '정규직'],
  ['housing_type', '월세'],
  ['deposit', 1000],
  ['rent', { rent: 60, maintenance: 8 }],
  ['move_in', '2027-09'],
  ['commute_after', 6],
  ['region', { sido: '서울', sigungu: '마포구' }],
  ['age', 27],
  [
    'cuttable',
    [
      { item: '통신비', monthly: 5 },
      { item: '구독', monthly: 3 },
    ],
  ],
];

// 처음 쓰는 사람: 고정지출 항목 없이 교통비만 답해요.
const NEW_USER = [
  ['purposes', ['주거', '비상자금']],
  ['goal', { amount: 1500, months: 12 }],
  ['income', 245],
  ['saving_now', 73],
  ['saved', 680],
  ['has_debt', 'no'],
  ['employment', '정규직'],
  ['housing_type', '월세'],
  ['deposit', 1000],
  ['rent', { rent: 60, maintenance: 8 }],
  ['move_in', '2027-09'],
  ['commute_now', 13],
  ['commute_after', 6],
  ['region', { sido: '서울', sigungu: '마포구' }],
  ['age', 27],
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
  assert.equal(p.cuttable.length, 2); // 입력 흐름에서 묻지 않아도 남아 있는 답은 써요
  assert.equal(p.base_month, '2026-10');
});

test('적응형: 정하은은 질문 15개, 공통 질문은 7개 이하', () => {
  const asked = visibleQuestions(answerAll(HAEUN));
  assert.equal(asked.length, 15);
  assert.ok(asked.filter(q => q.group === 'common' && stageOf(q) === 1).length <= 7);
});

test('적응형: 고른 목적에 따라 질문 수가 달라진다', () => {
  const base = [
    ['goal', { amount: 500, months: 12 }],
    ['income', 245],
    ['saving_now', 73],
    ['saved', 680],
    ['has_debt', 'no'],
  ];
  const emergencyOnly = answerAll([['purposes', ['비상자금']], ...base]);
  const housing = answerAll([['purposes', ['주거']], ...base, ['housing_type', '월세']]);
  // 비상자금만: 공통 + 고용 형태 + 지역·나이
  assert.deepEqual(
    visibleQuestions(emergencyOnly).map(q => q.id),
    ['purposes', 'goal', 'income', 'saving_now', 'saved', 'has_debt', 'employment', 'region', 'age'],
  );
  assert.ok(visibleQuestions(housing).length > visibleQuestions(emergencyOnly).length);
  assert.equal(
    visibleQuestions(housing).some(q => q.id === 'employment'),
    false,
  ); // 비상자금을 안 고르면 고용 형태를 묻지 않아요
});

test('적응형: 월세·보증금이 작으면 대출을 묻지 않고, 전세이거나 보증금이 크면 묻는다', () => {
  let answers = answerAll(NEW_USER);
  assert.equal(
    visibleQuestions(answers).some(q => q.id === 'loan_plan'),
    false,
  );
  answers = answer(answers, 'deposit', 5000, { now: NOW }).answers;
  assert.equal(
    visibleQuestions(answers).some(q => q.id === 'loan_plan'),
    true,
  );
  answers = answer(answers, 'housing_type', '전세', { now: NOW }).answers;
  assert.equal(answers.rent, undefined);
  answers = answer(answers, 'loan_plan', '예', { now: NOW }).answers;
  assert.equal(
    visibleQuestions(answers).some(q => q.id === 'loan_amount'),
    true,
  );
  assert.equal(isComplete(answers), false); // 대출액을 답해야 끝나요
});

test('적응형: 빠른 선택이 앞의 답에 따라 바뀐다', () => {
  const quick = (id, answers) => QUESTION_BY_ID[id].quick(answers);
  assert.deepEqual(quick('goal', { purposes: ['비상자금'] }).amount, [300, 500, 1000]);
  assert.deepEqual(quick('goal', { purposes: ['주거'] }).amount, [1000, 1500, 3000, 5000]);
  assert.ok(quick('deposit', { housing_type: '전세' })[0] >= 10000);
  assert.ok(quick('deposit', { housing_type: '월세' })[0] < 1000);
});

test('처음 쓰는 사람은 고정지출 6칸 대신 교통비만 답하고, 계산에 그대로 쓰인다', () => {
  const answers = answerAll(NEW_USER);
  assert.equal(isComplete(answers), true);
  assert.equal(
    visibleQuestions(answers).some(q => q.id === 'fixed_items' || q.id === 'cuttable'),
    false,
  );
  const p = buildProfile(answers, { now: NOW });
  assert.deepEqual(validateProfile(p), []);
  assert.deepEqual(p.money.fixed_items, { 교통비: 13 });
  assert.deepEqual(p.cuttable, []);
});

test('교통비가 없으면 독립 후 교통비를 묻지 않는다', () => {
  const answers = answerAll(
    NEW_USER.filter(([id]) => id !== 'commute_after').map(([id, v]) => (id === 'commute_now' ? [id, 0] : [id, v])),
  );
  assert.equal(isComplete(answers), true);
  assert.equal(
    visibleQuestions(answers).some(q => q.id === 'commute_after'),
    false,
  );
});

test('목적은 비상자금·주거·투자 세 가지, 빚이 없으면 빚 금액을 묻지 않는다', () => {
  assert.deepEqual(PURPOSES, ['비상자금', '주거', '투자']);
  assert.notEqual(answer({}, 'purposes', ['결혼']).error, null);
  const answers = answerAll([
    ['purposes', ['비상자금']],
    ['goal', { amount: 500, months: 12 }],
    ['income', 245],
    ['saving_now', 73],
    ['saved', 680],
    ['has_debt', 'no'],
  ]);
  assert.equal(nextQuestion(answers).id, 'employment');
});

test('입력 순서: ① 목표와 내 돈 → ② 나에게 맞춘 질문 → ③ 정책 찾기', () => {
  assert.equal(nextQuestion({}).id, 'purposes');
  const order = visibleQuestions(answerAll(HAEUN)).map(q => stageOf(q));
  assert.deepEqual(
    order,
    [...order].sort((x, y) => x - y),
  );
  assert.equal(stageOf(QUESTION_BY_ID.purposes), 1);
  assert.equal(stageOf(QUESTION_BY_ID.deposit), 2);
  assert.equal(stageOf(QUESTION_BY_ID.region), 3);
});

test('이전 흐름(classic)으로 바꾸면 예전 순서로 묻고, 다시 기본 순서로 돌아온다', () => {
  try {
    applyQuestionOrder('classic');
    assert.equal(nextQuestion({}).id, 'income');
    const answers = answerAll([
      ['income', 245],
      ['has_debt', 'no'],
    ]);
    assert.equal(nextQuestion(answers).id, 'saving_now'); // 고정지출 6칸은 이제 묻지 않아요
  } finally {
    applyQuestionOrder('plan');
  }
  assert.equal(nextQuestion({}).id, 'purposes');
});

test('"모름"은 null과 unknowns로 기록된다', () => {
  const steps = NEW_USER.filter(([id]) => id !== 'commute_after').map(([id, v]) =>
    id === 'commute_now' || id === 'deposit' ? [id, UNKNOWN] : [id, v],
  );
  const p = buildProfile(answerAll(steps), { now: NOW });
  assert.equal(p.money.fixed, null);
  assert.equal(p.money.variable, null);
  assert.equal(p.detail['주거'].deposit, null);
  assert.deepEqual(p.unknowns.sort(), ['commute_now', 'deposit']);
});

test('답을 고쳐서 질문이 사라지면 그 답도 지워진다', () => {
  let answers = answerAll(HAEUN);
  answers = answer(answers, 'purposes', ['비상자금'], { now: NOW }).answers;
  assert.equal(answers.housing_type, undefined);
  assert.equal(answers.commute_after, undefined);
  assert.equal(buildProfile(answers, { now: NOW }).detail['주거'], undefined);
  answers = answer(answers, 'purposes', ['투자'], { now: NOW }).answers;
  assert.equal(answers.employment, undefined); // 비상자금을 빼면 고용 형태 답도 지워요
});

test('앞뒤가 안 맞는 값은 막는다', () => {
  const income = answerAll([['income', 245]]);
  assert.notEqual(answer(income, 'saving_now', 300).error, null); // 월급보다 많음
  const withFixed = answerAll([
    ['income', 245],
    ['has_debt', 'yes'],
    ['debt', { remain: 420, monthly: 15 }],
    ['fixed_items', { 통신비: 9, 구독: 3, 보험: 7, 교통비: 13, '가족 용돈': 20 }],
  ]);
  assert.notEqual(answer(withFixed, 'saving_now', 200).error, null); // 245 - 67 = 178보다 많음
  assert.notEqual(answer(withFixed, 'cuttable', [{ item: '통신비', monthly: 20 }]).error, null); // 9만 원보다 많이 줄임
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

test('결과에 쓰이지 않는 질문(빚 종류·일한 기간·사는 형태 등)은 묻지 않고, 프로필은 만들어진다', () => {
  const answers = answerAll(HAEUN);
  const asked = visibleQuestions(answers).map(q => q.id);
  for (const id of ['debt_type', 'work_years', 'living_now', 'emergency_reason', 'housing_goal'])
    assert.equal(asked.includes(id), false, id);
  const p = buildProfile(answers, { now: NOW });
  assert.equal(p.living_now, null);
  assert.equal(p.work_years, null);
});

test('시·군·구는 그 시·도의 목록에 있는 것만 받는다', () => {
  assert.notEqual(answer({}, 'region', { sido: '부산', sigungu: '마포구' }).error, null);
  assert.equal(answer({}, 'region', { sido: '부산', sigungu: '해운대구' }).error, null);
  assert.equal(answer({}, 'region', { sido: '세종', sigungu: null }).error, null);
});
