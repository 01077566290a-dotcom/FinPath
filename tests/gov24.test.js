import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toPolicy, regionFromOrg, regionInName, classify, mergePolicies } from '../lib/goal/gov24.js';
import { filterPolicies } from '../lib/goal/policies.js';

// 보조금24 serviceList 응답 형식의 예시 항목
const item = (over = {}) => ({
  서비스ID: 'TEST001',
  서비스명: '마포구 청년 월세 지원',
  서비스목적요약: '청년의 월세 부담을 덜어줍니다.',
  지원대상: '마포구 거주 만 19~39세 무주택 청년',
  선정기준: '기준 중위소득 150% 이하',
  지원내용: '월 최대 20만 원, 보증금 5천만 원 이하 주택',
  소관기관명: '서울특별시 마포구',
  소관기관유형: '지방자치단체',
  사용자구분: '개인',
  상세조회URL: 'https://www.gov.kr/portal/rcvfvrSvc/dtlEx/TEST001',
  ...over,
});

test('지자체 이름에서 지역을 뽑고, 중앙부처는 전국으로 둔다', () => {
  assert.deepEqual(regionFromOrg('서울특별시 마포구', '지방자치단체'), { sido: '서울', sigungu: '마포구' });
  assert.deepEqual(regionFromOrg('경기도', '지방자치단체'), { sido: '경기', sigungu: null });
  assert.deepEqual(regionFromOrg('국토교통부', '중앙행정기관'), { sido: null, sigungu: null });
});

test('시·군 이름만 적힌 지자체도 시·도를 찾는다', () => {
  assert.deepEqual(regionFromOrg('여수시', '지방자치단체'), { sido: '전남', sigungu: '여수시' });
  assert.deepEqual(regionFromOrg('해운대구', '지방자치단체'), { sido: '부산', sigungu: '해운대구' });
  assert.deepEqual(regionFromOrg('전라남도 순천시', '지방자치단체'), { sido: '전남', sigungu: '순천시' });
  assert.deepEqual(regionFromOrg('부산광역시교육청', '교육청'), { sido: '부산', sigungu: null });
  assert.deepEqual(regionFromOrg('부산도시공사', '공공기관'), { sido: '부산', sigungu: null });
  assert.deepEqual(regionFromOrg('광주시', '지방자치단체'), { sido: '경기', sigungu: '광주시' });
  assert.deepEqual(regionFromOrg('한국주택금융공사', '공공기관'), { sido: null, sigungu: null });
});

test('여러 시·도에 있는 구 이름이면 지역을 모른다고 표시한다', () => {
  assert.equal(regionFromOrg('중구', '지방자치단체').unknown, true);
  assert.deepEqual(regionFromOrg('중구', '지방자치단체', '울산광역시 중구 거주 청년'), { sido: '울산', sigungu: null });
});

test('부산 사용자에게 전남 지자체 혜택이 나오지 않는다 (지역 오류 재발 방지)', () => {
  const jeonnam = toPolicy(item({ 서비스ID: 'JN1', 서비스명: '여수시 청년 월세 지원', 소관기관명: '여수시' }), {});
  const unknown = toPolicy(
    item({ 서비스ID: 'UK1', 서비스명: '청년 월세 지원', 소관기관명: '동구', 지원대상: '청년' }),
    {},
  );
  assert.equal(unknown, null); // 지역을 알 수 없는 지자체 혜택은 수집에서 뺌
  const busan = {
    age: 27,
    region: { sido: '부산', sigungu: null },
    purposes: ['주거'],
    detail: { 주거: { housing_type: '월세' } },
  };
  assert.equal(filterPolicies(busan, { policies: [jeonnam] }).length, 0);
});

test('결혼·빚 상환 목적 혜택도 가져온다', () => {
  assert.deepEqual(classify('신혼부부 전세자금 대출').purposes, ['주거', '결혼']);
  assert.equal(classify('청년 결혼 축하금').step, 'wedding_plan');
  assert.equal(classify('학자금 대출 이자 지원').step, 'debt_plan');
  assert.deepEqual(classify('학자금 대출 이자 지원').purposes, ['빚 상환']);
});

