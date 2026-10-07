import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeShare, decodeShare } from '../lib/report/share.js';
import { buildDemoProfile, DEMO_ASSUMPTIONS } from '../lib/plan/demoProfile.js';
import { buildPlan } from '../lib/plan/index.js';

test('공유 링크로 열면 같은 프로필·같은 숫자가 나온다', () => {
  const profile = buildDemoProfile();
  const code = encodeShare(profile, { demo: true, includeAmounts: true });
  assert.match(code, /^[A-Za-z0-9_-]+$/); // 주소에 그대로 넣을 수 있는 글자만
  const shared = decodeShare(code);
  assert.deepEqual(shared.profile, JSON.parse(JSON.stringify(profile))); // 값이 없는(undefined) 칸은 링크에서 빠져요
  assert.equal(shared.demo, true);
  const a = buildPlan(profile, { assumptions: DEMO_ASSUMPTIONS });
  const b = buildPlan(shared.profile, { assumptions: DEMO_ASSUMPTIONS });
  assert.equal(b.core.needed, a.core.needed);
  assert.equal(b.core.doneLabel, a.core.doneLabel);
});

test('잘못되거나 손상된 공유 링크는 열지 않는다', () => {
  assert.equal(decodeShare(''), null);
  assert.equal(decodeShare('not-a-report'), null);
  const code = encodeShare({ ...buildDemoProfile(), version: 99 }, { includeAmounts: true });
  assert.equal(decodeShare(code), null);
  assert.equal(decodeShare('x'.repeat(9000)), null);
});
