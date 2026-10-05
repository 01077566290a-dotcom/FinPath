// 리포트가 쓰는 파생 숫자: 그래프 데이터, 핵심 지표, 앞으로의 일정, 부족분 해결 방법, 요약 문장.
// buildPlan이 계산한 값(ctx)을 받아 화면용으로 정리할 뿐, 새 판단은 하지 않습니다.
import { PLAN_CONFIG } from './config.js';
import { money } from '../report/format.js';

const round1 = value => Math.round(value * 10) / 10;
const floor1 = value => Math.floor(value * 10) / 10; // 버틸 수 있는 기간은 내림해서 안전을 부풀리지 않습니다.
// 금액 표기는 리포트와 같은 규칙(1억 이상은 '1억 2,345만 원')
const won = n => money(n);
const MAX_MONTHS = 120;

export const monthsToReach = (amount, monthly) => (amount <= 0 ? 0 : monthly > 0 ? Math.ceil(amount / monthly) : null);

const mainGoals = goals => goals.filter(g => g.id !== 'invest');
const lastDone = (sim, goals) => {
  const months = mainGoals(goals).map(g => sim.done[g.id]);
  return months.length && months.every(m => m !== null) ? Math.max(...months) : null;
};

// 모은 돈 누적 그래프: 지금 속도 vs 권장 속도. 필요한 돈에 닿는 달 다음 달까지만 그립니다.
export function buildSeries({ input, core, budget, at }) {
  const horizon = Math.min(MAX_MONTHS, Math.max(2, (core.monthsNeeded ?? Math.max(core.deadline ?? 0, 12)) + 1));
  const planMonthly = budget.plan.monthly;
  return Array.from({ length: horizon + 1 }, (_, month) => ({
    month,
    label: at(month),
    base: input.saved + input.saveNow * month,
    saving: input.saved + Math.max(planMonthly, input.saveNow) * month,
  }));
}

// 핵심 지표 게이지 (비상자금으로 버틸 기간 / 주거비 비율 / 저축률 / 빚 상환 비율)
export function buildMetrics({ input, cashflow, goals, diagnosis, config = PLAN_CONFIG }) {
  const income = input.income;
  const emergency = goals.find(g => g.id === 'emergency');
  const targetMonths =
    emergency?.months ?? config.emergencyMonths.values[input.employment] ?? config.emergencyMonths.fallback;
  const after = cashflow.after.spend > 0 ? input.saved / cashflow.after.spend : 0;
  const hasHousing = Boolean(input.housing);
  const cap = config.limits.housingCap.value;
  const metrics = [
    {
      id: 'emergency',
      label: '비상자금으로 버틸 수 있는 기간',
      sub: '모아둔 돈 ÷ 한 달 생활비',
      unit: '개월',
      max: targetMonths * 2,
      rows: [
        { key: 'now', label: '지금', value: diagnosis.surviveNow ?? 0 },
        ...(hasHousing ? [{ key: 'after', label: '독립 후', value: diagnosis.surviveAfter ?? 0 }] : []),
      ],
      marker: { value: targetMonths, label: `목표 ${targetMonths}개월` },
      status:
        after >= targetMonths
          ? { tone: 'good', text: '목표 달성' }
          : after >= targetMonths * 0.9
            ? { tone: 'warning', text: `목표의 ${Math.floor((after / targetMonths) * 100)}%` }
            : { tone: 'serious', text: '부족' },
      note: `${hasHousing ? '독립 후 ' : ''}생활비 ${cashflow.after.spend}만 원 기준 목표 ${targetMonths}개월`,
    },
  ];
  if (hasHousing) {
    const rate = (cashflow.housingCost / income) * 100;
    metrics.push({
      id: 'housing',
      label: '월급 중 주거비',
      sub: '월세 + 관리비 ÷ 실수령액',
      unit: '%',
      max: 60,
      rows: [{ key: 'after', label: '독립 후', value: round1(rate) }],
      band: { from: 0, to: cap * 100, label: `일반적으로 ${Math.round(cap * 100)}% 이하`, source: null },
      status: rate <= cap * 100 ? { tone: 'good', text: '기준 안' } : { tone: 'serious', text: '기준 초과' },
      note: input.housing.rent ? '' : '월세가 없는 형태라 월세·관리비는 0으로 봤어요',
    });
  }
  metrics.push({
    id: 'saving',
    label: '저축률',
    sub: '모으는 돈 ÷ 실수령액',
    unit: '%',
    max: 60,
    rows: [
      { key: 'now', label: '지금', value: Math.max(0, cashflow.now.rate) },
      ...(hasHousing ? [{ key: 'after', label: '독립 후', value: Math.max(0, cashflow.after.rate) }] : []),
    ],
    status:
      hasHousing && cashflow.after.rate < cashflow.now.rate / 2
        ? { tone: 'warning', text: '독립 후 크게 줄어요' }
        : { tone: 'good', text: '유지돼요' },
    note: hasHousing
      ? `매달 ${cashflow.now.save}만 원 → ${cashflow.after.save}만 원`
      : `매달 ${cashflow.now.save}만 원`,
  });
  const debt = input.debt;
  if (debt) {
    metrics.push({
      id: 'debt',
      label: '월급 중 빚 상환',
      sub: '매달 상환액 ÷ 실수령액',
      unit: '%',
      max: 60,
      rows: [{ key: 'both', label: '지금·독립 후', value: round1((debt.monthly / income) * 100) }],
      status: { tone: 'info', text: diagnosis.debt?.doneLabel ? `${diagnosis.debt.doneLabel} 상환 완료` : '상환 중' },
      note: `남은 ${won(debt.remain)}, 매달 ${debt.monthly}만 원`,
    });
  }
  return metrics;
}

