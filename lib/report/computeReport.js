// 리포트 숫자 계산 (주거 + 비상자금 시연 범위). 금액 단위: 만 원, 예적금 이자는 넣지 않습니다.
// 어떤 입력이 와도 깨지지 않도록 normalizeReportInput으로 먼저 정리하고,
// 상황을 세 가지(ahead: 여유 / short: 부족 / cannot: 매달 모이는 돈이 없음)로 나눠 문장을 만듭니다.
// 엔진(A)이 완성되면 같은 출력 형태로 교체합니다. 시연 인물 기대값은 docs/demo-persona.md 4장과 같아야 합니다.
import { money, monthLabel, shortMonth, duration } from './format.js';

// 2번 엔진(lib/plan)이 이 파일에서 monthLabel을 가져다 씁니다. 같은 함수를 그대로 내보냅니다.
export { monthLabel };

const round1 = value => Math.round(value * 10) / 10;
// '버틸 수 있는 기간'은 안전을 부풀리지 않도록 내림합니다. (2.98개월 → 2.9개월)
const floor1 = value => Math.floor(value * 10) / 10;
const MAX_MONTHS = 600;

// ── 입력 정리 ──────────────────────────────────────────────
const toNumber = (value, { min = 0, max = 1e7, int = false, fallback = 0 } = {}) => {
  const n = typeof value === 'string' ? Number(value.replace(/[,\s]/g, '')) : Number(value);
  if (value === '' || value === null || value === undefined || !Number.isFinite(n)) return fallback;
  const clamped = Math.min(max, Math.max(min, n));
  return int ? Math.round(clamped) : clamped;
};

export function normalizeReportInput(raw = {}) {
  const now = new Date();
  const asOf = {
    year: toNumber(raw.asOf?.year, { min: 2000, max: 2100, int: true, fallback: now.getFullYear() }),
    month: toNumber(raw.asOf?.month, { min: 1, max: 12, int: true, fallback: now.getMonth() + 1 }),
  };
  const m = raw.money || {};
  const h = raw.housing || {};
  const debt =
    m.debt && toNumber(m.debt.balance) > 0
      ? { label: String(m.debt.label || '빚'), balance: toNumber(m.debt.balance), monthly: toNumber(m.debt.monthly) }
      : null;
  return {
    asOf,
    profile: {
      name: String(raw.profile?.name || '').slice(0, 20),
      age: toNumber(raw.profile?.age, { max: 120, int: true }) || null,
      employment: ['regular', 'contract', 'freelance'].includes(raw.profile?.employment)
        ? raw.profile.employment
        : null,
      tenure: String(raw.profile?.tenure || ''),
    },
    region: String(raw.region || '').slice(0, 30),
    purposes: Array.isArray(raw.purposes) ? raw.purposes : ['housing', 'emergency'],
    goal: {
      amount: toNumber(raw.goal?.amount),
      months: toNumber(raw.goal?.months, { min: 1, max: 120, int: true, fallback: 12 }),
    },
    money: {
      income: toNumber(m.income),
      fixedNow: toNumber(m.fixedNow),
      fixedAfter: toNumber(m.fixedAfter, { fallback: toNumber(m.fixedNow) }),
      livingNow: toNumber(m.livingNow),
      livingAfter: toNumber(m.livingAfter, { fallback: toNumber(m.livingNow) }),
      saved: toNumber(m.saved),
      debt,
    },
    housing: {
      type: h.type === 'jeonse' ? 'jeonse' : 'monthly',
      deposit: toNumber(h.deposit),
      monthlyCost: toNumber(h.monthlyCost),
      moveInMonths: toNumber(h.moveInMonths, { min: 1, max: 120, int: true, fallback: 12 }),
      loan: toNumber(h.loan),
      initialCost: toNumber(h.initialCost),
    },
    emergency: { months: toNumber(raw.emergency?.months, { min: 1, max: 12, int: true, fallback: 3 }) },
    savingCuts: (Array.isArray(raw.savingCuts) ? raw.savingCuts : [])
      .map((item, i) => ({
        id: String(item?.id || `cut${i}`),
        label: String(item?.label || ''),
        cut: toNumber(item?.cut),
      }))
      .filter(item => item.label && item.cut > 0)
      .slice(0, 6),
  };
}

// ── 계산 도우미 ─────────────────────────────────────────────
// 남은 금액을 매달 모아서 채우는 데 걸리는 개월. 못 채우면 null.
function monthsToReach(remaining, monthly) {
  if (remaining <= 0) return 0;
  if (monthly <= 0) return null;
  const months = Math.ceil(remaining / monthly);
  return months > MAX_MONTHS ? null : months;
}

