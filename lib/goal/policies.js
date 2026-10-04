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
    .sort((a, b) => specificity(b) - specificity(a));
}

// 2번이 타임라인 단계에 붙일 때 쓰기 편하게 step별로 묶습니다.
export function groupByStep(policies) {
  const groups = {};
  for (const p of policies) (groups[p.step || 'etc'] ||= []).push(p);
  return groups;
}
