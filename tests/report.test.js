import test from 'node:test';
import assert from 'node:assert/strict';
import { computeReport, normalizeReportInput, monthsWithExtra, savingsSeries } from '../lib/report/computeReport.js';
import { DEMO_PERSONA } from '../lib/report/demoPersona.js';
import { money, monthLabel, duration } from '../lib/report/format.js';

// 기대값은 docs/demo-persona.md(시연 인물 정답지) 4장과 같습니다.
const report = computeReport(DEMO_PERSONA);
const clone = value => JSON.parse(JSON.stringify(value));
const variant = mutate => {
  const input = clone(DEMO_PERSONA);
  mutate(input);
  return computeReport(input);
};

test('시연 인물: 월 현금흐름 73만 원(29.8%) → 독립 후 17만 원(6.9%)', () => {
  assert.equal(report.cashflow.now.spend, 172);
  assert.equal(report.cashflow.now.save, 73);
  assert.equal(report.cashflow.now.rate, 29.8);
  assert.equal(report.cashflow.after.spend, 228);
  assert.equal(report.cashflow.after.save, 17);
  assert.equal(report.cashflow.after.rate, 6.9);
});

test('시연 인물: 필요한 돈 1,884 = 비상자금 684 + 보증금 1,000 + 초기 비용 200', () => {
  assert.deepEqual(report.targets, {
    emergency: 684,
    deposit: 1000,
    initialCost: 200,
    loan: 0,
    housing: 1200,
    needed: 1884,
  });
});

test('시연 인물: 핵심 숫자와 판정', () => {
  const { goal, needed, saved, future, collectable, gap, readiness, deadline, monthsNeeded, doneLabel, delay } =
    report.core;
  assert.deepEqual(
    { goal, needed, saved, future, collectable, gap, readiness, deadline, monthsNeeded, doneLabel, delay },
    {
      goal: 1500,
      needed: 1884,
      saved: 680,
      future: 803,
      collectable: 1483,
      gap: 401,
      readiness: 79,
      deadline: '2027년 9월',
      monthsNeeded: 17,
      doneLabel: '2028년 3월',
      delay: 6,
    },
  );
  assert.equal(report.status, 'short');
  assert.equal(report.verdict.headline, '2027년 9월까지 401만 원이 부족해요');
});

test('시연 인물: 비상자금 1개월 뒤, 주거 17개월 뒤 완성 (규칙 A)', () => {
  assert.equal(report.allocation.emergencyDone, 1);
  assert.equal(report.allocation.housingDone, 17);
});

test('시연 인물: 절약 효과 (누적 5 → 16개월, 8 → 15개월, 28 → 12개월)', () => {
  assert.deepEqual(
    report.cuts.map(row => [row.totalCut, row.months, row.sooner, row.annual]),
    [
      [5, 16, 1, 60],
      [8, 15, 2, 36],
      [28, 12, 5, 240],
    ],
  );
  assert.deepEqual(report.cutsTotal, { monthly: 28, annual: 336, months: 12, doneLabel: '2027년 10월', sooner: 5 });
  assert.equal(monthsWithExtra(report, 8), 15);
});

test('시연 인물: 해결 방법 3가지', () => {
  assert.deepEqual(
    report.fixes.map(fix => [fix.kind, fix.value]),
    [
      ['extend', '+6개월'],
      ['spend', '+37만 원'],
      ['adjust', '500만 원'],
    ],
  );
  assert.match(report.fixes[2].detail, /1,384만 원.*2027년 8월/);
});

test('시연 인물: 비상자금 2.9개월은 목표(3개월) 달성으로 보이지 않는다', () => {
  const emergency = report.checks.find(check => check.id === 'emergency');
  assert.equal(emergency.value, 2.9);
  assert.equal(emergency.status.tone, 'warning');
});

test('여유 있는 사람: 부족분 음수나 100% 넘는 준비도가 나오지 않는다', () => {
  const r = variant(p => {
    p.money.income = 400;
    p.money.saved = 3000;
  });
  assert.equal(r.status, 'ahead');
  assert.equal(r.core.gap, 0);
  assert.equal(r.core.readiness, 100);
  assert.ok(r.core.surplus > 0);
  assert.equal(r.verdict.headline, '필요한 돈을 이미 다 모았어요');
  assert.equal(r.fixes.length, 0);
});

