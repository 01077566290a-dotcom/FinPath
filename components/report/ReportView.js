'use client';
import {
  COLOR,
  niceScale,
  METRIC_ROW_COLOR,
  CompareBars,
  StackedBars,
  CashflowBars,
  SavingsLines,
  MetricBar,
  MilestoneTimeline,
} from './charts.js';
import { SiteHeader } from '../flow/Chrome.js';
import PlanSection from './PlanSection.js';
import { usePlan } from './usePlan.js';

const fmt = value => Math.round(value).toLocaleString();
const GOAL_COLOR = {
  emergency: COLOR.emergency,
  housing: COLOR.housing,
  wedding: COLOR.initial,
  debt: 'var(--c-muted-strong)',
};
const TONE_COLOR = {
  now: 'var(--c-muted-strong)',
  emergency: COLOR.emergency,
  missed: '#ffffff',
  saving: COLOR.saving,
  housing: COLOR.housing,
  debt: 'var(--c-muted-strong)',
  wedding: COLOR.initial,
  invest: COLOR.base,
};

// 상태는 색만으로 전달하지 않고 아이콘 + 글자를 함께 씁니다.
const STATUS_ICON = {
  good: 'M6 12.5l4 4 8-9',
  warning: 'M12 7v6M12 16.5v.5',
  serious: 'M12 7v6M12 16.5v.5',
  info: 'M12 11v6M12 7.5v.5',
};
function StatusChip({ tone, text }) {
  return (
    <span className={`status status--${tone}`}>
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
        <path d={STATUS_ICON[tone]} />
      </svg>
      {text}
    </span>
  );
}

function Section({ number, title, sub, children, className = '' }) {
  return (
    <section className={`rp-section ${className}`} aria-labelledby={`rp-s${number}`}>
      <header className="rp-section__head">
        <h2 id={`rp-s${number}`}>
          <span className="rp-section__num">{number}</span>
          {title}
        </h2>
        {sub && <span>{sub}</span>}
      </header>
      <div className="rp-section__body">{children}</div>
    </section>
  );
}

