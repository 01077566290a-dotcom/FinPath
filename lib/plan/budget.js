// 개인화 판단: 목표를 기한 안에 이루려면 월급의 몇 %를 모아야 하고, 생활비는 최대 얼마까지 쓸 수 있는지,
// 무리하면 기간을 얼마나 늘려야 하는지를 정합니다. 기준 비율은 config.js의 limits를 씁니다.
import { PLAN_CONFIG } from './config.js';
import { money } from '../report/format.js';

const sum = list => list.reduce((a, b) => a + b, 0);
const pct = (value, income) => Math.round((value / income) * 1000) / 10;

// 기한이 있는 목표를 기한 순으로 보며 "그 시점까지 필요한 돈"을 쌓습니다. 비상자금은 첫 기한까지 채우는 것으로 봅니다.
export function checkpoints(goals, saved, fallbackMonths) {
  const timed = goals.filter(g => g.deadline !== null && g.id !== 'invest').sort((a, b) => a.deadline - b.deadline);
  const emergency = goals.find(g => g.id === 'emergency');
  const dueDates = [...new Set(timed.map(g => Math.max(1, g.deadline)))];
  if (!dueDates.length) dueDates.push(Math.max(1, fallbackMonths));
  let carried = emergency ? emergency.target : 0;
  return dueDates.map(months => {
    const due = timed.filter(g => Math.max(1, g.deadline) === months);
    carried += sum(due.map(g => g.target));
    return { months, cumulative: carried, requiredMonthly: Math.max(0, Math.ceil((carried - saved) / months)) };
  });
}

// 월세 + 관리비로 쓸 수 있는 최대 금액: 월급 대비 상한과 "독립 후에도 남겨야 할 저축" 중 더 빡빡한 쪽
export function affordableHousing(input, cashflow, config = PLAN_CONFIG) {
  const { housingCap, minAfterSaveRate } = config.limits;
  const spendWithoutHousing = cashflow.after.spend - cashflow.housingCost;
  const byCap = Math.floor(input.income * housingCap.value);
  const bySave = Math.floor(input.income - spendWithoutHousing - input.income * minAfterSaveRate.value);
  const max = Math.max(0, Math.min(byCap, bySave));
  // 권장 상한이 너무 낮으면(구하기 어려운 월세) 월세만으로는 해결이 안 된다고 따로 안내해요
  return { max, byCap, bySave, unrealistic: max < config.limits.minRent.value };
}

export function analyzeBudget({ input, cashflow, goals, config = PLAN_CONFIG }) {
  const { maxSaveRate, housingCap, minAfterSaveRate, housingBurdenExtraEmergencyMonths } = config.limits;
  const won = n => money(n);
  const income = input.income;
  const fallback = input.goal?.months ?? config.defaultHorizonMonths;
  const cutTotal = sum(input.cuttable.map(c => c.monthly));

  // 주거비 부담이 크면 비상자금을 더 쌓도록 목표를 키웁니다. (독립 후 저축이 적어 다시 채우기 어렵기 때문)
  const housingRate = input.housing ? cashflow.housingCost / income : 0;
  const afterRate = cashflow.after.save / income;
  const burdenHigh = Boolean(input.housing) && (housingRate > housingCap.value || afterRate < minAfterSaveRate.value);
  const emergency = goals.find(g => g.id === 'emergency');
  const buffer =
    burdenHigh && emergency ? Math.round(cashflow.after.spend * housingBurdenExtraEmergencyMonths.value) : 0;
  const planGoals = buffer ? goals.map(g => (g.id === 'emergency' ? { ...g, target: g.target + buffer } : g)) : goals;

  const points = checkpoints(planGoals, input.saved, fallback);
  const required = Math.max(...points.map(p => p.requiredMonthly));
  const ceiling = Math.floor(income * maxSaveRate.value);
  const capacity = Math.min(ceiling, input.saveNow + cutTotal); // 지금 저축 + 줄일 수 있다고 답한 지출
  const affordable = input.housing ? affordableHousing(input, cashflow, config) : null;

  // 판정: 지금 속도로 충분 / 지출을 줄이면 가능 / 기간을 늘려야 함 / 저축 여력이 없음
  let verdict, monthly;
  if (required <= input.saveNow) ((verdict = 'on_track'), (monthly = input.saveNow));
  else if (required <= capacity) ((verdict = 'cut_spending'), (monthly = required));
  else if (capacity > 0) ((verdict = 'extend'), (monthly = capacity));
  else ((verdict = 'no_room'), (monthly = 0));

  // 기간 늘리기: 체크포인트마다 모을 수 있는 속도(monthly)로 다시 계산
  const extended = points.map(p => ({
    ...p,
    newMonths: monthly > 0 ? Math.max(p.months, Math.ceil((p.cumulative - input.saved) / monthly)) : null,
  }));
  const primary = extended.at(-1);
  const housingPoint = input.housing ? extended.find(p => p.months === Math.max(1, input.housing.moveInMonths)) : null;
  const focus = housingPoint || extended[0];

  // 생활비 상한: 월급 − 계획 저축 − 월세·관리비 (월세 외 모든 지출의 상한)
  const livingMax = Math.max(0, income - monthly - cashflow.housingCost);
  const livingNow = cashflow.after.spend - cashflow.housingCost;

  const reasons = [];
  if (input.housing && housingRate > housingCap.value)
    reasons.push(
      `${cashflow.housingName}가 월급의 ${pct(cashflow.housingCost, income)}%라 일반적인 기준(${Math.round(housingCap.value * 100)}% 이하)보다 높아요.`,
    );
  if (input.housing && afterRate < minAfterSaveRate.value)
    reasons.push(
      cashflow.after.save < 0
        ? `독립하면 쓰는 돈이 월급보다 많아서 매달 ${won(-cashflow.after.save)}이 모자라요.`
        : `독립하면 저축이 월 ${won(cashflow.after.save)}(월급의 ${pct(cashflow.after.save, income)}%)으로 줄어들어요.`,
    );
  if (buffer)
    reasons.push(
      `${housingRate > housingCap.value ? '주거비 부담이 커서' : '독립 후 저축이 적어서'} 비상자금을 ${housingBurdenExtraEmergencyMonths.value}개월치(${won(buffer)}) 더 쌓는 걸 권해요.`,
    );
  if (verdict === 'extend')
    reasons.push(
      required > income
        ? `기한에 맞추려면 매달 ${won(required)}을 모아야 해서 월급으로는 어려워요.`
        : `기한에 맞추려면 월급의 ${pct(required, income)}%를 모아야 해서 지금 속도로는 어려워요.`,
    );

  return {
    verdict,
    burdenHigh,
    buffer,
    planGoals,
    required: { monthly: required, rate: pct(required, income) },
    ceiling,
    plan: {
      monthly,
      saveRate: pct(monthly, income),
      cutNeeded: Math.max(0, monthly - input.saveNow),
      cutAvailable: cutTotal,
      livingMax,
      livingMaxRate: pct(livingMax, income),
      livingNow,
      livingOver: Math.max(0, livingNow - livingMax),
    },
    period: {
      from: focus.months,
      to: focus.newMonths,
      extra: focus.newMonths === null ? null : focus.newMonths - focus.months,
      all: extended.map(p => ({ from: p.months, to: p.newMonths })),
    },
    housing: input.housing && {
      rate: pct(cashflow.housingCost, income),
      cap: Math.round(housingCap.value * 100),
      affordable,
      tooHigh: cashflow.housingCost > affordable.max,
    },
    reasons,
    primary,
  };
}
