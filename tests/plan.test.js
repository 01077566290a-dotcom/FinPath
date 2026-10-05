import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answer, buildProfile } from '../lib/goal/engine.js';
import { buildPlan } from '../lib/plan/index.js';
import { viewFromPlan } from '../lib/report/fromPlan.js';

// 기준 달: 2026년 10월 (docs/demo-persona.md와 같음)
const NOW = new Date(2026, 9, 15);

function profileOf(steps) {
  // 결혼·빚 상환은 입력 화면 목적에서 뺐지만(2026-10-04) 엔진은 계속 계산할 수 있어야 해요.
  // 그래서 목적 답만 화면 검증을 건너뛰고 넣어요. 나머지 답은 그대로 검증해요.
  let answers = {};
  const purposes = steps.find(([id]) => id === 'purposes')?.[1];
  if (purposes) answers = { purposes };
  // 목적을 먼저 답해야 목적별 질문(고용 형태 등)이 보여요. (입력 화면도 목적을 먼저 물어요)
  const ordered = steps.filter(([id]) => id !== 'purposes');
  for (const [id, value] of ordered) {
    const result = answer(answers, id, value, { now: NOW });
    assert.equal(result.error, null, `${id}: ${result.error}`);
    answers = result.answers;
  }
  return buildProfile(answers, { now: NOW });
}

const COMMON = [
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
];
const CUTS = [
  [
    'cuttable',
    [
      { item: '통신비', monthly: 5 },
      { item: '구독', monthly: 3 },
      { item: '외식·배달', monthly: 20 },
    ],
  ],
];
const HOUSING = [
  ['housing_type', '월세'],
  ['deposit', 1000],
  ['rent', { rent: 60, maintenance: 8 }],
  ['move_in', '2027-09'],
  ['commute_after', 6],
  ['loan_plan', '아니요'],
];
const HAEUN = profileOf([...COMMON, ['purposes', ['주거', '비상자금']], ...CUTS, ...HOUSING]);
// docs/demo-persona.md의 [가정]: 독립 후 변동 생활비 105 → 100
const haeun = buildPlan(HAEUN, { assumptions: { variableAfterDelta: -5 } });

test('일부 목표만 완료되면 전체 완료 날짜와 기간 연장을 안내하지 않는다', () => {
  const profile = structuredClone(HAEUN);
  profile.purposes.push('결혼');
  profile.detail['결혼'] = { wedding_months: 24, wedding_cost: 3000, family_support: 0, partner_share: 0 };
  profile.money.saving_now = 10;
  const plan = buildPlan(profile);
  assert.notEqual(plan.scenarios.A.done.housing, null);
  assert.equal(plan.scenarios.A.done.wedding, null);
  assert.equal(plan.core.monthsNeeded, null);
  assert.equal(plan.core.doneLabel, null);
  assert.equal(
    plan.fixes.some(fix => fix.kind === 'extend'),
    false,
  );
  assert.ok(plan.savings.every(item => item.sooner === null));
  const view = viewFromPlan(plan);
  assert.equal(view.status, 'cannot');
  assert.match(view.verdict.headline, /모든 목표/);
  assert.doesNotMatch(view.verdict.sentence, /준비가 끝나요|null/);
});

test('이미 모든 목표를 채운 경우 완료 시점 0개월을 유지한다', () => {
  const profile = structuredClone(HAEUN);
  profile.money.saved = 10000;
  const plan = buildPlan(profile);
  assert.equal(plan.core.monthsNeeded, 0);
  assert.equal(plan.core.doneLabel, plan.asOfLabel);
});

test('정하은: 월 현금흐름이 정답지와 같다 (지금 73 → 독립 후 17)', () => {
  assert.deepEqual(haeun.cashflow.now, { spend: 172, save: 73, rate: 29.8 });
  assert.deepEqual(haeun.cashflow.after, { spend: 228, save: 17, rate: 6.9 });
});

test('정하은: 실제로 필요한 돈 1,884 (비상자금 684 + 주거 1,200)', () => {
  const [emergency, housing] = haeun.goals;
  assert.equal(emergency.target, 684);
  assert.equal(housing.target, 1200);
  assert.equal(haeun.core.needed, 1884);
  assert.equal(haeun.core.collectable, 1483);
  assert.equal(haeun.core.gap, 401);
  assert.equal(haeun.core.readiness, 79);
  assert.equal(haeun.core.doneLabel, '2028년 3월');
});

test('규칙 A: 비상자금 1개월 뒤, 주거 17개월 뒤', () => {
  const A = haeun.scenarios.A;
  assert.equal(A.done.emergency, 1);
  assert.equal(A.done.housing, 17);
  assert.equal(A.doneLabels.housing, '2028년 3월');
});