test('매달 모이는 돈이 0원이거나 적자여도 계산이 멈추지 않는다', () => {
  for (const living of [178, 250]) {
    const r = variant(p => {
      p.money.livingNow = living;
    });
    assert.equal(r.status, 'cannot');
    assert.equal(r.core.monthsNeeded, null);
    assert.equal(r.core.future, 0);
    assert.match(r.verdict.headline, /매달 모이는 돈이 없어요/);
    assert.ok(savingsSeries(r).length > 1);
    // 적자를 메우는 돈까지 더해 매달 더 모아야 하는 금액을 알려 줍니다. (기한 11개월, 남은 1,204만 원 → 매달 110만 원)
    assert.equal(r.fixes.find(fix => fix.kind === 'spend').value, `+${money(110 - r.cashflow.now.save)}`);
  }
});

test('독립 후 적자를 알려 준다', () => {
  const r = variant(p => {
    p.housing.monthlyCost = 130;
  });
  assert.equal(r.deficitAfter, true);
  assert.equal(r.checks.find(check => check.id === 'saving').status.text, '독립 후 적자');
  assert.match(r.verdict.warning, /매달 45만 원이 모자라요/);
});

test('보증금 1억처럼 큰 금액은 억 단위로 쓰고 기간도 계산한다', () => {
  const r = variant(p => {
    p.housing.type = 'jeonse';
    p.housing.deposit = 10000;
    p.housing.monthlyCost = 10;
  });
  assert.equal(money(r.core.needed), '1억 710만 원'); // 비상자금 170×3 + 보증금 1억 + 초기 비용 200
  assert.equal(r.status, 'short');
  assert.ok(r.core.monthsNeeded > 100);
  assert.ok(r.horizon <= 120);
});

test('빚이 없으면 빚 체크와 완납 일정이 빠진다', () => {
  const r = variant(p => {
    p.money.debt = null;
  });
  assert.ok(!r.checks.some(check => check.id === 'debt'));
  assert.ok(!r.milestones.some(item => item.title.includes('완납')));
});

test('이상한 입력값도 안전한 숫자로 바꾼다', () => {
  const input = normalizeReportInput({
    money: { income: '245', fixedNow: -10, livingNow: 'abc', saved: '1,000' },
    housing: { moveInMonths: 0, deposit: '' },
    emergency: { months: 99 },
  });
  assert.equal(input.money.income, 245);
  assert.equal(input.money.fixedNow, 0);
  assert.equal(input.money.livingNow, 0);
  assert.equal(input.money.saved, 1000);
  assert.equal(input.housing.moveInMonths, 1);
  assert.equal(input.housing.deposit, 0);
  assert.equal(input.emergency.months, 12);
});

test('무작위 입력 500개에서도 화면에 NaN·Infinity·undefined가 나오지 않는다', () => {
  let seed = 7;
  const rand = max => {
    seed = (seed * 16807) % 2147483647;
    return Math.round((seed / 2147483647) * max);
  };
  for (let i = 0; i < 500; i++) {
    const r = computeReport({
      asOf: { year: 2026, month: 1 + rand(11) },
      goal: { amount: rand(5000), months: rand(60) },
      money: {
        income: rand(800),
        fixedNow: rand(200),
        fixedAfter: rand(200),
        livingNow: rand(300),
        livingAfter: rand(300),
        saved: rand(8000),
        debt: rand(1) ? { label: '대출', balance: rand(3000), monthly: rand(60) } : null,
      },
      housing: {
        deposit: rand(20000),
        monthlyCost: rand(150),
        moveInMonths: rand(48),
        loan: rand(5000),
        initialCost: rand(400),
      },
      emergency: { months: rand(12) },
      savingCuts: [{ id: 'a', label: '절약', cut: rand(40) }],
    });
    const text = JSON.stringify(r);
    assert.ok(!/NaN|Infinity|undefined/.test(text), `입력 ${i}`);
    assert.ok(r.core.readiness >= 0 && r.core.readiness <= 100);
    assert.ok(r.core.gap >= 0 && r.core.surplus >= 0);
    assert.ok(['ahead', 'short', 'cannot'].includes(r.status));
    assert.ok(r.horizon >= 1 && r.horizon <= 120);
    assert.ok(r.milestones.every((item, j, list) => j === 0 || list[j - 1].month <= item.month));
  }
});

test('표시 도우미', () => {
  assert.equal(money(1884), '1,884만 원');
  assert.equal(money(12000), '1억 2,000만 원');
  assert.equal(money(10000), '1억 원');
  assert.equal(duration(17), '1년 5개월');
  assert.equal(duration(6), '6개월');
  assert.equal(monthLabel({ year: 2026, month: 12 }, 1), '2027년 1월');
});
