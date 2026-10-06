// 리포트의 '계산 방법': 화면의 숫자가 어디서 나왔는지 내 숫자를 그대로 넣은 식으로 보여 줍니다.
// 숫자는 모두 2번 엔진(buildPlan) 결과에서 가져오고, 여기서는 문장만 만듭니다.
import { BENCHMARKS, sourceLine } from './benchmarks.js';
import { money } from './format.js';

// 금액 표기는 리포트와 같은 규칙(1억 이상은 '1억 2,345만 원')
const won = n => money(n);

export function methodFromPlan(plan, view, score) {
  const { core, cashflow, profile } = plan;
  const sections = [];

  // 1. 실제로 필요한 돈
  sections.push({
    id: 'needed',
    title: '실제로 필요한 돈',
    result: won(core.needed),
    lines: [
      ...plan.goals.filter(g => g.id !== 'invest').map(g => `${g.label} ${won(g.target)}`),
      ...plan.goals.flatMap(g => g.basis ?? []),
    ],
  });

  // 2. 모을 수 있는 돈과 부족한 돈 (기한이 있을 때)
  if (core.deadline !== null) {
    sections.push({
      id: 'collectable',
      title: `${core.deadlineLabel}까지 모을 수 있는 돈`,
      result: won(view.core.collectable),
      lines: [
        `지금 모아둔 돈 ${won(profile.saved)} + 매달 ${won(Math.max(0, profile.saveNow))} × ${core.deadline}개월 = ${won(view.core.collectable)}`,
        view.core.gap > 0
          ? `부족한 돈 = 필요한 돈 ${won(core.needed)} − 모을 수 있는 돈 ${won(view.core.collectable)} = ${won(view.core.gap)}`
          : `여유 = 모을 수 있는 돈 ${won(view.core.collectable)} − 필요한 돈 ${won(core.needed)} = ${won(view.core.surplus)}`,
        '예적금 이자와 투자 수익은 넣지 않았어요. 실제로는 조금 더 모일 수 있어요.',
      ],
    });
  }

  // 3. 매달 모으는 돈 (독립 전·후)
  const flow = [
    `지금: 월급 ${won(cashflow.income)} − 쓰는 돈 ${won(cashflow.now.spend)} = 매달 ${won(cashflow.now.save)} (월급의 ${cashflow.now.rate}%)`,
  ];
  if (plan.housing) {
    const other = cashflow.after.spend - cashflow.now.spend - cashflow.housingCost;
    flow.push(
      `독립 후 쓰는 돈 = 지금 쓰는 돈 ${won(cashflow.now.spend)} + 월세·관리비 ${won(cashflow.housingCost)}${
        other !== 0 ? ` ${other > 0 ? '+' : '−'} 교통비·생활비 변화 ${won(Math.abs(other))}` : ''
      } = ${won(cashflow.after.spend)}`,
      `독립 후: 월급 ${won(cashflow.income)} − ${won(cashflow.after.spend)} = 매달 ${won(cashflow.after.save)} (월급의 ${cashflow.after.rate}%)`,
    );
  }
  sections.push({ id: 'flow', title: '매달 모으는 돈', result: won(cashflow.now.save), lines: flow });

  // 4. 다 모으는 때
  if (core.monthsNeeded !== null) {
    sections.push({
      id: 'when',
      title: '다 모으는 때',
      result: core.doneLabel ?? '',
      lines: [
        '매달 모으는 돈을 목적 순서대로 나눠 담는다고 보고 한 달씩 계산했어요.',
        '순서: 비상자금을 먼저 다 채우고 → 기한이 급한 목표 → 투자는 남는 돈 안에서',
        plan.housing
          ? `독립하는 달부터는 매달 모으는 돈이 ${won(cashflow.after.save)}로 바뀌어요.`
          : `매달 ${won(cashflow.now.save)}씩 모은다고 봤어요.`,
        `그래서 ${core.doneLabel}에 필요한 돈 ${won(core.needed)}을 다 모아요.`,
      ],
    });
  }

  // (점수 산정 방식은 리포트에서 뺐어요. 점수 카드의 항목·비교 기준으로 충분해요)

  // 5. 비교 기준과 출처
  const used = [
    BENCHMARKS.youthSaveRate,
    ...(plan.housing && plan.cashflow.housingCost > 0
      ? [BENCHMARKS.youthRentRate, BENCHMARKS.rentBurdenLimit]
      : [BENCHMARKS.debtRateLimit]),
  ];
  sections.push({
    id: 'sources',
    title: '비교 기준과 출처',
    result: '',
    lines: [
      ...used.map(b => `${sourceLine(b)} · ${b.detail}${b.note ? ` · ${b.note}` : ''}`),
      '비상자금 개월 수: 고용 형태에 따라 3~6개월 (일반적인 기준)',
      ...(plan.usedDefaults?.length ? ['모른다고 답한 값은 지역·유형별 기준값으로 채워 계산했어요.'] : []),
    ],
  });

  return sections;
}
