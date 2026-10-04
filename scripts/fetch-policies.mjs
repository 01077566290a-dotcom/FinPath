// 보조금24 API로 청년 주거·저축 관련 혜택을 받아 data/policies-gov24.json에 저장합니다.
// https://www.data.go.kr/data/15113968/openapi.do  (개발·운영 모두 자동승인)
//
// 화면은 손으로 확인한 data/policies.json을 먼저 보여주고, 이 파일의 항목은 이름이 겹치지 않을 때만 뒤에 붙입니다.
// 브라우저에서는 API를 부르지 않습니다. (GitHub Pages에서 인증키가 노출되기 때문)
//
// 사용법
//   1) 공공데이터포털 마이페이지 → 활용신청 상세 → "일반 인증키(Decoding)" 복사
//   2) 저장소 루트 .env에 한 줄:  GOV24_API_KEY=인증키   (.env는 저장소에 올라가지 않아요)
//   3) node scripts/fetch-policies.mjs
//
// 승인 직후 1~2시간(길게는 24시간)은 인증 오류가 날 수 있어요. 그때는 기존 파일을 그대로 둡니다.

import { readFile, writeFile } from 'node:fs/promises';
import { toPolicy } from '../lib/goal/gov24.js';

const BASE = 'https://api.odcloud.kr/api/gov24/v3';
const PER_PAGE = 500;
const MAX_PAGES = 40;
const OUT = new URL('../data/policies-gov24.json', import.meta.url);

async function loadKey() {
  if (process.env.GOV24_API_KEY) return process.env.GOV24_API_KEY.trim();
  try {
    const env = await readFile(new URL('../.env', import.meta.url), 'utf8');
    return env.match(/^GOV24_API_KEY=(.+)$/m)?.[1].trim() || null;
  } catch {
    return null;
  }
}

async function call(path, key, params = {}) {
  const query = new URLSearchParams({ returnType: 'JSON', serviceKey: key, ...params });
  const res = await fetch(`${BASE}/${path}?${query}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

// 1차로 이름·내용 키워드가 맞는 항목만 고릅니다. (나이 조건은 2차에서 확인)
const MAYBE =
  /청년|사회초년|신혼|결혼|혼인|월세|전세|보증금|임차|임대주택|주거비|이사|중개보수|반환보증|적금|저축|자산형성|청약통장|목돈|학자금|채무|신용회복/;

async function main() {
  const key = await loadKey();
  if (!key) {
    console.log('인증키가 없어요. .env에 GOV24_API_KEY를 넣어주세요. 기존 파일은 그대로 둡니다.');
    return;
  }

  // 1) 목록 전체를 페이지로 받기 (약 1만 건, 하루 호출 한도 안쪽)
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = await call('serviceList', key, { page: String(page), perPage: String(PER_PAGE) });
    const data = body.data ?? [];
    all.push(...data);
    process.stdout.write(`\r목록 ${all.length}/${body.totalCount ?? '?'}건`);
    if (data.length < PER_PAGE) break;
  }
  console.log();
  // 이름·요약뿐 아니라 지원대상·지원내용까지 봐야 놓치는 혜택이 줄어요.
  const rough = all.filter(item =>
    MAYBE.test(
      `${item['서비스명']} ${item['서비스목적요약'] ?? ''} ${item['지원대상'] ?? ''} ${item['지원내용'] ?? ''}`,
    ),
  );
  console.log(`키워드 1차 통과 ${rough.length}건`);

  // 2) 후보마다 지원조건(나이)을 받아 정책 형식으로 바꾸기
  const policies = [];
  for (const item of rough) {
    let conditions = {};
    try {
      const body = await call('supportConditions', key, { 'cond[서비스ID::EQ]': item['서비스ID'] });
      conditions = body.data?.[0] ?? {};
    } catch {
      /* 지원조건이 없는 서비스도 있어요 */
    }
    const policy = toPolicy(item, conditions);
    if (policy) policies.push(policy);
  }

  const out = { fetched_at: new Date().toISOString().slice(0, 10), source: 'gov24', policies };
  await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
  const count = key => policies.filter(p => p.purposes.includes(key)).length;
  console.log(`청년 혜택 ${policies.length}건을 data/policies-gov24.json에 저장했어요.`);
  console.log(
    `목적별: 주거 ${count('주거')}, 비상자금 ${count('비상자금')}, 결혼 ${count('결혼')}, 빚 상환 ${count('빚 상환')}`,
  );
  console.log(
    `전국 ${policies.filter(p => !p.region.sido).length}건, 지역 ${policies.filter(p => p.region.sido).length}건`,
  );
}

main().catch(error => {
  console.error(`\n실패: ${error.message}`);
  console.error(
    '기존 data/policies-gov24.json은 그대로 둡니다. 인증키 활성화(승인 후 1~2시간)를 기다린 뒤 다시 실행해보세요.',
  );
  process.exitCode = 1;
});
