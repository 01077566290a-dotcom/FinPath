import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, validateAnswer, validateProfile } from '../lib/goal/engine.js';
import { QUESTION_BY_ID } from '../lib/goal/questions.js';
import { buildDemoProfile } from '../lib/plan/demoProfile.js';
import { buildPlan, toPlanInput } from '../lib/plan/index.js';
import { encodeShare, decodeShare } from '../lib/report/share.js';
import { assessPolicy } from '../lib/goal/policies.js';

test('소수점·원·만·억을 같은 만원 단위로 해석하고 잘못된 값을 거부한다', () => {
  for (const [text, expected] of [
    ['250.5만 원', 250.5],
    ['2,505,000원', 250.5],
    ['1억', 10000],
    ['1억 250.5만 원', 10250.5],
  ])
    assert.equal(parseAmount(text), expected);
  for (const text of ['-250', '1.2.3', 'abc100']) assert.ok(Number.isNaN(parseAmount(text)));
  assert.equal(validateAnswer(QUESTION_BY_ID.income, 250.5), null);
  assert.ok(validateAnswer(QUESTION_BY_ID.invest_months, 12.5));
  const profile = buildDemoProfile();
  profile.money.income = 250.5;
  assert.deepEqual(validateProfile(profile), []);
});

test('1억 목돈 목표가 실제 필요 금액과 시뮬레이션에 반영된다', () => {
  const profile = buildDemoProfile();
  profile.goal = { amount: parseAmount('1억'), months: 36 };
  const plan = buildPlan(profile);
  assert.ok(plan.core.needed >= 10000);
  assert.ok(plan.goals.some(g => g.id === 'personal' && g.target > 0));
  assert.notEqual(plan.scenarios.A.done.personal, 0);
});

test('이사 후 기존 월세를 대체하고 새 대출 원금과 지역 생활비 증가를 반영한다', () => {
  const profile = buildDemoProfile();
  Object.assign(profile.detail['주거'], {
    current_housing_cost: 50,
    loan_amount: 1000,
    loan_principal_monthly: 20,
    variable_after_delta: 15,
  });
  const plan = buildPlan(profile);
  assert.equal(
    plan.cashflow.after.spend,
    plan.cashflow.now.spend - 50 - toPlanInput(profile).commuteDelta + plan.cashflow.housingCost + 15,
  );
  assert.equal(plan.cashflow.housingCost, 60 + 8 + 3 + 20);
});

test('기본 공유의 실제 payload에는 개인정보와 금액이 없다', () => {
  const profile = buildDemoProfile();
  const code = encodeShare(profile);
  const payload = JSON.parse(Buffer.from(code, 'base64url').toString('utf8'));
  assert.deepEqual(Object.keys(payload).sort(), ['purposes', 'v']);
  assert.deepEqual(decodeShare(code), { masked: true, purposes: profile.purposes });
});

test('정책 소득 초과·접수 종료·미확인 조건을 구분한다', () => {
  const policy = {
    income_requirement: { scope: 'individual', max_manwon: 5000 },
    application_period: { start: '2026-01-01', end: '2026-09-30' },
  };
  assert.equal(assessPolicy(policy, { annualGrossIncome: 6000 }, '2026-09-01').status, 'ineligible');
  assert.equal(assessPolicy(policy, {}, '2026-10-07').status, 'closed');
  assert.equal(assessPolicy({}, {}, '2026-10-07').status, 'needs-check');
});

test('휴대폰 키패드의 쉼표 소수점도 소수로 읽고, 천 단위 쉼표는 그대로 둔다', () => {
  assert.equal(parseAmount('250,5'), 250.5);
  assert.equal(parseAmount('250,5만 원'), 250.5);
  assert.equal(parseAmount('2,505'), 2505);
  assert.equal(parseAmount('1,000,000'), 1000000);
});

test('목돈 목표는 타임라인 단계로도 보이고, 결과 금액은 정수로 보인다', async () => {
  const { buildPlanRoadmap } = await import('../lib/plan/steps.js');
  const { money } = await import('../lib/report/format.js');
  const profile = buildDemoProfile();
  profile.goal = { amount: 10000, months: 36 };
  const step = buildPlanRoadmap(buildPlan(profile)).steps.find(s => s.id === 'personal');
  assert.ok(step, '목돈 목표 단계가 있어야 해요');
  assert.match(step.figure, /^36개월 안에 /);
  assert.equal(money(233.33333), '233만 원'); // 결과 화면은 만 원 단위 정수
});

