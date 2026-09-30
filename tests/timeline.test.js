import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, dateKey, parseDate, generateTimeline } from '../src/lib/timeline.js';

test('독립일에서 6·5·3·1개월 전을 역산한다', () => {
  const timeline = generateTimeline({ independenceDate: '2027-03-15' }, [], new Date(2026, 8, 24));
  assert.deepEqual(timeline.map(d => d.dueDate), ['2026-09-15', '2026-10-15', '2026-12-15', '2027-02-15']);
  assert.deepEqual(timeline.map(d => d.status), ['now', 'upcoming', 'upcoming', 'upcoming']);
});
test('월말 역산 시 다음 달로 넘어가지 않고 마지막 날을 사용한다', () => {
  assert.equal(dateKey(addMonths(parseDate('2027-03-31'), -1)), '2027-02-28');
  assert.equal(dateKey(addMonths(parseDate('2024-03-31'), -1)), '2024-02-29');
  assert.equal(dateKey(addMonths(parseDate('2026-12-31'), 1)), '2027-01-31');
});
test('날짜가 없거나 잘못된 이벤트는 일정을 만들지 않는다', () => {
  assert.deepEqual(generateTimeline({ employmentDate: '', independenceDate: '2026-02-30' }), []);
  assert.equal(parseDate('2026-13-01'), null);
});
test('오늘까지 시작된 미완료 항목만 지금 준비로 표시한다', () => {
  const timeline = generateTimeline({ independenceDate: '2027-03-24' }, ['housing-compare'], new Date(2026, 9, 24, 0, 1));
  assert.equal(timeline.find(d => d.id === 'housing-compare').status, 'done');
  assert.equal(timeline.find(d => d.id === 'housing-budget').status, 'now');
  assert.equal(timeline.find(d => d.id === 'housing-loan').status, 'upcoming');
});
test('첫 월급은 취업일과 별도의 날짜를 기준으로 계산한다', () => {
  const timeline = generateTimeline({ employmentDate: '2026-10-01', salaryDate: '2026-10-25' });
  assert.equal(timeline.find(d => d.id === 'employment-contract').dueDate, '2026-09-01');
  assert.equal(timeline.find(d => d.id === 'salary-budget').dueDate, '2026-10-25');
  assert.equal(timeline.find(d => d.id === 'salary-review').dueDate, '2027-01-25');
});
test('계획 변경 시 준비 날짜를 재계산하고 완료 상태는 유지한다', () => {
  const timeline = generateTimeline({ independenceDate: '2027-09-01' }, ['housing-budget']);
  assert.equal(timeline.find(d => d.id === 'housing-budget').dueDate, '2027-04-01');
  assert.equal(timeline.find(d => d.id === 'housing-budget').status, 'done');
});
