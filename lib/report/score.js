// 인바디처럼 한눈에 보는 '내 돈 건강 점수' (100점).
// 2번 엔진(buildPlan)의 숫자만 써서 네 항목을 25점씩 매기고, 청년 가구 평균·기준과 비교합니다.
// 항목·점수 규칙은 리포트의 '계산 방법'에 그대로 보여 줍니다 (lib/report/method.js).
import { BENCHMARKS } from './benchmarks.js';

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
    compare: { label: '청년 가구 평균', value: avg },
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
    compare: { label: `목표 ${targetMonths}개월치`, value: 100 },
    scaleMax: 100,
    better: 'higher',
    formula: emergencyGoal
      ? `모아둔 돈 ÷ 비상자금 목표(${emergencyGoal.target.toLocaleString()}만 원)`
      : `모아둔 돈으로 버틸 수 있는 개월 ÷ ${targetMonths}개월`,
  });

  // 3. 목표 준비도 (기한까지 모을 수 있는 돈 ÷ 필요한 돈)
  const readiness = plan.core.readiness;
  const goalRate =
    readiness === null || readiness === undefined
      ? plan.core.monthsNeeded !== null
        ? 80
        : 0
      : Math.min(100, readiness);
  items.push({
    id: 'goal',
    label: '목표 준비도',
    value: Math.round(goalRate),
    unit: '%',
    points: 25 * clamp01(goalRate / 100),
    level: goalRate >= 100 ? 'high' : goalRate >= 70 ? 'mid' : 'low',
    compare: { label: '기한 안에 다 모음', value: 100 },
    scaleMax: 100,
    better: 'higher',
    formula:
      readiness === null || readiness === undefined
        ? '기한이 없는 목표라 지금 속도로 닿을 수 있으면 80%로 봐요'
        : '기한까지 모을 수 있는 돈 ÷ 실제로 필요한 돈',
  });

  // 4. 주거비 비중 (주거를 안 고르면 빚 상환 비중)
  if (hasHousing) {
    const rate = plan.cashflow.housingRate;
    items.push({
      id: 'housing',
      label: '독립 후 주거비 비중',
      value: round1(rate),
      unit: '%',
      points: housingScore(rate),
      level: rate <= BENCHMARKS.youthRentRate.value ? 'high' : rate <= BENCHMARKS.rentBurdenLimit.value ? 'mid' : 'low',
      compare: { label: '청년 임차가구 중간값', value: BENCHMARKS.youthRentRate.value },
      limit: { label: '과부담 기준', value: BENCHMARKS.rentBurdenLimit.value },
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
      compare: { label: '일반적인 권장선', value: BENCHMARKS.debtRateLimit.value },
      scaleMax: 40,
      better: 'lower',
      formula: '매달 갚는 돈 ÷ 월급',
    });
  }

  for (const item of items) item.points = Math.round(item.points * 10) / 10;
  const total = Math.round(items.reduce((sum, item) => sum + item.points, 0));
  const grade = GRADES.find(g => total >= g.min);

  // 한마디: 가장 잘한 항목 하나 + 가장 아쉬운 항목 하나 + 할 일 하나
  const sorted = [...items].sort((a, b) => b.points - a.points);
  const best = sorted[0];
  const worst = sorted.at(-1);
  const praise = {
    saving: `${best.label}이 ${best.value}%로 청년 가구 평균(${avg}%)보다 높아요.`,
    emergency: best.value >= 100 ? '비상자금은 이미 다 모았어요.' : `비상자금은 목표의 ${best.value}%까지 모았어요.`,
    goal:
      best.value >= 100
        ? '기한 안에 필요한 돈을 다 모을 수 있어요.'
        : `필요한 돈의 ${best.value}%는 기한 안에 모을 수 있어요.`,
    housing: `독립 후 주거비가 월급의 ${best.value}%로 무리 없는 수준이에요.`,
    debt: best.value === 0 ? '갚을 빚이 없어요.' : `빚 상환 부담이 월급의 ${best.value}%로 크지 않아요.`,
  }[best.id];
  const concern = {
    saving: `다만 ${worst.label}이 ${worst.value}%로 청년 가구 평균(${avg}%)보다 낮아요.`,
    emergency: `다만 비상자금이 목표의 ${worst.value}%뿐이라 갑자기 돈이 필요하면 다른 목표를 깨야 해요.`,
    goal: `다만 기한까지는 필요한 돈의 ${worst.value}%만 모을 수 있어요.`,
    housing: `다만 독립 후 주거비가 월급의 ${worst.value}%로 커요. 청년 임차가구 중간값은 ${BENCHMARKS.youthRentRate.value}%예요.`,
    debt: `다만 빚 상환이 월급의 ${worst.value}%로 부담이 커요.`,
  }[worst.id];
  // 아쉬운 항목이 실제로 기준보다 나쁠 때만 '다만 …'을 붙여요. (평균보다 높은데 낮다고 말하지 않게)
  const fine =
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
