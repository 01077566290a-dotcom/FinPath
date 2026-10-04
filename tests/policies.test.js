import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterPolicies, groupByStep } from '../lib/goal/policies.js';

const data = JSON.parse(readFileSync(new URL('../data/policies.json', import.meta.url), 'utf8'));

const profile = (overrides = {}) => ({
  age: 27,
  region: { sido: '서울', sigungu: '마포구' },
  purposes: ['주거', '비상자금'],
  detail: { 주거: { housing_type: '월세' } },
  ...overrides,
});

test('정책 파일의 필수 항목이 다 있다', () => {
  for (const p of data.policies) {
    for (const key of ['id', 'name', 'summary', 'purposes', 'region', 'age', 'condition_note', 'url', 'source'])
      assert.ok(p[key] !== undefined, `${p.id}: ${key}`);
    assert.match(p.url, /^https:\/\//);
  }
});

test('서울 월세 준비자에게는 월세 정책이 나오고 전세 대출은 안 나온다', () => {
  const ids = filterPolicies(profile(), data).map(p => p.id);
  assert.ok(ids.includes('seoul-youth-rent'));
  assert.ok(ids.includes('molit-youth-rent'));
  assert.ok(!ids.includes('nhuf-youth-jeonse'));
});

test('지역이 다르면 서울 정책은 빠진다', () => {
  const ids = filterPolicies(profile({ region: { sido: '부산', sigungu: null } }), data).map(p => p.id);
  assert.ok(!ids.some(id => id.startsWith('seoul-')));
});

test('나이 기준을 넘으면 빠진다', () => {
  const ids = filterPolicies(profile({ age: 36 }), data).map(p => p.id);
  assert.ok(!ids.includes('molit-youth-rent'));
  assert.ok(ids.includes('seoul-youth-rent')); // 서울은 39세까지
});

test('지역 정책이 전국 정책보다 앞에 온다', () => {
  const list = filterPolicies(profile(), data);
  assert.equal(list[0].region.sido, '서울');
});

test('step별로 묶을 수 있다', () => {
  const groups = groupByStep(filterPolicies(profile(), data));
  assert.ok(groups.housing_budget.length >= 1);
});

test('정하은(서울 27세 월세 독립)에게 맞는 정책이 10개 안팎으로 나온다', () => {
  const list = filterPolicies(profile({ age: 27 }), data);
  const ids = list.map(p => p.id);
  assert.ok(ids.includes('seoul-moving-cost')); // 이사·초기 비용
  assert.ok(ids.includes('nhuf-youth-wolse-loan')); // 보증금 부족분
  assert.ok(!ids.includes('nhuf-youth-jeonse')); // 전세 전용은 제외
  assert.ok(list.length >= 8 && list.length <= 12);
});

test('정책 id는 겹치지 않는다', () => {
  const ids = data.policies.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('빚이 있으면 "빚 상환"을 안 골라도 빚 관련 지원이 나온다', () => {
  const debtPolicy = {
    id: 'x-debt',
    name: '학자금 대출 이자 지원',
    purposes: ['빚 상환'],
    region: { sido: null, sigungu: null },
    age: { min: 19, max: 39 },
  };
  const withDebt = profile({ money: { debt: { remain: 420, monthly: 15 } } });
  assert.equal(filterPolicies(withDebt, { policies: [debtPolicy] }).length, 1);
  assert.equal(filterPolicies(profile(), { policies: [debtPolicy] }).length, 0);
});
