// 보조금24(행정안전부_대한민국 공공서비스(혜택) 정보) 응답을 FinPath 정책 형식으로 바꿉니다.
// 응답 필드는 한글입니다: 서비스ID, 서비스명, 서비스목적요약, 지원대상, 선정기준, 지원내용,
// 소관기관명, 소관기관유형, 상세조회URL, 사용자구분 ...
// 지원조건(supportConditions)의 JA0110/JA0111이 대상 나이(시작/끝)입니다.

import { SIDO_NAMES, SIGUNGU, SIGUNGU_BY_SIDO } from './regions.js';

const SHORT = [
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  '경기',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
];

const NATIONWIDE = { sido: null, sigungu: null };
const UNKNOWN_REGION = { sido: null, sigungu: null, unknown: true };

function sidoInText(text) {
  const compact = String(text ?? '').replace(/\s/g, '');
  const full = Object.keys(SIDO_NAMES).find(name => compact.includes(name));
  return full ? SIDO_NAMES[full] : null;
}

// 서비스ID 앞 7자리는 소관기관의 행정기관코드예요. 앞 3자리로 시·도를 알 수 있어요.
// (예: 4840000 광양시 → 전남, 6460000 전라남도) 받아둔 데이터로 범위를 확인했어요.
const CODE_RANGES = [
  [300, 324, '서울'],
  [325, 340, '부산'],
  [341, 348, '대구'],
  [349, 357, '인천'],
  [358, 362, '광주'],
  [363, 367, '대전'],
  [368, 373, '울산'],
  [374, 417, '경기'],
  [418, 435, '강원'],
  [436, 447, '충북'],
  [448, 463, '충남'],
  [464, 479, '전북'],
  [480, 501, '전남'],
  [502, 526, '경북'],
  [527, 548, '경남'],
];
const CODE_EXACT = {
  554: '경기',
  560: '경기',
  567: '경남',
  568: '충남',
  569: '세종',
  571: '충북',
  611: '서울',
  626: '부산',
  627: '대구',
  628: '인천',
  629: '광주',
  630: '대전',
  631: '울산',
  641: '경기',
  642: '강원',
  643: '충북',
  644: '충남',
  645: '전북',
  646: '전남',
  647: '경북',
  648: '경남',
  650: '제주',
  651: '제주',
  652: '제주',
  653: '강원',
  654: '전북',
};

export function sidoFromServiceId(serviceId = '') {
  const id = String(serviceId).replace(/^gov24-/, '');
  if (!/^[3-6]\d{6}/.test(id)) return null; // 중앙부처(1~2), 공공기관(영문) 등은 코드로 지역을 정하지 않아요
  const n = Number(id.slice(0, 3));
  if (CODE_EXACT[n]) return CODE_EXACT[n];
  return CODE_RANGES.find(([lo, hi]) => n >= lo && n <= hi)?.[2] ?? null;
}

// 이름에 시·군·구가 들어 있으면 찾아요. (예: "영암군 청년 월세" → 영암군, "광양청년 주택자금" → 광양시)
export function sigunguInText(sido, text = '') {
  const compact = String(text).replace(/\s/g, '');
  const list = (SIGUNGU_BY_SIDO[sido] || '').split(' ').filter(Boolean);
  const exact = list.find(name => compact.includes(name));
  if (exact) return exact;
  return list.find(name => name.length >= 3 && compact.includes(name.slice(0, -1))) ?? null;
}

// 시·군·구 기관 코드(3~5로 시작)일 때만 이름에서 시·군·구를 찾아요. 시·도 기관(6으로 시작)은 시·도 전체 정책이에요.
export function sigunguFromCode(serviceId, sido, text) {
  const id = String(serviceId).replace(/^gov24-/, '');
  return /^[345]/.test(id) && sido !== '세종' ? sigunguInText(sido, text) : null;
}