function Basis({ lines }) {
  return (
    <details className="rp-more">
      <summary>계산 근거</summary>
      <ul>
        {lines.map(line => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  );
}

function TableView({ caption, head, rows }) {
  return (
    <details className="rp-more">
      <summary>표로 보기</summary>
      <table className="rp-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map(cell => (
              <th key={cell} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row[0]}>
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={i}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function Legend({ items }) {
  return (
    <div className="viz__legend">
      {items.map(item => (
        <span key={item.label}>
          <i
            className={`viz__key${item.track ? ' viz__key--track' : ''}`}
            style={item.track ? undefined : { background: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

// 리포트 본문 한 장. /report 페이지와 지도 화면의 팝업에서 함께 씁니다. plan은 buildPlan(profile) 결과입니다.
export function ReportSheet({ plan, demo = false }) {
  const { core, cashflow, goals, profile, diagnosis, budget, savings, fixes, metrics, milestones, series } = plan;
  const hasHousing = Boolean(plan.housing);
  const emergency = goals.find(g => g.id === 'emergency');
  const future = core.collectable === null ? null : core.collectable - profile.saved;
  const placeName = plan.region.split(' ').at(-1);

  const compareRows = [
    ...(core.goal !== null
      ? [
          {
            label: '내가 생각한 목표',
            value: core.goal,
            color: COLOR.muted,
            note: `처음에 "${core.goalMonths}개월 동안 ${fmt(core.goal)}만 원"으로 입력했어요`,
          },
        ]
      : []),
    {
      label: '실제로 필요한 돈',
      value: core.needed,
      color: COLOR.needed,
      strong: true,
      note: goals
        .filter(g => g.target > 0)
        .map(g => g.label)
        .join(' + '),
    },
    ...(core.collectable !== null
      ? [
          {
            label: `${core.deadlineLabel}까지 모을 돈`,
            value: core.collectable,
            color: COLOR.saving,
            shortfallTo: core.gap > 0 ? core.needed : undefined,
            note: `지금 모아둔 ${fmt(profile.saved)} + 매달 ${cashflow.now.save} × ${core.deadline}개월`,
          },
        ]
      : []),
  ];
  const compareScale = niceScale(Math.max(...compareRows.map(row => row.value)));
  const needParts = goals
    .filter(g => g.target > 0)
    .map(g => ({ label: g.label, short: g.label, value: g.target, color: GOAL_COLOR[g.id] || COLOR.base }));
  const stackMax = Math.max(core.needed, core.collectable ?? 0);
  const goalBasis = goals.flatMap(g => g.basis);

  const savePart = value => ({
    key: 'save',
    label: '모으는 돈',
    short: '저축',
    value: Math.max(0, value),
    color: COLOR.saving,
    ink: '#0b0b0b',
  });
  const livingPart = value => ({ key: 'living', label: '생활비', short: '생활비', value, color: COLOR.base });
  const cashRows = [
    {
      label: '지금',
      save: cashflow.now.save,
      parts: [livingPart(cashflow.now.spend), savePart(cashflow.now.save)],
    },
    ...(hasHousing
      ? [
          {
            label: '독립 후',
            save: cashflow.after.save,
            parts: [
              livingPart(cashflow.after.spend - cashflow.housingCost),
              {
                key: 'housing',
                label: '월세 + 관리비',
                short: '주거비',
                value: cashflow.housingCost,
                color: COLOR.housing,
              },
              savePart(cashflow.after.save),
            ],
          },
        ]
      : []),
  ];

  const hasFaster = budget.plan.monthly > profile.saveNow;
  const speedSeries = [
    { key: 'base', color: COLOR.base, label: `지금 속도 (매달 ${cashflow.now.save}만 원)`, short: '지금 속도' },
    ...(hasFaster
      ? [
          {
            key: 'saving',
            color: COLOR.saving,
            label: `권장 속도 (매달 ${budget.plan.monthly}만 원)`,
            short: '권장 속도',
          },
        ]
      : []),
  ];
  const mainHousing = plan.scenarios.A.done.housing;
  const investMilestone = plan.scenarios.A.milestones.find(m => m.id === 'invest');

  return (
    <article className="rp-sheet" aria-labelledby="rp-title">
      <header className="rp-head">
        <div className="rp-head__title">
          <p className="rp-head__brand">FinPath</p>
          <h1 id="rp-title">돈 구성 리포트</h1>
          {demo && <span className="rp-head__badge">시연 데이터</span>}
        </div>
        <dl className="rp-head__meta">
          <div>
            <dt>나이</dt>
            <dd>{profile.age}세</dd>
          </div>
          <div>
            <dt>고용 형태</dt>
            <dd>{profile.employment}</dd>
          </div>
          <div>
            <dt>월 실수령액</dt>
            <dd>{fmt(profile.income)}만 원</dd>
          </div>
          <div>
            <dt>지역</dt>
            <dd>{plan.region}</dd>
          </div>
          <div>
            <dt>목적</dt>
            <dd>{profile.purposes.join(' · ')}</dd>
          </div>
          <div>
            <dt>기준 시점</dt>
            <dd>{plan.asOfLabel}</dd>
          </div>
        </dl>
      </header>

      <p className="rp-summary">{plan.summary}</p>

      <div className="rp-grid">
        <div className="rp-main">
          <Section number={1} title="목표 진단" sub="내가 생각한 목표 vs 실제로 필요한 돈">
            <p className="rp-lead">
              {core.goal !== null && (
                <>
                  생각한 목표는 <b>{fmt(core.goal)}만 원</b>이었지만,{' '}
                </>
              )}
              실제로 필요한 돈은 <b>{fmt(core.needed)}만 원</b>이에요.
              {emergency && (
                <>
                  {' '}
                  {hasHousing ? '독립 후 ' : ''}생활비 {emergency.months}개월치 비상자금{' '}
                  <b>{fmt(emergency.target)}만 원</b>도 포함돼요.
                </>
              )}
            </p>
            <CompareBars
              rows={compareRows}
              max={compareScale.max}
              ticks={compareScale.ticks}
              ariaLabel={compareRows.map(row => `${row.label} ${row.value}만 원`).join(', ')}
            />
            <div className="rp-more-row">
              <Basis lines={goalBasis} />
              <TableView
                caption="목표 진단"
                head={['구분', '금액(만 원)', '설명']}
                rows={[
                  ...compareRows.map(row => [row.label, fmt(row.value), row.note]),
                  ...(core.gap > 0 ? [['부족한 돈', fmt(core.gap), '실제로 필요한 돈 − 모을 돈']] : []),
                ]}
              />
            </div>
          </Section>

          <Section
            number={2}
            title="돈 구성 분석"
            sub={`단위: 만 원${core.deadlineLabel ? ` · ${core.deadlineLabel} 기준` : ''}`}
          >
            <StackedBars
              max={stackMax}
              ariaLabel={`필요한 돈은 ${needParts.map(part => `${part.label} ${part.value}`).join(', ')}.${
                future === null
                  ? ''
                  : ` 마련할 돈은 모아둔 돈 ${profile.saved}, 앞으로 모을 돈 ${future}, 부족 ${Math.max(0, core.gap)}`
              }`}
              rows={[
                { label: '필요한 돈', parts: needParts },
                ...(future === null
                  ? []
                  : [
                      {
                        label: '마련할 돈',
                        ...(core.gap > 0
                          ? { track: core.needed, trackLabel: `부족 ${fmt(core.gap)}`, trackShort: fmt(core.gap) }
                          : {}),
                        parts: [
                          { label: '지금 모아둔 돈', short: '모아둔 돈', value: profile.saved, color: COLOR.saved },
                          {
                            label: `앞으로 ${core.deadline}개월 모을 돈`,
                            short: '앞으로',
                            value: future,
                            color: COLOR.saving,
                            ink: '#0b0b0b',
                          },
                        ],
                      },
                    ]),
              ]}
            />
            <div className="rp-legend-grid">
              <span className="rp-legend-grid__label">필요한 돈</span>
              <Legend
                items={needParts.map(part => ({ label: `${part.label} ${fmt(part.value)}`, color: part.color }))}
              />
              {future !== null && (
                <>
                  <span className="rp-legend-grid__label">마련할 돈</span>
                  <Legend
                    items={[
                      { label: `지금 모아둔 돈 ${fmt(profile.saved)}`, color: COLOR.saved },
                      { label: `앞으로 ${core.deadline}개월 모을 돈 ${fmt(future)}`, color: COLOR.saving },
                      ...(core.gap > 0 ? [{ label: `부족 ${fmt(core.gap)}`, track: true }] : []),
                    ]}
                  />
                </>
              )}
            </div>
          </Section>

          <Section number={3} title="월 현금흐름" sub="월급이 어디로 가는지 · 단위: 만 원">
            <CashflowBars
              income={cashflow.income}
              ariaLabel={`지금은 쓰는 돈 ${cashflow.now.spend}, 모으는 돈 ${cashflow.now.save}.${
                hasHousing
                  ? ` 독립 후에는 생활비 ${cashflow.after.spend - cashflow.housingCost}, 주거비 ${cashflow.housingCost}, 모으는 돈 ${cashflow.after.save}`
                  : ''
              }`}
              rows={cashRows}
            />
            <Legend
              items={[
                { label: '생활비 (고정지출 + 변동 생활비)', color: COLOR.base },
                ...(hasHousing ? [{ label: '주거비 (월세 + 관리비)', color: COLOR.housing }] : []),
                { label: '모으는 돈', color: COLOR.saving },
              ]}
            />
            <p className="rp-callout">
              {hasHousing ? (
                <>
                  독립하면 매달 나가는 돈이 <b>{diagnosis.spendIncrease}만 원</b> 늘어, 모으는 돈이{' '}
                  <b>
                    {cashflow.now.save}만 원 → {cashflow.after.save}만 원
                  </b>
                  으로 줄어요.
                  {emergency && (
                    <>
                      {' '}
                      그래서 비상자금을 <b>독립 전에</b> 채우는 순서가 중요해요.
                    </>
                  )}
                </>
              ) : (
                <>
                  매달 <b>{cashflow.now.save}만 원</b>을 모으고 있어요. 월급의 <b>{cashflow.now.rate}%</b>예요.
                </>
              )}
            </p>
            <div className="rp-more-row">
              <Basis
                lines={[
                  `지금 쓰는 돈 = 월급 ${fmt(cashflow.income)} − 모으는 돈 ${cashflow.now.save} = ${fmt(cashflow.now.spend)}만 원`,
                  ...(hasHousing
                    ? [
                        `독립 후 쓰는 돈 = 지금 쓰는 돈 ${cashflow.now.spend} − 교통비 변화 + 월세·관리비 ${cashflow.housingCost} = ${cashflow.after.spend}만 원`,
                      ]
                    : []),
                ]}
              />
              <TableView
                caption="월 현금흐름"
                head={hasHousing ? ['항목', '지금', '독립 후'] : ['항목', '금액']}
                rows={
                  hasHousing
                    ? [
                        ['실수령액', cashflow.income, cashflow.income],
                        ['생활비(주거비 제외)', cashflow.now.spend, cashflow.after.spend - cashflow.housingCost],
                        ['월세 + 관리비', 0, cashflow.housingCost],
                        ['모으는 돈', cashflow.now.save, cashflow.after.save],
                      ]
                    : [
                        ['실수령액', cashflow.income],
                        ['생활비', cashflow.now.spend],
                        ['모으는 돈', cashflow.now.save],
                      ]
                }
              />
            </div>
          </Section>

          <Section number={4} title="핵심 지표 분석" sub="막대 길이가 기준선·범위와 어디쯤인지 보세요">
            <div className="metrics__legend">
              <Legend
                items={[
                  { label: '지금', color: METRIC_ROW_COLOR.now },
                  ...(hasHousing ? [{ label: '독립 후', color: METRIC_ROW_COLOR.after }] : []),
                ]}
              />
              <span>
                <i className="metrics__band-key" aria-hidden="true" />
                권장 범위
              </span>
              <span>
                <i className="metrics__target-key" aria-hidden="true" />
                목표선
              </span>
            </div>
            <ul className="metrics">
              {metrics.map(metric => (
                <li key={metric.id} className="metric">
                  <div className="metric__name">
                    <strong>{metric.label}</strong>
                    <span>{metric.sub}</span>
                  </div>
                  <MetricBar metric={metric} />
                  <div className="metric__value">
                    {metric.rows.map(row => (
                      <span key={row.key} className="metric__row">
                        <i style={{ background: METRIC_ROW_COLOR[row.key] }} aria-hidden="true" />
                        {row.label}{' '}
                        <b>
                          {row.value}
                          {metric.unit}
                        </b>
                      </span>
                    ))}
                    {metric.band && (
                      <span className="metric__note">
                        {metric.band.label}
                        {!metric.band.source && <em className="rp-draft">기준 확인 중</em>}
                      </span>
                    )}
                    {metric.note && <span className="metric__note">{metric.note}</span>}
                    <StatusChip tone={metric.status.tone} text={metric.status.text} />
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            number={5}
            title="모으는 속도"
            sub={`저축 속도 기준 · 선이 필요한 돈에 닿으면 ${hasHousing ? '독립' : '목표 달성'}`}
          >
            <SavingsLines
              data={series}
              target={core.needed}
              deadline={
                core.deadline === null
                  ? null
                  : { month: Math.min(core.deadline, series.at(-1).month), label: `원래 계획 ${core.deadlineLabel}` }
              }
              ariaLabel={`지금 속도면 ${core.monthsNeeded ?? '아주 오랜'}개월 뒤${
                hasFaster ? `, 매달 ${budget.plan.monthly}만 원 모으면 더 빨리` : ''
              } 필요한 돈 ${core.needed}만 원에 닿아요`}
              series={speedSeries}
            />
            <div className="rp-more-row">
              <Basis
                lines={[
                  `필요한 돈까지 남은 금액 = ${fmt(core.needed)} − ${fmt(profile.saved)} = ${fmt(core.needed - profile.saved)}만 원`,
                  `지금 속도: ${fmt(core.needed - profile.saved)} ÷ 매달 ${cashflow.now.save}만 원`,
                  ...(hasFaster
                    ? [`권장 속도: ${fmt(core.needed - profile.saved)} ÷ 매달 ${budget.plan.monthly}만 원`]
                    : []),
                  ...(hasHousing
                    ? ['독립하면 매달 모으는 돈이 줄어서, 그래프는 필요한 돈을 다 모으는 달까지만 그렸어요.']
                    : []),
                ]}
              />
              <TableView
                caption="모으는 속도"
                head={['시점', '지금 속도(만 원)', '권장 속도(만 원)']}
                rows={series
                  .filter(d => d.month % 3 === 0 || d.month === series.at(-1).month)
                  .map(d => [d.label, fmt(d.base), fmt(d.saving)])}
              />
            </div>
          </Section>

          <Section number={6} title="앞으로의 일정" sub="지금 저축 속도와 규칙 A(비상자금 먼저) 기준">
            <MilestoneTimeline
              items={milestones}
              toneColor={TONE_COLOR}
              ariaLabel={milestones.map(item => `${item.label} ${item.title}`).join(', ')}
            />
            <ol className="milestones">
              {milestones.map(item => (
                <li key={item.title} className={`milestones__item milestones__item--${item.tone}`}>
                  <i
                    style={{ background: item.tone === 'missed' ? '#ffffff' : TONE_COLOR[item.tone] }}
                    aria-hidden="true"
                  />
                  <div>
                    <span className="milestones__date">{item.label}</span>
                    <strong>{item.title}</strong>
                    <span className="rp-muted">{item.text}</span>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section
            number={7}
            title="내 숫자로 맞춘 계획"
            sub="월급 대비 저축률 · 생활비 상한 · 비상자금 배분 규칙 비교"
          >
            <PlanSection plan={plan} demo={demo} />
          </Section>
        </div>

        <aside className="rp-side">
          {/* 좁은 화면에서는 이 묶음을 요약 바로 아래로 올립니다 (globals.css .rp-side__top) */}
          <div className="rp-side__top">
            {core.readiness !== null && (
              <section className="rp-score" aria-labelledby="score-title">
                <h2 id="score-title">준비도</h2>
                <p className="rp-score__value">
                  {Math.min(core.readiness, 999)}
                  <span>%</span>
                </p>
                <div className="meter meter--dark" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, core.readiness)}%` }} />
                </div>
                <p className="rp-score__text">
                  {core.deadlineLabel}까지 필요한 돈의 <b>{core.readiness}%</b>를 모을 수 있어요.{' '}
                  {core.gap > 0 ? (
                    <>
                      <b>{fmt(core.gap)}만 원</b>이 부족해요.
                    </>
                  ) : (
                    '부족하지 않아요.'
                  )}
                </p>
                <p className="rp-score__help">준비도 = 목표 시점까지 모을 돈 ÷ 실제로 필요한 돈</p>
              </section>
            )}

            {hasHousing && mainHousing !== null && (
              <section className="rp-card rp-card--accent">
                <h3>
                  {placeName} {plan.housing.type} 독립까지
                </h3>
                <p className="rp-big">
                  {mainHousing}
                  <span>개월</span>
                </p>
                <p className="rp-muted">
                  {plan.scenarios.A.doneLabels.housing} 예정
                  {core.deadline !== null && mainHousing > core.deadline && (
                    <>
                      {' '}
                      · 원래 계획({core.deadlineLabel})보다 <b>{mainHousing - core.deadline}개월</b> 늦어요
                    </>
                  )}
                </p>
              </section>
            )}
          </div>

          <div className="rp-side__rest">
            <section className="rp-card">
              <h3>목적별 계획</h3>
              <ul className="cuts">
                {goals.map(goal => (
                  <li key={goal.id}>
                    <div className="cuts__text">
                      <strong>{goal.label}</strong>
                      <span className="rp-muted">
                        {goal.id === 'invest'
                          ? `매달 최대 ${fmt(goal.monthlyCap)}만 원 · ${
                              investMilestone ? `${investMilestone.label}부터` : '남는 돈이 생기면 시작'
                            }`
                          : `${fmt(goal.target)}만 원 · ${
                              plan.scenarios.A.doneLabels[goal.id]
                                ? `${plan.scenarios.A.doneLabels[goal.id]} 완성`
                                : '지금 속도로는 어려워요'
                            }`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rp-card">
              <h3>부족분 해결 방법</h3>
              {fixes.length ? (
                <ol className="fixes">
                  {fixes.map(fix => (
                    <li key={fix.kind}>
                      <span className="fixes__kind">{fix.title}</span>
                      <strong>{fix.headline}</strong>
                      <span className="rp-muted">{fix.detail}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rp-muted">지금 속도로 기한 안에 필요한 돈을 모을 수 있어요.</p>
              )}
            </section>

            {savings.length > 0 && (
              <section className="rp-card">
                <h3>아낄 수 있는 것</h3>
                <p className="rp-muted">위에서부터 차례로 줄였을 때 목표가 앞당겨지는 정도예요.</p>
                <ul className="cuts">
                  {savings.map(row => (
                    <li key={row.item}>
                      <div className="cuts__text">
                        <strong>{row.item}</strong>
                        <span className="rp-muted">
                          매달 −{row.cut}만 원 (누적 {row.totalCut}만 원)
                          {row.doneLabel ? ` · ${row.doneLabel} 완성` : ''}
                        </span>
                        <span className="cuts__bar" aria-hidden="true">
                          <span
                            style={{
                              width: `${core.monthsNeeded ? Math.min(100, ((row.sooner ?? 0) / core.monthsNeeded) * 100) : 0}%`,
                            }}
                          />
                        </span>
                      </div>
                      <span className="cuts__gain">
                        {row.sooner > 0 ? (
                          <>
                            <b>{row.sooner}개월</b> 빨라져요
                          </>
                        ) : (
                          '변화 없어요'
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {emergency && (
              <section className="rp-card">
                <h3>비상자금</h3>
                <p className="rp-mid">
                  {fmt(Math.min(profile.saved, emergency.target))} <span>/ {fmt(emergency.target)}만 원</span>
                </p>
                <div className="meter meter--emergency" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, Math.floor((profile.saved / emergency.target) * 100))}%` }} />
                </div>
                <p className="rp-muted">
                  목표의 {Math.min(100, Math.floor((profile.saved / emergency.target) * 100))}%
                  {diagnosis.surviveAfter !== null && (
                    <>
                      {' '}
                      · {hasHousing ? '독립 후 ' : ''}생활비로{' '}
                      <b>{hasHousing ? diagnosis.surviveAfter : diagnosis.surviveNow}개월</b> 버틸 수 있어요.
                    </>
                  )}{' '}
                  {plan.scenarios.A.doneLabels.emergency && `${plan.scenarios.A.doneLabels.emergency}에 목표를 채워요.`}
                </p>
              </section>
            )}

            {diagnosis.debt && (
              <section className="rp-card">
                <h3>빚 상환</h3>
                <p className="rp-mid">
                  {fmt(diagnosis.debt.remain)} <span>만 원 남음</span>
                </p>
                <p className="rp-muted">
                  {diagnosis.debt.doneLabel ? (
                    <>
                      매달 {diagnosis.debt.monthly}만 원씩 갚으면 <b>{diagnosis.debt.doneLabel}</b>에 다 갚아요 (
                      {diagnosis.debt.months}개월).
                    </>
                  ) : (
                    '매달 갚는 돈이 없어서 끝나는 때를 알 수 없어요.'
                  )}
                </p>
              </section>
            )}
          </div>
        </aside>
      </div>

      <Section number={8} title="결과 해석" className="rp-findings">
        <ul>
          {diagnosis.surviveNow !== null && (
            <li>
              지금 월급이 끊기면 모아둔 돈으로 <b>{diagnosis.surviveNow}개월</b> 버틸 수 있어요.
              {hasHousing && diagnosis.surviveAfter !== null && (
                <>
                  {' '}
                  독립 후에는 생활비가 늘어 <b>{diagnosis.surviveAfter}개월</b>로 줄어요.
                </>
              )}
            </li>
          )}
          <li>
            월급의 <b>{Math.round(cashflow.now.rate)}%</b>를 저축하고 있어요.
            {hasHousing && (
              <>
                {' '}
                독립하면 <b>{Math.round(cashflow.after.rate)}%</b>로 줄어요.
              </>
            )}
          </li>
          {plan.text.map(line => (
            <li key={line}>{line}</li>
          ))}
          {diagnosis.debt?.doneLabel && (
            <li>
              빚은 <b>{diagnosis.debt.doneLabel}</b>에 다 갚아요. 그 뒤로는 매달 {diagnosis.debt.monthly}만 원을 더 모을
              수 있어요.
            </li>
          )}
        </ul>
      </Section>

      <footer className="rp-foot">
        <p>입력한 숫자로 계산한 참고용 시뮬레이션이며 실제 결과를 보장하지 않아요. 상품 추천이 아니에요.</p>
        <p>
          비상자금 개월 수, 이사·초기 비용, 저축·주거비 기준 비율은 팀 결정과 출처 확인 전 일반적인 기준이에요. 예적금
          이자와 투자 수익률은 계산에 넣지 않았어요.
        </p>
      </footer>
    </article>
  );
}

// /report 전체 페이지 (인쇄·PDF 저장용)
export default function ReportView() {
  const { plan, demo } = usePlan();
  return (
    <>
      <SiteHeader>
        <button type="button" className="btn btn--outline btn--sm" onClick={() => window.print()}>
          인쇄 · PDF 저장
        </button>
      </SiteHeader>
      <main className="rp-page">
        <ReportSheet plan={plan} demo={demo} />
      </main>
    </>
  );
}
