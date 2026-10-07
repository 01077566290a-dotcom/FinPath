// 목적별 "실제로 필요한 돈" 계산. 모든 함수는 순수 함수이고 금액은 만 원 단위 정수입니다.
import { PLAN_CONFIG } from './config.js';
import { money } from '../report/format.js';

// 독립 후 매달 나가는 주거비 = 월세 + 관리비 + 대출 이자(추정)
export const housingCostOf = housing =>
  housing ? housing.rent + housing.maintenance + (housing.interest || 0) + (housing.principal || 0) : 0;
// 주거비를 부르는 이름: 무엇이 들어 있는지에 따라
export function housingNameOf(housing) {
  if (!housing) return '주거비';
  const parts = [];
  if (housing.rent || housing.maintenance) parts.push('월세·관리비');
  if (housing.interest) parts.push('대출 이자');
  if (housing.principal) parts.push('대출 원금');
  return parts.join('·') || '주거비';
}

// 월 현금흐름: 지금 vs 독립 후. 독립 후 = 지금 − 교통비 변화 + 월세·관리비 + 변동 생활비 변화
export function cashflowOf(input) {
  const housingCost = housingCostOf(input.housing);
  const spendNow = input.spendNow;
  const spendAfter = input.housing
    ? spendNow - (input.currentHousingCost || 0) - input.commuteDelta + housingCost + input.variableAfterDelta
    : spendNow;
  const saveNow = input.saveNow;
  const saveAfter = input.income - spendAfter;
  const rate = save => Math.round((save / input.income) * 1000) / 10;
  return {
    income: input.income,
    housingCost,
    housingName: housingNameOf(input.housing),
    loanInterest: input.housing?.interest || 0,
    housingRate: Math.round((housingCost / input.income) * 1000) / 10,
    now: { spend: spendNow, save: saveNow, rate: rate(saveNow) },
    after: { spend: spendAfter, save: saveAfter, rate: rate(saveAfter) },
  };
}

// 목표 목록. deadline: 기한(개월, 없으면 null), target: 모아야 할 돈, basis: 계산 근거 문장
export function buildGoals(input, cashflow, config = PLAN_CONFIG) {
  const goals = [];
  const won = n => money(n); // 리포트와 같은 금액 표기(1억 이상은 '1억 2,345만 원')

  if (input.purposes.includes('비상자금')) {
    const months = config.emergencyMonths.values[input.employment] ?? config.emergencyMonths.fallback;
    const spend = cashflow.after.spend;
    goals.push({
      id: 'emergency',
      label: '비상자금',
      deadline: null,
      months,
      target: Math.round(spend * months), // 월급에 소수(250.5만 원)가 있어도 목표는 만 원 단위로
      basis: [
        `비상자금 = ${input.housing ? '독립 후 ' : ''}한 달 생활비 ${won(spend)} × ${months}개월 = ${won(Math.round(spend * months))}`,
        `고용 형태(${input.employment})에 따라 개월 수가 달라져요. 일반적으로 3~6개월을 말해요.`,
      ],
    });
  }
  if (input.housing) {
    const h = input.housing;
    const initial = h.initialCosts.reduce((a, b) => a + b.amount, 0);
    goals.push({
      id: 'housing',
      label: '주거',
      deadline: h.moveInMonths,
      target: Math.max(0, h.deposit + initial - h.loan),
      basis: [
        `주거 = ${h.type === '매매' ? '집값' : '보증금'} ${won(h.deposit)} + 이사·초기 비용 ${won(initial)}${h.loan ? ` − 대출 ${won(h.loan)}` : ''} = ${won(h.deposit + initial - h.loan)}`,
        `이사·초기 비용 = ${h.initialCosts.map(item => `${item.label} ${item.amount}`).join(' + ')} (만 원, 추정)`,
        ...(h.rent ? [`월세·관리비 ${won(h.rent + h.maintenance)}은 독립 후 매달 나가는 돈에 더했어요.`] : []),
        ...(h.interest
          ? [`대출 ${won(h.loan)}의 이자를 연 4%로 잡아 매달 약 ${won(h.interest)}을 독립 후 나가는 돈에 더했어요.`]
          : []),
        ...(h.loan
          ? [
              h.principal
                ? `월 원금 상환 ${won(h.principal)}을 더했어요. ${Math.ceil(h.loan / h.principal)}개월 뒤 다 갚으면 그때부터 매달 ${won(h.principal + (h.interest || 0))}을 더 모아요.`
                : '월 원금 상환액이 없거나 미정이에요. 만기 상환 원금은 별도로 마련해야 하며, 현재 결과는 대출 완납 계획이 아니에요.',
            ]
          : []),
      ],
    });
  }
  if (input.wedding) {
    const w = input.wedding;
    const partner = Math.round((w.cost * w.partnerShare) / 100);
    const mine = Math.max(0, w.cost - partner - w.familySupport);
    goals.push({
      id: 'wedding',
      label: '결혼',
      deadline: w.months,
      target: mine,
      basis: [
        `결혼 내 몫 = 총비용 ${won(w.cost)} − 배우자 부담 ${won(partner)} − 가족 지원 ${won(w.familySupport)} = ${won(mine)}`,
      ],
    });
  }
  if (input.debtPlan) {
    const d = input.debtPlan;
    const requiredMonthly = Math.ceil(d.remain / d.periodMonths);
    const extra = Math.max(0, requiredMonthly - d.monthly);
    goals.push({
      id: 'debt',
      label: '빚 상환',
      deadline: d.periodMonths,
      target: extra * d.periodMonths,
      basis: [
        `${d.periodMonths}개월 안에 갚으려면 매달 ${won(requiredMonthly)} (남은 ${won(d.remain)} ÷ ${d.periodMonths}개월)`,
        `지금 갚는 ${won(d.monthly)}은 이미 고정지출에 들어 있어서, 더 내야 하는 ${won(extra)} × ${d.periodMonths}개월만 목표로 잡았어요.`,
      ],
    });
  }
  if (input.invest) {
    goals.push({
      id: 'invest',
      label: '투자',
      deadline: null,
      monthlyCap: input.invest.monthly,
      months: input.invest.months,
      target: 0, // 목표 금액 없이 월 배분액으로 관리
      basis: [
        `투자는 목표 금액 대신 매달 최대 ${won(input.invest.monthly)}을, 다른 목표를 채운 뒤 남는 돈에서만 배분해요.`,
      ],
    });
  }
  if (input.goal?.amount > 0) {
    const allocated = goals.filter(g => g.id !== 'invest').reduce((total, g) => total + g.target, 0);
    const remaining = Math.max(0, Math.round(input.goal.amount - allocated));
    if (remaining > 0)
      goals.push({
        id: 'personal',
        label: '목돈 목표',
        deadline: input.goal.months,
        target: remaining,
        basis: [`입력한 목표 ${won(input.goal.amount)}에서 다른 목적에 배정한 ${won(allocated)}을 제외한 금액이에요.`],
      });
  }
  return goals;
}