// 이름에 시·군 이름이 들어 있으면 지역을 찾아요. (예: "영암형 공공주택" → 전남 영암군)
// 여러 시·도에 있는 이름(고성, 광주 등)과 두 글자 미만은 쓰지 않아요.
export function regionInName(text = '') {
  const t = String(text);
  let best = null;
  for (const [name, sido] of Object.entries(SIGUNGU)) {
    const base = name.slice(0, -1);
    if (base.length < 2 || base === '광주') continue;
    // 낱말 첫머리에 있을 때만 (예: "공공주택" 안의 "공주"는 공주시가 아님)
    const m = new RegExp(`(^|[\\s(·,\\[])${base}`).exec(t);
    if (m && (!best || m.index < best.index)) best = { index: m.index, sido, sigungu: name };
  }
  if (!best) return null;
  // "제주"처럼 시·도 이름과 같으면 시·도 전체로 봐요
  return SHORT.includes(best.sigungu.slice(0, -1))
    ? { sido: best.sido, sigungu: null }
    : { sido: best.sido, sigungu: best.sigungu };
}

// 소관기관으로 정책 지역을 정합니다.
// "서울특별시 마포구" → 서울 마포구, "여수시" → 전남 여수시, "부산도시공사" → 부산, 중앙부처 → 전국
// 지자체인데 시·도를 알 수 없으면 unknown: true (전국으로 잘못 보여주지 않도록 수집에서 뺍니다)
export function regionFromOrg(orgName = '', orgType = '', text = '') {
  const name = String(orgName).trim();
  const compact = name.replace(/\s/g, '');
  const tokens = name.split(/\s+/);
  const full = Object.keys(SIDO_NAMES).find(n => compact.startsWith(n));
  if (full) {
    const second = tokens[0] === full ? tokens[1] : null;
    return { sido: SIDO_NAMES[full], sigungu: second && /[시군구]$/.test(second) ? second : null };
  }
  if (SIGUNGU[tokens[0]]) return { sido: SIGUNGU[tokens[0]], sigungu: tokens[0] };
  if (/중앙/.test(orgType)) return NATIONWIDE;
  const short = SHORT.find(s => compact.startsWith(s));
  if (short && !/^광주시/.test(compact)) return { sido: short, sigungu: null }; // 예: 부산도시공사, 경기주택도시공사
  const local = /지방|지자체|자치|교육청/.test(orgType) || /[시군구]$/.test(tokens[0]);
  if (local) {
    const fromText = sidoInText(text);
    return fromText ? { sido: fromText, sigungu: null } : UNKNOWN_REGION;
  }
  return NATIONWIDE; // 한국주택금융공사 같은 전국 공공기관
}

const RULES = [
  { step: 'contract_check', purposes: ['주거'], test: /반환보증|보증료/ },
  { step: 'move_in_cost', purposes: ['주거'], test: /이사비|이사\s?지원|중개보수|중개수수료/ },
  { step: 'debt_plan', purposes: ['빚 상환'], test: /학자금|채무|신용회복|신용유의|대출\s?이자.*(학자금|상환)/ },
  {
    step: 'housing_deposit',
    purposes: ['주거', '결혼'],
    test: /신혼.*(전세|주택|대출|보증금)|(전세|주택|대출|보증금).*신혼/,
  },
  { step: 'wedding_plan', purposes: ['결혼'], test: /결혼|혼인|신혼|예비부부/ },
  { step: 'housing_search', purposes: ['주거'], test: /임대주택|매입임대|공공임대|안심주택|행복주택|기숙사/ },
  {
    step: 'housing_deposit',
    purposes: ['주거'],
    test: /보증금|전세자금|전월세|임차|이자\s?지원|주택.*대출|대출.*주택/,
  },
  { step: 'housing_budget', purposes: ['주거'], test: /월세|주거비/ },
  { step: 'saving_method', purposes: ['비상자금', '주거', '결혼'], test: /적금|저축|자산형성|청약통장|통장|목돈/ },
];

