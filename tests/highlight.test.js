import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitAmounts, isRecommendation } from '../lib/plan/highlight.js';
import { dedupeLines } from '../lib/plan/steps.js';

const amounts = line => splitAmounts(line).filter(p => typeof p !== 'string');

test('금액 색: 늘어나는 돈은 up, 줄어드는 돈은 down, 나머지는 key', () => {
  assert.deepEqual(amounts('독립하면 쓰는 돈이 228만 원으로 늘고, 모으는 돈은 17만 원(6.9%)으로 줄어요.'), [
    { amount: '228만 원', dir: 'up' },
    { amount: '17만 원', dir: 'down' },
  ]);
  assert.deepEqual(amounts('다 갚고 나면 매달 15만 원을 더 모을 수 있어요.'), [{ amount: '15만 원', dir: 'up' }]);
  assert.deepEqual(
    amounts('예상 금액: 중개수수료 28만 원 + 이사비 30만 원 = 58만 원').map(p => p.dir),
    ['key', 'key', 'key'],
  );
  // 1억이 넘는 금액도 하나로 묶어요
  assert.deepEqual(amounts('매달 1억 8,598만 원 저축, 보증금 3억 원'), [
    { amount: '1억 8,598만 원', dir: 'key' },
    { amount: '3억 원', dir: 'key' },
  ]);
  // 금액이 없는 문장은 그대로
  assert.deepEqual(splitAmounts('계약서 날짜와 특약을 읽어요.'), ['계약서 날짜와 특약을 읽어요.']);
});

test('권장·조정 문장을 알아본다', () => {
  assert.equal(isRecommendation('기간 늘리기: 입주를 2028년 3월로. 6개월 늦추면 부족한 돈이 없어요.'), true);
  assert.equal(isRecommendation('독립 후에도 저축을 지키려면 60만 원 이하가 좋아요.'), true);
  assert.equal(isRecommendation('남은 420만 원을 매달 15만 원씩 갚으면 2029년 2월에 다 갚아요.'), false);
});

test('한 단계 안의 같은 문장·같은 비율 반복은 뺀다', () => {
  const lines = [
    '월급의 53.5%를 모아야 하는데 무리예요. 월 101만 원(41.2%)씩 모으는 속도로 늘리는 걸 권해요.',
    '필요한 저축이 월급의 53.5%라 지금 방식으로는 무리예요.',
    '생각한 목표는 1,500만 원이었지만 실제로 필요한 돈은 1,884만 원이에요.',
    '생각한 목표는 1,500만 원이었지만 실제로 필요한 돈은 1,884만 원이에요.',
  ];
  assert.deepEqual(dedupeLines(lines), [lines[0], lines[2]]);
});
