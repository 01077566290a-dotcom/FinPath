// 보조금24(행정안전부_대한민국 공공서비스(혜택) 정보) 응답을 FinPath 정책 형식으로 바꿉니다.
// 응답 필드는 한글입니다: 서비스ID, 서비스명, 서비스목적요약, 지원대상, 선정기준, 지원내용,
// 소관기관명, 소관기관유형, 상세조회URL, 사용자구분 ...
// 지원조건(supportConditions)의 JA0110/JA0111이 대상 나이(시작/끝)입니다.

const SIDO_NAMES = {
  서울특별시: '서울',
  부산광역시: '부산',
  대구광역시: '대구',
  인천광역시: '인천',
  광주광역시: '광주',
  대전광역시: '대전',
  울산광역시: '울산',
  세종특별자치시: '세종',
  경기도: '경기',
  강원특별자치도: '강원',
  강원도: '강원',
  충청북도: '충북',
  충청남도: '충남',
  전북특별자치도: '전북',
  전라북도: '전북',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
  제주특별자치도: '제주',
};

// "서울특별시 마포구" → { sido: '서울', sigungu: '마포구' }, 중앙부처 → 전국
export function regionFromOrg(orgName = '', orgType = '') {
  const parts = String(orgName).trim().split(/\s+/);
  const sido = SIDO_NAMES[parts[0]];
  if (!sido || /중앙|공공기관/.test(orgType)) return { sido: null, sigungu: null };
  return { sido, sigungu: parts[1] && /[시군구]$/.test(parts[1]) ? parts[1] : null };
}

const RULES = [
  { step: 'contract_check', test: /반환보증|보증료/ },
  { step: 'move_in_cost', test: /이사|중개보수|중개수수료/ },
  { step: 'housing_search', test: /임대주택|매입임대|공공임대|안심주택/ },
  { step: 'housing_deposit', test: /보증금|전세자금|전월세|이자\s?지원|대출/ },
  { step: 'housing_budget', test: /월세/ },
  { step: 'saving_method', test: /적금|저축|자산형성|청약통장|통장/ },
];

export function classify(text) {
  const rule = RULES.find(r => r.test.test(text));
  if (!rule) return null;
  const purposes = rule.step === 'saving_method' ? ['비상자금', '주거', '결혼'] : ['주거'];
  let housing_types;
  if (/월세/.test(text) && !/전세/.test(text)) housing_types = ['월세'];
  else if (/전세/.test(text) && !/월세/.test(text)) housing_types = ['전세'];
  return { step: rule.step, purposes, ...(housing_types ? { housing_types } : {}) };
}

const toAge = v => {
  const n = Number(String(v ?? '').trim());
  return Number.isInteger(n) && n > 0 && n < 120 ? n : null;
};

const clip = (s, n) => {
  const t = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

// 청년 대상인지: 이름·지원대상에 "청년"이 있거나, 나이 범위가 19~39세와 겹치고 상한이 45세 이하
export function isYouth(item, conditions = {}) {
  if (/청년|사회초년/.test(`${item['서비스명']} ${item['지원대상']}`)) return true;
  const min = toAge(conditions.JA0110);
  const max = toAge(conditions.JA0111);
  return max !== null && max <= 45 && max >= 19 && (min === null || min <= 39);
}

// 보조금24 항목 하나 → 정책 형식. 주거·저축과 관계없으면 null
export function toPolicy(item, conditions = {}) {
  const name = clip(item['서비스명'], 80);
  const text = `${item['서비스명']} ${item['서비스목적요약'] ?? ''} ${item['지원내용'] ?? ''}`;
  const kind = classify(item['서비스명'] ?? '') || classify(text); // 이름으로 먼저 분류
  if (!name || !kind || !isYouth(item, conditions)) return null;
  if (item['사용자구분'] && !String(item['사용자구분']).includes('개인')) return null;
  return {
    id: `gov24-${item['서비스ID']}`,
    name,
    summary: clip(item['서비스목적요약'] || item['지원내용'], 120),
    ...kind,
    region: regionFromOrg(item['소관기관명'], item['소관기관유형']),
    age: { min: toAge(conditions.JA0110), max: toAge(conditions.JA0111) },
    condition_note: clip(item['선정기준'] || item['지원대상'] || '세부 조건은 공식 안내에서 확인하세요.', 160),
    url: item['상세조회URL'] || 'https://www.gov.kr',
    source: 'gov24',
  };
}

// 괄호 속 기관명, 띄어쓰기, 가운뎃점을 빼고 "서울특별시"는 "서울시"로 맞춰 비교합니다.
const norm = s =>
  String(s)
    .replace(/\(.*?\)|\s|·/g, '')
    .replace(/^서울특별시/, '서울시')
    .toLowerCase();

// 손으로 확인한 정책을 먼저 두고, 이름이 같은 API 항목은 뺍니다.
export function mergePolicies(manual = [], fromApi = []) {
  const names = manual.map(p => norm(p.name));
  const seen = new Set(manual.map(p => p.id));
  const extra = fromApi.filter(p => {
    const n = norm(p.name);
    if (seen.has(p.id) || names.includes(n)) return false;
    seen.add(p.id);
    return true;
  });
  return [...manual, ...extra];
}