test('규칙 B: 주거 12개월 뒤(A보다 5개월 빠름), 독립 직후 비상자금 356, 32개월 뒤 완성', () => {
  const B = haeun.scenarios.B;
  assert.equal(B.done.housing, 12);
  assert.equal(B.emergencyAtMove, 356);
  assert.equal(B.done.emergency, 32);
  assert.equal(B.thinMonths, 20);
  assert.equal(haeun.comparison.fasterBy, 5);
  assert.equal(haeun.comparison.protectedMonthsB, 1.5);
  assert.equal(haeun.comparison.safer, 'A');
});

test('절약 효과: 5/8/28만 원 → 1/2/5개월 앞당김', () => {
  assert.deepEqual(
    haeun.savings.map(row => [row.totalCut, row.months, row.sooner]),
    [
      [5, 16, 1],
      [8, 15, 2],
      [28, 12, 5],
    ],
  );
});

test('개인화: 필요한 저축이 무리면 기간을 늘리고 이유와 상한을 알려준다', () => {
  const { budget } = haeun;
  assert.equal(budget.verdict, 'extend');
  assert.equal(budget.burdenHigh, true); // 독립 후 저축률 7% < 10%
  assert.equal(budget.plan.monthly, 101); // 지금 저축 73 + 줄일 수 있는 28
  assert.ok(budget.period.to > budget.period.from);
  assert.ok(budget.reasons.some(r => r.includes('독립하면 저축이')));
  assert.equal(budget.housing.affordable.max, 60); // 월세·관리비 68은 상한 60보다 큼
  assert.equal(budget.housing.tooHigh, true);
  assert.ok(haeun.text.some(line => line.includes('이하가 좋아요')));
});

test('개인화: 여유 있는 사람은 지금 속도로 충분하다고 나온다', () => {
  const rich = profileOf([
    ['income', 400],
    ['has_debt', 'no'],
    ['fixed_items', { 통신비: 5, 보험: 5 }],
    ['saving_now', 250],
    ['saved', 3000],
    ['employment', '정규직'],
    ['age', 28],
    ['region', { sido: '서울', sigungu: null }],
    ['goal', { amount: 3000, months: 12 }],
    ['purposes', ['비상자금']],
    ['cuttable', []],
  ]);
  const plan = buildPlan(rich);
  assert.equal(plan.budget.verdict, 'on_track');
  assert.equal(plan.goals[0].target, 150 * 3); // 한 달 생활비 = 월급 − 저축
});

test('결혼·투자·빚 상환: 목적별 계산과 투자는 마지막에 남는 돈으로', () => {
  const profile = profileOf([
    ...COMMON.filter(([id]) => id !== 'goal'),
    ['goal', UNKNOWN_GOAL()],
    ['purposes', ['결혼', '투자', '빚 상환']],
    ['cuttable', []],
    ['wedding_when', '2028-10'],
    ['wedding_cost', 4000],
    ['family_support', 1000],
    ['partner_share', 50],
    ['invest_months', 24],
    ['invest_monthly', 20],
    ['debt_period', 12],
  ]);
  const plan = buildPlan(profile);
  const byId = Object.fromEntries(plan.goals.map(g => [g.id, g]));
  assert.equal(byId.wedding.target, 1000); // 4000 - 2000(50%) - 1000
  assert.equal(byId.wedding.deadline, 24);
  assert.equal(byId.debt.target, (35 - 15) * 12); // 420 / 12 = 35 → 매달 20 더
  assert.equal(byId.invest.target, 0);
  const A = plan.scenarios.A;
  assert.ok(A.done.debt < A.done.wedding); // 기한이 급한 목표부터
  assert.ok(A.investStart >= A.done.wedding); // 투자는 마지막
});

test('모른다고 답한 값은 기준값으로 채우고 표시한다', () => {
  const unknown = profileOf([
    ...COMMON.filter(([id]) => id !== 'goal'),
    ['goal', UNKNOWN_GOAL()],
    ['purposes', ['주거']],
    ['cuttable', []],
    ['housing_type', '월세'],
    ['deposit', 'unknown'],
    ['rent', 'unknown'],
    ['move_in', '2027-09'],
    ['commute_after', 6],
    ['loan_plan', '아니요'],
  ]);
  const plan = buildPlan(unknown);
  assert.deepEqual(plan.usedDefaults, ['deposit', 'rent', 'maintenance']);
  assert.equal(plan.cashflow.housingCost, 68);
  assert.equal(plan.core.goal, null);
});

function UNKNOWN_GOAL() {
  return 'unknown';
}

// ── 리포트·지도용 파생 데이터 ──
import { buildPlanRoadmap } from '../lib/plan/steps.js';
import { filterPolicies } from '../lib/goal/policies.js';
import { readFileSync } from 'node:fs';

const policyData = JSON.parse(readFileSync(new URL('../data/policies.json', import.meta.url), 'utf8'));

