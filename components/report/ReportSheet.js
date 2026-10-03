'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { viewFromPlan, monthsWithExtra, savingsLine } from '../../lib/report/fromPlan.js';
import { money, monthLabel, duration } from '../../lib/report/format.js';
import { SavingsLines } from './charts.js';
import PlanSection from './PlanSection.js';
import { useFlowMode } from '../../lib/flowMode.js';

const pct = (value, total) => (total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0);

// 상태는 색만으로 전달하지 않고 아이콘 + 글자를 함께 씁니다.
const ICON = {
  good: 'M6 12.5l4 4 8-9',
  warning: 'M12 7v6M12 16.5v.5',
  serious: 'M12 7v6M12 16.5v.5',
  info: 'M12 11v6M12 7.5v.5',
};
function Status({ tone, children }) {
  return (
    <span className={`rs-status rs-status--${tone}`}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={ICON[tone]} />
      </svg>
      {children}
    </span>
  );
}

function Card({ title, sub, tone, children, id }) {
  return (
    <section className={`rs-card${tone ? ` rs-card--${tone}` : ''}`} aria-labelledby={id}>
      <header className="rs-card__head">
        <h2 id={id}>{title}</h2>
        {sub && <p>{sub}</p>}
      </header>
      {children}
    </section>
  );
}

