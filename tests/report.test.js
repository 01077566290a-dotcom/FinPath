import test from 'node:test';
import assert from 'node:assert/strict';
import { computeReport, monthLabel } from '../lib/report/computeReport.js';
import { DEMO_PERSONA } from '../lib/report/demoPersona.js';

// 기대값은 docs/demo-persona.md(시연 인물 정답지) 4장과 같습니다.
const report = computeReport(DEMO_PERSONA);

test('월 현금흐름: 지금 73만 원(30%) → 독립 후 17만 원(7%)', () => {
  assert.deepEqual(report.cashflow.now, { spend: 172, save: 73, rate: 29.8 });
  assert.deepEqual(report.cashflow.after, { spend: 228, save: 17, rate: 6.9 });
});

test('실제로 필요한 돈: 비상자금 684 + 주거 1,200 = 1,884', () => {
  assert.deepEqual(report.targets, { emergency: 684, housing: 1200, initialCost: 200, needed: 1884 });
});

test('핵심 숫자 세 개와 부족분', () => {
  const { goal, needed, collectable, gap, readiness, deadline, monthsNeeded, doneLabel } = report.core;
  assert.deepEqual(
    { goal, needed, collectable, gap, readiness, deadline, monthsNeeded, doneLabel },
    {
      goal: 1500,
      needed: 1884,
      collectable: 1483,
      gap: 401,
      readiness: 79,
      deadline: '2027년 9월',
      monthsNeeded: 17,
      doneLabel: '2028년 3월',
    },
  );
});

test('배분 규칙 A: 비상자금은 1개월 뒤, 주거는 17개월 뒤 완성', () => {
  assert.equal(report.allocation.emergencyDone, 1);
  assert.equal(report.allocation.housingDone, 17);
});

test('해결 방법과 절약 효과', () => {
  assert.match(report.fixes[0].headline, /2028년 3월/);
  assert.match(report.fixes[1].headline, /110만 원/);
  assert.match(report.fixes[2].detail, /1,384만 원.*2027년 8월/);
  assert.deepEqual(
    report.savings.map(row => [row.totalCut, row.months, row.sooner]),
    [
      [5, 16, 1],
      [8, 15, 2],
      [28, 12, 5],
    ],
  );
});

test('진단 숫자', () => {
  assert.equal(report.diagnosis.surviveNow, 3.9);
  assert.equal(report.diagnosis.spendIncrease, 56);
  assert.equal(report.diagnosis.debt.doneLabel, '2029년 2월');
});

test('월 라벨은 해가 바뀌어도 맞다', () => {
  assert.equal(monthLabel({ year: 2026, month: 10 }, 3), '2027년 1월');
  assert.equal(monthLabel({ year: 2026, month: 12 }, 0), '2026년 12월');
});

test('버틸 수 있는 기간은 내림해서 목표 달성으로 잘못 보이지 않는다', () => {
  const emergency = report.metrics.find(metric => metric.id === 'emergency');
  assert.deepEqual(
    emergency.rows.map(row => row.value),
    [3.9, 2.9],
  );
  assert.equal(emergency.status.tone, 'warning');
  assert.equal(emergency.status.text, '목표의 99%');
});

test('앞으로의 일정은 시간 순서이고 핵심 시점을 담는다', () => {
  const months = report.milestones.map(item => item.month);
  assert.deepEqual(
    months,
    [...months].sort((a, b) => a - b),
  );
  assert.deepEqual(
    report.milestones.map(item => [item.title, item.label]),
    [
      ['지금', '2026년 10월'],
      ['비상자금 완성', '2026년 11월'],
      ['원래 계획한 입주', '2027년 9월'],
      ['절약하면 독립', '2028년 1월'],
      ['지금 계획으로 독립', '2028년 3월'],
      ['학자금 대출 완납', '2029년 2월'],
    ],
  );
});

test('월 현금흐름 구성은 실수령액과 합이 맞는다', () => {
  for (const key of ['now', 'after']) {
    const parts = report.cashflow.parts[key];
    assert.equal(parts.living + parts.housing + parts.save, report.cashflow.income, key);
  }
});
