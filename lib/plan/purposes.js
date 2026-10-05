// 목적별 "실제로 필요한 돈" 계산. 모든 함수는 순수 함수이고 금액은 만 원 단위 정수입니다.
import { PLAN_CONFIG } from './config.js';

export const housingCostOf = housing => (housing ? housing.rent + housing.maintenance : 0);

// 월 현금흐름: 지금 vs 독립 후. 독립 후 = 지금 − 교통비 변화 + 월세·관리비 + 변동 생활비 변화
export function cashflowOf(input) {
  const housingCost = housingCostOf(input.housing);
  const spendNow = input.spendNow;
  const spendAfter = input.housing ? spendNow - input.commuteDelta + housingCost + input.variableAfterDelta : spendNow;
  const saveNow = input.saveNow;
  const saveAfter = input.income - spendAfter;
  const rate = save => Math.round((save / input.income) * 1000) / 10;
  return {
    income: input.income,
    housingCost,
    housingRate: Math.round((housingCost / input.income) * 1000) / 10,
    now: { spend: spendNow, save: saveNow, rate: rate(saveNow) },
    after: { spend: spendAfter, save: saveAfter, rate: rate(saveAfter) },
  };
}

// 목표 목록. deadline: 기한(개월, 없으면 null), target: 모아야 할 돈, basis: 계산 근거 문장
export function buildGoals(input, cashflow, config = PLAN_CONFIG) {
  const goals = [];
  const won = n => `${Math.round(n).toLocaleString()}만 원`;

  if (input.purposes.includes('비상자금')) {
    const months = config.emergencyMonths.values[input.employment] ?? config.emergencyMonths.fallback;
    const spend = cashflow.after.spend;
    goals.push({
      id: 'emergency',
      label: '비상자금',
      deadline: null,
      months,
      target: spend * months,
      basis: [
        `비상자금 = ${input.housing ? '독립 후 ' : ''}한 달 생활비 ${won(spend)} × ${months}개월 = ${won(spend * months)}`,
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
        `주거 = 보증금 ${won(h.deposit)} + 이사·초기 비용 ${won(initial)}${h.loan ? ` − 대출 ${won(h.loan)}` : ''} = ${won(h.deposit + initial - h.loan)}`,
        `이사·초기 비용 = ${h.initialCosts.map(item => `${item.label} ${item.amount}`).join(' + ')} (만 원, 추정)`,
        ...(h.rent ? [`월세·관리비 ${won(h.rent + h.maintenance)}은 독립 후 매달 나가는 돈에 더했어요.`] : []),
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
  return goals;
}