test('리포트 데이터: 정하은 핵심 지표·일정·해결 방법이 정답지와 같다', () => {
  assert.deepEqual(
    haeun.metrics.map(m => m.id),
    ['emergency', 'housing', 'saving', 'debt'],
  );
  assert.deepEqual(
    haeun.metrics[0].rows.map(r => r.value),
    [3.9, 2.9],
  );
  assert.match(haeun.fixes[0].detail, /6개월/);
  assert.match(haeun.fixes[1].headline, /110만 원/);
  assert.match(haeun.fixes[2].detail, /1,384만 원.*2027년 8월/);
  const months = haeun.milestones.map(m => m.month);
  assert.deepEqual(
    months,
    [...months].sort((a, b) => a - b),
  );
  assert.equal(haeun.series[0].base, 680);
  assert.ok(haeun.series.at(-1).base >= haeun.core.needed);
  assert.match(haeun.summary, /79%/);
});

test('리포트 데이터: 목적이 달라도(비상자금만) 깨지지 않는다', () => {
  const only = buildPlan(
    profileOf([
      ...COMMON.filter(([id]) => id !== 'goal'),
      ['goal', 'unknown'],
      ['purposes', ['비상자금']],
      ['cuttable', []],
    ]),
  );
  assert.equal(only.fixes.length >= 0, true);
  assert.ok(only.series.length >= 3);
  assert.ok(only.metrics.every(m => m.id !== 'housing'));
  assert.ok(only.milestones.length >= 1);
  assert.equal(only.core.goal, null);
});

test('지도: 단계 카드에 내 금액이 들어가고 정책이 붙는다', () => {
  const roadmap = buildPlanRoadmap(haeun, filterPolicies(HAEUN, policyData));
  const ids = roadmap.steps.map(s => s.id);
  for (const id of [
    'cashflow',
    'budget',
    'saving_method',
    'emergency',
    'housing_budget',
    'housing_deposit',
    'move_in_cost',
  ])
    assert.ok(ids.includes(id), id);
  const byId = Object.fromEntries(roadmap.steps.map(s => [s.id, s]));
  assert.match(byId.emergency.figure, /912/); // 684 + 주거비 부담으로 더 쌓는 1개월치 228
  assert.ok(byId.emergency.personal.some(line => line.includes('228만 원을 더')));
  assert.match(byId.housing_deposit.figure, /보증금 1,000/); // 이사·초기 비용은 다음 단계(move_in_cost)에만
  assert.equal(
    byId.housing_deposit.personal.some(line => line.includes('200만 원')),
    false,
  );
  assert.match(byId.move_in_cost.figure, /200/);
  assert.match(byId.move_in_cost.personal[0], /^예상 금액: 중개수수료 \d+만 원 \+ 이사비/);
  // 한 단계 안에서 같은 비율을 두 번 말하지 않는다
  assert.equal(byId.budget.personal.filter(line => line.includes('53.5%')).length, 1);
  assert.ok(byId.housing_budget.personal.some(line => line.includes('60만 원 이하')));
  assert.ok(byId.housing_budget.policies.length > 0); // data/policies.json의 step과 id가 맞아야 함
  // 숫자 없는 카드가 없다
  for (const step of roadmap.steps) assert.ok(step.personal.length > 0, step.id);
  // 번호는 1부터 이어지고, 기한이 빠른 단계가 앞에 온다
  assert.deepEqual(
    roadmap.steps.map(s => s.number),
    roadmap.steps.map((_, i) => i + 1),
  );
  const months = roadmap.steps.map(s => s.month);
  assert.deepEqual(
    months,
    [...months].sort((a, b) => a - b),
  );
  assert.equal(roadmap.groups.flatMap(g => g.steps).length, roadmap.steps.length);
});

test('지도: 결혼·투자·빚 상환 단계도 만들어진다', () => {
  const profile = profileOf([
    ...COMMON.filter(([id]) => id !== 'goal'),
    ['goal', 'unknown'],
    ['purposes', ['결혼', '투자', '빚 상환']],
    ['cuttable', []],
    ['wedding_when', '2028-10'],
    ['wedding_cost', 4000],
    ['family_support', 1000],
    ['partner_share', 50],
    ['invest_months', 24],
    ['invest_monthly', 20],
    ['debt_period', 12],
  ]);
  const roadmap = buildPlanRoadmap(buildPlan(profile), []);
  const ids = roadmap.steps.map(s => s.id);
  for (const id of ['wedding', 'debt', 'invest']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('housing_budget'));
});

test('지도: 규칙 B로 바꾸면 비상자금 단계가 주거 뒤로 밀린다', () => {
  const policies = filterPolicies(HAEUN, policyData);
  const a = buildPlanRoadmap(haeun, policies, { rule: 'A' }).steps.map(s => s.id);
  const b = buildPlanRoadmap(haeun, policies, { rule: 'B' }).steps.map(s => s.id);
  assert.ok(a.indexOf('emergency') < a.indexOf('housing_deposit'));
  assert.ok(b.indexOf('emergency') > b.indexOf('housing_deposit'));
});
