// 인바디처럼 한눈에 보는 '내 돈 건강 점수' (100점).
// 2번 엔진(buildPlan)의 숫자만 써서 네 항목을 25점씩 매기고, 청년 가구 평균·기준과 비교합니다.
// 항목·점수 규칙은 리포트의 '계산 방법'에 그대로 보여 줍니다 (lib/report/method.js).
import { BENCHMARKS } from './benchmarks.js';
import { money } from './format.js';

const clamp01 = v => Math.max(0, Math.min(1, v));
const round1 = v => Math.round(v * 10) / 10;
const lerp = (x, x0, y0, x1, y1) => y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);

// 저축률: 0% → 0점, 35% 이상 → 25점 (청년 가구 평균 24.7%면 약 18점)
const SAVE_FULL = 35;
export function saveScore(rate) {
  return 25 * clamp01(rate / SAVE_FULL);
}
// 주거비 비중(낮을수록 좋음): 청년 중간값 16% 이하 25점 → 기준 30%에서 12점 → 45% 이상 0점
export function housingScore(rate) {
  const mid = BENCHMARKS.youthRentRate.value;
  const limit = BENCHMARKS.rentBurdenLimit.value;
  if (rate <= mid) return 25;
  if (rate <= limit) return lerp(rate, mid, 25, limit, 12);
  return Math.max(0, lerp(rate, limit, 12, 45, 0));
}
// 빚 상환 비중(낮을수록 좋음): 0% 25점 → 20% 이상 0점
export function debtScore(rate) {
  return 25 * clamp01(1 - rate / BENCHMARKS.debtRateLimit.value);
}

const GRADES = [
  { min: 80, label: '아주 좋아요', tone: 'good' },
  { min: 60, label: '잘하고 있어요', tone: 'good' },
  { min: 40, label: '조금만 더 해봐요', tone: 'warning' },
  { min: 0, label: '지금부터 바꿔봐요', tone: 'serious' },
];

// 인바디의 '표준 이하 · 표준 · 표준 이상'처럼 세 칸으로 보여 줍니다.
const LEVEL = { low: '부족', mid: '보통', high: '좋음' };