test('가구 대상 혜택도 가져온다 (개인만 남기면 주거 혜택이 많이 빠짐)', () => {
  assert.notEqual(toPolicy(item({ 사용자구분: '가구' }), {}), null);
});

test('이름 기준으로 단계를 나눈다 (내용에 보증금이 있어도 월세 지원은 주거비 단계)', () => {
  const p = toPolicy(item(), { JA0110: '19', JA0111: '39' });
  assert.equal(p.step, 'housing_budget');
  assert.deepEqual(p.housing_types, ['월세']);
  assert.deepEqual(p.age, { min: 19, max: 39 });
  assert.equal(p.source, 'gov24');
  assert.equal(classify('청년 이사비 지원').step, 'move_in_cost');
  assert.equal(classify('전세보증금반환보증 보증료 지원').step, 'contract_check');
});

test('청년 대상이 아니거나 주거·저축과 관계없으면 뺀다', () => {
  assert.equal(toPolicy(item({ 서비스명: '어르신 월세 지원', 지원대상: '만 65세 이상' }), { JA0110: '65' }), null);
  assert.equal(toPolicy(item({ 서비스명: '청년 문화패스', 서비스목적요약: '공연 관람', 지원내용: '' })), null);
  assert.equal(toPolicy(item({ 사용자구분: '법인' })), null);
});

test('API 항목은 정하은 거르기에 그대로 쓰인다', () => {
  const list = filterPolicies(
    {
      age: 27,
      region: { sido: '서울', sigungu: '마포구' },
      purposes: ['주거'],
      detail: { 주거: { housing_type: '월세' } },
    },
    { policies: [toPolicy(item(), { JA0110: '19', JA0111: '39' })] },
  );
  assert.equal(list.length, 1);
});

test('손으로 확인한 정책과 이름이 겹치는 API 항목은 빠진다', () => {
  const manual = JSON.parse(readFileSync(new URL('../data/policies.json', import.meta.url), 'utf8')).policies;
  const dup = toPolicy(item({ 서비스ID: 'DUP', 서비스명: '서울시 청년월세지원', 소관기관명: '서울특별시' }), {});
  const fresh = toPolicy(item(), {});
  const merged = mergePolicies(manual, [dup, fresh]);
  assert.equal(merged.length, manual.length + 1);
  assert.equal(merged.at(-1).id, 'gov24-TEST001');
});

test('비어 있는 수집 파일도 읽을 수 있다', () => {
  const data = JSON.parse(readFileSync(new URL('../data/policies-gov24.json', import.meta.url), 'utf8'));
  assert.ok(Array.isArray(data.policies));
});

test('이름 속 시·군 이름으로 지역을 찾되, 낱말 중간은 무시한다', () => {
  assert.deepEqual(regionInName('영암형 공공주택 계약연장'), { sido: '전남', sigungu: '영암군' });
  assert.equal(regionInName('청년 공공주택 공급'), null); // "공공주택" 안의 "공주"
});

test('청년이 아닌 대상 전용 혜택은 뺀다', () => {
  assert.equal(
    toPolicy(item({ 서비스명: '중증장애인 자산형성지원(이룸통장)', 지원대상: '만 15~64세 중증장애인' }), {
      JA0110: '15',
      JA0111: '64',
    }),
    null,
  );
});

test('이름만 조금 다른 같은 제도는 한 번만 보여준다', () => {
  const nation = { region: { sido: null, sigungu: null } };
  const merged = mergePolicies(
    [{ id: 'm1', name: '청년 매입임대주택 (LH·SH)', ...nation }],
    [
      { id: 'g1', name: '청년 매입임대주택 지원', ...nation },
      { id: 'g2', name: '매입임대 지원(청년)', ...nation },
      { id: 'g3', name: '기존주택 매입임대주택 지원사업', ...nation },
      { id: 'g4', name: '행복주택 공급', ...nation },
    ],
  );
  assert.deepEqual(
    merged.map(p => p.id),
    ['m1', 'g4'],
  );
});