// 규칙 A(결정 #3 초안): 모아둔 돈과 매달 저축을 비상자금에 먼저 넣고, 다 차면 주거로 보냅니다.
function allocate({ saved, monthly, emergency, housing }) {
  let emergencyFund = Math.min(saved, emergency),
    housingFund = saved - emergencyFund;
  let emergencyDone = emergencyFund >= emergency ? 0 : null,
    housingDone = housingFund >= housing ? 0 : null;
  if (monthly > 0)
    for (let month = 1; month <= MAX_MONTHS && (emergencyDone === null || housingDone === null); month++) {
      const toEmergency = Math.min(monthly, emergency - emergencyFund);
      emergencyFund += toEmergency;
      housingFund += monthly - toEmergency;
      if (emergencyDone === null && emergencyFund >= emergency) emergencyDone = month;
      if (housingDone === null && housingFund >= housing) housingDone = month;
    }
  return { emergencyDone, housingDone };
}

// 지금 계획에 매달 extra만큼 더 모을 때, 필요한 돈을 다 모으는 개월 (화면에서 절약 항목을 고를 때 씁니다)
export function monthsWithExtra(report, extra = 0) {
  return monthsToReach(report.core.needed - report.core.saved, report.cashflow.now.save + extra);
}

// 그래프용: 0개월부터 horizon까지 모은 돈 누적 (매달 extra 추가 저축 포함)
export function savingsSeries(report, extra = 0) {
  const monthly = Math.max(0, report.cashflow.now.save + extra);
  return Array.from({ length: report.horizon + 1 }, (_, month) => ({
    month,
    label: monthLabel(report.input.asOf, month),
    value: report.core.saved + monthly * month,
  }));
}

