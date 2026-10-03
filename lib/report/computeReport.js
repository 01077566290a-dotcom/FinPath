// 리포트 숫자 계산 (주거 + 비상자금 시연 범위). 금액 단위: 만 원, 예적금 이자는 넣지 않습니다.
// 엔진(A)이 완성되면 같은 출력 형태로 교체합니다. 기대값은 docs/demo-persona.md 4장과 같아야 합니다.

const sum = list => list.reduce((total, value) => total + value, 0);
const monthsToReach = (amount, monthly) => (amount <= 0 ? 0 : monthly > 0 ? Math.ceil(amount / monthly) : Infinity);
const round1 = value => Math.round(value * 10) / 10;
// '버틸 수 있는 기간'은 안전을 부풀리지 않도록 내림합니다. (2.98개월 → 2.9개월, '3개월 달성'으로 보이지 않게)
const floor1 = value => Math.floor(value * 10) / 10;
const won = value => `${Math.round(value).toLocaleString()}만 원`;

export function monthLabel(asOf, offset) {
  const index = asOf.year * 12 + (asOf.month - 1) + offset;
  return `${Math.floor(index / 12)}년 ${(index % 12) + 1}월`;
}
export const shortMonth = (asOf, offset) => {
  const index = asOf.year * 12 + (asOf.month - 1) + offset;
  return `${String(Math.floor(index / 12)).slice(2)}.${String((index % 12) + 1).padStart(2, '0')}`;
};

// 규칙 A(결정 #3 초안): 모아둔 돈과 매달 저축을 비상자금에 먼저 넣고, 다 차면 주거로 보냅니다.
function allocate({ saved, monthly, emergency, housing }) {
  let emergencyFund = Math.min(saved, emergency),
    housingFund = saved - emergencyFund,
    emergencyDone = emergencyFund >= emergency ? 0 : null,
    housingDone = housingFund >= housing ? 0 : null;
  for (let month = 1; month <= 600 && housingDone === null; month++) {
    let money = monthly;
    const toEmergency = Math.min(money, emergency - emergencyFund);
    emergencyFund += toEmergency;
    money -= toEmergency;
    housingFund += money;
    if (emergencyDone === null && emergencyFund >= emergency) emergencyDone = month;
    if (housingFund >= housing) housingDone = month;
  }
  return { emergencyDone, housingDone };
}

