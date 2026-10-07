// 배분 규칙 A·B를 개월 단위로 시뮬레이션합니다. 예적금 이자와 투자 수익률은 넣지 않습니다.
//   규칙 A: 비상자금을 전부 채운 뒤 나머지 목표(기한 급한 순)에 배분
//   규칙 B: 비상자금을 일정 비율만 먼저 채우고 나머지 목표에 배분, 다 끝나면 남은 비상자금을 채움
// 두 규칙 모두 투자는 마지막에 남는 돈에서만 배분합니다.
import { PLAN_CONFIG } from './config.js';

export const RULES = {
  A: { id: 'A', label: '비상자금 먼저 전부 채우기' },
  B: { id: 'B', label: '비상자금 일부만 먼저 채우기' },
};

const byDeadline = (a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity);

// month번째 달에 모이는 돈. moved: 독립한 달(주거 목표를 채운 달, 없으면 null)
// loan: { months, relief } — 독립 후 months개월이 지나 대출을 다 갚으면 매달 relief(원금+이자)만큼 더 모여요.
// 적자인 달은 모아둔 돈을 깎지 않고 0으로 봐요 (시뮬레이션과 같은 규칙).
export function monthlyFlow({ saveBefore, saveAfter, loan = null }, month, moved) {
  if (moved === null || moved === undefined || month <= moved) return Math.max(0, saveBefore);
  const paidOff = loan && loan.months !== null && month - moved > loan.months;
  return Math.max(0, saveAfter + (paidOff ? loan.relief : 0));
}

// goals: buildGoals 결과. saveBefore: 독립 전 매달 저축, saveAfter: 독립(주거 목표 완료) 후 매달 저축
export function simulate({ goals, saved, saveBefore, saveAfter, loan = null, rule, config = PLAN_CONFIG }) {
  const ratio = rule === 'B' ? config.partialEmergencyRatio.value : 1;
  const emergency = goals.find(g => g.id === 'emergency');
  const housing = goals.find(g => g.id === 'housing');
  const invest = goals.find(g => g.id === 'invest');
  const others = goals.filter(g => !['emergency', 'invest'].includes(g.id)).sort(byDeadline);

  const funds = Object.fromEntries(goals.map(g => [g.id, 0]));
  const done = Object.fromEntries(goals.map(g => [g.id, null]));
  const history = [];
  let investStart = null;

  // 목표 하나에 cap까지 채우고 남은 돈을 돌려줍니다.
  const fill = (goal, money, cap = goal.target) => {
    const put = Math.max(0, Math.min(money, cap - funds[goal.id]));
    funds[goal.id] += put;
    return money - put;
  };
  const pour = (money, month, isMonthly) => {
    let left = money;
    if (emergency) left = fill(emergency, left, emergency.target * ratio);
    for (const goal of others) left = fill(goal, left);
    if (emergency) left = fill(emergency, left);
    if (invest && isMonthly && left > 0 && allDone()) {
      const put = Math.min(left, invest.monthlyCap);
      if (put > 0) {
        funds.invest += put;
        investStart ??= month;
      }
    }
    for (const goal of goals)
      if (goal.id !== 'invest' && done[goal.id] === null && funds[goal.id] >= goal.target) done[goal.id] = month;
  };
  const allDone = () => goals.every(g => g.id === 'invest' || funds[g.id] >= g.target);

  pour(saved, 0, false);
  history.push({ ...funds });
  for (let month = 1; month <= config.maxMonths; month++) {
    if (allDone() && (!invest || investStart !== null || invest.monthlyCap <= 0)) break;
    pour(monthlyFlow({ saveBefore, saveAfter, loan }, month, housing ? done.housing : null), month, true);
    history.push({ ...funds });
  }

  const at = month => history[Math.min(month, history.length - 1)];
  const moved = housing ? done.housing : null;
  return {
    rule,
    done,
    investStart,
    // 기한 시점의 목표별 부족분 (기한 없는 목표는 제외)
    atDeadline: goals
      .filter(g => g.deadline !== null)
      .map(g => ({
        id: g.id,
        deadline: g.deadline,
        funded: at(g.deadline)[g.id],
        shortfall: Math.max(0, g.target - at(g.deadline)[g.id]),
      })),
    // 독립한 시점에 비상자금이 얼마나 쌓여 있는지, 그 뒤로 몇 개월 동안 얇은 상태인지
    emergencyAtMove: emergency && moved !== null ? at(moved).emergency : null,
    thinMonths: emergency && moved !== null && done.emergency !== null ? Math.max(0, done.emergency - moved) : null,
    fundsAtMove: moved !== null ? { ...at(moved) } : null,
    history,
  };
}
