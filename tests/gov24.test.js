import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toPolicy, regionFromOrg, classify, mergePolicies } from '../lib/goal/gov24.js';
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