export function computeReport(input) {
  const { money, housing, asOf } = input;
  const at = offset => monthLabel(asOf, offset);

  // 월 현금흐름: 지금(부모님 집) vs 독립 후
  const fixedNow = sum(money.fixed.map(item => item.now));
  const fixedAfter = sum(money.fixed.map(item => item.after));
  const housingCost = housing.rent + housing.maintenance;
  const spendNow = fixedNow + money.variable.now;
  const spendAfter = fixedAfter + housingCost + money.variable.after;
  const saveNow = money.income - spendNow;
  const saveAfter = money.income - spendAfter;
  const cashflow = {
    now: { spend: spendNow, save: saveNow, rate: round1((saveNow / money.income) * 100) },
    after: { spend: spendAfter, save: saveAfter, rate: round1((saveAfter / money.income) * 100) },
    parts: {
      now: { living: spendNow, housing: 0, save: saveNow },
      after: { living: fixedAfter + money.variable.after, housing: housingCost, save: saveAfter },
    },
    income: money.income,
    housingCost,
  };

  // 목적별 실제로 필요한 돈
  const initialCost = sum(housing.initialCosts.map(item => item.amount));
  const emergencyTarget = spendAfter * input.emergency.months;
  const housingTarget = housing.deposit + initialCost - housing.loan;
  const needed = emergencyTarget + housingTarget;

  // 핵심 숫자 세 개
  const collectable = money.saved + saveNow * housing.moveInMonths;
  const gap = needed - collectable;
  const monthsNeeded = monthsToReach(needed - money.saved, saveNow);
  const core = {
    goal: input.goal.amount,
    goalMonths: input.goal.months,
    needed,
    collectable,
    gap,
    readiness: Math.round((collectable / needed) * 100),
    deadline: at(housing.moveInMonths),
    deadlineMonths: housing.moveInMonths,
    monthsNeeded,
    doneLabel: at(monthsNeeded),
    delay: monthsNeeded - housing.moveInMonths,
    missing: needed - input.goal.amount,
  };

  const allocated = allocate({
    saved: money.saved,
    monthly: saveNow,
    emergency: emergencyTarget,
    housing: housingTarget,
  });
  const allocation = {
    emergencyDone: allocated.emergencyDone,
    emergencyDoneLabel: at(allocated.emergencyDone),
    housingDone: allocated.housingDone,
    housingDoneLabel: at(allocated.housingDone),
  };

  // 부족분 해결 방법 (기간 늘리기 / 생활비 줄이기 / 목표 조정)
  const monthlyForDeadline = Math.ceil((needed - money.saved) / housing.moveInMonths);
  const smallerDeposit = 500;
  const neededSmaller = needed - (housing.deposit - smallerDeposit);
  const monthsSmaller = monthsToReach(neededSmaller - money.saved, saveNow);
  const fixes = [
    {
      kind: 'extend',
      title: '기간 늘리기',
      headline: `입주를 ${at(monthsNeeded)}로`,
      detail: `${core.delay}개월 늦추면 부족한 돈이 없어요.`,
    },
    {
      kind: 'spend',
      title: '생활비 줄이기',
      headline: `매달 ${monthlyForDeadline}만 원 저축`,
      detail: `${core.deadline}에 맞추려면 지금보다 매달 ${monthlyForDeadline - saveNow}만 원을 더 모아야 해요.`,
    },
    {
      kind: 'adjust',
      title: '목표 조정',
      headline: `보증금 ${smallerDeposit.toLocaleString()}만 원 집`,
      detail: `필요한 돈이 ${neededSmaller.toLocaleString()}만 원으로 줄어 ${at(monthsSmaller)}에 가능해요. 대신 월세가 오를 수 있어요.`,
    },
  ];

  // 아낄 수 있는 것: 누적 절약 → 앞당겨지는 개월
  let cut = 0;
  const savings = input.savingCuts.map(item => {
    cut += item.cut;
    const months = monthsToReach(needed - money.saved, saveNow + cut);
    return { ...item, totalCut: cut, months, sooner: monthsNeeded - months, doneLabel: at(months) };
  });
  const highlight = savings[1] || savings[0];

  // 진단
  const debt = money.debts[0];
  const debtMonths = debt ? Math.ceil(debt.balance / debt.monthly) : null;
  const diagnosis = {
    surviveNow: floor1(money.saved / spendNow),
    surviveAfter: floor1(money.saved / spendAfter),
    spendIncrease: spendAfter - spendNow,
    debt: debt && { ...debt, months: debtMonths, doneLabel: at(debtMonths) },
  };

  // 그래프: 모은 돈 누적 (지금 계획 vs 대표 절약). 독립하면 저축 속도가 바뀌므로 필요한 돈에 닿는 달 다음 달까지만 그립니다.
  const horizon = monthsNeeded + 1;
  const series = Array.from({ length: horizon + 1 }, (_, month) => ({
    month,
    label: at(month),
    base: money.saved + saveNow * month,
    saving: money.saved + (saveNow + highlight.totalCut) * month,
  }));

  // 핵심 지표: 지금 / 독립 후를 따로 보여 주고, 상태는 반올림 전 값으로 판정합니다.
  const emergencyNow = money.saved / spendNow,
    emergencyAfter = money.saved / spendAfter;
  const housingRate = (housingCost / money.income) * 100;
  const metrics = [
    {
      id: 'emergency',
      label: '비상자금으로 버틸 수 있는 기간',
      sub: '모아둔 돈 ÷ 한 달 생활비',
      unit: '개월',
      max: input.emergency.months * 2,
      rows: [
        { key: 'now', label: '지금', value: floor1(emergencyNow) },
        { key: 'after', label: '독립 후', value: floor1(emergencyAfter) },
      ],
      marker: { value: input.emergency.months, label: `목표 ${input.emergency.months}개월` },
      status:
        emergencyAfter >= input.emergency.months
          ? { tone: 'good', text: '목표 달성' }
          : emergencyAfter >= input.emergency.months * 0.9
            ? { tone: 'warning', text: `목표의 ${Math.floor((emergencyAfter / input.emergency.months) * 100)}%` }
            : { tone: 'serious', text: '부족' },
      note: `독립 후 생활비 ${spendAfter}만 원 기준 목표 ${input.emergency.months}개월`,
    },
    {
      id: 'housing',
      label: '월급 중 주거비',
      sub: '월세 + 관리비 ÷ 실수령액',
      unit: '%',
      max: 60,
      rows: [{ key: 'after', label: '독립 후', value: round1(housingRate) }],
      band: { from: 0, to: 30, label: '일반적으로 30% 이하', source: null },
      status: housingRate <= 30 ? { tone: 'good', text: '기준 안' } : { tone: 'serious', text: '기준 초과' },
      note: '지금은 부모님 집이라 주거비가 없어요',
    },
    {
      id: 'saving',
      label: '저축률',
      sub: '모으는 돈 ÷ 실수령액',
      unit: '%',
      max: 60,
      rows: [
        { key: 'now', label: '지금', value: cashflow.now.rate },
        { key: 'after', label: '독립 후', value: cashflow.after.rate },
      ],
      status:
        cashflow.after.rate < cashflow.now.rate / 2
          ? { tone: 'warning', text: '독립 후 크게 줄어요' }
          : { tone: 'good', text: '유지돼요' },
      note: `매달 ${saveNow}만 원 → ${saveAfter}만 원`,
    },
    {
      id: 'debt',
      label: '월급 중 빚 상환',
      sub: debt ? `${debt.label} 매달 상환액 ÷ 실수령액` : '',
      unit: '%',
      max: 60,
      rows: [{ key: 'both', label: '지금·독립 후', value: debt ? round1((debt.monthly / money.income) * 100) : 0 }],
      status: { tone: 'info', text: debt ? `${at(debtMonths)} 상환 완료` : '빚 없음' },
      note: debt ? `남은 ${won(debt.balance)}, 매달 ${debt.monthly}만 원` : '',
    },
  ];

  // 앞으로의 일정 (규칙 A 기준)
  const milestones = [
    { month: 0, title: '지금', text: `모아둔 돈 ${won(money.saved)}`, tone: 'now' },
    {
      month: allocation.emergencyDone,
      title: '비상자금 완성',
      text: `${won(emergencyTarget)} · 생활비 ${input.emergency.months}개월치`,
      tone: 'emergency',
    },
    { month: housing.moveInMonths, title: '원래 계획한 입주', text: `이때는 ${won(gap)} 부족`, tone: 'missed' },
    {
      month: highlight.months,
      title: '절약하면 독립',
      text: `매달 ${highlight.totalCut}만 원 절약 시`,
      tone: 'saving',
    },
    { month: monthsNeeded, title: '지금 계획으로 독립', text: `${input.region} 월세`, tone: 'housing' },
    ...(debt
      ? [
          {
            month: debtMonths,
            title: `${debt.label} 완납`,
            text: `이후 매달 ${debt.monthly}만 원 더 저축`,
            tone: 'debt',
          },
        ]
      : []),
  ]
    .map(item => ({ ...item, label: at(item.month), short: shortMonth(asOf, item.month) }))
    .sort((a, b) => a.month - b.month);

  // 계산 근거 (섹션별 '계산 근거' 펼치기)
  const basis = {
    goal: [
      `실제로 필요한 돈 = 비상자금 ${won(emergencyTarget)} + 보증금 ${won(housing.deposit)} + 이사·초기 비용 ${won(initialCost)}${housing.loan ? ` − 대출 ${won(housing.loan)}` : ''} = ${won(needed)}`,
      `비상자금 = 독립 후 한 달 생활비 ${won(spendAfter)} × ${input.emergency.months}개월`,
      `이사·초기 비용 = ${housing.initialCosts.map(item => `${item.label} ${item.amount}`).join(' + ')} (만 원, 추정)`,
      `${core.deadline}까지 모을 돈 = 지금 모아둔 ${won(money.saved)} + 매달 ${saveNow}만 원 × ${housing.moveInMonths}개월 = ${won(collectable)}`,
      `준비도 = ${won(collectable)} ÷ ${won(needed)} = ${core.readiness}%`,
    ],
    cashflow: [
      `지금 쓰는 돈 = 고정지출 ${fixedNow} + 변동 생활비 ${money.variable.now} = ${spendNow}만 원`,
      `독립 후 쓰는 돈 = 고정지출 ${fixedAfter} + 월세·관리비 ${housingCost} + 변동 생활비 ${money.variable.after} = ${spendAfter}만 원`,
      `독립 후 교통비 ${money.fixed.find(item => item.label === '교통비')?.now ?? '-'} → ${money.fixed.find(item => item.label === '교통비')?.after ?? '-'}만 원 (회사 근처로 이사)`,
    ],
    speed: [
      `필요한 돈까지 남은 금액 = ${won(needed)} − ${won(money.saved)} = ${won(needed - money.saved)}`,
      `지금 계획: ${won(needed - money.saved)} ÷ 매달 ${saveNow}만 원 = ${((needed - money.saved) / saveNow).toFixed(1)} → ${monthsNeeded}개월`,
      `절약 시: ${won(needed - money.saved)} ÷ 매달 ${saveNow + highlight.totalCut}만 원 = ${((needed - money.saved) / (saveNow + highlight.totalCut)).toFixed(1)} → ${highlight.months}개월`,
      `독립하면 매달 모으는 돈이 ${saveNow}만 원에서 ${saveAfter}만 원으로 줄어서, 그래프는 필요한 돈을 다 모으는 달까지만 그렸어요.`,
    ],
  };

  const summary = `${input.profile.name} 님은 ${core.deadline}까지 독립에 필요한 돈의 ${core.readiness}%를 모을 수 있어요. ${won(gap)}이 부족해서, 지금 계획대로면 ${at(monthsNeeded)}에 독립할 수 있어요.`;

  return {
    input,
    asOfLabel: at(0),
    summary,
    cashflow,
    targets: { emergency: emergencyTarget, housing: housingTarget, initialCost, needed },
    core,
    allocation,
    fixes,
    savings,
    highlight,
    diagnosis,
    series,
    metrics,
    milestones,
    basis,
  };
}