test('정책 카드에는 원래 조건 설명을 두고, 신청 가능 여부는 짧은 표시로 붙인다', async () => {
  const { filterPolicies } = await import('../lib/goal/policies.js');
  const policy = {
    id: 'x',
    name: '테스트 정책',
    purposes: ['주거'],
    region: null,
    age: { min: 19, max: 39 },
    condition_note: '무주택 청년',
  };
  const [p] = filterPolicies(
    { purposes: ['주거'], region: { sido: '서울' }, age: 27, money: {} },
    { policies: [policy] },
  );
  assert.equal(p.condition_note, '무주택 청년');
  assert.equal(p.eligibility.label, '추가 확인 필요');
});

test('목표 진단은 독립 후 줄어든 저축까지 반영해 실제 완료 시점과 어긋나지 않는다', async () => {
  // 제보 사례: 월급 300·저축 100·이사 후 월세 50·목표 2,000만 원/24개월 → 예전엔 '기한 전에 다 모아요'
  const { answer, buildProfile } = await import('../lib/goal/engine.js');
  const now = new Date(2026, 9, 7);
  let a = {};
  for (const [id, v] of [
    ['purposes', ['주거']],
    ['goal', { amount: 2000, months: 24 }],
    ['income', 300],
    ['saving_now', 100],
    ['saved', 0],
    ['has_debt', 'no'],
    ['housing_type', '월세'],
    ['deposit', 500],
    ['rent', { rent: 50, maintenance: 0 }],
    ['move_in', '2027-04'],
    ['commute_now', 10],
    ['commute_after', 10],
    ['region', { sido: '서울', sigungu: '' }],
    ['age', 27],
  ])
    a = answer(a, id, v, { now }).answers;
  const plan = buildPlan(buildProfile(a, { now }));
  assert.ok(plan.core.monthsNeeded > plan.core.deadline);
  assert.ok(plan.core.collectable < plan.core.needed);
});

test('월 원금을 다 갚은 뒤에는 원금·이자만큼 다시 모인다', async () => {
  const { monthlyFlow } = await import('../lib/plan/simulate.js');
  const flows = { saveBefore: 100, saveAfter: 20, loan: { months: 3, relief: 101 } };
  assert.equal(monthlyFlow(flows, 5, 5), 100); // 독립 전
  assert.equal(monthlyFlow(flows, 8, 5), 20); // 독립 3개월째까지 상환 중
  assert.equal(monthlyFlow(flows, 9, 5), 121); // 다 갚은 뒤
  assert.equal(monthlyFlow({ saveBefore: 100, saveAfter: -30 }, 9, 5), 0); // 적자는 0으로 (모아둔 돈을 깎지 않음)
});

test('저축을 고쳐 지금 월세 답이 맞지 않게 되면 그 답을 지워 다시 묻는다', async () => {
  const { answer } = await import('../lib/goal/engine.js');
  const now = new Date(2026, 9, 7);
  let a = {};
  for (const [id, v] of [
    ['purposes', ['주거']],
    ['income', 300],
    ['saving_now', 100],
    ['current_housing_cost', 180],
  ])
    a = answer(a, id, v, { now }).answers;
  assert.equal(a.current_housing_cost, 180);
  const r = answer(a, 'saving_now', 290, { now });
  assert.equal(r.error, null);
  assert.equal(r.answers.current_housing_cost, undefined);
});

test('소수 교통비(12.5만 원)도 프로필과 독립 후 지출에 반영된다', async () => {
  const { answer, buildProfile } = await import('../lib/goal/engine.js');
  const now = new Date(2026, 9, 7);
  let a = {};
  for (const [id, v] of [
    ['purposes', ['주거']],
    ['goal', { amount: 1000, months: 12 }],
    ['income', 300],
    ['saving_now', 100],
    ['saved', 0],
    ['has_debt', 'no'],
    ['housing_type', '월세'],
    ['deposit', 500],
    ['rent', { rent: 50, maintenance: 0 }],
    ['move_in', '2027-04'],
    ['commute_now', 12.5],
    ['commute_after', 5],
    ['region', { sido: '서울', sigungu: '' }],
    ['age', 27],
  ])
    a = answer(a, id, v, { now }).answers;
  const profile = buildProfile(a, { now });
  assert.deepEqual(profile.money.fixed_items, { 교통비: 12.5 });
  const plan = buildPlan(profile);
  assert.equal(plan.cashflow.after.spend, plan.cashflow.now.spend - 7.5 + 50);
});
