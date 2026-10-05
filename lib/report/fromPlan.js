// 2번 엔진(lib/plan, buildPlan) 결과 → 리포트 화면(v2)이 쓰는 형태로 바꾸는 연결부.
// 엔진의 숫자는 그대로 쓰고, 화면에서 말이 안 되는 값만 정리합니다.
//   - 부족분은 0 아래로 내려가지 않게(남으면 '여유'로), 준비도는 100%를 넘지 않게
//   - 상황을 ahead(여유) / short(부족) / cannot(매달 모이는 돈이 없음) / open(기한 없는 목표만) 으로 나눠 문장을 만듦
// 절약 항목을 골라 켜고 끌 때도 엔진의 배분 시뮬레이션(규칙 A)을 그대로 씁니다.
import { simulate } from '../plan/simulate.js';
import { money, monthLabel, duration } from './format.js';

const MAX_MONTHS = 120;
// 줄일 지출 예시 (일반적인 금액, 사용자가 리포트에서 골라요)
export const SUGGESTED_CUTS = [
  { id: 'phone', label: '통신비 (알뜰 요금제로)', cut: 3, hint: '예시 금액' },
  { id: 'subs', label: '안 쓰는 구독 정리', cut: 2, hint: '예시 금액' },
  { id: 'food', label: '외식·배달 줄이기', cut: 10, hint: '예시 금액' },
  { id: 'shop', label: '쇼핑 줄이기', cut: 5, hint: '예시 금액' },
];
const EMPLOYMENT = { 정규직: '정규직', 계약직: '계약직', 프리랜서: '프리랜서' };

// 매달 extra만큼 더 모을 때 (투자를 뺀) 모든 목표를 채우는 개월. 못 채우면 null.
export function monthsWithExtra(plan, extra = 0) {
  const sim = simulate({
    goals: plan.goals,
    saved: plan.profile.saved,
    saveBefore: plan.profile.saveNow + extra,
    saveAfter: plan.cashflow.after.save,
    rule: 'A',
  });
  const months = plan.goals.filter(g => g.id !== 'invest').map(g => sim.done[g.id]);
  return months.length && months.every(m => m !== null) ? Math.max(...months) : null;
}

// 그래프용: 0개월부터 horizon까지 모은 돈 누적 (매달 extra 추가 저축 포함)
export function savingsLine(view, extra = 0) {
  const monthly = Math.max(0, view.saveNow + extra);
  return Array.from({ length: view.horizon + 1 }, (_, month) => ({
    month,
    label: monthLabel(view.asOf, month),
    value: view.core.saved + monthly * month,
  }));
}

