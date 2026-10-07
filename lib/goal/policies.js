// 프로필에 맞는 정책만 고릅니다. 소득 조건은 글로 쓰여 있어 자동으로 거르지 않습니다.

export function matchesRegion(policy, region) {
  const r = policy.region || {};
  if (!r.sido) return true; // 전국 정책
  if (!region || r.sido !== region.sido) return false;
  return !r.sigungu || r.sigungu === region.sigungu;
}

export function matchesAge(policy, age) {
  const { min = null, max = null } = policy.age || {};
  if (!Number.isInteger(age)) return min === null && max === null;
  return (min === null || age >= min) && (max === null || age <= max);
}

export const matchesPurpose = (policy, purposes) =>
  Array.isArray(policy.purposes) && policy.purposes.some(p => purposes.includes(p));

// 주거 형태가 정해져 있으면 그 형태용 정책만 남깁니다. (예: 전세 대출은 월세 준비자에게 안 보여줌)
function matchesHousing(policy, profile) {
  if (!policy.housing_types) return true;
  const type = profile.detail?.['주거']?.housing_type;
  return !type || policy.housing_types.includes(type);
}

const specificity = policy => (policy.region?.sigungu ? 2 : policy.region?.sido ? 1 : 0);

// 빚이 있으면 "빚 상환"을 목적으로 고르지 않아도 빚 관련 지원(학자금 이자 지원 등)은 보여줘요.
const purposesFor = profile =>
  profile.money?.debt && !profile.purposes.includes('빚 상환') ? [...profile.purposes, '빚 상환'] : profile.purposes;

export function assessPolicy(
  policy,
  { annualGrossIncome = null, householdIncome = null } = {},
  today = new Date().toISOString().slice(0, 10),
) {
  const reasons = [];
  const income = policy.income_requirement;
  if (!income) reasons.push('소득 요건 미확인: 세후 월급만으로 신청 자격을 판정할 수 없어요.');
  else {
    const value = income.scope === 'household' ? householdIncome : annualGrossIncome;
    if (!Number.isFinite(value)) reasons.push('심사에 쓰는 세전 연소득 또는 가구소득 입력이 필요해요.');
    else if (value > income.max_manwon) return { status: 'ineligible', reasons: ['소득 상한을 초과해요.'] };
  }
  const period = policy.application_period;
  if (period?.start && today < period.start) return { status: 'not-open', reasons: [`접수 시작: ${period.start}`] };
  if (period?.end && today > period.end) return { status: 'closed', reasons: [`접수 종료: ${period.end}`] };
  if (!period?.start || !period?.end)
    reasons.push(`현재 접수 여부 미확인: ${policy.application_note || '공식 공고의 접수 기간을 확인하세요.'}`);
  reasons.push(policy.condition_note || '재산·무주택·거주·중복 수혜 조건은 공식 공고에서 확인하세요.');
  return { status: 'needs-check', reasons };
}

export function filterPolicies(profile, data) {
  const policies = Array.isArray(data?.policies) ? data.policies : [];
  const purposes = purposesFor(profile);
  return policies
    .filter(
      p =>
        matchesPurpose(p, purposes) &&
        matchesRegion(p, profile.region) &&
        matchesAge(p, profile.age) &&
        matchesHousing(p, profile),
    )
    .sort((a, b) => specificity(b) - specificity(a))
    .map(p => {
      const eligibility = assessPolicy(p);
      const label = {
        ineligible: '소득 조건 불충족',
        closed: '접수 종료',
        'not-open': '접수 전',
        'needs-check': '추가 확인 필요',
      }[eligibility.status];
      // 원래 조건 설명은 그대로 두고, 신청 가능 여부는 짧은 표시(label)와 이유(reasons)로 따로 붙여요
      return { ...p, eligibility: { ...eligibility, label }, url: p.notice_url || p.url };
    });
}

// 2번이 타임라인 단계에 붙일 때 쓰기 편하게 step별로 묶습니다.
export function groupByStep(policies) {
  const groups = {};
  for (const p of policies) (groups[p.step || 'etc'] ||= []).push(p);
  return groups;
}
