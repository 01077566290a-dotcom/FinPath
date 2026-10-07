// 질문 순서 결정, 답 검증, 프로필 JSON 생성
import { sigunguOf } from './regions.js';
import { normalizeMoney } from '../extractors/ruleExtractor.js';
import {
  QUESTIONS,
  QUESTION_BY_ID,
  UNKNOWN,
  MAX_PURPOSES,
  SIDO,
  CUTTABLE_ITEMS,
  CUTTABLE_FROM_FIXED,
  FIXED_ITEMS,
  optionsFor,
} from './questions.js';

export const PROFILE_VERSION = 1;
export const SKIPPED = 'skipped'; // 선택 질문을 건너뛴 경우

export const isVisible = (question, answers) => !question.when || question.when(answers);

// 입력 흐름에서 묻는 질문. inFlow: false인 질문(고정지출 항목, 줄일 지출)은 묻지 않지만,
// 예전 답이나 리포트에서 고른 값은 지우지 않고 계산에 써요. (지우는 기준은 isVisible)
export const visibleQuestions = answers => QUESTIONS.filter(q => q.inFlow !== false && isVisible(q, answers));

export const nextQuestion = answers => visibleQuestions(answers).find(q => answers[q.id] === undefined) || null;

// 프로필을 만드는 데 꼭 필요한 질문이 다 끝났는지. enrich 질문(목적을 더 자세히 파악하는 질문)은
// 화면에서는 묻지만, 답이 없어도 프로필은 만들어요. (기존 시연 데이터와 테스트가 그대로 동작)
export const isComplete = answers => visibleQuestions(answers).every(q => q.enrich || answers[q.id] !== undefined);

export function progress(answers) {
  const visible = visibleQuestions(answers);
  const answered = visible.filter(q => answers[q.id] !== undefined).length;
  return { answered, total: visible.length };
}

// "250", "250만", "1,000" → 정수. 숫자가 없으면 NaN
export function parseAmount(input) {
  // 휴대폰 키패드의 쉼표 소수점: '250,5' → 250.5 (천 단위 쉼표 '2,505'·'1,000,000'은 그대로)
  const text = String(input ?? '')
    .trim()
    .replace(/^(\d+),(\d{1,2})(?=\D*$)/, '$1.$2');
  const value = typeof input === 'number' ? input : normalizeMoney(text);
  return Number.isFinite(value) && value >= 0 ? value : NaN;
}

const sum = obj => Object.values(obj || {}).reduce((a, b) => a + b, 0);

// 빚 상환액까지 포함한 매달 고정지출. 고정지출을 모르면 null
export function fixedTotal(answers) {
  if (answers.fixed_items === undefined || answers.fixed_items === UNKNOWN) return null;
  const debtMonthly = answers.has_debt === 'yes' && answers.debt ? answers.debt.monthly : 0;
  return sum(answers.fixed_items) + debtMonthly;
}

// 기준 달(now)부터 "YYYY-MM"까지 몇 개월인지
export function monthsUntil(yearMonth, now = new Date()) {
  const [y, m] = yearMonth.split('-').map(Number);
  return (y - now.getFullYear()) * 12 + (m - (now.getMonth() + 1));
}

function checkNumber(value, { min = 0, max = Infinity, label = '', unit } = {}) {
  if (!Number.isFinite(value) || (unit !== '만 원' && !Number.isInteger(value))) return `${label}숫자로 입력해주세요.`;
  if (value < min) return `${label}${min} 이상으로 입력해주세요.`;
  if (value > max) return `${label}${max.toLocaleString()} 이하로 입력해주세요.`;
  return null;
}