export function viewFromPlan(plan, { demo = false } = {}) {
  const { cashflow, goals, profile } = plan;
  const saveNow = profile.saveNow;
  const hasHousing = Boolean(plan.housing);
  const deadline = plan.core.deadline;
  const needed = plan.core.needed;
  const saved = profile.saved;
  const future = deadline === null ? null : Math.max(0, saveNow) * deadline;
  const collectable = deadline === null ? null : saved + future;
  const monthsNeeded = plan.core.monthsNeeded;
  // 투자만 고른 경우: 모아야 할 목표 금액이 없고, 매달 얼마를 투자에 나눌 수 있는지가 핵심이에요.
  const investGoal = goals.find(g => g.id === 'invest');
  const investOnly =
    investGoal && goals.every(g => g.id === 'invest')
      ? (() => {
          const cap = investGoal.monthlyCap;
          const possible = Math.max(0, Math.min(saveNow, cap));
          return { cap, months: investGoal.months, possible, total: possible * investGoal.months };
        })()
      : null;
  const status = investOnly
    ? 'invest'
    : deadline === null
      ? 'open'
      : monthsNeeded === null
        ? 'cannot'
        : collectable >= needed
          ? 'ahead'
          : 'short';
  const core = {
    goal: plan.core.goal,
    goalMonths: plan.core.goalMonths,
    goalDiff: plan.core.missing,
    needed,
    saved,
    future,
    collectable,
    gap: collectable === null ? null : Math.max(0, needed - collectable),
    surplus: collectable === null ? null : Math.max(0, collectable - needed),
    readiness: collectable === null || needed <= 0 ? null : Math.min(100, Math.round((collectable / needed) * 100)),
    deadline,
    deadlineLabel: plan.core.deadlineLabel,
    monthsNeeded,
    doneLabel: plan.core.doneLabel,
    delay: monthsNeeded !== null && deadline !== null ? monthsNeeded - deadline : null,
  };

  const purposeLabel = goals.map(g => g.label).join(' · ');
  const verdict =
    status === 'invest'
      ? investOnly.possible <= 0
        ? {
            tone: 'serious',
            headline: '지금은 투자에 나눌 돈이 없어요',
            sentence: '매달 모이는 돈이 생기면 그 안에서만 투자해요. 아래 절약안부터 확인해 보세요.',
          }
        : investOnly.possible < investOnly.cap
          ? {
              tone: 'warning',
              headline: `원하는 ${money(investOnly.cap)} 중 매달 ${money(investOnly.possible)}까지 투자할 수 있어요`,
              sentence: `${investOnly.months}개월 동안 넣으면 원금 ${money(investOnly.total)}이에요. 투자 수익률은 가정하지 않았어요.`,
            }
          : {
              tone: 'good',
              headline: `매달 ${money(investOnly.possible)}씩 투자할 수 있어요`,
              sentence: `${investOnly.months}개월 동안 넣으면 원금 ${money(investOnly.total)}이에요. 투자 수익률은 가정하지 않았어요.`,
            }
      : status === 'ahead'
        ? {
            tone: 'good',
            headline:
              monthsNeeded === 0 ? '필요한 돈을 이미 다 모았어요' : `${core.deadlineLabel} 전에 다 모을 수 있어요`,
            sentence:
              monthsNeeded === 0
                ? `모아둔 돈이 필요한 돈보다 ${money(saved - needed)} 많아요.`
                : `${core.doneLabel ?? core.deadlineLabel}이면 준비가 끝나고, ${core.deadlineLabel}까지 ${money(core.surplus)}이 남아요.`,
          }
        : status === 'short'
          ? {
              tone: 'warning',
              headline: `${core.deadlineLabel}까지 ${money(core.gap)}이 부족해요`,
              sentence: `지금처럼 모으면 ${core.doneLabel}에 준비가 끝나요.${core.delay > 0 ? ` 계획보다 ${duration(core.delay)} 늦어요.` : ''}`,
            }
          : status === 'cannot'
            ? {
                tone: 'serious',
                headline:
                  saveNow <= 0 ? '지금은 매달 모이는 돈이 없어요' : '지금 계획으로는 모든 목표를 채우기 어려워요',
                sentence:
                  saveNow < 0
                    ? `매달 쓰는 돈이 월급보다 ${money(-saveNow)} 많아요. 아래 절약안부터 확인해 보세요.`
                    : '지금 속도로는 필요한 돈에 닿지 않아요. 아래 절약안부터 확인해 보세요.',
              }
            : monthsNeeded !== null
              ? {
                  tone: 'good',
                  headline: `지금 속도로 ${core.doneLabel}에 다 모아요`,
                  sentence: `${purposeLabel}에 필요한 돈 ${money(needed)}을 매달 ${money(saveNow)}씩 모았을 때예요.`,
                }
              : {
                  tone: 'serious',
                  headline:
                    saveNow <= 0 ? '지금은 매달 모이는 돈이 없어요' : '지금 계획으로는 모든 목표를 채우기 어려워요',
                  sentence:
                    '계산 기간 안에 모든 목표를 채우지 못해 완료 시점을 표시할 수 없어요. 아래 절약안부터 확인해 보세요.',
                };
  if (hasHousing && cashflow.after.save < 0)
    verdict.warning = `독립하면 매달 ${money(-cashflow.after.save)}이 모자라요. 독립 전에 생활비를 다시 짜야 해요.`;

  // 아낄 수 있는 것 (엔진의 savings: 위에서부터 누적)
  // 입력에서 줄일 지출을 묻지 않으므로, 답이 없으면 흔한 항목을 예시 금액으로 보여 주고 리포트에서 골라요.
  const cuts = plan.savings.length
    ? plan.savings.map((item, i) => ({
        id: `${item.item}-${i}`,
        label: item.item,
        cut: item.cut,
        annual: item.cut * 12,
        months: item.months,
        sooner: item.sooner,
        doneLabel: item.doneLabel,
      }))
    : SUGGESTED_CUTS.map(item => ({ ...item, annual: item.cut * 12, suggested: true }));

  // 목적별 필요한 돈 (규칙 A 기준 완성 시점)
  const goalRows = goals.map(g => ({
    id: g.id,
    label: g.label,
    target: g.target,
    doneLabel: plan.scenarios.A.doneLabels[g.id] ?? null,
    note: g.id === 'invest' ? '매달 나누는 몫으로 관리' : (g.basis?.[0] ?? ''),
    monthlyOnly: g.id === 'invest',
  }));

  // 체크 포인트 (엔진의 metrics를 타일 형태로)
  const checks = plan.metrics.map(metric => {
    const now = metric.rows.find(row => row.key === 'now' || row.key === 'both');
    const after = metric.rows.find(row => row.key === 'after');
    const main = metric.id === 'housing' ? after : (now ?? after);
    const value = main?.value ?? 0;
    return {
      id: metric.id,
      label:
        {
          emergency: '비상자금',
          housing: '주거비 비중',
          saving: '저축률',
          debt: '빚 상환',
        }[metric.id] ?? metric.label,
      value,
      after: metric.id !== 'housing' && now && after ? after.value : undefined,
      unit: metric.unit,
      caption: [metric.sub, metric.note].filter(Boolean).join(' · '),
      max: Math.max(metric.max, Math.ceil(Math.max(value, after?.value ?? 0) * 1.1)),
      target: metric.marker?.value,
      band: metric.band ? { to: metric.band.to, label: metric.band.label, source: metric.band.source } : undefined,
      status: metric.status,
    };
  });

  // 부족분을 채우는 방법 (엔진의 fixes)
  const fixes = plan.fixes.map(fix => ({ kind: fix.kind, title: fix.title, value: fix.headline, detail: fix.detail }));

  const milestones = plan.milestones.map(item => ({ ...item, muted: item.tone === 'missed' }));

  // 그래프 범위: 필요한 돈에 닿는 달 다음 달까지 (못 닿으면 기한 + 1년), 최대 10년
  const reach = [monthsNeeded, cuts.at(-1)?.months ?? null].filter(v => v !== null);
  const horizon = Math.min(
    MAX_MONTHS,
    Math.max(2, reach.length ? Math.max(deadline ?? 0, ...reach) + 1 : (deadline ?? 12) + 12),
  );

  const meta = [
    `${plan.asOfLabel} 기준`,
    [plan.region, plan.housing?.type].filter(Boolean).join(' '),
    [EMPLOYMENT[profile.employment] ?? profile.employment, profile.age ? `${profile.age}세` : null]
      .filter(Boolean)
      .join(' '),
  ].filter(Boolean);

  return {
    demo,
    investOnly,
    asOf: plan.asOf,
    asOfLabel: plan.asOfLabel,
    title: hasHousing ? '나의 독립 자금 리포트' : '나의 목표 자금 리포트',
    meta,
    purposeLabel,
    hasHousing,
    housingType: plan.housing?.type ?? null,
    saveNow,
    status,
    verdict,
    core,
    cashflow: { ...cashflow, hasHousing },
    goals: goalRows,
    cuts,
    checks,
    fixes,
    milestones,
    horizon,
    basis: goals.flatMap(g => g.basis ?? []),
    usedDefaults: plan.usedDefaults ?? [],
    text: plan.text ?? [],
  };
}