// 앞으로의 일정 (현재 저축 속도 + 규칙 A 기준)
export function buildMilestones({ input, goals, core, scenarios, recommended, diagnosis, budget, at }) {
  const items = [{ month: 0, title: '지금', text: `모아둔 돈 ${won(input.saved)}`, tone: 'now' }];
  const tones = { emergency: 'emergency', housing: 'housing', wedding: 'wedding', debt: 'debt' };
  for (const goal of mainGoals(goals)) {
    const month = scenarios.A.done[goal.id];
    if (month !== null && month > 0)
      items.push({ month, title: `${goal.label} 완성`, text: `${won(goal.target)}`, tone: tones[goal.id] || 'saving' });
  }
  if (core.deadline !== null && core.gap > 0) {
    const named = goals.find(g => g.deadline === core.deadline);
    items.push({
      month: core.deadline,
      title: `원래 계획한 ${named ? named.label : '목표'} 시점`,
      text: `이때는 ${won(core.gap)} 부족`,
      tone: 'missed',
    });
  }
  const fast = lastDone(recommended.A, budget.planGoals);
  if (fast !== null && budget.plan.monthly > input.saveNow && fast !== core.monthsNeeded)
    items.push({
      month: fast,
      title: '권장 속도로 달성',
      text: `매달 ${won(budget.plan.monthly)} 모을 때`,
      tone: 'saving',
    });
  if (scenarios.A.investStart !== null)
    items.push({
      month: scenarios.A.investStart,
      title: '투자 시작',
      text: '다른 목표를 채운 뒤 남는 돈',
      tone: 'invest',
    });
  if (diagnosis.debt?.months)
    items.push({
      month: diagnosis.debt.months,
      title: '빚 완납',
      text: `이후 매달 ${diagnosis.debt.monthly}만 원 더 저축`,
      tone: 'debt',
    });
  const seen = new Set();
  return items
    .filter(item => item.month <= MAX_MONTHS * 2 && !seen.has(item.title) && seen.add(item.title))
    .map(item => ({
      ...item,
      label: at(item.month),
      short: `${String(Math.floor((input.asOf.year * 12 + input.asOf.month - 1 + item.month) / 12)).slice(2)}.${String(((input.asOf.month - 1 + item.month) % 12) + 1).padStart(2, '0')}`,
    }))
    .sort((a, b) => a.month - b.month);
}

// 부족분 해결 방법 3가지 (기간 늘리기 / 생활비 줄이기 / 목표 조정). 부족하지 않으면 빈 목록
export function buildFixes({ input, goals, core, at }) {
  if (core.deadline === null || !(core.gap > 0)) return [];
  const needed = core.needed;
  const label = goals.find(g => g.id === 'housing') ? '입주' : '목표 시점';
  const fixes = [];
  if (core.monthsNeeded !== null)
    fixes.push({
      kind: 'extend',
      title: '기간 늘리기',
      headline: `${label}${label === '입주' ? '를' : '을'} ${core.doneLabel}로`,
      detail: `${core.monthsNeeded - core.deadline}개월 늦추면 부족한 돈이 없어요.`,
    });
  const perMonth = Math.ceil((needed - input.saved) / Math.max(1, core.deadline));
  fixes.push({
    kind: 'spend',
    title: '생활비 줄이기',
    headline: `매달 ${won(perMonth)} 저축`,
    detail: `${core.deadlineLabel}에 맞추려면 지금보다 매달 ${Math.max(0, perMonth - input.saveNow)}만 원을 더 모아야 해요.`,
  });
  const biggest = [...goals]
    .filter(g => !['emergency', 'invest'].includes(g.id))
    .sort((a, b) => b.target - a.target)[0];
  const cut = 500;
  if (biggest && biggest.target > cut) {
    const months = monthsToReach(needed - cut - input.saved, input.saveNow);
    fixes.push({
      kind: 'adjust',
      title: '목표 조정',
      headline: `${biggest.label} 목표를 ${won(cut)} 줄이기`,
      detail:
        months === null
          ? `필요한 돈이 ${won(needed - cut)}으로 줄어요.`
          : `필요한 돈이 ${won(needed - cut)}으로 줄어 ${at(months)}에 가능해요.`,
    });
  }
  return fixes;
}

// 맨 위 요약 한 문장
export function buildSummary({ input, core, goals }) {
  const parts = [];
  if (core.deadlineLabel && core.readiness !== null) {
    parts.push(`${core.deadlineLabel}까지 실제로 필요한 돈의 ${core.readiness}%를 모을 수 있어요.`);
    if (core.gap > 0)
      parts.push(
        core.doneLabel
          ? `${won(core.gap)}이 부족해서, 지금 속도로는 ${core.doneLabel}에 다 모을 수 있어요.`
          : `${won(core.gap)}이 부족해요.`,
      );
  } else {
    parts.push(`실제로 필요한 돈은 ${won(core.needed)}이에요.`);
    if (core.doneLabel) parts.push(`지금 속도로는 ${core.doneLabel}에 다 모을 수 있어요.`);
  }
  return `${goals.map(g => g.label).join('·')} 계획: ${parts.join(' ')}`;
}
