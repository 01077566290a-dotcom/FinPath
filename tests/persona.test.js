// 20명 가상 인물 점검(2026-10-06)에서 나온 문제들이 다시 생기지 않게 지키는 테스트
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answer, buildProfile } from '../lib/goal/engine.js';
import { buildPlan } from '../lib/plan/index.js';
import { buildPlanRoadmap } from '../lib/plan/steps.js';
import { scoreFromPlan } from '../lib/report/score.js';
import { money } from '../lib/report/format.js';

const NOW = new Date(2026, 9, 6);

function planOf(steps) {
  let answers = {};
  for (const [id, value] of steps) {
    const result = answer(answers, id, value, { now: NOW });
    assert.equal(result.error, null, `${id}: ${result.error}`);
    answers = result.answers;
  }
  return buildPlan(buildProfile(answers, { now: NOW }));
}
const stepsOf = plan => Object.fromEntries(buildPlanRoadmap(plan).steps.map(s => [s.id, s]));

const base = (purposes, rest) => [
  ['purposes', purposes],
  ['goal', { amount: 2000, months: 12 }],
  ['has_debt', 'no'],
  ...rest,
  ['region', { sido: '서울', sigungu: '마포구' }],
  ['age', 27],
];
const rentHouse = (moveIn, deposit = 2000, rent = 55) => [
  ['housing_type', '월세'],
  ['deposit', deposit],
  ['rent', { rent, maintenance: 5 }],
  ['move_in', moveIn],
  ['commute_now', 10],
  ['commute_after', 10],
];

test('타임라인의 입주·계약 시점은 입력한 입주 달을 따른다 (돈이 일찍 모여도 앞당기지 않음)', () => {
  const plan = planOf(base(['주거'], [['income', 260], ['saving_now', 40], ['saved', 200], ...rentHouse('2035-01')]));
  const s = stepsOf(plan);
  assert.equal(s.housing_deposit.phaseLabel, '2035년 1월');
  assert.match(s.contract_check.personal.at(-1), /입주하려는 2035년 1월 기준으로 계약은 2034년 12월쯤/);
});

test('입주까지 부족하면 보증금 단계가 리포트와 같은 달(지금 속도)로 마련 시점을 말한다', () => {
  const plan = planOf(
    base(['주거'], [['income', 245], ['saving_now', 60], ['saved', 300], ...rentHouse('2027-06', 1000, 60)]),
  );
  const deposit = stepsOf(plan).housing_deposit;
  assert.ok(plan.core.gap > 0);
  assert.ok(
    deposit.personal.some(line =>
      line.includes(`지금처럼 매달 60만 원씩 모으면 ${plan.scenarios.A.doneLabels.housing}에 마련해요`),
    ),
  );
  assert.equal(deposit.now, `지금 속도면 ${plan.scenarios.A.doneLabels.housing}`);
});

test('투자 희망액이 남는 돈보다 크면 타임라인도 넣을 수 있는 만큼만 말한다', () => {
  const plan = planOf([
    ['purposes', ['투자']],
    ['goal', 'unknown'],
    ['income', 280],
    ['saving_now', 80],
    ['saved', 500],
    ['has_debt', 'no'],
    ['invest_months', 36],
    ['invest_monthly', 200],
    ['region', { sido: '서울', sigungu: '' }],
    ['age', 28],
  ]);
  const invest = stepsOf(plan).invest;
  assert.equal(invest.figure, '월 80만 원 안에서만 투자');
  assert.ok(invest.personal.some(line => line.includes('원하는 200만 원 중 남는 돈으로는 매달 80만 원까지')));
});