// ── 리포트 ──────────────────────────────────────────────────
export function computeReport(rawInput) {
  const input = normalizeReportInput(rawInput);
  const { money: m, housing, asOf } = input;
  const at = offset => monthLabel(asOf, offset);

  // 월 현금흐름: 지금 vs 독립 후
  const spendNow = m.fixedNow + m.livingNow;
  const spendAfter = m.fixedAfter + housing.monthlyCost + m.livingAfter;
  const saveNow = m.income - spendNow;
  const saveAfter = m.income - spendAfter;
  const rate = save => (m.income > 0 ? round1((save / m.income) * 100) : 0);
  const cashflow = {
    income: m.income,
    now: { fixed: m.fixedNow, living: m.livingNow, housing: 0, spend: spendNow, save: saveNow, rate: rate(saveNow) },
    after: {
      fixed: m.fixedAfter,
      living: m.livingAfter,
      housing: housing.monthlyCost,
      spend: spendAfter,
      save: saveAfter,
      rate: rate(saveAfter),
    },
  };

  // 실제로 필요한 돈
  const emergencyTarget = spendAfter * input.emergency.months;
  const housingTarget = Math.max(0, housing.deposit + housing.initialCost - housing.loan);
  const needed = emergencyTarget + housingTarget;
  const targets = {
    emergency: emergencyTarget,
    deposit: housing.deposit,
    initialCost: housing.initialCost,
    loan: housing.loan,
    housing: housingTarget,
    needed,
  };

  // 핵심 숫자
  const deadlineMonths = housing.moveInMonths;
  const future = Math.max(0, saveNow) * deadlineMonths;
  const collectable = m.saved + future;
  const monthsNeeded = monthsToReach(needed - m.saved, saveNow);
  const status = collectable >= needed ? 'ahead' : monthsNeeded === null ? 'cannot' : 'short';
  const core = {
    goal: input.goal.amount,
    goalMonths: input.goal.months,
    goalDiff: needed - input.goal.amount,
    needed,
    saved: m.saved,
    future,
    collectable,
    gap: Math.max(0, needed - collectable),
    surplus: Math.max(0, collectable - needed),
    readiness: needed > 0 ? Math.min(100, Math.round((collectable / needed) * 100)) : 100,
    deadline: at(deadlineMonths),
    deadlineMonths,
    monthsNeeded,
    doneLabel: monthsNeeded === null ? null : at(monthsNeeded),
    delay: monthsNeeded === null ? null : monthsNeeded - deadlineMonths,
  };

  const allocated = allocate({ saved: m.saved, monthly: saveNow, emergency: emergencyTarget, housing: housingTarget });
  const allocation = {
    emergencyDone: allocated.emergencyDone,
    emergencyDoneLabel: allocated.emergencyDone === null ? null : at(allocated.emergencyDone),
    housingDone: allocated.housingDone,
    housingDoneLabel: allocated.housingDone === null ? null : at(allocated.housingDone),
  };

  // 한 줄 판정
  const verdict =
    status === 'ahead'
      ? {
          tone: 'good',
          headline: monthsNeeded === 0 ? '필요한 돈을 이미 다 모았어요' : `${core.deadline} 전에 다 모을 수 있어요`,
          sentence:
            monthsNeeded === 0
              ? `모아둔 돈이 필요한 돈보다 ${money(m.saved - needed)} 많아요.`
              : `${core.doneLabel}이면 준비가 끝나고, ${core.deadline}까지 ${money(core.surplus)}이 남아요.`,
        }
      : status === 'short'
        ? {
            tone: 'warning',
            headline: `${core.deadline}까지 ${money(core.gap)}이 부족해요`,
            sentence: `지금처럼 모으면 ${core.doneLabel}에 준비가 끝나요. 계획보다 ${duration(core.delay)} 늦어요.`,
          }
        : {
            tone: 'serious',
            headline: '지금은 매달 모이는 돈이 없어요',
            sentence:
              saveNow < 0
                ? `매달 쓰는 돈이 월급보다 ${money(-saveNow)} 많아요. 아래 절약안부터 확인해 보세요.`
                : '매달 쓰는 돈과 월급이 같아요. 아래 절약안부터 확인해 보세요.',
          };

  // 독립 후 적자는 핵심 카드에서 바로 알립니다.
  if (saveAfter < 0)
    verdict.warning = `독립하면 매달 ${money(-saveAfter)}이 모자라요. 독립 전에 생활비를 다시 짜야 해요.`;

  // 아낄 수 있는 것: 위에서부터 누적
  let total = 0;
  const cuts = input.savingCuts.map(item => {
    total += item.cut;
    const months = monthsToReach(needed - m.saved, saveNow + total);
    return {
      ...item,
      totalCut: total,
      annual: item.cut * 12,
      months,
      doneLabel: months === null ? null : at(months),
      sooner: months !== null && monthsNeeded !== null ? monthsNeeded - months : null,
    };
  });
  const lastCut = cuts.at(-1);
  const cutsTotal = {
    monthly: total,
    annual: total * 12,
    months: lastCut ? lastCut.months : monthsNeeded,
    doneLabel: lastCut ? lastCut.doneLabel : core.doneLabel,
    sooner: lastCut ? lastCut.sooner : 0,
  };

  // 부족분 해결 방법
  const fixes = [];
  if (status !== 'ahead') {
    if (status === 'short')
      fixes.push({
        kind: 'extend',
        title: '기간 늘리기',
        value: `+${duration(core.delay)}`,
        detail: `입주를 ${core.doneLabel}로 미루면 부족한 돈이 없어요.`,
      });
    const monthlyNeeded = Math.ceil((needed - m.saved) / deadlineMonths);
    fixes.push({
      kind: 'spend',
      title: '매달 더 모으기',
      // 적자면 적자를 메우는 돈까지 더해야 합니다.
      value: `+${money(monthlyNeeded - saveNow)}`,
      detail: `${core.deadline}에 맞추려면 매달 ${money(monthlyNeeded)}을 모아야 해요.`,
    });
    if (housing.deposit >= 200) {
      const smaller = Math.max(100, Math.round(housing.deposit / 2 / 100) * 100);
      const neededSmaller = needed - (housing.deposit - smaller);
      const monthsSmaller = monthsToReach(neededSmaller - m.saved, saveNow);
      fixes.push({
        kind: 'adjust',
        title: '보증금 낮추기',
        value: money(smaller),
        detail:
          monthsSmaller === null
            ? `필요한 돈이 ${money(neededSmaller)}으로 줄어요.`
            : `필요한 돈이 ${money(neededSmaller)}으로 줄어 ${at(monthsSmaller)}에 가능해요. 대신 ${
                housing.type === 'jeonse' ? '매달 월세가 생길 수 있어요.' : '월세가 오를 수 있어요.'
              }`,
      });
    }
  }

  // 체크 포인트 (인바디식 지표)
  const emergencyMonths = spendAfter > 0 ? m.saved / spendAfter : 0;
  const housingRate = m.income > 0 ? (housing.monthlyCost / m.income) * 100 : 0;
  const debtMonths = m.debt && m.debt.monthly > 0 ? Math.ceil(m.debt.balance / m.debt.monthly) : null;
  const checks = [
    {
      id: 'emergency',
      label: '비상자금',
      value: floor1(emergencyMonths),
      unit: '개월',
      caption: `월급이 끊겨도 버티는 기간 · 목표 ${input.emergency.months}개월`,
      max: Math.max(input.emergency.months * 2, Math.ceil(emergencyMonths)),
      target: input.emergency.months,
      status:
        emergencyMonths >= input.emergency.months
          ? { tone: 'good', text: '충분해요' }
          : emergencyMonths >= input.emergency.months * 0.9
            ? { tone: 'warning', text: '거의 다 됐어요' }
            : { tone: 'serious', text: '부족해요' },
    },
    {
      id: 'housing',
      label: '주거비 비중',
      value: round1(housingRate),
      unit: '%',
      caption: '월급 중 월세·관리비 (독립 후)',
      max: Math.max(60, Math.ceil(housingRate / 10) * 10 + 10),
      band: { to: 30, label: '일반적으로 30% 이하', source: null },
      status: housingRate <= 30 ? { tone: 'good', text: '적정해요' } : { tone: 'serious', text: '높아요' },
    },
    {
      id: 'saving',
      label: '저축률',
      value: cashflow.now.rate,
      after: cashflow.after.rate,
      unit: '%',
      caption: '월급 중 모으는 돈',
      max: Math.max(60, Math.ceil(Math.max(cashflow.now.rate, 0) / 10) * 10 + 10),
      status:
        saveAfter < 0
          ? { tone: 'serious', text: '독립 후 적자' }
          : cashflow.after.rate < cashflow.now.rate / 2
            ? { tone: 'warning', text: '독립 후 크게 줄어요' }
            : { tone: 'good', text: '유지돼요' },
    },
  ];
  if (m.debt)
    checks.push({
      id: 'debt',
      label: '빚 상환',
      value: m.income > 0 ? round1((m.debt.monthly / m.income) * 100) : 0,
      unit: '%',
      caption: `${m.debt.label} ${money(m.debt.balance)} 남음`,
      max: 60,
      status: { tone: 'info', text: debtMonths === null ? '상환 계획 필요' : `${at(debtMonths)} 완납` },
    });

  // 일정
  const milestones = [
    { month: 0, title: '지금', text: `모아둔 돈 ${money(m.saved)}` },
    allocation.emergencyDone !== null && {
      month: allocation.emergencyDone,
      title: '비상자금 완성',
      text: money(emergencyTarget),
    },
    {
      month: deadlineMonths,
      title: '원래 계획한 입주',
      text: core.gap ? `${money(core.gap)} 부족` : '준비 완료',
      muted: true,
    },
    cuts.length > 0 &&
      cutsTotal.months !== null &&
      cutsTotal.months !== monthsNeeded && {
        month: cutsTotal.months,
        title: '아끼면 독립',
        text: `매달 ${money(cutsTotal.monthly)} 절약 시`,
      },
    monthsNeeded !== null &&
      monthsNeeded !== deadlineMonths && {
        month: monthsNeeded,
        title: '지금 계획으로 독립',
        text: input.region || '',
      },
    debtMonths !== null && {
      month: debtMonths,
      title: `${m.debt.label} 완납`,
      text: `이후 매달 ${money(m.debt.monthly)} 더 저축`,
    },
  ]
    .filter(Boolean)
    .filter(item => item.month <= 120)
    .sort((a, b) => a.month - b.month)
    .map(item => ({ ...item, label: at(item.month), short: shortMonth(asOf, item.month) }));

  // 그래프 범위: 필요한 돈에 닿는 달 다음 달까지 (못 닿으면 계획 시점 + 1년), 최대 10년
  const reach = [monthsNeeded, cutsTotal.months].filter(v => v !== null);
  const horizon = Math.min(120, reach.length ? Math.max(deadlineMonths, ...reach) + 1 : deadlineMonths + 12);

  // 계산 근거
  const basis = [
    `실제로 필요한 돈 = 비상자금 ${money(emergencyTarget)} + 보증금 ${money(housing.deposit)} + 이사·초기 비용 ${money(
      housing.initialCost,
    )}${housing.loan ? ` − 대출 ${money(housing.loan)}` : ''} = ${money(needed)}`,
    `비상자금 = 독립 후 한 달 생활비 ${money(spendAfter)} × ${input.emergency.months}개월`,
    `${core.deadline}까지 모을 돈 = 지금 모아둔 ${money(m.saved)} + 매달 ${money(Math.max(0, saveNow))} × ${deadlineMonths}개월 = ${money(collectable)}`,
    `지금 매달 모으는 돈 = 월급 ${money(m.income)} − 고정지출 ${money(m.fixedNow)} − 생활비 ${money(m.livingNow)} = ${money(saveNow)}`,
    `독립 후 매달 모으는 돈 = 월급 − 고정지출 ${money(m.fixedAfter)} − 월세·관리비 ${money(housing.monthlyCost)} − 생활비 ${money(
      m.livingAfter,
    )} = ${money(saveAfter)}`,
    '비상자금을 먼저 채운 뒤 주거 자금을 모으는 순서로 계산했어요. 예적금 이자는 넣지 않았어요.',
  ];

  return {
    input,
    asOfLabel: at(0),
    status,
    verdict,
    cashflow,
    deficitAfter: saveAfter < 0,
    targets,
    core,
    allocation,
    cuts,
    cutsTotal,
    fixes,
    checks,
    milestones,
    horizon,
    basis,
  };
}
