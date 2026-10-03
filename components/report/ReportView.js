'use client';
import {
  COLOR,
  METRIC_ROW_COLOR,
  CompareBars,
  StackedBars,
  CashflowBars,
  SavingsLines,
  MetricBar,
  MilestoneTimeline,
} from './charts.js';
import { SiteHeader } from '../flow/Chrome.js';

const fmt = value => Math.round(value).toLocaleString();
const EMPLOYMENT = { regular: '정규직', contract: '계약직', freelance: '프리랜서' };
const PURPOSE = { housing: '주거', emergency: '비상자금', marriage: '결혼', invest: '투자', debt: '빚 상환' };
const TONE_COLOR = {
  now: 'var(--c-muted-strong)',
  emergency: COLOR.emergency,
  missed: '#ffffff',
  saving: COLOR.saving,
  housing: COLOR.housing,
  debt: COLOR.initial,
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

// 리포트 본문 한 장. /report 페이지와 지도 화면의 팝업에서 함께 씁니다.
export function ReportSheet({ report }) {
  const {
    input,
    core,
    targets,
    cashflow,
    savings,
    fixes,
    diagnosis,
    allocation,
    highlight,
    metrics,
    milestones,
    basis,
  } = report;
  const { profile, housing, money } = input;
  const emergencyRate = Math.min(100, Math.floor((money.saved / targets.emergency) * 100));
  const future = core.collectable - money.saved;

  const compareRows = [
    {
      label: '내가 생각한 목표',
      value: core.goal,
      color: COLOR.muted,
      note: `처음에 "${core.goalMonths}개월 동안 ${fmt(core.goal)}만 원"으로 입력했어요`,
    },
    {
      label: '실제로 필요한 돈',
      value: core.needed,
      color: COLOR.needed,
      strong: true,
      note: '비상자금 + 보증금 + 이사·초기 비용',
    },
    {
      label: `${core.deadline}까지 모을 돈`,
      value: core.collectable,
      color: COLOR.saving,
      shortfallTo: core.needed,
      note: `지금 모아둔 ${fmt(money.saved)} + 매달 ${cashflow.now.save} × ${core.deadlineMonths}개월`,
    },
  ];

  return (
    <article className="rp-sheet" aria-labelledby="rp-title">
      <header className="rp-head">
        <div className="rp-head__title">
          <p className="rp-head__brand">FinPath</p>
          <h1 id="rp-title">돈 구성 리포트</h1>
          <span className="rp-head__badge">시연 데이터</span>
        </div>
        <dl className="rp-head__meta">
          <div>
            <dt>이름</dt>
            <dd>
              {profile.name} ({profile.age}세)
            </dd>
          </div>
          <div>
            <dt>직장</dt>
            <dd>
              {profile.tenure} · {EMPLOYMENT[profile.employment]}
            </dd>
          </div>
          <div>
            <dt>월 실수령액</dt>
            <dd>{fmt(money.income)}만 원</dd>
          </div>
          <div>
            <dt>지역</dt>
            <dd>{input.region}</dd>
          </div>
          <div>
            <dt>목적</dt>
            <dd>{input.purposes.map(key => PURPOSE[key]).join(' · ')}</dd>
          </div>
          <div>
            <dt>기준 시점</dt>
            <dd>{report.asOfLabel}</dd>
          </div>
        </dl>
      </header>

      <p className="rp-summary">{report.summary}</p>

      <div className="rp-grid">
        <div className="rp-main">
          <Section number={1} title="목표 진단" sub="내가 생각한 목표 vs 실제로 필요한 돈">
            <p className="rp-lead">
              생각한 목표는 <b>{fmt(core.goal)}만 원</b>이었지만, 실제로 필요한 돈은 <b>{fmt(core.needed)}만 원</b>
              이에요. 독립 후 생활비 {input.emergency.months}개월치 비상자금 <b>{fmt(targets.emergency)}만 원</b>이 빠져
              있었어요.
            </p>
            <CompareBars
              rows={compareRows}
              max={2000}
              ticks={[0, 500, 1000, 1500, 2000]}
              ariaLabel={`생각한 목표 ${core.goal}만 원, 실제로 필요한 돈 ${core.needed}만 원, ${core.deadline}까지 모을 돈 ${core.collectable}만 원, 부족 ${core.gap}만 원`}
            />
            <div className="rp-more-row">
              <Basis lines={basis.goal} />
              <TableView
                caption="목표 진단"
                head={['구분', '금액(만 원)', '설명']}
                rows={[
                  ...compareRows.map(row => [row.label, fmt(row.value), row.note]),
                  ['부족한 돈', fmt(core.gap), '실제로 필요한 돈 − 모을 돈'],
                ]}
              />
            </div>
          </Section>

          <Section number={2} title="돈 구성 분석" sub={`단위: 만 원 · ${core.deadline} 기준`}>
            <StackedBars
              max={core.needed}
              ariaLabel={`필요한 돈은 비상자금 ${targets.emergency}, 보증금 ${housing.deposit}, 이사·초기 비용 ${targets.initialCost}. 마련할 돈은 모아둔 돈 ${money.saved}, 앞으로 모을 돈 ${future}, 부족 ${core.gap}`}
              rows={[
                {
                  label: '필요한 돈',
                  parts: [
                    { label: '비상자금', short: '비상자금', value: targets.emergency, color: COLOR.emergency },
                    { label: '보증금', short: '보증금', value: housing.deposit, color: COLOR.housing },
                    {
                      label: '이사·초기 비용',
                      short: '초기 비용',
                      value: targets.initialCost,
                      color: COLOR.initial,
                    },
                  ],
                },
                {
                  label: '마련할 돈',
                  track: core.needed,
                  trackLabel: `부족 ${fmt(core.gap)}`,
                  trackShort: fmt(core.gap),
                  parts: [
                    { label: '지금 모아둔 돈', short: '모아둔 돈', value: money.saved, color: COLOR.saved },
                    {
                      label: `앞으로 ${core.deadlineMonths}개월 모을 돈`,
                      short: '앞으로',
                      value: future,
                      color: COLOR.saving,
                      ink: '#0b0b0b',
                    },
                  ],
                },
              ]}
            />
            <div className="rp-legend-grid">
              <span className="rp-legend-grid__label">필요한 돈</span>
              <Legend
                items={[
                  { label: `비상자금 ${fmt(targets.emergency)}`, color: COLOR.emergency },
                  { label: `보증금 ${fmt(housing.deposit)}`, color: COLOR.housing },
                  { label: `이사·초기 비용 ${fmt(targets.initialCost)}`, color: COLOR.initial },
                ]}
              />
              <span className="rp-legend-grid__label">마련할 돈</span>
              <Legend
                items={[
                  { label: `지금 모아둔 돈 ${fmt(money.saved)}`, color: COLOR.saved },
                  { label: `앞으로 ${core.deadlineMonths}개월 모을 돈 ${fmt(future)}`, color: COLOR.saving },
                  { label: `부족 ${fmt(core.gap)}`, track: true },
                ]}
              />
            </div>
          </Section>

          <Section number={3} title="월 현금흐름" sub="월급이 어디로 가는지 · 단위: 만 원">
            <CashflowBars
              income={cashflow.income}
              ariaLabel={`지금은 쓰는 돈 ${cashflow.now.spend}, 모으는 돈 ${cashflow.now.save}. 독립 후에는 생활비 ${cashflow.parts.after.living}, 주거비 ${cashflow.parts.after.housing}, 모으는 돈 ${cashflow.after.save}`}
              rows={[
                {
                  label: '지금',
                  save: cashflow.now.save,
                  parts: [
                    {
                      key: 'living',
                      label: '생활비',
                      short: '생활비',
                      value: cashflow.parts.now.living,
                      color: COLOR.base,
                    },
                    {
                      key: 'save',
                      label: '모으는 돈',
                      short: '저축',
                      value: cashflow.parts.now.save,
                      color: COLOR.saving,
                      ink: '#0b0b0b',
                    },
                  ],
                },
                {
                  label: '독립 후',
                  save: cashflow.after.save,
                  parts: [
                    {
                      key: 'living',
                      label: '생활비',
                      short: '생활비',
                      value: cashflow.parts.after.living,
                      color: COLOR.base,
                    },
                    {
                      key: 'housing',
                      label: '월세 + 관리비',
                      short: '주거비',
                      value: cashflow.parts.after.housing,
                      color: COLOR.housing,
                    },
                    {
                      key: 'save',
                      label: '모으는 돈',
                      short: '저축',
                      value: cashflow.parts.after.save,
                      color: COLOR.saving,
                      ink: '#0b0b0b',
                    },
                  ],
                },
              ]}
            />
            <Legend
              items={[
                { label: '생활비 (고정지출 + 변동 생활비)', color: COLOR.base },
                { label: '주거비 (월세 + 관리비)', color: COLOR.housing },
                { label: '모으는 돈', color: COLOR.saving },
              ]}
            />
            <p className="rp-callout">
              독립하면 매달 나가는 돈이 <b>{diagnosis.spendIncrease}만 원</b> 늘어, 모으는 돈이{' '}
              <b>
                {cashflow.now.save}만 원 → {cashflow.after.save}만 원
              </b>
              으로 줄어요. 그래서 비상자금을 <b>독립 전에</b> 먼저 채워요.
            </p>
            <div className="rp-more-row">
              <Basis lines={basis.cashflow} />
              <TableView
                caption="월 현금흐름"
                head={['항목', '지금', '독립 후']}
                rows={[
                  ['실수령액', money.income, money.income],
                  ...money.fixed.map(item => [item.label, item.now, item.after]),
                  ['월세 + 관리비', 0, cashflow.housingCost],
                  ['변동 생활비', money.variable.now, money.variable.after],
                  ['모으는 돈', cashflow.now.save, cashflow.after.save],
                ]}
              />
            </div>
          </Section>

          <Section number={4} title="핵심 지표 분석" sub="막대 길이가 기준선·범위와 어디쯤인지 보세요">
            <div className="metrics__legend">
              <Legend
                items={[
                  { label: '지금', color: METRIC_ROW_COLOR.now },
                  { label: '독립 후', color: METRIC_ROW_COLOR.after },
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
                    {metric.marker && <span className="metric__note">{metric.note}</span>}
                    {!metric.marker && !metric.band && metric.note && (
                      <span className="metric__note">{metric.note}</span>
                    )}
                    {metric.band && metric.note && <span className="metric__note">{metric.note}</span>}
                    <StatusChip tone={metric.status.tone} text={metric.status.text} />
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section number={5} title="모으는 속도" sub="독립 전 저축 속도 기준 · 선이 필요한 돈에 닿으면 독립">
            <SavingsLines
              data={report.series}
              target={core.needed}
              deadline={{ month: core.deadlineMonths, label: `원래 계획 ${core.deadline}` }}
              ariaLabel={`지금 계획이면 ${core.monthsNeeded}개월 뒤, 매달 ${highlight.totalCut}만 원 절약하면 ${highlight.months}개월 뒤 필요한 돈 ${core.needed}만 원에 닿아요`}
              series={[
                {
                  key: 'base',
                  color: COLOR.base,
                  label: `지금 계획 (매달 ${cashflow.now.save}만 원)`,
                  short: '지금 계획',
                },
                {
                  key: 'saving',
                  color: COLOR.saving,
                  label: `구독·통신비 ${highlight.totalCut}만 원 절약 (매달 ${cashflow.now.save + highlight.totalCut}만 원)`,
                  short: '절약 시',
                },
              ]}
            />
            <div className="rp-more-row">
              <Basis lines={basis.speed} />
              <TableView
                caption="모으는 속도"
                head={['시점', '지금 계획(만 원)', '절약 시(만 원)']}
                rows={report.series
                  .filter(d => d.month % 3 === 0 || d.month === core.monthsNeeded || d.month === highlight.months)
                  .map(d => [d.label, fmt(d.base), fmt(d.saving)])}
              />
            </div>
          </Section>

          <Section number={6} title="앞으로의 일정" sub="비상자금을 먼저 채운 뒤 주거 자금을 모으는 순서">
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
        </div>

        <aside className="rp-side">
          {/* 좁은 화면에서는 이 묶음을 요약 바로 아래로 올립니다 (globals.css .rp-side__top) */}
          <div className="rp-side__top">
            <section className="rp-score" aria-labelledby="score-title">
              <h2 id="score-title">준비도</h2>
              <p className="rp-score__value">
                {core.readiness}
                <span>%</span>
              </p>
              <div className="meter meter--dark" aria-hidden="true">
                <span style={{ width: `${core.readiness}%` }} />
              </div>
              <p className="rp-score__text">
                {core.deadline}까지 필요한 돈의 <b>{core.readiness}%</b>를 모을 수 있어요. <b>{fmt(core.gap)}만 원</b>이
                부족해요.
              </p>
              <p className="rp-score__help">준비도 = 목표 시점까지 모을 돈 ÷ 실제로 필요한 돈</p>
            </section>

            <section className="rp-card rp-card--accent">
              <h3>{input.region.split(' ').at(-1)} 월세 독립까지</h3>
              <p className="rp-big">
                {core.monthsNeeded}
                <span>개월</span>
              </p>
              <p className="rp-muted">
                {core.doneLabel} 예정 · 원래 계획({core.deadline})보다 <b>{core.delay}개월</b> 늦어요
              </p>
            </section>
          </div>

          <div className="rp-side__rest">
            <section className="rp-card">
              <h3>부족분 해결 방법</h3>
              <ol className="fixes">
                {fixes.map(fix => (
                  <li key={fix.kind}>
                    <span className="fixes__kind">{fix.title}</span>
                    <strong>{fix.headline}</strong>
                    <span className="rp-muted">{fix.detail}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rp-card">
              <h3>아낄 수 있는 것</h3>
              <p className="rp-muted">위에서부터 차례로 줄였을 때 독립이 앞당겨지는 정도예요.</p>
              <ul className="cuts">
                {savings.map(row => (
                  <li key={row.label}>
                    <div className="cuts__text">
                      <strong>{row.label}</strong>
                      <span className="rp-muted">
                        매달 −{row.cut}만 원 (누적 {row.totalCut}만 원) · {row.doneLabel} 독립
                      </span>
                      <span className="cuts__bar" aria-hidden="true">
                        <span style={{ width: `${(row.sooner / core.monthsNeeded) * 100}%` }} />
                      </span>
                    </div>
                    <span className="cuts__gain">
                      <b>{row.sooner}개월</b> 빨라져요
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rp-card">
              <h3>비상자금</h3>
              <p className="rp-mid">
                {fmt(money.saved)} <span>/ {fmt(targets.emergency)}만 원</span>
              </p>
              <div className="meter meter--emergency" aria-hidden="true">
                <span style={{ width: `${emergencyRate}%` }} />
              </div>
              <p className="rp-muted">
                목표의 {emergencyRate}% · 독립 후 생활비로 <b>{diagnosis.surviveAfter}개월</b> 버틸 수 있어요.{' '}
                {allocation.emergencyDoneLabel}에 목표를 채워요.
              </p>
            </section>

            {diagnosis.debt && (
              <section className="rp-card">
                <h3>{diagnosis.debt.label}</h3>
                <p className="rp-mid">
                  {fmt(diagnosis.debt.balance)} <span>만 원 남음</span>
                </p>
                <p className="rp-muted">
                  매달 {diagnosis.debt.monthly}만 원씩 갚으면 <b>{diagnosis.debt.doneLabel}</b>에 다 갚아요 (
                  {diagnosis.debt.months}개월).
                </p>
              </section>
            )}
          </div>
        </aside>
      </div>

      <Section number={7} title="결과 해석" className="rp-findings">
        <ul>
          <li>
            지금 월급이 끊기면 모아둔 돈으로 <b>{diagnosis.surviveNow}개월</b> 버틸 수 있어요. 독립 후에는 생활비가 늘어{' '}
            <b>{diagnosis.surviveAfter}개월</b>로 줄어요.
          </li>
          <li>
            월급의 <b>{Math.round(cashflow.now.rate)}%</b>를 저축하고 있지만, 독립하면{' '}
            <b>{Math.round(cashflow.after.rate)}%</b>로 줄어요. 그래서 비상자금을 독립 전에 먼저 채워요.
          </li>
          <li>
            모아둔 {fmt(money.saved)}만 원이면 비상자금은 <b>{allocation.emergencyDoneLabel}</b>에 채워지고, 그다음부터
            매달 {cashflow.now.save}만 원이 독립 자금으로 가요.
          </li>
          <li>
            구독과 통신비 <b>{highlight.totalCut}만 원</b>을 줄이면 독립이 <b>{highlight.sooner}개월</b> 빨라져요(
            {highlight.doneLabel}).
          </li>
          {diagnosis.debt && (
            <li>
              {diagnosis.debt.label}은 <b>{diagnosis.debt.doneLabel}</b>에 다 갚아요. 그 뒤로는 매달{' '}
              {diagnosis.debt.monthly}만 원을 더 모을 수 있어요.
            </li>
          )}
        </ul>
      </Section>

      <footer className="rp-foot">
        <p>입력한 숫자로 계산한 참고용 시뮬레이션이며 실제 결과를 보장하지 않아요. 상품 추천이 아니에요.</p>
        <p>
          비상자금 개월 수({input.emergency.months}개월), 이사·초기 비용, 주거비 기준(30%)은 팀 결정과 출처 확인 전
          임시값이에요. 예적금 이자는 계산에 넣지 않았어요.
        </p>
      </footer>
    </article>
  );
}

// /report 전체 페이지 (인쇄·PDF 저장용)
export default function ReportView({ report }) {
  return (
    <>
      <SiteHeader>
        <button type="button" className="btn btn--outline btn--sm" onClick={() => window.print()}>
          인쇄 · PDF 저장
        </button>
      </SiteHeader>
      <main className="rp-page">
        <ReportSheet report={report} />
      </main>
    </>
  );
}