// 리포트 본문. /report 페이지와 지도 화면의 팝업에서 함께 씁니다.
// plan은 2번 엔진 buildPlan(profile)의 결과이고, 화면용 정리는 lib/report/fromPlan.js가 합니다.
export function ReportSheet({ plan, demo = false }) {
  const view = useMemo(() => viewFromPlan(plan, { demo }), [plan, demo]);
  const classic = useFlowMode() === 'classic';
  const { core, cashflow, cuts, fixes, checks, milestones, status, verdict, goals } = view;

  // 아낄 항목은 사용자가 직접 켜고 끕니다. 고른 만큼 엔진 시뮬레이션으로 다시 계산합니다.
  const [picked, setPicked] = useState(() => cuts.map(cut => cut.id));
  const selected = cuts.filter(cut => picked.includes(cut.id));
  const extra = selected.reduce((total, cut) => total + cut.cut, 0);
  const monthsCut = useMemo(
    () => (extra > 0 ? monthsWithExtra(plan, extra) : core.monthsNeeded),
    [plan, extra, core.monthsNeeded],
  );
  const sooner = monthsCut !== null && core.monthsNeeded !== null ? core.monthsNeeded - monthsCut : null;
  const base = useMemo(() => savingsLine(view, 0), [view]);
  const withCut = useMemo(() => (extra > 0 ? savingsLine(view, extra) : base), [view, extra, base]);
  const maxAnnual = Math.max(1, ...cuts.map(cut => cut.annual));
  const saveWithCut = view.saveNow + extra;
  const cutResult =
    extra === 0
      ? ['아낄 항목을', '골라 보세요', '숫자가 바로 바뀌어요']
      : saveWithCut <= 0
        ? ['아껴도', `매달 ${money(-saveWithCut)} 부족`, '더 줄일 항목이 필요해요']
        : sooner !== null && sooner > 0
          ? [
              view.hasHousing ? '독립' : '목표 달성',
              `${duration(sooner)} 빨라져요`,
              `${monthLabel(view.asOf, monthsCut)} 가능`,
            ]
          : core.monthsNeeded === null && monthsCut !== null
            ? ['아끼면', monthLabel(view.asOf, monthsCut), '다 모을 수 있어요']
            : ['모으는 돈', `1년 +${money(extra * 12)}`, '여유가 더 늘어요'];

  // 진행 막대: 모아둔 돈 · 앞으로 모을 돈 · 부족분 (기한이 있을 때)
  const hasDeadline = core.deadline !== null;
  const scale = Math.max(core.needed, core.collectable ?? 0, 1);
  const goalAt = core.goal ? pct(core.goal, scale) : null;

  return (
    <article className="rs" aria-labelledby="rp-title">
      <header className="rs-head">
        <div>
          <h1 id="rp-title">{view.title}</h1>
          <p>{view.meta.join(' · ')}</p>
        </div>
        <span className={`rs-badge${demo ? '' : ' rs-badge--edited'}`}>{demo ? '시연 데이터' : '내 답변 기준'}</span>
      </header>
      {demo && (
        <p className="rs-demo-note">
          지금은 시연 인물(정하은) 기준이에요.{' '}
          {classic ? (
            <>
              <Link href="/goal">내 돈 상황을 입력</Link>하거나 아래 ‘내 숫자로 바꿔 보기’에서 고치면 내 숫자로
              바뀌어요.
            </>
          ) : (
            <>
              <Link href="/goal">①~③ 입력</Link>을 마치면 내 숫자로 바뀌어요.
            </>
          )}
        </p>
      )}

      {/* 1. 핵심: 모을 수 있는 돈 */}
      <section className="rs-card rs-hero" aria-labelledby="rs-hero-title">
        <p id="rs-hero-title" className="rs-hero__label">
          {hasDeadline ? `${core.deadlineLabel}까지 모을 수 있는 돈` : `${view.purposeLabel}에 필요한 돈`}
        </p>
        <p className="rs-hero__amount">
          {money(hasDeadline ? core.collectable : core.needed, { unit: false })}
          <span>원</span>
        </p>
        <p className="rs-hero__need">
          {hasDeadline ? (
            <>
              필요한 돈 <b>{money(core.needed)}</b>
            </>
          ) : (
            <>
              지금 모아둔 돈 <b>{money(core.saved)}</b>
            </>
          )}
        </p>

        {hasDeadline && (
          <>
            <div className="rs-progress" aria-hidden="true">
              <div className="rs-progress__track">
                <span className="rs-progress__saved" style={{ width: `${pct(core.saved, scale)}%` }} />
                <span className="rs-progress__future" style={{ width: `${pct(core.future, scale)}%` }} />
                {core.gap > 0 && <span className="rs-progress__gap" style={{ width: `${pct(core.gap, scale)}%` }} />}
              </div>
              <span
                className="rs-progress__mark rs-progress__mark--need"
                style={{ left: `${pct(core.needed, scale)}%` }}
              />
              {goalAt !== null && (
                <span className="rs-progress__mark rs-progress__mark--goal" style={{ left: `${goalAt}%` }}>
                  <em>생각한 목표</em>
                </span>
              )}
            </div>
            <dl className="rs-hero__parts">
              <div>
                <dt>
                  <i className="rs-dot rs-dot--saved" aria-hidden="true" />
                  지금 모아둔 돈
                </dt>
                <dd>{money(core.saved)}</dd>
              </div>
              <div>
                <dt>
                  <i className="rs-dot rs-dot--future" aria-hidden="true" />
                  앞으로 {core.deadline}개월 모을 돈
                </dt>
                <dd>{money(core.future)}</dd>
              </div>
              {core.gap > 0 ? (
                <div className="rs-hero__gap">
                  <dt>
                    <i className="rs-dot rs-dot--gap" aria-hidden="true" />
                    부족한 돈
                  </dt>
                  <dd>{money(core.gap)}</dd>
                </div>
              ) : (
                <div>
                  <dt>
                    <i className="rs-dot rs-dot--future" aria-hidden="true" />
                    여유
                  </dt>
                  <dd>{money(core.surplus)}</dd>
                </div>
              )}
            </dl>
          </>
        )}

        <div className={`rs-verdict rs-verdict--${verdict.tone}`}>
          <Status tone={verdict.tone}>{verdict.headline}</Status>
          <p>{verdict.sentence}</p>
          {verdict.warning && (
            <p className="rs-verdict__warn">
              <Status tone="serious">{verdict.warning}</Status>
            </p>
          )}
        </div>
      </section>

      {/* 2. 아끼면 이만큼 */}
      {cuts.length > 0 && (
        <Card
          id="rs-cut"
          title="아끼면 이만큼 빨라져요"
          sub="줄일 수 있다고 답한 항목이에요. 골라 보면 숫자가 바로 바뀌어요."
          tone="good"
        >
          <div className="rs-cut__sum">
            <div>
              <p className="rs-cut__label">매달 {money(extra)} 아끼면</p>
              <p className="rs-cut__amount">
                1년에 <b>{money(extra * 12)}</b>
              </p>
            </div>
            <p className="rs-cut__result">
              {cutResult.map((text, i) => (i === 1 ? <b key={i}>{text}</b> : <span key={i}>{text}</span>))}
            </p>
          </div>
          <ul className="rs-cut__list">
            {cuts.map(cut => {
              const on = picked.includes(cut.id);
              return (
                <li key={cut.id}>
                  <button
                    type="button"
                    className="rs-cut__item"
                    aria-pressed={on}
                    onClick={() =>
                      setPicked(current => (on ? current.filter(id => id !== cut.id) : [...current, cut.id]))
                    }
                  >
                    <span className="rs-check" aria-hidden="true" />
                    <span className="rs-cut__name">
                      <strong>{cut.label}</strong>
                      <span>매달 {money(cut.cut)}</span>
                    </span>
                    <span className="rs-cut__bar" aria-hidden="true">
                      <span style={{ width: `${pct(cut.annual, maxAnnual)}%` }} />
                    </span>
                    <span className="rs-cut__year">1년 {money(cut.annual)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* 3. 언제 다 모을 수 있을까 */}
      <Card
        id="rs-speed"
        title="언제 다 모을 수 있을까요"
        sub={
          core.monthsNeeded === 0
            ? '이미 필요한 돈을 모았어요'
            : core.monthsNeeded === null
              ? '지금 속도로는 필요한 돈에 닿지 않아요'
              : `지금 속도 ${duration(core.monthsNeeded)}${
                  extra > 0 && monthsCut !== null && monthsCut !== core.monthsNeeded
                    ? ` → 아끼면 ${duration(monthsCut)}`
                    : ''
                }`
        }
      >
        <SavingsLines
          base={base}
          saving={withCut}
          target={core.needed}
          deadline={core.deadline ?? Infinity}
          savingLabel={`매달 ${money(extra)} 아끼면`}
          ariaLabel={`필요한 돈 ${money(core.needed)}. 지금 속도면 ${core.monthsNeeded ?? '닿지 않음'}개월, 아끼면 ${monthsCut ?? '닿지 않음'}개월`}
        />
        {view.hasHousing && (
          <p className="rs-note-muted">
            독립하면 모으는 속도가 바뀌어서, 실제 완성 시점은 비상자금을 먼저 채우는 순서(규칙 A)로 계산했어요.
          </p>
        )}
      </Card>

      {/* 4. 매달 모으는 돈 */}
      <Card id="rs-flow" title="매달 모으는 돈" sub={`월급 ${money(cashflow.income)} 중에서`}>
        <div className="rs-flow">
          {[['지금', cashflow.now], ...(cashflow.hasHousing ? [['독립 후', cashflow.after]] : [])].map(
            ([label, row]) => (
              <div key={label} className="rs-flow__row">
                <span className="rs-flow__label">{label}</span>
                <div className="rs-flow__bar" aria-hidden="true">
                  <span
                    className="rs-flow__spend"
                    style={{ width: `${pct(row.spend, Math.max(cashflow.income, row.spend))}%` }}
                  />
                  {row.save > 0 && (
                    <span className="rs-flow__save" style={{ width: `${pct(row.save, cashflow.income)}%` }} />
                  )}
                </div>
                <span className={`rs-flow__value${row.save < 0 ? ' rs-flow__value--minus' : ''}`}>
                  {row.save < 0 ? `−${money(-row.save)}` : money(row.save)}
                  <small>{row.save < 0 ? '매달 부족' : `월급의 ${Math.round(row.rate)}%`}</small>
                </span>
              </div>
            ),
          )}
          <p className="rs-flow__note">
            <i className="rs-dot rs-dot--spend" aria-hidden="true" />
            쓰는 돈
            <i className="rs-dot rs-dot--future" aria-hidden="true" />
            모으는 돈{cashflow.hasHousing ? ` · 독립 후에는 월세·관리비 ${money(cashflow.housingCost)} 포함` : ''}
          </p>
          {cashflow.hasHousing && cashflow.after.save < cashflow.now.save && (
            <Status tone={cashflow.after.save < 0 ? 'serious' : 'warning'}>
              {cashflow.after.save < 0
                ? `독립하면 매달 ${money(-cashflow.after.save)}이 모자라요`
                : `독립하면 매달 ${money(cashflow.now.save - cashflow.after.save)} 덜 모여요 · 그래서 비상자금을 먼저 채워요`}
            </Status>
          )}
        </div>
      </Card>

      {/* 5. 목적별 필요한 돈 */}
      <Card
        id="rs-need"
        title={`필요한 돈 ${money(core.needed)}`}
        sub={
          core.goal && core.goalDiff > 0
            ? `생각한 목표 ${money(core.goal)}보다 ${money(core.goalDiff)} 많아요`
            : core.goal
              ? `생각한 목표 ${money(core.goal)} 안에 들어와요`
              : '목적별로 필요한 돈과 다 모으는 때예요'
        }
      >
        <ul className="rs-need">
          {goals.map(goal => (
            <li key={goal.id}>
              <span className="rs-need__name">
                <strong>{goal.label}</strong>
                <span>
                  {goal.monthlyOnly ? goal.note : goal.doneLabel ? `${goal.doneLabel} 완성` : '지금 속도로는 못 채워요'}
                </span>
              </span>
              <span className="rs-need__bar" aria-hidden="true">
                <span style={{ width: `${pct(goal.target, core.needed || 1)}%` }} />
              </span>
              <span className="rs-need__value">
                {goal.monthlyOnly ? `월 ${money(goal.target)}` : money(goal.target)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* 6. 내 숫자로 맞춘 계획 (2번 엔진: 권장 저축률·생활비 상한·규칙 A·B 비교) */}
      <Card
        id="rs-plan-budget"
        title="내 숫자로 맞춘 계획"
        sub="월급 대비 저축률 · 생활비 상한 · 비상자금 배분 규칙 비교"
      >
        <div className="rs-plansection">
          <PlanSection plan={plan} demo={false} />
        </div>
      </Card>

      {/* 7. 체크 포인트 (인바디식) */}
      <Card id="rs-check" title="체크 포인트" sub="막대가 목표선·권장 범위와 어디쯤인지 보세요">
        <div className="rs-checks">
          {checks.map(check => (
            <div key={check.id} className="rs-check-tile">
              <p className="rs-check-tile__label">{check.label}</p>
              <p className="rs-check-tile__value">
                {check.value}
                <span>{check.unit}</span>
                {check.after !== undefined && (
                  <em>
                    → {check.after}
                    {check.unit}
                  </em>
                )}
              </p>
              <div className="rs-meter" aria-hidden="true">
                {check.band && (
                  <span className="rs-meter__band" style={{ width: `${pct(check.band.to, check.max)}%` }} />
                )}
                <span className="rs-meter__fill" style={{ width: `${pct(check.value, check.max)}%` }} />
                {check.target !== undefined && (
                  <span className="rs-meter__target" style={{ left: `${pct(check.target, check.max)}%` }} />
                )}
              </div>
              <p className="rs-check-tile__caption">
                {check.caption}
                {check.band && (
                  <>
                    {' · '}
                    {check.band.label}
                    {!check.band.source && <em className="rs-draft">기준 확인 중</em>}
                  </>
                )}
              </p>
              <Status tone={check.status.tone}>{check.status.text}</Status>
            </div>
          ))}
        </div>
      </Card>

      {/* 8. 부족분을 채우는 방법 */}
      {fixes.length > 0 && (
        <Card
          id="rs-fix"
          title={status === 'cannot' ? '먼저 해야 할 일' : '부족분을 채우는 방법'}
          sub="하나만 해도, 섞어서 해도 돼요"
        >
          <ol className="rs-fixes">
            {fixes.map(fix => (
              <li key={fix.kind}>
                <span className="rs-fixes__title">{fix.title}</span>
                <strong>{fix.value}</strong>
                <span className="rs-fixes__detail">{fix.detail}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* 9. 앞으로의 일정 */}
      <Card id="rs-plan" title="앞으로의 일정" sub="지금 저축 속도 + 비상자금을 먼저 채우는 순서(규칙 A) 기준">
        <ol className="rs-plan">
          {milestones.map(item => (
            <li key={`${item.month}-${item.title}`} className={item.muted ? 'is-muted' : ''}>
              <span className="rs-plan__date">{item.label}</span>
              <span className="rs-plan__title">{item.title}</span>
              <span className="rs-plan__text">{item.text}</span>
            </li>
          ))}
        </ol>
      </Card>

      <footer className="rs-foot">
        <details>
          <summary>계산 방법 보기</summary>
          <ul>
            {view.basis.map(line => (
              <li key={line}>{line}</li>
            ))}
            <li>예적금 이자와 투자 수익률은 넣지 않았어요.</li>
          </ul>
        </details>
        <p>
          입력한 숫자로 계산한 참고용 시뮬레이션이며 실제 결과를 보장하지 않아요. 상품 추천이 아니에요. 기준
          비율(비상자금 개월 수, 주거비 상한 등)은 출처 확인 전 초안이라 ‘일반적으로’라고 표현했어요.
        </p>
      </footer>
    </article>
  );
}