// 답이 올바르면 null, 아니면 사용자에게 보여줄 오류 문장을 돌려줍니다.
export function validateAnswer(question, value, answers = {}, { now = new Date() } = {}) {
  if (value === UNKNOWN) return question.allowUnknown || question.type === 'choice' ? null : '값을 입력해주세요.';
  if (value === SKIPPED) return question.optional ? null : '값을 입력해주세요.';
  switch (question.type) {
    case 'number': {
      const error = checkNumber(value, question);
      if (error) return error;
      if (question.id === 'saving_now') {
        if (Number.isFinite(answers.income) && value > answers.income)
          return `월급 ${answers.income}만 원보다 많아요. 다시 확인해주세요.`;
        const fixed = fixedTotal(answers);
        if (fixed !== null && value > answers.income - fixed)
          return `월급에서 고정지출을 뺀 ${answers.income - fixed}만 원보다 많아요. 다시 확인해주세요.`;
      }
      if (
        question.id === 'current_housing_cost' &&
        Number.isFinite(answers.income) &&
        Number.isFinite(answers.saving_now) &&
        value > answers.income - answers.saving_now
      )
        return '현재 월세·관리비가 현재 월 지출보다 많아요. 월급과 저축액을 함께 확인해주세요.';
      return null;
    }
    case 'numbers':
      for (const field of question.fields) {
        const error = checkNumber(value?.[field.key], { ...field, label: `${field.label}: ` });
        if (error) return error;
      }
      return null;
    case 'items':
      if (!value || typeof value !== 'object') return '항목을 확인해주세요.';
      for (const [item, amount] of Object.entries(value)) {
        if (!FIXED_ITEMS.includes(item)) return '고를 수 없는 항목이 있어요.';
        const error = checkNumber(amount, { min: 0, max: 5000, label: `${item}: `, unit: '만 원' });
        if (error) return error;
      }
      return sum(value) < answers.income ? null : '고정지출이 월급보다 많아요. 다시 확인해주세요.';
    case 'choice':
      return optionsFor(question, answers).some(o => o.value === value) ? null : '하나를 골라주세요.';
    case 'multi': {
      const allowed = optionsFor(question, answers).map(o => o.value);
      if (!Array.isArray(value) || value.length === 0) return '하나 이상 골라주세요.';
      if (value.length > (question.max || MAX_PURPOSES)) return `최대 ${question.max}개까지 고를 수 있어요.`;
      return value.every(v => allowed.includes(v)) ? null : '고를 수 없는 항목이 있어요.';
    }
    case 'region':
      if (!value || !SIDO.includes(value.sido)) return '시·도를 골라주세요.';
      if (value.sigungu == null || value.sigungu === '') return null;
      return sigunguOf(value.sido).includes(value.sigungu) ? null : '시·군·구를 목록에서 골라주세요.';
    case 'goal':
      return (
        checkNumber(value?.amount, { min: 1, max: 10000000, label: '금액: ', unit: '만 원' }) ||
        checkNumber(value?.months, { min: 1, max: 600, label: '기간: ' })
      );
    case 'yearMonth': {
      if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return '연도와 달을 골라주세요.';
      const months = monthsUntil(value, now);
      if (months < 0) return '지난 달은 고를 수 없어요.';
      return months > 120 ? '10년 안쪽으로 골라주세요.' : null;
    }
    case 'cuttable':
      if (!Array.isArray(value)) return '항목을 확인해주세요.';
      for (const c of value) {
        if (!CUTTABLE_ITEMS.includes(c.item)) return '고를 수 없는 항목이 있어요.';
        const error = checkNumber(c.monthly, { min: 1, max: 1000, label: `${c.item}: `, unit: '만 원' });
        if (error) return error;
        const items = answers.fixed_items;
        if (CUTTABLE_FROM_FIXED.includes(c.item) && items && items !== UNKNOWN && c.monthly > (items[c.item] || 0))
          return `${c.item}는 지금 ${items[c.item] || 0}만 원을 쓰고 있어서 그보다 많이 줄일 수 없어요.`;
      }
      return null;
    default:
      return '알 수 없는 질문이에요.';
  }
}

// 답을 저장하고, 그 답 때문에 더 이상 보이지 않게 된 질문의 답은 지웁니다. (답변 고치기 대응)
export function answer(answers, id, value, options) {
  const question = QUESTION_BY_ID[id];
  if (!question) throw new Error(`없는 질문: ${id}`);
  const error = validateAnswer(question, value, answers, options);
  if (error) return { answers, error };
  const next = { ...answers, [id]: value };
  // 월급을 고칠 때도 이미 저장된 저축과 지출이 새 월급 안에 들어가는지 확인해요.
  if (id === 'income') {
    const fixed = fixedTotal(next);
    if (fixed !== null && fixed > value)
      return { answers, error: `고정지출과 빚 상환액 ${fixed}만 원보다 월급이 적어요. 지출을 먼저 확인해주세요.` };
    if (next.saving_now !== undefined) {
      const savingError = validateAnswer(QUESTION_BY_ID.saving_now, next.saving_now, next, options);
      if (savingError) return { answers, error: `${savingError} 매달 모으는 돈을 먼저 고쳐주세요.` };
    }
  }
  // 내 집 마련이면 집 형태는 매매로 정해져서 다시 묻지 않아요. 다른 계획으로 바꾸면 다시 물어요.
  if (id === 'housing_goal') {
    if (value === '내 집 마련') next.housing_type = '매매';
    else if (answers.housing_goal === '내 집 마련') delete next.housing_type;
  }
  if (id === 'has_debt' && value === 'no' && Array.isArray(next.purposes)) {
    next.purposes = next.purposes.filter(p => p !== '빚 상환');
    if (next.purposes.length === 0) delete next.purposes;
  }
  const implied = id => id === 'housing_type' && next.housing_goal === '내 집 마련'; // 묻지 않고 정해진 값
  for (const q of QUESTIONS) if (next[q.id] !== undefined && !isVisible(q, next) && !implied(q.id)) delete next[q.id];
  return { answers: next, error: null };
}

export const skip = (answers, id) => answer(answers, id, SKIPPED);

const val = v => (v === UNKNOWN || v === SKIPPED || v === undefined ? null : v);

