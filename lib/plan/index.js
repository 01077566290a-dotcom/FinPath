// 2번(계산·개인화) 진입점: 1번 프로필 JSON → 타임라인·리포트가 쓰는 숫자
// buildPlan(profile) 하나만 부르면 됩니다. 금액 단위: 만 원, 예적금 이자·투자 수익률은 넣지 않습니다.
import { monthLabel } from '../report/computeReport.js';
import { PLAN_CONFIG } from './config.js';
import { toPlanInput } from './inputs.js';
import { cashflowOf, buildGoals } from './purposes.js';
import { simulate, RULES } from './simulate.js';
import { analyzeBudget } from './budget.js';
import { buildSeries, buildMetrics, buildMilestones, buildFixes, buildSummary } from './extras.js';
import { money } from '../report/format.js';

const floor1 = value => Math.floor(value * 10) / 10;
// 금액 표기는 리포트와 같은 규칙(1억 이상은 '1억 2,345만 원')
const won = n => money(n);

export { PLAN_CONFIG, toPlanInput, RULES };

// 규칙 하나의 시뮬레이션 결과를 화면용으로 정리 (history는 길어서 빼고 요약만)
function summarize(sim, goals, at) {
  const { history, ...rest } = sim;
  const label = month => (month === null ? null : at(month));
  // 첫 달에 목표별로 얼마가 들어가는지 (통장 나누기 안내용)
  const firstMonth = Object.fromEntries(
    goals.map(g => [g.id, (history[1]?.[g.id] ?? history[0][g.id]) - history[0][g.id]]),
  );
  const milestones = goals
    .filter(g => g.id !== 'invest' && sim.done[g.id] !== null)
    .map(g => ({ id: g.id, month: sim.done[g.id], label: at(sim.done[g.id]), title: `${g.label} 완성` }));
  if (sim.investStart !== null)
    milestones.push({ id: 'invest', month: sim.investStart, label: at(sim.investStart), title: '투자 시작' });
  milestones.sort((a, b) => a.month - b.month);
  return {
    ...rest,
    firstMonth,
    doneLabels: Object.fromEntries(Object.entries(sim.done).map(([id, month]) => [id, label(month)])),
    milestones,
  };
}

// 규칙 A·B 비교 문장. 독립 후 저축이 적은 사람에게는 규칙 A가 안전하다는 점이 숫자로 드러납니다.
function compareRules(A, B, goals, cashflow) {
  const housing = goals.find(g => g.id === 'housing');
  const emergency = goals.find(g => g.id === 'emergency');
  if (!housing || !emergency || A.done.housing === null || B.done.housing === null) return null;
  const faster = A.done.housing - B.done.housing;
  const monthlySpend = cashflow.after.spend;
  const protectedMonths = B.emergencyAtMove === null ? null : floor1(B.emergencyAtMove / monthlySpend);
  return {
    fasterBy: faster, // B가 A보다 독립이 몇 개월 빠른지
    thinMonths: B.thinMonths, // B에서 비상자금이 얇은 채로 지내는 개월 수
    protectedMonthsB: protectedMonths,
    text:
      faster > 0
        ? `규칙 B는 독립이 ${faster}개월 빠르지만, 독립 직후 비상자금이 생활비의 ${protectedMonths}개월치뿐이고 ${B.thinMonths}개월 동안 보호가 얇아요.`
        : '두 규칙의 독립 시점이 같아요.',
    safer: B.thinMonths > 0 && cashflow.after.save < cashflow.now.save / 2 ? 'A' : null,
  };
}

