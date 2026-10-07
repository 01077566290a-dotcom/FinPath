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

test('목돈 목표는 타임라인 단계로도 보이고, 금액은 소수 첫째 자리까지만 보인다', async () => {
  const { buildPlanRoadmap } = await import('../lib/plan/steps.js');
  const { money } = await import('../lib/report/format.js');
  const profile = buildDemoProfile();
  profile.goal = { amount: 10000, months: 36 };
  const step = buildPlanRoadmap(buildPlan(profile)).steps.find(s => s.id === 'personal');
  assert.ok(step, '목돈 목표 단계가 있어야 해요');
  assert.match(step.figure, /^36개월 안에 /);
  assert.equal(money(233.33333), '233.3만 원');
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
