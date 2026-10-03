'use client';

const fmt = value => Math.round(value).toLocaleString();
const VERDICT = {
  on_track: '지금 속도로 충분해요',
  cut_spending: '지출을 조금 줄이면 가능해요',
  extend: '기간을 늘리는 게 좋아요',
  no_room: '먼저 지출을 줄여야 해요',
};
const DEFAULT_LABEL = {
  deposit: '보증금',
  rent: '월세',
  maintenance: '관리비',
  wedding_cost: '결혼 총비용',
};

function RuleCard({ rule, title, scenario, highlight }) {
  const housingDone = scenario.done.housing;
  return (
    <section className={`rp-card plan-rule${highlight ? ' plan-rule--safer' : ''}`}>
      <h3>
        <span className="plan-rule__tag">규칙 {rule}</span>
        {title}
        {highlight && <em className="plan-rule__badge">더 안전해요</em>}
      </h3>
      <ol className="plan-steps">
        {scenario.milestones.map(item => (
          <li key={item.id}>
            <span className="milestones__date">{item.label}</span>
            <strong>{item.title}</strong>
          </li>
        ))}
      </ol>
      {scenario.emergencyAtMove !== null && (
        <p className="rp-muted">
          {housingDone === 0 ? '이미 독립할 수 있어요.' : `독립할 때 비상자금 ${fmt(scenario.emergencyAtMove)}만 원`}
          {scenario.thinMonths > 0 && (
            <>
              {' '}
              · 독립 후 <b>{scenario.thinMonths}개월</b> 동안 비상자금이 목표보다 적어요
            </>
          )}
        </p>
      )}
    </section>
  );
}

// 리포트 7번 섹션 본문: 내 숫자로 맞춘 계획 (월급 대비 저축률, 생활비 상한, 규칙 A·B 비교)
export default function PlanSection({ plan, demo }) {
  const { budget, scenarios, comparison, core } = plan;
  const p = budget.plan;
  const hasEmergency = plan.goals.some(g => g.id === 'emergency');
  const hasOther = plan.goals.some(g => !['emergency', 'invest'].includes(g.id));
  const compareRules = hasEmergency && hasOther;

  return (
    <div className="plan">
      {demo && <p className="rp-muted">입력 화면을 마치면 내 숫자로 바뀌어요. 지금은 시연 인물 기준이에요.</p>}

      <p className="rp-lead">
        <b>{VERDICT[budget.verdict]}.</b> 기한 안에 {fmt(budget.primary.cumulative)}만 원을 모으려면 매달{' '}
        <b>
          {fmt(budget.required.monthly)}만 원(월급의 {budget.required.rate}%)
        </b>
        이 필요해요. 일반적으로 월급의 {Math.round((budget.ceiling / plan.cashflow.income) * 100)}% 안팎까지를 무리 없는
        저축으로 봐요.
      </p>

      <dl className="plan-stats">
        <div>
          <dt>권장 저축</dt>
          <dd>
            월 {fmt(p.monthly)}만 원<span>월급의 {p.saveRate}%</span>
          </dd>
        </div>
        <div>
          <dt>생활비 상한 (월세 제외)</dt>
          <dd>
            월 {fmt(p.livingMax)}만 원<span>지금 {fmt(p.livingNow)}만 원 쓰고 있어요</span>
          </dd>
        </div>
        {budget.period.to !== null && (
          <div>
            <dt>{budget.housing ? '독립 시기' : '목표 기간'}</dt>
            <dd>
              {budget.period.from}개월 → {budget.period.to}개월<span>이 속도로 모았을 때</span>
            </dd>
          </div>
        )}
      </dl>

      <ul className="plan-text">
        {plan.text.map(line => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {compareRules && (
        <>
          <h3 className="plan-sub">비상자금을 먼저 다 채울까, 일부만 채울까? (지금 저축 속도 기준)</h3>
          <div className="plan-rules">
            <RuleCard
              rule="A"
              title="비상자금 먼저 전부"
              scenario={scenarios.A}
              highlight={comparison?.safer === 'A'}
            />
            <RuleCard rule="B" title="비상자금 절반만 먼저" scenario={scenarios.B} />
          </div>
          {comparison && <p className="rp-callout">{comparison.text}</p>}
        </>
      )}

      <div className="rp-more-row">
        <details className="rp-more">
          <summary>계산 근거</summary>
          <ul>
            {plan.goals.flatMap(goal => goal.basis.map(line => <li key={`${goal.id}-${line}`}>{line}</li>))}
            <li>
              월 필요 저축 = (기한까지 필요한 돈 − 모아둔 돈) ÷ 기한 개월 수. 비상자금은 첫 기한까지 채우는 것으로 봐요.
            </li>
            <li>생활비 상한 = 월급 − 권장 저축 − 월세·관리비</li>
          </ul>
        </details>
      </div>

      {plan.usedDefaults.length > 0 && (
        <p className="rp-muted">
          모른다고 답한 {plan.usedDefaults.map(key => DEFAULT_LABEL[key] || key).join(', ')}은(는) 일반적인 기준값으로
          계산했어요.
        </p>
      )}
    </div>
  );
}