export function classify(text) {
  const rule = RULES.find(r => r.test.test(text));
  if (!rule) return null;
  let housing_types;
  if (rule.purposes.includes('주거')) {
    if (/월세/.test(text) && !/전세/.test(text)) housing_types = ['월세'];
    else if (/전세/.test(text) && !/월세/.test(text)) housing_types = ['전세'];
  }
  return { step: rule.step, purposes: [...rule.purposes], ...(housing_types ? { housing_types } : {}) };
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
// 청년이 아닌 다른 대상 전용 혜택 (이름에 청년이 없을 때만 뺍니다)
const OTHER_TARGET = /장애인|노인|어르신|한부모|아동|출산|다문화|북한이탈|보훈|농업인|어업인|어가|농가/;

export function isYouth(item, conditions = {}) {
  const name = String(item['서비스명'] ?? '');
  if (OTHER_TARGET.test(name) && !/청년/.test(name)) return false;
  if (/청년|사회초년|신혼|예비부부|대학생|취업준비/.test(`${item['서비스명']} ${item['지원대상']}`)) return true;
  const min = toAge(conditions.JA0110);
  const max = toAge(conditions.JA0111);
  return max !== null && max <= 45 && max >= 19 && (min === null || min <= 39);
}

// 행정기관코드(서비스ID)로 시·도를 먼저 정하고, 없으면 소관기관명으로 정해요.
export function policyRegion(item) {
  const text = `${item['서비스명'] ?? ''} ${item['소관기관명'] ?? ''} ${item['지원대상'] ?? ''}`;
  const byName = regionFromOrg(item['소관기관명'], item['소관기관유형'], text);
  const sido = sidoFromServiceId(item['서비스ID']);
  if (!sido) return byName.sido ? byName : regionInName(item['서비스명']) || byName;
  if (byName.sido === sido) return byName;
  return {
    sido,
    sigungu: sigunguFromCode(item['서비스ID'], sido, `${item['소관기관명'] ?? ''} ${item['서비스명'] ?? ''}`),
  };
}

// 보조금24 항목 하나 → 정책 형식. 주거·저축과 관계없으면 null
export function toPolicy(item, conditions = {}) {
  const name = clip(item['서비스명'], 80);
  const text = `${item['서비스명']} ${item['서비스목적요약'] ?? ''} ${item['지원내용'] ?? ''}`;
  const kind = classify(item['서비스명'] ?? '') || classify(text); // 이름으로 먼저 분류
  if (!name || !kind || !isYouth(item, conditions)) return null;
  // 법인·시설·소상공인 대상만 뺍니다. ("가구" 대상 주거 혜택이 많아서 개인만 남기면 많이 빠져요)
  if (item['사용자구분'] && !/개인|가구/.test(String(item['사용자구분']))) return null;
  const region = policyRegion(item);
  if (region.unknown) return null; // 지역을 모르는 지자체 혜택은 다른 지역 사람에게 잘못 보일 수 있어서 뺍니다
  return {
    id: `gov24-${item['서비스ID']}`,
    name,
    summary: clip(item['서비스목적요약'] || item['지원내용'], 120),
    ...kind,
    region,
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

// 이름의 핵심만 남겨요. (예: "청년 매입임대주택 지원" → "매입임대", "기존주택 매입임대주택 지원사업" → "매입임대")
const core = s =>
  norm(s)
    .replace(/지원사업|지원|사업|공급|운영|안내|청년|기존주택|주택|전용|및/g, '')
    .replace(/^(서울시|서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/, '');

const sameRegion = (a, b) => (a.region?.sido ?? null) === (b.region?.sido ?? null);

// 손으로 확인한 정책을 먼저 두고, 같은 지역에서 이름(핵심)이 겹치는 API 항목은 뺍니다.
export function mergePolicies(manual = [], fromApi = []) {
  const kept = [...manual];
  const seen = new Set(manual.map(p => p.id));
  for (const p of fromApi) {
    if (seen.has(p.id)) continue;
    const n = norm(p.name);
    const c = core(p.name);
    const dup = kept.some(k => {
      if (norm(k.name) === n) return true;
      if (!sameRegion(k, p)) return false;
      const kc = core(k.name);
      return c.length >= 3 && kc.length >= 3 && (kc.includes(c) || c.includes(kc));
    });
    if (dup) continue;
    seen.add(p.id);
    kept.push(p);
  }
  return kept;
}
