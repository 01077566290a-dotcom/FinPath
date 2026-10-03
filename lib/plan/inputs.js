// 1번 프로필(lib/goal/engine.js buildProfile) → 계산용 입력으로 바꿉니다.
// 모르겠다고 답한 값(null)은 기준값으로 채우고, 채운 항목은 usedDefaults에 남겨 화면에서 "기준값 사용"을 표시할 수 있게 합니다.
import { PLAN_CONFIG } from './config.js';

const parseBase = baseMonth => {
  const [year, month] = baseMonth.split('-').map(Number);
  return { year, month };
};

// assumptions.variableAfterDelta: 독립 후 변동 생활비가 지금보다 얼마나 바뀌는지 (만 원, 기본 0)
export function toPlanInput(profile, { assumptions = {}, config = PLAN_CONFIG } = {}) {
  const { money } = profile;
  const usedDefaults = [];
  const has = name => profile.purposes.includes(name);
  const regionKey = [profile.region.sido, profile.region.sigungu].filter(Boolean).join(' ');
  const regional = config.defaults.byRegion[regionKey] || {};

  const input = {
    asOf: parseBase(profile.base_month),
    region: regionKey,
    employment: profile.employment,
    income: money.income,
    saveNow: money.saving_now,
    saved: money.saved,
    spendNow: money.income - money.saving_now,
    debt: money.debt,
    goal: profile.goal,
    cuttable: profile.cuttable,
    purposes: profile.purposes,
    variableAfterDelta: assumptions.variableAfterDelta ?? 0,
    commuteDelta: 0,
    housing: null,
    wedding: null,
    invest: null,
    debtPlan: null,
    usedDefaults,
  };

  if (has('주거')) {
    const d = profile.detail['주거'];
    const type = d.housing_type;
    const pick = (value, fallback, key) => {
      if (value !== null && value !== undefined) return value;
      usedDefaults.push(key);
      return fallback;
    };
    const deposit = pick(d.deposit, regional.deposit?.[type] ?? config.defaults.deposit[type], 'deposit');
    let rent = 0,
      maintenance = 0;
    if (type === '월세') {
      const base = regional.rent || config.defaults.rent;
      rent = pick(d.rent, base.rent, 'rent');
      maintenance = pick(d.maintenance, base.maintenance, 'maintenance');
    }
    const loan = d.loan_amount || 0;
    const convertedDeposit = deposit + rent * 100; // 환산보증금
    const c = config.initialCosts;
    const initialCosts = [
      { label: '중개수수료', amount: Math.round(convertedDeposit * c.brokerageRate) },
      { label: '이사비', amount: c.moving },
      { label: '가전·가구·생활용품', amount: c.furnishing },
    ];
    input.housing = { type, deposit, rent, maintenance, loan, moveInMonths: d.move_in_months, initialCosts };
    const transport = profile.money.fixed_items?.['교통비'];
    if (transport !== undefined && d.commute_after !== null && d.commute_after !== undefined)
      input.commuteDelta = transport - d.commute_after;
  }
  if (has('결혼')) {
    const d = profile.detail['결혼'];
    let cost = d.wedding_cost;
    if (cost === null) {
      cost = config.defaults.weddingCost;
      usedDefaults.push('wedding_cost');
    }
    input.wedding = {
      months: d.wedding_months,
      cost,
      familySupport: d.family_support ?? 0,
      partnerShare: d.partner_share ?? 0, // 선택 입력, 건너뛰면 0%
    };
  }
  if (has('투자')) {
    const d = profile.detail['투자'];
    input.invest = { months: d.invest_months, monthly: d.invest_monthly };
  }
  if (has('빚 상환') && money.debt) {
    input.debtPlan = { periodMonths: profile.detail['빚 상환'].debt_period, ...money.debt };
  }
  return input;
}