// 2번(타임라인)·3번(리포트)에 넘기는 프로필 JSON
// now: 개월 수를 계산할 기준 달 (테스트·시연에서 고정할 때 넘깁니다)
export function buildProfile(answers, { now = new Date() } = {}) {
  if (!isComplete(answers)) return null;
  const unknowns = visibleQuestions(answers)
    .filter(q => answers[q.id] === UNKNOWN)
    .map(q => q.id);
  const purposes = answers.purposes;
  const fixed = fixedTotal(answers);
  const detail = {};
  if (purposes.includes('비상자금'))
    detail['비상자금'] = answers.emergency_reason ? { reason: answers.emergency_reason } : {};
  if (purposes.includes('주거')) {
    const rent = answers.housing_type === '월세' ? val(answers.rent) : null;
    detail['주거'] = {
      housing_goal: val(answers.housing_goal),
      housing_type: answers.housing_type,
      deposit: val(answers.deposit),
      rent: rent ? rent.rent : null,
      maintenance: rent ? rent.maintenance : null,
      move_in: answers.move_in,
      move_in_months: monthsUntil(answers.move_in, now),
      commute_after: val(answers.commute_after),
      loan_plan: answers.loan_plan === UNKNOWN ? '모름' : answers.loan_plan,
      loan_amount: answers.loan_plan === '예' ? answers.loan_amount : null,
      loan_principal_monthly: val(answers.loan_principal_monthly),
      variable_after_delta: val(answers.variable_after_delta),
      current_housing_cost: val(answers.current_housing_cost),
    };
  }
  if (purposes.includes('결혼'))
    detail['결혼'] = {
      wedding_when: answers.wedding_when,
      wedding_months: monthsUntil(answers.wedding_when, now),
      wedding_cost: val(answers.wedding_cost),
      family_support: val(answers.family_support),
      partner_share: val(answers.partner_share),
    };
  if (purposes.includes('투자'))
    detail['투자'] = { invest_months: answers.invest_months, invest_monthly: answers.invest_monthly };
  if (purposes.includes('빚 상환')) detail['빚 상환'] = { debt_period: answers.debt_period };

  return {
    version: PROFILE_VERSION,
    base_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    money: {
      income: answers.income,
      fixed, // 빚 상환액 포함 합계
      // 빚 상환액 제외 항목별. 입력 흐름에서는 교통비만 물어서(commute_now) 그 값만 담길 수 있어요.
      fixed_items:
        val(answers.fixed_items) ?? (Number.isInteger(answers.commute_now) ? { 교통비: answers.commute_now } : null),
      saving_now: answers.saving_now,
      variable: fixed === null ? null : answers.income - fixed - answers.saving_now, // 변동 생활비 (계산값)
      saved: answers.saved,
      debt:
        answers.has_debt === 'yes'
          ? { remain: answers.debt.remain, monthly: answers.debt.monthly, type: val(answers.debt_type) }
          : null,
    },
    employment: val(answers.employment), // 비상자금을 고른 사람에게만 물어요. 없으면 계산에서 기준값을 써요
    work_years: val(answers.work_years),
    living_now: val(answers.living_now),
    age: answers.age,
    region: { sido: answers.region.sido, sigungu: answers.region.sigungu || null },
    goal: answers.goal === UNKNOWN ? null : { amount: answers.goal.amount, months: answers.goal.months },
    purposes: [...purposes],
    cuttable: (Array.isArray(answers.cuttable) ? answers.cuttable : []).map(c => ({
      item: c.item,
      monthly: c.monthly,
    })),
    detail,
    unknowns,
  };
}

// 2·3번이 받은 프로필이 형식에 맞는지 확인할 때 씁니다. 문제 목록을 돌려줍니다.
export function validateProfile(profile) {
  const problems = [];
  const isInt = v => Number.isFinite(v) && v >= 0;
  if (!profile || profile.version !== PROFILE_VERSION) return ['version이 맞지 않아요.'];
  const m = profile.money || {};
  if (!isInt(m.income)) problems.push('money.income');
  if (m.fixed !== null && !isInt(m.fixed)) problems.push('money.fixed');
  if (!isInt(m.saving_now)) problems.push('money.saving_now');
  if (m.variable !== null && !isInt(m.variable)) problems.push('money.variable');
  if (!isInt(m.saved)) problems.push('money.saved');
  if (m.debt !== null && !(isInt(m.debt?.remain) && isInt(m.debt?.monthly))) problems.push('money.debt');
  if (!SIDO.includes(profile.region?.sido)) problems.push('region.sido');
  if (!Array.isArray(profile.purposes) || profile.purposes.length < 1 || profile.purposes.length > MAX_PURPOSES)
    problems.push('purposes');
  for (const p of profile.purposes || []) if (!profile.detail?.[p]) problems.push(`detail.${p}`);
  if (!Array.isArray(profile.unknowns)) problems.push('unknowns');
  return problems;
}