export function scoreFromPlan(plan) {
  const metric = id => plan.metrics.find(m => m.id === id);
  const row = (m, key) => m?.rows.find(r => r.key === key)?.value;
  const hasHousing = Boolean(plan.housing);
  const items = [];

  // 1. 저축률 (주거를 고르면 독립 후 기준: 계획대로 독립했을 때의 모습)
  const saving = metric('saving');
  const saveRate = hasHousing
    ? (row(saving, 'after') ?? plan.cashflow.after.rate)
    : (row(saving, 'now') ?? plan.cashflow.now.rate);
  const avg = BENCHMARKS.youthSaveRate.value;
  items.push({
    id: 'saving',
    label: hasHousing ? '독립 후 저축률' : '저축률',
    value: round1(saveRate),
    unit: '%',
    points: saveScore(saveRate),
    level: saveRate >= avg * 1.1 ? 'high' : saveRate >= avg * 0.7 ? 'mid' : 'low',
    compare: { label: '청년 가구 평균', short: '청년 평균', value: avg },
    scaleMax: 50,
    better: 'higher',
    formula: hasHousing ? '독립 후 매달 모으는 돈 ÷ 월급' : '매달 모으는 돈 ÷ 월급',
  });

  // 2. 비상자금 준비율 (모아둔 돈 ÷ 비상자금 목표)
  const emergencyGoal = plan.goals.find(g => g.id === 'emergency');
  const emergencyMetric = metric('emergency');
  const targetMonths = emergencyMetric?.marker?.value ?? 3;
  const nowMonths = row(emergencyMetric, 'now') ?? 0;
  const readyRate = emergencyGoal
    ? Math.min(100, (plan.profile.saved / Math.max(1, emergencyGoal.target)) * 100)
    : Math.min(100, (nowMonths / targetMonths) * 100);
  items.push({
    id: 'emergency',
    label: '비상자금 준비',
    value: Math.round(readyRate),
    unit: '%',
    points: 25 * clamp01(readyRate / 100),
    level: readyRate >= 100 ? 'high' : readyRate >= 50 ? 'mid' : 'low',
    compare: { label: `목표 ${targetMonths}개월치`, short: '목표', value: 100 },
    scaleMax: 100,
    better: 'higher',
    formula: emergencyGoal
      ? `모아둔 돈 ÷ 비상자금 목표(${money(emergencyGoal.target)})`
      : `모아둔 돈으로 버틸 수 있는 개월 ÷ ${targetMonths}개월`,
  });

  // 3. 목표 준비도 (기한까지 모을 수 있는 돈 ÷ 필요한 돈)
  //    투자만 고른 경우에는 모을 목표 금액이 없어서 '투자 여력'(넣을 수 있는 돈 ÷ 원하는 투자금)으로 봐요.
  const investGoal = plan.goals.find(g => g.id === 'invest');
  const investOnly = investGoal && plan.goals.every(g => g.id === 'invest');
  const readiness = plan.core.readiness;
  // 기한이 없는 목표(모르겠다고 답한 경우)는 '다 모으는 데 걸리는 기간'으로 봐요: 1년 안 100 · 3년 안 80 · 5년 안 60 · 그 뒤 40
  const monthsNeeded = plan.core.monthsNeeded;
  const speedRate =
    monthsNeeded === null ? 0 : monthsNeeded <= 12 ? 100 : monthsNeeded <= 36 ? 80 : monthsNeeded <= 60 ? 60 : 40;
  const noDeadlineGoal = readiness === null || readiness === undefined;
  const goalRate = noDeadlineGoal ? speedRate : Math.min(100, readiness);
  if (investOnly) {
    const possible = Math.max(0, Math.min(plan.profile.saveNow, investGoal.monthlyCap));
    const rate = investGoal.monthlyCap > 0 ? Math.min(100, (possible / investGoal.monthlyCap) * 100) : 100;
    items.push({
      id: 'goal',
      label: '투자 여력',
      value: Math.round(rate),
      unit: '%',
      points: 25 * clamp01(rate / 100),
      level: rate >= 100 ? 'high' : rate >= 70 ? 'mid' : 'low',
      compare: { label: '원하는 투자금 전부', short: '목표', value: 100 },
      scaleMax: 100,
      better: 'higher',
      formula: `지금 매달 넣을 수 있는 돈 ÷ 원하는 투자금(월 ${money(investGoal.monthlyCap)})`,
    });
  } else
    items.push({
      id: 'goal',
      label: noDeadlineGoal ? '다 모으는 속도' : '목표 준비도',
      value: Math.round(goalRate),
      unit: '%',
      points: 25 * clamp01(goalRate / 100),
      level: goalRate >= 100 ? 'high' : goalRate >= 70 ? 'mid' : 'low',
      compare: noDeadlineGoal
        ? {
            label: plan.core.doneLabel ? `${plan.core.doneLabel}에 다 모음` : '지금 속도로는 닿지 않음',
            short: '1년 안',
            value: 100,
          }
        : { label: '기한 안에 다 모음', short: '목표', value: 100 },
      scaleMax: 100,
      better: 'higher',
      formula:
        readiness === null || readiness === undefined
          ? '기한이 없어서 다 모으는 데 걸리는 기간으로 봐요 (1년 안 100% · 3년 안 80% · 5년 안 60% · 그 뒤 40%)'
          : '기한까지 모을 수 있는 돈 ÷ 실제로 필요한 돈',
    });

  // 4. 주거비 비중 (월세일 때). 전세·매매는 대출 이자를 아직 계산하지 않아 0%로 보이므로, 주거를 안 고른 경우처럼 빚 상환 비중으로 봐요.
  if (hasHousing && plan.cashflow.housingCost > 0) {
    const rate = plan.cashflow.housingRate;
    items.push({
      id: 'housing',
      label: '독립 후 주거비 비중',
      value: round1(rate),
      unit: '%',
      points: housingScore(rate),
      level: rate <= BENCHMARKS.youthRentRate.value ? 'high' : rate <= BENCHMARKS.rentBurdenLimit.value ? 'mid' : 'low',
      compare: { label: '청년 임차가구 중간값', short: '청년 중간값', value: BENCHMARKS.youthRentRate.value },
      limit: { label: '과부담 기준', short: '과부담', value: BENCHMARKS.rentBurdenLimit.value },
      scaleMax: 50,
      better: 'lower',
      formula: '월세 + 관리비 ÷ 월급',
    });
  } else {
    const debt = plan.diagnosis?.debt;
    const rate = debt ? (debt.monthly / plan.profile.income) * 100 : 0;
    items.push({
      id: 'debt',
      label: '빚 상환 비중',
      value: round1(rate),
      unit: '%',
      points: debtScore(rate),
      level: rate === 0 ? 'high' : rate <= BENCHMARKS.debtRateLimit.value / 2 ? 'mid' : 'low',
      compare: { label: '일반적인 권장선', short: '권장선', value: BENCHMARKS.debtRateLimit.value },
      scaleMax: 40,
      better: 'lower',
      formula: '매달 갚는 돈 ÷ 월급',
    });
  }

  for (const item of items) item.points = Math.round(item.points * 10) / 10;
  const total = Math.round(items.reduce((sum, item) => sum + item.points, 0));
  // 기한까지 부족한 돈이 있으면 점수가 높아도 '아주 좋아요'까지는 주지 않아요 (등급과 상황이 어긋나지 않게)
  const short = plan.core.deadline !== null && plan.core.gap > 0 && !investOnly;
  const grade = GRADES.find(g => total >= g.min && !(short && g.min >= 80));

  // 한마디: 가장 잘한 항목 하나 + 가장 아쉬운 항목 하나 + 할 일 하나
  // '갚을 빚이 없어요'처럼 0%라서 만점인 항목보다는, 다른 항목에 칭찬할 게 있으면 그걸 먼저 말해요.
  const sorted = [...items].sort((a, b) => b.points - a.points);
  const meaningful = sorted.filter(i => !(i.id === 'debt' && i.value === 0) && i.points >= 15);
  const best = meaningful[0] ?? sorted[0];
  const worst = sorted.at(-1);
  const noDeadline = !investOnly && (readiness === null || readiness === undefined);
  const say = (item, good) => {
    const v = item.value;
    switch (item.id) {
      case 'saving':
        return good
          ? `${item.label}이 ${v}%로 청년 가구 평균(${avg}%)보다 높아요.`
          : `다만 ${item.label}이 ${v}%로 청년 가구 평균(${avg}%)보다 낮아요.`;
      case 'emergency':
        if (good) return v >= 100 ? '비상자금은 이미 다 모았어요.' : `비상자금은 목표의 ${v}%까지 모았어요.`;
        return item.level === 'low'
          ? `다만 비상자금이 목표의 ${v}%뿐이라 갑자기 돈이 필요하면 다른 목표를 깨야 해요.`
          : `비상자금은 목표의 ${v}%예요. 조금만 더 채우면 돼요.`;
      case 'goal':
        if (investOnly)
          return good
            ? v >= 100
              ? '원하는 만큼 매달 투자할 수 있어요.'
              : `원하는 투자금의 ${v}%는 매달 넣을 수 있어요.`
            : `다만 원하는 투자금의 ${v}%만 매달 넣을 수 있어요.`;
        if (noDeadline)
          return good
            ? `지금 속도로 ${plan.core.doneLabel}이면 필요한 돈을 다 모아요.`
            : plan.core.doneLabel
              ? `다만 다 모으기까지 ${plan.core.doneLabel}까지 걸려요.`
              : '다만 지금 속도로는 필요한 돈에 닿지 않아요.';
        return good
          ? v >= 100
            ? '기한 안에 필요한 돈을 다 모을 수 있어요.'
            : `필요한 돈의 ${v}%는 기한 안에 모을 수 있어요.`
          : `다만 기한까지는 필요한 돈의 ${v}%만 모을 수 있어요.`;
      case 'housing':
        if (good) return `독립 후 주거비가 월급의 ${v}%로 무리 없는 수준이에요.`;
        return item.level === 'low'
          ? `다만 독립 후 주거비가 월급의 ${v}%로 커요. 청년 임차가구 중간값은 ${BENCHMARKS.youthRentRate.value}%예요.`
          : `독립 후 주거비는 월급의 ${v}%로 기준(${BENCHMARKS.rentBurdenLimit.value}%) 안이지만, 청년 중간값(${BENCHMARKS.youthRentRate.value}%)보다는 높아요.`;
      case 'debt':
        if (good) return v === 0 ? '갚을 빚이 없어요.' : `빚 상환 부담이 월급의 ${v}%로 크지 않아요.`;
        return item.level === 'low'
          ? `다만 빚 상환이 월급의 ${v}%로 부담이 커요.`
          : `빚 상환은 월급의 ${v}%예요. 다 갚으면 그만큼 더 모을 수 있어요.`;
      default:
        return '';
    }
  };
  const praise = say(best, true);
  const concern = say(worst, false);
  // 아쉬운 항목이 실제로 기준보다 나쁠 때만 덧붙여요. (평균보다 높은데 낮다고 말하지 않게)
  const fine =
    best === worst ||
    worst.level === 'high' ||
    (worst.id === 'saving' && worst.value >= avg) ||
    (worst.id === 'housing' && worst.value <= BENCHMARKS.youthRentRate.value) ||
    worst.points >= 22;
  const action = plan.fixes?.[0] ? `${plan.fixes[0].title}: ${plan.fixes[0].headline}` : null;

  return {
    total,
    grade: grade.label,
    tone: grade.tone,
    comment: fine ? `${praise} 지금처럼만 하면 돼요.` : `${praise} ${concern}`,
    action,
    items: items.map(item => ({ ...item, levelLabel: LEVEL[item.level] })),
  };
}
