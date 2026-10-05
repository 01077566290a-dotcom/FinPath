// 우선순위 타임라인(지도) 단계 카드. buildPlan 결과를 지도 화면이 쓰는 roadmap 형태로 바꿉니다.
// 각 단계는 해야 할 일 / 내 기준(내 금액으로 환산한 숫자) / 방법 / 관련 정책·제도로 구성됩니다.
// 단계 id 중 housing_budget·housing_deposit·move_in_cost·contract_check·housing_search·saving_method는
// data/policies.json의 step 값과 같아서 정책이 자동으로 붙습니다.
import { groupByStep } from '../goal/policies.js';
import { monthLabel } from '../report/computeReport.js';

const won = n => `${Math.round(n).toLocaleString()}만 원`;
const CLOSING = '여기까지가 지금 입력한 상황에서 챙길 단계예요. 상황이 바뀌면 답변을 고쳐 지도를 다시 만들어요.';
const NEVER = Infinity;

// policies: filterPolicies(profile, data) 결과
// rule: 'A'(비상자금 먼저 전부) | 'B'(비상자금 일부만 먼저). 단계 시점이 규칙에 따라 달라집니다.
export function buildPlanRoadmap(plan, policies = [], { rule = 'A' } = {}) {
  const at = month => monthLabel(plan.asOf, month);
  const byStep = groupByStep(policies);
  const { cashflow: cf, budget, core, profile, recommended } = plan;
  const rec = recommended[rule] || recommended.A;
  const goal = id => budget.planGoals.find(g => g.id === id);
  const original = id => plan.goals.find(g => g.id === id);
  const doneAt = id => {
    const month = rec.done[id];
    return month === null || month === undefined ? NEVER : month;
  };
  const doneLabel = id => (doneAt(id) === NEVER ? null : at(doneAt(id)));
  const pace = budget.plan.monthly;
  const h = plan.housing;
  const emergency = goal('emergency'),
    housing = goal('housing'),
    wedding = goal('wedding'),
    invest = goal('invest');
  const tag = id => original(id)?.label;

  const steps = [];
  const add = step => steps.push({ first: [], note: null, personal: [], policies: [], ...step });

  add({
    id: 'cashflow',
    month: 0,
    tags: [],
    title: '월 현금흐름 확인하기',
    figure: `저축 ${won(cf.now.save)}`,
    why: '돈이 어디로 가는지 알아야, 얼마를 모을 수 있는지 계산할 수 있어요.',
    how: [
      '세금을 뗀 월급에서 매달 나가는 돈을 항목별로 적어요.',
      '남는 돈이 실제로 모이고 있는지 통장 내역으로 확인해요.',
      '달마다 달라지는 지출은 최근 석 달 평균으로 잡아요.',
    ],
    personal: [
      `월급 ${won(cf.income)} 중 쓰는 돈 ${won(cf.now.spend)}, 모으는 돈 ${won(cf.now.save)}(월급의 ${cf.now.rate}%)이에요.`,
      ...(h
        ? [
            `독립하면 쓰는 돈이 ${won(cf.after.spend)}로 늘고, 모으는 돈은 ${won(cf.after.save)}(${cf.after.rate}%)로 줄어요.`,
          ]
        : []),
      ...(plan.diagnosis.debt ? [`빚 상환 ${won(plan.diagnosis.debt.monthly)}은 이미 쓰는 돈에 들어 있어요.`] : []),
    ],
  });

  add({
    id: 'budget',
    month: 0,
    tags: [],
    title: '저축·생활비 목표 정하기',
    figure: `월급의 ${budget.plan.saveRate}% 저축`,
    why: '저축을 쓰고 남은 돈으로 두면 잘 안 모여요. 모을 몫을 먼저 정하면 생활비 상한이 정해져요.',
    how: [
      '월급에서 모을 돈을 먼저 떼어 정해요.',
      '남은 돈에서 월세 같은 고정지출을 빼면 생활비 상한이 나와요.',
      '상한을 넘는 달이 있다면 줄일 항목을 정해 둬요.',
    ],
    personal: [...plan.text],
    note: budget.verdict === 'extend' ? '지금 방식으로는 기한에 맞추기 어려워 기간을 늘리는 쪽으로 계산했어요.' : null,
    first: ['cashflow'],
  });

  add({
    id: 'saving_method',
    month: 0,
    tags: [],
    title: '통장 나누고 자동이체 걸기',
    figure: `월 ${won(pace)}`,
    why: '목적별로 통장을 나누고 월급날 자동이체를 걸어 두면, 돈이 섞이지 않고 꾸준히 모여요.',
    how: ['목적별로 통장(또는 적금)을 나눠요.', '월급날 다음 날로 자동이체를 걸어요.', '생활비 통장은 따로 둬요.'],
    personal: budget.planGoals
      .filter(g => (rec.firstMonth[g.id] || 0) > 0)
      .map(g => `${g.label} 통장에 월 ${won(rec.firstMonth[g.id])}`),
    policies: byStep.saving_method || [],
    first: ['budget'],
  });

  if (emergency) {
    const have = Math.min(profile.saved, emergency.target);
    add({
      id: 'emergency',
      month: doneAt('emergency'),
      tags: [tag('emergency')],
      title: `비상자금 ${won(emergency.target)} 채우기`,
      // 주거비 부담으로 더 쌓은 경우 '권장'이라고 밝혀서 리포트의 기본 목표와 헷갈리지 않게 해요
      figure: budget.buffer ? `${won(emergency.target)} (권장)` : won(emergency.target),
      why: '갑자기 돈이 나갈 때 다른 목표 자금을 건드리지 않으려면 따로 둔 돈이 필요해요.',
      how: [
        '바로 꺼낼 수 있는 통장에 따로 모아요.',
        '다른 목표보다 먼저 채워요.',
        '쓰고 나면 다시 채우는 걸 첫 번째로 해요.',
      ],
      personal: [
        ...emergency.basis.slice(0, 1),
        `지금 모아둔 돈 중 ${won(have)}이 이미 있어요.`,
        ...(doneLabel('emergency') ? [`${doneLabel('emergency')}에 목표를 채워요.`] : []),
        ...(budget.buffer
          ? [
              `리포트의 기본 목표 ${won(original('emergency').target)}에, 주거비 부담에 대비해 1개월치 ${won(budget.buffer)}을 더한 권장 목표예요.`,
            ]
          : []),
        ...(rule === 'B' && housing
          ? ['규칙 B: 비상자금은 일부만 먼저 채우고, 나머지는 주거 자금을 모은 뒤에 채워요.']
          : []),
      ],
      first: ['saving_method'],
    });
  }

  if (h && housing) {
    const afford = budget.housing.affordable;
    const initial = h.initialCosts.reduce((a, b) => a + b.amount, 0);
    const moveMonth = doneAt('housing');
    const lead = n => (moveMonth === NEVER ? NEVER : Math.max(0, moveMonth - n));
    add({
      id: 'housing_budget',
      month: 0,
      tags: [tag('housing')],
      title: h.type === '월세' ? '월세·관리비 범위 정하기' : '집 예산 정하기',
      figure: h.type === '월세' ? `월세 ${won(afford.max)} 이하` : `보증금 ${won(h.deposit)}`,
      why: '매달 나가는 주거비가 저축 속도를 정해서, 집을 보기 전에 감당할 범위부터 정해야 해요.',
      how: [
        '월급 대비 주거비 비율을 계산해요.',
        '보증금을 올리면 월세가 줄어드는 조합을 비교해요.',
        '관리비에 포함된 항목과 따로 내는 공과금을 확인해요.',
      ],
      personal: [
        ...(h.rent
          ? [
              `계획한 월세·관리비 ${won(cf.housingCost)}은 월급의 ${cf.housingRate}%예요. 일반적으로 30% 이하를 권해요.`,
              budget.housing.tooHigh
                ? `독립 후에도 저축을 지키려면 ${won(afford.max)} 이하가 좋아요.`
                : '지금 계획은 독립 후 저축을 지킬 수 있는 범위예요.',
            ]
          : [`${h.type} 보증금 ${won(h.deposit)}${h.loan ? `, 대출 ${won(h.loan)}` : ''}으로 계산했어요.`]),
        ...(plan.usedDefaults.some(k => ['deposit', 'rent', 'maintenance'].includes(k))
          ? ['모른다고 답한 값은 일반적인 기준값으로 계산했어요. 알아본 뒤 답변을 고치면 숫자가 바뀌어요.']
          : []),
      ],
      policies: byStep.housing_budget || [],
      first: ['budget'],
    });
    add({
      id: 'housing_search',
      month: lead(3),
      tags: [tag('housing')],
      title: '살 집 알아보기',
      figure: `${plan.region.split(' ').at(-1)} 기준`,
      why: '예산 안에서 갈 수 있는 지역·집 조건을 미리 알아보면 계약 때 서두르지 않아요.',
      how: [
        '예산과 출퇴근 시간으로 지역을 좁혀요.',
        '실거래가·시세를 공식 사이트에서 확인해요.',
        '청년 대상 공공 임대 공고가 있는지 봐요.',
      ],
      personal: [
        `${plan.region} 기준으로, 보증금 ${won(h.deposit)}${h.rent ? `에 월세·관리비 ${won(cf.housingCost)}` : ''} 안쪽 집을 찾아요.`,
      ],
      policies: byStep.housing_search || [],
      first: ['housing_budget'],
    });
    add({
      id: 'housing_deposit',
      month: moveMonth,
      tags: [tag('housing')],
      title: `보증금 ${won(h.deposit)} 마련하기`,
      figure: won(housing.target),
      why: '한 번에 큰돈이 들어가서, 모아둔 돈과 대출을 어떻게 나눌지에 따라 부담이 달라져요.',
      how: [
        '월급날 자동이체로 주거 통장에 모아요.',
        '부족하면 청년 대상 대출을 공식 기관에서 확인해요.',
        '대출을 쓴다면 매달 이자를 현금흐름에 넣어요.',
      ],
      personal: [
        ...housing.basis.slice(0, 1),
        ...(doneLabel('housing')
          ? [`비상자금을 채운 뒤 매달 ${won(pace)}씩 모으면 ${doneLabel('housing')}에 마련해요.`]
          : ['지금 저축으로는 마련하기 어려워요. 기간이나 목표를 조정해야 해요.']),
        ...(core.deadline !== null && core.gap > 0
          ? [`원래 계획한 ${core.deadlineLabel}에는 ${won(core.gap)}이 부족해요.`]
          : []),
      ],
      policies: byStep.housing_deposit || [],
      first: ['emergency', 'saving_method'].filter(id => id !== 'emergency' || emergency),
    });
    add({
      id: 'move_in_cost',
      month: moveMonth,
      tags: [tag('housing')],
      title: '이사·초기 비용 챙기기',
      figure: won(initial),
      why: '보증금 말고도 중개수수료, 이사비, 가전·가구 같은 비용이 한꺼번에 들어가요.',
      how: [
        '항목별로 견적을 받아 비교해요.',
        '꼭 필요한 것부터 사고 나머지는 입주 후에 나눠 사요.',
        '이사 비용 지원이 있는지 확인해요.',
      ],
      personal: [
        `${h.initialCosts.map(item => `${item.label} ${item.amount}`).join(', ')} (만 원, 추정) = ${won(initial)}`,
      ],
      policies: byStep.move_in_cost || [],
      first: ['housing_search'],
    });
    add({
      id: 'contract_check',
      month: lead(1),
      tags: [tag('housing')],
      title: '계약 전 확인할 것 챙기기',
      figure: moveMonth === NEVER ? '' : `${at(lead(1))}쯤`,
      why: '계약하고 나면 되돌리기 어려워서, 서명 전에 확인해야 해요.',
      how: [
        '등기부등본으로 집과 집주인 정보를 확인해요.',
        '보증금을 지키는 보증보험을 알아봐요.',
        '계약서 날짜와 특약을 읽어요.',
      ],
      personal: [
        `계약한 보증금 ${won(h.deposit)}을 지키려면 전입신고와 확정일자를 입주 당일에 받아요.`,
        ...(moveMonth === NEVER ? [] : [`목표 입주 ${at(moveMonth)} 기준으로 계약은 ${at(lead(1))}쯤이에요.`]),
      ],
      policies: byStep.contract_check || [],
      first: ['housing_search'],
    });
  }

  if (wedding) {
    const sim = plan.scenarios.A.atDeadline.find(item => item.id === 'wedding');
    const monthly = Math.ceil(wedding.target / Math.max(1, wedding.deadline));
    add({
      id: 'wedding',
      month: doneAt('wedding'),
      tags: [tag('wedding')],
      title: `결혼 내 몫 ${won(wedding.target)} 모으기`,
      figure: won(wedding.target),
      why: '결혼 비용은 한 번에 크게 들어가서, 기한에서 거꾸로 계산해 매달 모을 돈을 정해야 해요.',
      how: ['항목별 예상 비용을 적어요.', '배우자·가족과 부담 비율을 의논해요.', '신혼집은 주거 계획과 함께 봐요.'],
      personal: [
        ...wedding.basis,
        `${wedding.deadline}개월 안에 모으려면 매달 ${won(monthly)}이 필요해요.`,
        ...(sim && sim.shortfall > 0 ? [`지금 저축 속도로는 기한에 ${won(sim.shortfall)}이 부족해요.`] : []),
      ],
      first: emergency ? ['emergency'] : ['saving_method'],
    });
  }

  if (plan.diagnosis.debt) {
    const d = plan.diagnosis.debt;
    const debtGoal = goal('debt');
    add({
      id: 'debt',
      month: debtGoal ? doneAt('debt') : 0,
      tags: [tag('debt')].filter(Boolean),
      title: '빚 상환 계획 세우기',
      figure: d.months ? `${d.months}개월 후 완납` : `${won(d.remain)} 남음`,
      why: '매달 갚는 금액과 끝나는 때를 알아야 저축 계획을 현실적으로 세울 수 있어요.',
      how: [
        '대출별 남은 금액, 금리, 갚는 날을 적어요.',
        '먼저 갚을 대출이 있는지 비교해요.',
        '일찍 갚을 때 수수료가 있는지 확인해요.',
      ],
      personal: [
        `남은 ${won(d.remain)}을 매달 ${won(d.monthly)}씩 갚으면 ${d.doneLabel ?? '언제 끝날지 알 수 없어요'}에 다 갚아요.`,
        ...(debtGoal ? debtGoal.basis : []),
        ...(d.doneLabel ? [`다 갚고 나면 매달 ${won(d.monthly)}을 더 모을 수 있어요.`] : []),
      ],
      first: ['cashflow'],
    });
  }

  if (invest) {
    const start = rec.investStart;
    add({
      id: 'invest',
      month: start === null ? NEVER : start,
      tags: [tag('invest')],
      title: '남는 돈으로 투자 시작하기',
      figure: `월 ${won(invest.monthlyCap)}`,
      why: '비상자금과 다른 목표를 채운 뒤 남는 돈 안에서만 투자해야 생활이 흔들리지 않아요.',
      how: [
        '투자 기간과 매달 넣을 금액을 먼저 정해요.',
        '손실이 나도 생활에 지장 없는 돈인지 확인해요.',
        '상품은 공식 비교 자료로 직접 확인해요. FinPath는 상품을 추천하지 않아요.',
      ],
      personal: [
        start === null
          ? '지금 저축으로는 다른 목표를 채우고 나서 남는 돈이 없어요.'
          : `${at(start)}부터 매달 최대 ${won(invest.monthlyCap)}을 배분할 수 있어요.`,
        `${invest.months}개월 동안 넣으면 ${won(invest.monthlyCap * invest.months)}이에요. 수익률은 가정하지 않았어요.`,
      ],
      first: ['saving_method'],
    });
  }

  if (core.deadline !== null && (core.gap > 0 || budget.verdict === 'extend')) {
    add({
      id: 'review',
      month: core.deadline,
      tags: [],
      title: `${core.deadlineLabel} 계획 점검하기`,
      figure: core.gap > 0 ? `${won(core.gap)} 부족` : '',
      why: '정한 기한에 맞는지 점검하고, 부족하면 기간·생활비·목표 중 무엇을 조정할지 정해야 해요.',
      how: [
        '모은 돈이 계획과 맞는지 통장 잔액을 확인해요.',
        '부족하면 기간, 생활비, 목표 금액 중 하나를 조정해요.',
        '조정한 뒤 답변을 고치면 지도가 다시 계산돼요.',
      ],
      personal: [
        ...(core.gap > 0 ? [`지금 속도로는 ${core.deadlineLabel}에 ${won(core.gap)}이 부족해요.`] : []),
        ...plan.fixes.map(fix => `${fix.title}: ${fix.headline}. ${fix.detail}`),
      ],
      first: ['saving_method'],
    });
  }

  // 기한이 이른 순으로 정렬하고(같으면 위 순서 유지), 같은 시점끼리 묶습니다.
  const sorted = steps
    .map((step, i) => ({ step, i }))
    .sort((a, b) => a.step.month - b.step.month || a.i - b.i)
    .map(({ step }) => step);
  const ids = sorted.map(step => step.id);
  const built = sorted.map((step, index) => ({
    ...step,
    number: index + 1,
    phase: `m${step.month}`,
    phaseLabel: step.month === 0 ? '지금' : step.month === NEVER ? '모을 수 있게 되면' : at(step.month),
    tags: step.tags.length ? step.tags : [profile.purposes.length ? '내 돈 상황' : '내 돈 상황'],
    first: step.first.filter(id => ids.indexOf(id) > -1 && ids.indexOf(id) < index),
  }));
  built.forEach((step, i) => {
    step.next = built[i + 1]?.title || CLOSING;
  });
  const groups = [];
  for (const step of built) {
    const last = groups.at(-1);
    if (last?.phase === step.phase) last.steps.push(step);
    else groups.push({ phase: step.phase, label: step.phaseLabel, steps: [step] });
  }
  return {
    status: 'complete',
    situation: [plan.region, ...profile.purposes],
    deferred: [],
    steps: built,
    groups,
  };
}
