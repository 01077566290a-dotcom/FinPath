'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { viewFromPlan, monthsWithExtra, savingsLine } from '../../lib/report/fromPlan.js';
import { money, monthLabel, duration } from '../../lib/report/format.js';
import { SavingsLines } from './charts.js';
import PlanSection from './PlanSection.js';
import Trio from './Trio.js';
import { useFlowMode } from '../../lib/flowMode.js';
import { scoreFromPlan } from '../../lib/report/score.js';
import { methodFromPlan } from '../../lib/report/method.js';

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

// 인바디처럼: 큰 점수 + 한마디 + 항목별 막대(내 값, 비교 기준 눈금, 부족·보통·좋음)
function ScoreCard({ score }) {
  return (
    <section className="rs-card rs-score" aria-labelledby="rs-score-title">
      <header className="rs-score__head">
        <div>
          <h2 id="rs-score-title">내 돈 건강 점수</h2>
          <p className="rs-score__total">
            <b>{score.total}</b>
            <span>/ 100점</span>
          </p>
        </div>
        <Status tone={score.tone}>{score.grade}</Status>
      </header>
      <p className="rs-score__comment">{score.comment}</p>
      {score.action && <p className="rs-score__action">→ {score.action}</p>}
      <p className="rs-score__legend">막대는 내 값, 세로선은 비교 기준이에요.</p>
      <ul className="rs-score__items">
        {score.items.map(item => (
          <li key={item.id} className={`rs-score__item rs-score__item--${item.level}`}>
            <div className="rs-score__row">
              <span className="rs-score__label">{item.label}</span>
              <span className="rs-score__value">
                {item.value}
                <small>{item.unit}</small>
              </span>
              <span className={`rs-level rs-level--${item.level}`}>{item.levelLabel}</span>
            </div>
            {/* 막대 = 내 값, 이름표가 붙은 세로선 = 비교 기준 */}
            <div className="rs-score__bar" aria-hidden="true">
              <span className="rs-score__fill" style={{ width: `${pct(item.value, item.scaleMax)}%` }} />
              <span
                className="rs-score__tick"
                style={{ left: `${pct(item.compare.value, item.scaleMax)}%` }}
                data-edge={pct(item.compare.value, item.scaleMax) > 85 ? 'end' : undefined}
              >
                <em>{item.compare.short}</em>
              </span>
              {item.limit && (
                <span
                  className="rs-score__tick rs-score__tick--limit"
                  style={{ left: `${pct(item.limit.value, item.scaleMax)}%` }}
                >
                  <em>{item.limit.short}</em>
                </span>
              )}
            </div>
            <p className="rs-score__compare">
              {item.compare.label} {item.compare.value}
              {item.unit}
              {item.limit && ` · ${item.limit.label} ${item.limit.value}${item.unit}`}
              <span>{item.points} / 25점</span>
            </p>
          </li>
        ))}
      </ul>
      {score.penalties?.length > 0 && (
        // 네 항목 합계에서 빼는 감점: 전체 상황이 나쁘면 점수가 높게 나오지 않게 해요
        <ul className="rs-score__penalties" aria-label="감점">
          {score.penalties.map(p => (
            <li key={p.id}>
              <span>{p.label}</span>
              <b>−{p.points}점</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// 계산 방법: 화면의 숫자를 내 숫자가 들어간 식으로 풀어 보여 줘요. 항목을 눌러 펼쳐요.
function MethodCard({ sections }) {
  return (
    <section className="rs-card rs-method" aria-labelledby="rs-method-title">
      <header className="rs-card__head">
        <h2 id="rs-method-title">계산 방법</h2>
        <p>화면의 숫자가 어떻게 나왔는지 내 숫자로 보여 드려요.</p>
      </header>
      <div className="rs-method__list">
        {sections.map(section => (
          <details key={section.id} className={`rs-method__item${section.small ? ' rs-method__item--small' : ''}`}>
            <summary>
              <span>{section.title}</span>
              {section.result && <b>{section.result}</b>}
            </summary>
            <ul>
              {section.lines.map(line => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}

// 리포트 본문. /report 페이지와 지도 화면의 팝업에서 함께 씁니다.
// plan은 2번 엔진 buildPlan(profile)의 결과이고, 화면용 정리는 lib/report/fromPlan.js가 합니다.
// shared: 공유 링크로 연 리포트 (보기 전용)
export function ReportSheet({ plan, demo = false, shared = false }) {
  const view = useMemo(() => viewFromPlan(plan, { demo }), [plan, demo]);
  const classic = useFlowMode() === 'classic';
  const { core, cashflow, cuts, fixes, checks, milestones, status, verdict, goals } = view;
  const score = useMemo(() => scoreFromPlan(plan), [plan]);
  const method = useMemo(() => methodFromPlan(plan, view, score), [plan, view, score]);
  const suggested = cuts.some(cut => cut.suggested);

  // 아낄 항목은 사용자가 직접 켜고 끕니다. 고른 만큼 엔진 시뮬레이션으로 다시 계산합니다.
  // 입력에서 답한 항목은 모두 켠 채로, 예시 항목은 꺼 둔 채로 시작해요.
  const [picked, setPicked] = useState(() => (suggested ? [] : cuts.map(cut => cut.id)));
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
      ? ['', '', '']
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
            : core.gap > 0 && core.deadline
              ? [
                  '부족한 돈이',
                  `${money(Math.min(core.gap, extra * core.deadline))} 줄어요`,
                  core.gap > extra * core.deadline
                    ? `기한까지 ${money(core.gap - extra * core.deadline)} 남아요`
                    : '기한 안에 다 모아요',
                ]
              : ['모으는 돈', `1년 +${money(extra * 12)}`, '여유가 더 늘어요'];

  // 진행 막대: 모아둔 돈 · 앞으로 모을 돈 · 부족분 (기한이 있을 때)
  // 투자만 고른 경우는 진행 막대 대신 투자 숫자만 보여줘요
  const hasDeadline = core.deadline !== null && !view.investOnly;
  const scale = Math.max(core.needed, core.collectable ?? 0, 1);
  const goalAt = core.goal ? pct(core.goal, scale) : null;

  return (
    <article className="rs" aria-labelledby="rp-title">
      <header className="rs-head">
        <div>
          <h1 id="rp-title">{view.title}</h1>
          <p>{view.meta.join(' · ')}</p>
        </div>
        <span className={`rs-badge${demo ? '' : ' rs-badge--edited'}`}>
          {shared ? '공유받은 리포트' : demo ? '시연 데이터' : '내 답변 기준'}
        </span>
      </header>
      {plan.usedDefaults.includes('loan_principal_monthly') && (
        <p role="status" className="rs-demo-note">
          대출 원금 상환액이 미정이라 월 지출에는 추정 이자만 반영했어요. 원금 상환액을 입력해야 상환 부담을 함께 계산할
          수 있어요.
        </p>
      )}
      {plan.usedDefaults.includes('variable_after_delta') && (
        <p className="rs-demo-note">
          지역별 추가 생활비는 미입력으로 0원을 가정했어요. 이사 후 식비 등 증가분을 입력하면 결과에 반영돼요.
        </p>
      )}
      {demo && !shared && (
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
        {hasDeadline || view.investOnly ? (
          <>
            <p id="rs-hero-title" className="rs-hero__label">
              {view.investOnly
                ? `${view.purposeLabel} · ${view.investOnly.months}개월`
                : `${view.purposeLabel} · ${core.deadlineLabel}까지`}
            </p>
            {/* 시연의 첫 장면: 생각한 목표 vs 실제로 필요한 돈 vs 모을 수 있는 돈 (투자만이면 투자 숫자) */}
            <Trio view={view} />
          </>
        ) : (
          <>
            <p id="rs-hero-title" className="rs-hero__label">
              {`${view.purposeLabel}에 필요한 돈`}
            </p>
            <p className="rs-hero__amount">
              {money(core.needed, { unit: false })}
              <span>원</span>
            </p>
            <p className="rs-hero__need">
              지금 모아둔 돈 <b>{money(core.saved)}</b>
            </p>
          </>
        )}

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
                <span
                  className="rs-progress__mark rs-progress__mark--goal"
                  style={{ left: `${goalAt}%` }}
                  data-edge={goalAt > 85 ? 'end' : goalAt < 15 ? 'start' : undefined}
                >
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

      {/* 2. 내 돈 건강 점수 (인바디식) */}
      <ScoreCard score={score} />

      {/* 3. 아끼면 이만큼 */}
      {cuts.length > 0 && (
        <Card
          id="rs-cut"
          title="아끼면 이만큼 빨라져요"
          sub={
            suggested
              ? '흔히 줄이는 항목이에요. 눌러서 고르면 숫자가 바로 바뀌어요.'
              : '줄일 수 있다고 답한 항목이에요. 골라 보면 숫자가 바로 바뀌어요.'
          }
          tone="good"
        >
          <div className="rs-cut__sum">
            {extra > 0 ? (
              <div>
                <p className="rs-cut__label">매달 {money(extra)} 아끼면</p>
                <p className="rs-cut__amount">
                  1년에 <b>{money(extra * 12)}</b>
                </p>
              </div>
            ) : (
              // 아무것도 고르지 않았을 때 '0만 원'을 크게 보여 주지 않고, 무엇을 하면 되는지 알려줘요
              <div>
                <p className="rs-cut__label">아래에서 줄일 항목을 눌러 보세요</p>
                <p className="rs-cut__amount rs-cut__amount--empty">얼마나 빨라지는지 바로 보여 드려요</p>
              </div>
            )}
            {extra > 0 && (
              <p className="rs-cut__result">
                {cutResult.map((text, i) => (i === 1 ? <b key={i}>{text}</b> : <span key={i}>{text}</span>))}
              </p>
            )}
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
                      <span>
                        매달 {money(cut.cut)}
                        {cut.hint ? ` · ${cut.hint}` : ''}
                      </span>
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

      {/* 4. 부족분을 채우는 방법 */}
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

      {/* 자세히 보기: 그래프 · 매달 모으는 돈 · 필요한 돈 · 계획 · 체크 포인트 · 일정 */}
      <details className="rs-more">
        <summary>
          자세히 보기 <span>그래프 · 매달 모으는 돈 · 필요한 돈 · 계획 · 일정</span>
        </summary>
        <div className="rs-more__body">
          {/* 언제 다 모을 수 있을까 */}
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
                      {goal.monthlyOnly
                        ? goal.note
                        : goal.doneLabel
                          ? `${goal.doneLabel} 완성`
                          : '지금 속도로는 못 채워요'}
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
        </div>
      </details>

      <MethodCard sections={method} />

      <footer className="rs-foot">
        <p>
          입력한 숫자로 계산한 참고용 시뮬레이션이며 실제 결과를 보장하지 않아요. 상품 추천이 아니에요. 출처가 없는
          기준은 ‘일반적으로’라고 표시했어요.
        </p>
      </footer>
    </article>
  );
}
