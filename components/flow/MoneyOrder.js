'use client';
import { PLAN_CONFIG } from '../../lib/plan/config.js';

const fmt = value => Math.round(value).toLocaleString();

// 우선순위 타임라인의 "돈의 순서": 어떤 목표에 어떤 순서로 얼마를 나누는지를 규칙 A·B 두 가지로 함께 보여줍니다.
// 규칙은 고르는 게 아니라 두 결과를 나란히 비교합니다.
export default function MoneyOrder({ plan }) {
  const { budget } = plan;
  const A = plan.recommended.A;
  const B = plan.recommended.B;
  const planGoals = budget.planGoals;
  const emergency = planGoals.find(g => g.id === 'emergency');
  const others = planGoals
    .filter(g => !['emergency', 'invest'].includes(g.id))
    .sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity));
  const invest = planGoals.find(g => g.id === 'invest');
  const ordered = [...(emergency ? [emergency] : []), ...others, ...(invest ? [invest] : [])];
  const canCompare = Boolean(emergency) && others.length > 0;
  const ratio = Math.round(PLAN_CONFIG.partialEmergencyRatio.value * 100);
  const pace = budget.plan.monthly;
  const shortOf = (sim, id) => sim.atDeadline.find(item => item.id === id)?.shortfall ?? 0;
  const thisMonth = sim =>
    ordered
      .filter(g => (sim.firstMonth[g.id] || 0) > 0)
      .map(g => `${g.label} ${fmt(sim.firstMonth[g.id])}만 원`)
      .join(', ');
  const faster = A.done.housing !== null && B.done.housing !== null ? A.done.housing - B.done.housing : null;
  const investLabel = A.milestones.find(m => m.id === 'invest')?.label;

  function Cell({ sim, goal, partial }) {
    const label = sim.doneLabels[goal.id];
    const gap = shortOf(sim, goal.id);
    return (
      <span className="mo__cell">
        {partial && (
          <span className="mo__partial">
            먼저 {fmt((goal.target * ratio) / 100)}만 원({ratio}%)
          </span>
        )}
        <b>{label ? `${label} 완성` : '지금 속도로는 어려워요'}</b>
        {gap > 0 && <span className="mo__warn">기한에 {fmt(gap)}만 원 부족</span>}
      </span>
    );
  }

  return (
    <section className="mo card" aria-labelledby="mo-title">
      <div>
        <h2 id="mo-title">돈의 순서</h2>
        <p className="mo__lead">
          매달 <b>{fmt(pace)}만 원</b>(월급의 {budget.plan.saveRate}%)을 아래 순서대로 나눠요.
          {canCompare && ' 비상자금을 어떻게 채우느냐에 따라 규칙 A와 B 두 가지 결과가 나와요.'}
        </p>
      </div>

      <ol className="mo__list">
        {ordered.map((goal, index) => {
          const monthly = goal.deadline ? Math.ceil(goal.target / Math.max(1, goal.deadline)) : null;
          const isInvest = goal.id === 'invest';
          return (
            <li key={goal.id} className="mo__item">
              <span className="mo__num">{index + 1}</span>
              <div className="mo__body">
                <strong>{isInvest ? goal.label : `${goal.label} ${fmt(goal.target)}만 원`}</strong>
                <span className="mo__meta">
                  {isInvest
                    ? `남는 돈에서만, 매달 최대 ${fmt(goal.monthlyCap)}만 원`
                    : goal.deadline !== null
                      ? `기한 ${goal.deadline}개월 · 매달 ${fmt(monthly)}만 원 필요`
                      : '기한 없이 가장 먼저'}
                </span>
              </div>
              <div className="mo__rules">
                {isInvest ? (
                  <div className="mo__rule">
                    <span className="mo__cell">
                      <b>{investLabel ? `${investLabel}부터` : '남는 돈이 생기면 시작'}</b>
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="mo__rule">
                      {canCompare && <em>규칙 A</em>}
                      <Cell sim={A} goal={goal} />
                    </div>
                    {canCompare && (
                      <div className="mo__rule">
                        <em>규칙 B</em>
                        <Cell sim={B} goal={goal} partial={goal.id === 'emergency'} />
                      </div>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {canCompare && (
        <div className="mo__compare">
          <div>
            <strong>규칙 A · 비상자금 먼저 전부</strong>
            <p>이번 달은 {thisMonth(A)}에 넣어요. 독립할 때 비상자금이 목표만큼 쌓여 있어서 안전해요.</p>
          </div>
          <div>
            <strong>규칙 B · 비상자금 {ratio}%만 먼저</strong>
            <p>
              이번 달은 {thisMonth(B)}에 넣어요.
              {faster > 0 && <> 독립이 규칙 A보다 {faster}개월 빨라요.</>}
              {B.emergencyAtMove !== null && (
                <>
                  {' '}
                  대신 독립할 때 비상자금이 {fmt(B.emergencyAtMove)}만 원뿐이고
                  {B.thinMonths > 0 && <> 이후 {B.thinMonths}개월 동안 목표보다 적어요.</>}
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {plan.core.gap > 0 && plan.fixes.length > 0 && (
        <div className="mo__fixes">
          <h3>
            지금 저축 속도로는 {plan.core.deadlineLabel}에 {fmt(plan.core.gap)}만 원이 부족해요
          </h3>
          <ul>
            {plan.fixes.map(fix => (
              <li key={fix.kind}>
                <b>{fix.title}</b> {fix.headline}. <span>{fix.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