test('독립 후 적자는 "모자라요"로 말하고, 감점 10점과 칭찬 제외가 붙는다', () => {
  const plan = planOf(
    base(['주거'], [['income', 200], ['saving_now', 30], ['saved', 400], ...rentHouse('2027-04', 1000, 85)]),
  );
  const s = stepsOf(plan);
  assert.match(s.cashflow.personal[1], /매달 \d+만 원이 모자라요\.$/);
  assert.ok(!s.cashflow.personal.join(' ').includes('−'));
  const score = scoreFromPlan(plan);
  assert.ok(score.penalties.some(p => p.id === 'deficit' && p.points === 10));
  assert.ok(!/주거비가 월급의 .*무리 없는/.test(score.comment));
});

test('저축률 0%를 "평균보다 높아요"라고 칭찬하지 않는다', () => {
  const plan = planOf([
    ['purposes', ['비상자금']],
    ['goal', { amount: 500, months: 12 }],
    ['income', 200],
    ['saving_now', 0],
    ['saved', 0],
    ['has_debt', 'yes'],
    ['debt', { remain: 3000, monthly: 60 }],
    ['employment', '계약직'],
    ['region', { sido: '경기', sigungu: '' }],
    ['age', 25],
  ]);
  const score = scoreFromPlan(plan);
  assert.ok(!score.comment.includes('높아요'));
  const s = stepsOf(plan);
  assert.equal(s.budget.figure, '매달 모을 돈부터 만들기');
  assert.equal(s.saving_method.figure, '목적별 통장 먼저 만들기');
  assert.equal(s.emergency.now, '0원 모음');
});

test('전세·매매 대출은 연 4% 이자를 주거비로 더하고, 매매는 "집값"으로 말한다', () => {
  const plan = planOf(
    base(
      ['주거'],
      [
        ['income', 450],
        ['saving_now', 200],
        ['saved', 15000],
        ['housing_type', '매매'],
        ['deposit', 50000],
        ['move_in', '2029-12'],
        ['loan_plan', '예'],
        ['loan_amount', 30000],
      ],
    ),
  );
  assert.equal(plan.cashflow.loanInterest, 100);
  assert.equal(plan.cashflow.housingCost, 100);
  const s = stepsOf(plan);
  assert.equal(s.housing_deposit.title, '집값·이사 비용 마련하기');
  assert.equal(s.housing_budget.figure, '집값 5억 원 안에서 정하기');
  assert.ok(!s.contract_check.personal.join(' ').includes('보증금'));
  assert.notEqual(scoreFromPlan(plan).items.at(-1).id, 'debt');
});

test('비현실적인 해결책은 숨기고, 목표 조정은 실제 부족액에 맞춘다', () => {
  const plan = planOf(
    base(
      ['주거'],
      [
        ['goal', { amount: 15000, months: 6 }], // 기본 목표를 다시 답해서 덮어써요
        ['income', 330],
        ['saving_now', 150],
        ['saved', 3000],
        ['housing_type', '전세'],
        ['deposit', 15000],
        ['move_in', '2027-03'],
        ['commute_now', 0],
        ['loan_plan', '아니요'],
      ],
    ),
  );
  assert.ok(!plan.fixes.some(f => f.kind === 'spend')); // 매달 2,000만 원 넘는 저축은 보여 주지 않음
  const adjust = plan.fixes.find(f => f.kind === 'adjust');
  assert.ok(adjust && !adjust.headline.includes('500만 원'));
  const score = scoreFromPlan(plan);
  assert.ok(score.total < 60, `큰 부족인데 ${score.total}점`);
});

test('월세 권장 상한이 너무 낮으면 금액 대신 함께 줄이자고 안내한다', () => {
  const plan = planOf(
    base(
      ['주거', '비상자금'],
      [
        ['income', 180],
        ['saving_now', 20],
        ['saved', 300],
        ['employment', '프리랜서·기타'],
        ...rentHouse('2027-06', 500, 45),
      ],
    ),
  );
  const s = stepsOf(plan);
  assert.equal(s.housing_budget.figure, '주거비와 생활비 함께 줄이기');
  assert.equal(money(0), '0원');
});
