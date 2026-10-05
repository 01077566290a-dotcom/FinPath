import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from '../lib/plan/index.js';
import { buildDemoProfile, DEMO_ASSUMPTIONS } from '../lib/plan/demoProfile.js';
import { answer, buildProfile } from '../lib/goal/engine.js';
import { scoreFromPlan, saveScore, housingScore, debtScore } from '../lib/report/score.js';
import { methodFromPlan } from '../lib/report/method.js';
import { viewFromPlan, SUGGESTED_CUTS } from '../lib/report/fromPlan.js';
import { BENCHMARKS } from '../lib/report/benchmarks.js';

const NOW = new Date(2026, 9, 15);
const demoPlan = () => buildPlan(buildDemoProfile(), { assumptions: DEMO_ASSUMPTIONS });

function planOf(steps) {
  let answers = {};
  for (const [id, value] of steps) {
    const result = answer(answers, id, value, { now: NOW });
    assert.equal(result.error, null, `${id}: ${result.error}`);
    answers = result.answers;
  }
  return buildPlan(buildProfile(answers, { now: NOW }));
}
const SAVER = [
  ['purposes', ['비상자금']],
  ['goal', { amount: 500, months: 12 }],
  ['income', 245],
  ['saving_now', 73],
  ['saved', 680],
  ['has_debt', 'no'],
  ['employment', '정규직'],
  ['region', { sido: '서울', sigungu: '마포구' }],
  ['age', 27],
];

test('점수 규칙: 항목별 25점, 기준값에 맞춰 움직인다', () => {
  assert.equal(saveScore(0), 0);
  assert.equal(saveScore(35), 25);
  assert.equal(saveScore(50), 25);
  assert.equal(housingScore(BENCHMARKS.youthRentRate.value), 25);
  assert.equal(housingScore(BENCHMARKS.rentBurdenLimit.value), 12);
  assert.equal(housingScore(60), 0);
  assert.equal(debtScore(0), 25);
  assert.equal(debtScore(20), 0);
});

test('정하은: 64점 "잘하고 있어요", 아쉬운 점은 독립 후 저축률', () => {
  const score = scoreFromPlan(demoPlan());
  assert.equal(score.total, 64);
  assert.equal(score.grade, '잘하고 있어요');
  assert.deepEqual(
    score.items.map(i => i.id),
    ['saving', 'emergency', 'goal', 'housing'],
  );
  assert.match(score.comment, /독립 후 저축률이 6\.9%로 청년 가구 평균\(24\.7%\)보다 낮아요/);
  assert.match(score.action, /입주를 2028년 3월로/);
});

test('평균보다 많이 저축하는 사람에게 "낮아요"라고 말하지 않는다', () => {
  const score = scoreFromPlan(planOf(SAVER));
  const saving = score.items.find(i => i.id === 'saving');
  assert.ok(saving.value > BENCHMARKS.youthSaveRate.value);
  assert.doesNotMatch(score.comment, /낮아요/);
  assert.equal(
    score.items.some(i => i.id === 'debt'),
    true,
  ); // 주거를 안 고르면 빚 상환 비중으로 봐요
});

test('계산 방법은 내 숫자를 넣은 식과 출처를 보여 준다', () => {
  const plan = demoPlan();
  const view = viewFromPlan(plan, { demo: true });
  const sections = methodFromPlan(plan, view, scoreFromPlan(plan));
  const byId = Object.fromEntries(sections.map(s => [s.id, s]));
  assert.equal(byId.needed.result, '1,884만 원');
  assert.ok(byId.collectable.lines[0].includes('680만 원 + 매달 73만 원 × 11개월 = 1,483만 원'));
  assert.ok(byId.collectable.lines[1].includes('= 401만 원'));
  assert.ok(byId.flow.lines.some(l => l.includes('매달 17만 원')));
  assert.ok(byId.sources.lines.some(l => l.includes('통계청 가계동향조사')));
  assert.ok(byId.sources.lines.some(l => l.includes('주거실태조사')));
});

test('줄일 지출을 답하지 않으면 리포트에서 고를 예시 항목을 보여 준다', () => {
  const view = viewFromPlan(planOf(SAVER));
  assert.equal(view.cuts.length, SUGGESTED_CUTS.length);
  assert.ok(view.cuts.every(c => c.suggested && c.annual === c.cut * 12));
  const demo = viewFromPlan(demoPlan(), { demo: true });
  assert.equal(
    demo.cuts.some(c => c.suggested),
    false,
  ); // 답한 항목이 있으면 그 항목을 써요
});

const INVEST_ONLY = [
  ['purposes', ['투자']],
  ['goal', { amount: 1000, months: 36 }],
  ['income', 280],
  ['saving_now', 90],
  ['saved', 500],
  ['has_debt', 'no'],
  ['invest_months', 60],
  ['invest_monthly', 30],
  ['region', { sido: '경기', sigungu: null }],
  ['age', 29],
];

test('투자만 고르면 "필요한 돈 0만 원·목표 준비도 0%" 대신 투자 숫자로 보여 준다', () => {
  const plan = planOf(INVEST_ONLY);
  const view = viewFromPlan(plan);
  assert.equal(view.status, 'invest');
  assert.deepEqual(view.investOnly, { cap: 30, months: 60, possible: 30, total: 1800 });
  assert.match(view.verdict.headline, /매달 30만 원씩 투자할 수 있어요/);
  const goal = scoreFromPlan(plan).items.find(i => i.id === 'goal');
  assert.equal(goal.label, '투자 여력');
  assert.equal(goal.value, 100);
});

test('기한까지 부족한 돈이 있으면 점수가 높아도 "아주 좋아요"를 주지 않는다', () => {
  const plan = planOf([
    ['purposes', ['주거', '투자']],
    ['goal', { amount: 5000, months: 24 }],
    ['income', 320],
    ['saving_now', 120],
    ['saved', 2000],
    ['has_debt', 'yes'],
    ['debt', { remain: 1500, monthly: 30 }],
    ['housing_type', '전세'],
    ['deposit', 15000],
    ['move_in', '2028-03'],
    ['commute_now', 10],
    ['commute_after', 5],
    ['loan_plan', '예'],
    ['loan_amount', 10000],
    ['invest_months', 36],
    ['invest_monthly', 20],
    ['region', { sido: '경기', sigungu: null }],
    ['age', 29],
  ]);
  assert.ok(plan.core.gap > 0);
  const score = scoreFromPlan(plan);
  assert.notEqual(score.grade, '아주 좋아요');
  // 전세는 월세가 없어서 주거비 비중 대신 빚 상환 비중으로 봐요
  assert.deepEqual(
    score.items.map(i => i.id),
    ['saving', 'emergency', 'goal', 'debt'],
  );
});

test('목표 금액·기간을 모른다고 하면 임의의 준비도 대신 "다 모으는 속도"로 본다', () => {
  const plan = planOf([
    ['purposes', ['비상자금']],
    ['goal', 'unknown'],
    ['income', 230],
    ['saving_now', 40],
    ['saved', 150],
    ['has_debt', 'no'],
    ['employment', '계약직'],
    ['region', { sido: '경기', sigungu: null }],
    ['age', 29],
  ]);
  const goal = scoreFromPlan(plan).items.find(i => i.id === 'goal');
  assert.equal(goal.label, '다 모으는 속도');
  assert.equal(goal.value, plan.core.monthsNeeded <= 36 ? 80 : 60);
  assert.match(goal.compare.label, /에 다 모음/);
});