export function buildPlan(profile, { assumptions = {}, config = PLAN_CONFIG } = {}) {
  const input = toPlanInput(profile, { assumptions, config });
  const at = month => monthLabel(input.asOf, month);
  const cashflow = cashflowOf(input);
  const goals = buildGoals(input, cashflow, config);
  const budget = analyzeBudget({ input, cashflow, goals, config });

  const run = (rule, targetGoals = goals, extra = 0) =>
    simulate({
      goals: targetGoals,
      saved: input.saved,
      saveBefore: input.saveNow + extra,
      saveAfter: cashflow.after.save,
      rule,
      config,
    });

  // 지금 속도 그대로일 때: 규칙 A·B를 모두 계산합니다.
  const sims = { A: run('A'), B: run('B') };
  const scenarios = { A: summarize(sims.A, goals, at), B: summarize(sims.B, goals, at) };

  // 추천 계획(개인화 결과)대로 모을 때
  const planMonthly = budget.plan.monthly;
  const planExtra = planMonthly - input.saveNow;
  const recommended = {
    monthly: planMonthly,
    A: summarize(run('A', budget.planGoals, planExtra), budget.planGoals, at),
    B: summarize(run('B', budget.planGoals, planExtra), budget.planGoals, at),
  };

  // 핵심 숫자 세 개: 내가 생각한 목표 / 실제로 필요한 돈 / 지금 계획으로 모을 수 있는 돈
  const needed = goals.filter(g => g.id !== 'invest').reduce((a, g) => a + g.target, 0);
  const timed = goals.filter(g => g.deadline !== null && g.id !== 'invest');
  const housing = goals.find(g => g.id === 'housing');
  const deadline = housing
    ? housing.deadline
    : timed.length
      ? Math.min(...timed.map(g => g.deadline))
      : (input.goal?.months ?? null);
  const collectable = deadline === null ? null : input.saved + input.saveNow * deadline;
  const completionMonths = goals.filter(g => g.id !== 'invest').map(g => sims.A.done[g.id]);
  const lastDone =
    completionMonths.length && completionMonths.every(month => month !== null) ? Math.max(...completionMonths) : null;
  const core = {
    goal: input.goal?.amount ?? null,
    goalMonths: input.goal?.months ?? null,
    needed,
    collectable,
    gap: collectable === null ? null : needed - collectable,
    readiness: collectable === null || needed === 0 ? null : Math.round((collectable / needed) * 100),
    deadline,
    deadlineLabel: deadline === null ? null : at(deadline),
    monthsNeeded: lastDone, // 모든 목표를 채우지 못하면 완료 시점을 표시하지 않아요.
    doneLabel: lastDone !== null ? at(lastDone) : null,
    missing: input.goal ? needed - input.goal.amount : null, // 내가 생각한 목표가 실제 필요액보다 얼마 모자란지
  };

  // 아낄 수 있는 것: 누적 절약 → 앞당겨지는 개월 (규칙 A 기준)
  let cut = 0;
  const savings = input.cuttable.map(item => {
    cut += item.monthly;
    const sim = run('A', goals, cut);
    const months = Math.max(...goals.filter(g => g.id !== 'invest').map(g => sim.done[g.id] ?? Infinity), 0);
    const finite = Number.isFinite(months);
    return {
      item: item.item,
      cut: item.monthly,
      totalCut: cut,
      months: finite ? months : null,
      sooner: finite && lastDone !== null ? lastDone - months : null,
      doneLabel: finite ? at(months) : null,
    };
  });

  // 진단 문장용 숫자
  const debt = input.debt;
  const debtMonths = debt && debt.monthly > 0 ? Math.ceil(debt.remain / debt.monthly) : null;
  const diagnosis = {
    surviveNow: input.spendNow > 0 ? floor1(input.saved / input.spendNow) : null,
    surviveAfter: cashflow.after.spend > 0 ? floor1(input.saved / cashflow.after.spend) : null,
    saveRateNow: cashflow.now.rate,
    saveRateAfter: cashflow.after.rate,
    spendIncrease: cashflow.after.spend - cashflow.now.spend,
    debt: debt && { ...debt, months: debtMonths, doneLabel: debtMonths === null ? null : at(debtMonths) },
  };

  const ctx = { input, cashflow, goals, core, budget, scenarios, recommended, savings, diagnosis, at, config };
  return {
    asOf: input.asOf,
    asOfLabel: at(0),
    region: input.region,
    // 리포트 머리글·단계 카드에 쓰는 입력 요약
    profile: {
      age: profile.age,
      employment: input.employment,
      purposes: input.purposes,
      income: input.income,
      saved: input.saved,
      saveNow: input.saveNow,
      housingType: input.housing?.type ?? null,
    },
    cashflow,
    goals,
    core,
    budget,
    housing: input.housing,
    scenarios,
    comparison: compareRules(sims.A, sims.B, goals, cashflow),
    recommended,
    savings,
    diagnosis,
    series: buildSeries(ctx),
    metrics: buildMetrics(ctx),
    milestones: buildMilestones(ctx),
    fixes: buildFixes(ctx),
    summary: buildSummary(ctx),
    usedDefaults: input.usedDefaults,
    // 근거가 초안인 기준값이 하나라도 쓰였으면 화면에 "일반적으로" 표현을 붙입니다.
    generic: true,
    text: planText({ input, cashflow, core, budget, at }),
  };
}

// 개인화 문장 (리포트·타임라인 카드에 그대로 쓸 수 있는 한 줄들)
function planText({ input, cashflow, core, budget, at }) {
  const lines = [];
  const p = budget.plan;
  if (budget.verdict === 'on_track')
    lines.push(
      core.deadline === null
        ? `지금 매달 ${won(p.monthly)}(월급의 ${p.saveRate}%)을 모으고 있어요.`
        : `지금처럼 매달 ${won(p.monthly)}(월급의 ${p.saveRate}%)을 모으면 기한 안에 가능해요.`,
    );
  else if (budget.verdict === 'cut_spending')
    lines.push(
      `기한에 맞추려면 월급의 ${p.saveRate}%(${won(p.monthly)})를 모아야 해요. 생활비는 월 최대 ${won(p.livingMax)}까지 쓸 수 있어요.`,
    );
  else if (budget.verdict === 'extend')
    lines.push(
      `${
        budget.required.monthly > input.income
          ? `기한에 맞추려면 매달 ${won(budget.required.monthly)}이 필요해서 월급으로는 어려워요.`
          : `기한에 맞추려면 매달 ${won(budget.required.monthly)}(월급의 ${budget.required.rate}%)을 모아야 해요.`
      } 월 ${won(p.monthly)}(${p.saveRate}%)씩 모으는 속도로 기간을 ${budget.period.from}개월에서 ${budget.period.to}개월로 늘리는 걸 권해요.`,
    );
  else lines.push('지금은 모을 수 있는 돈이 없어서, 지출을 줄이는 것부터 시작해야 해요.');
  budget.reasons.forEach(reason => lines.push(reason));
  if (budget.housing?.tooHigh)
    lines.push(
      budget.housing.affordable.unrealistic
        ? `독립 후 저축을 지키려면 ${cashflow.housingName}를 ${won(budget.housing.affordable.max)} 이하로 맞춰야 하는데, 이 금액으로는 집을 구하기 어려워요. 주거비와 함께 생활비도 줄여야 해요.`
        : `독립 후 저축을 지키려면 ${cashflow.housingName}는 ${won(budget.housing.affordable.max)} 이하가 좋아요. (지금 계획 ${won(cashflow.housingCost)})`,
    );
  if (core.missing !== null && core.missing > 0)
    lines.push(`생각한 목표는 ${won(core.goal)}이었지만 실제로 필요한 돈은 ${won(core.needed)}이에요.`);
  return lines;
}
