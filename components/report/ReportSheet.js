'use client';
import { useMemo, useState } from 'react';
import { monthsWithExtra, savingsSeries } from '../../lib/report/computeReport.js';
import { money, monthLabel, duration } from '../../lib/report/format.js';
import { SavingsLines } from './charts.js';

const EMPLOYMENT = { regular: '정규직', contract: '계약직', freelance: '프리랜서' };
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
export function ReportSheet({ report, edited = false }) {
  const { input, core, targets, cashflow, cuts, fixes, checks, milestones, status, verdict, allocation } = report;
  const { profile, housing } = input;

  // 아낄 항목은 사용자가 직접 켜고 끕니다. 고른 만큼 숫자와 그래프가 바로 바뀝니다.
  const [picked, setPicked] = useState(() => cuts.map(cut => cut.id));
  const selected = cuts.filter(cut => picked.includes(cut.id));
  const extra = selected.reduce((total, cut) => total + cut.cut, 0);
  const monthsCut = extra > 0 ? monthsWithExtra(report, extra) : core.monthsNeeded;
  const sooner = monthsCut !== null && core.monthsNeeded !== null ? core.monthsNeeded - monthsCut : null;
  const base = useMemo(() => savingsSeries(report, 0), [report]);
  const withCut = useMemo(() => (extra > 0 ? savingsSeries(report, extra) : base), [report, extra, base]);
  const maxAnnual = Math.max(1, ...cuts.map(cut => cut.annual));
  // 아낀 결과 한 덩어리: [작은 제목, 큰 숫자, 보조 문장]
  const saveWithCut = cashflow.now.save + extra;
  const cutResult =
    extra === 0
      ? ['아낄 항목을', '골라 보세요', '숫자가 바로 바뀌어요']
      : saveWithCut <= 0
        ? ['아껴도', `매달 ${money(-saveWithCut)} 부족`, '더 줄일 항목이 필요해요']
        : sooner !== null && sooner > 0
          ? ['독립', `${duration(sooner)} 빨라져요`, `${monthLabel(input.asOf, monthsCut)} 가능`]
          : core.monthsNeeded === null && monthsCut !== null
            ? ['아끼면', monthLabel(input.asOf, monthsCut), '독립할 수 있어요']
            : ['모으는 돈', `1년 +${money(extra * 12)}`, '여유가 더 늘어요'];

  const title = profile.name ? `${profile.name} 님의 독립 자금 리포트` : '나의 독립 자금 리포트';
  const meta = [
    report.asOfLabel + ' 기준',
    [input.region, housing.type === 'jeonse' ? '전세' : '월세'].filter(Boolean).join(' '),
    [EMPLOYMENT[profile.employment], profile.tenure].filter(Boolean).join(' '),
  ].filter(Boolean);

  // 진행 막대: 모아둔 돈 · 앞으로 모을 돈 · 부족분 (전체 = 필요한 돈과 모을 돈 중 큰 값)
  const scale = Math.max(core.needed, core.collectable, 1);
  const savedW = pct(core.saved, scale);
  const futureW = pct(core.future, scale);
  const gapW = pct(core.gap, scale);
  const goalAt = core.goal > 0 ? pct(core.goal, scale) : null;
  const neededAt = pct(core.needed, scale);

  return (
    <article className="rs" aria-labelledby="rp-title">
      <header className="rs-head">
        <div>
          <h1 id="rp-title">{title}</h1>
          <p>{meta.join(' · ')}</p>
        </div>
        <span className={`rs-badge${edited ? ' rs-badge--edited' : ''}`}>
          {edited ? '직접 입력한 값' : '시연 데이터'}
        </span>
      </header>

      {/* 1. 핵심: 모을 수 있는 돈 */}
      <section className="rs-card rs-hero" aria-labelledby="rs-hero-title">
        <p id="rs-hero-title" className="rs-hero__label">
          {core.deadline}까지 모을 수 있는 돈
        </p>
        <p className="rs-hero__amount">
          {money(core.collectable, { unit: false })}
          <span>원</span>
        </p>
        <p className="rs-hero__need">
          필요한 돈 <b>{money(core.needed)}</b>
        </p>

        <div className="rs-progress" aria-hidden="true">
          <div className="rs-progress__track">
            <span className="rs-progress__saved" style={{ width: `${savedW}%` }} />
            <span className="rs-progress__future" style={{ width: `${futureW}%` }} />
            {gapW > 0 && <span className="rs-progress__gap" style={{ width: `${gapW}%` }} />}
          </div>
          <span className="rs-progress__mark rs-progress__mark--need" style={{ left: `${neededAt}%` }} />
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
              앞으로 {core.deadlineMonths}개월 모을 돈
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
          sub="줄일 항목을 골라 보세요. 숫자가 바로 바뀌어요."
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

      {/* 3. 언제 독립할 수 있을까 */}
      <Card
        id="rs-speed"
        title="언제 다 모을 수 있을까요"
        sub={
          core.monthsNeeded === 0
            ? '이미 필요한 돈을 모았어요'
            : core.monthsNeeded === null
              ? '지금 계획으로는 필요한 돈에 닿지 않아요'
              : `지금 계획 ${duration(core.monthsNeeded)}${extra > 0 && monthsCut !== null && monthsCut !== core.monthsNeeded ? ` → 아끼면 ${duration(monthsCut)}` : ''}`
        }
      >
        <SavingsLines
          base={base}
          saving={withCut}
          target={core.needed}
          deadline={core.deadlineMonths}
          savingLabel={`매달 ${money(extra)} 아끼면`}
          ariaLabel={`필요한 돈 ${money(core.needed)}. 지금 계획이면 ${core.monthsNeeded ?? '닿지 않음'}개월, 아끼면 ${monthsCut ?? '닿지 않음'}개월`}
        />
      </Card>

      {/* 4. 매달 돈의 흐름 */}
      <Card id="rs-flow" title="매달 모으는 돈" sub={`월급 ${money(cashflow.income)} 중에서`}>
        <div className="rs-flow">
          {[
            ['지금', cashflow.now],
            ['독립 후', cashflow.after],
          ].map(([label, row]) => (
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
          ))}
          <p className="rs-flow__note">
            <i className="rs-dot rs-dot--spend" aria-hidden="true" />
            쓰는 돈
            <i className="rs-dot rs-dot--future" aria-hidden="true" />
            모으는 돈 · 독립 후에는 월세·관리비 {money(cashflow.after.housing)} 포함
          </p>
          {cashflow.after.save < cashflow.now.save && (
            <Status tone={report.deficitAfter ? 'serious' : 'warning'}>
              {report.deficitAfter
                ? `독립하면 매달 ${money(-cashflow.after.save)}이 모자라요`
                : `독립하면 매달 ${money(cashflow.now.save - cashflow.after.save)} 덜 모여요 · 그래서 비상자금을 먼저 채워요`}
            </Status>
          )}
        </div>
      </Card>

      {/* 5. 필요한 돈 구성 */}
      <Card
        id="rs-need"
        title={`필요한 돈 ${money(core.needed)}`}
        sub={
          core.goal > 0 && core.goalDiff > 0
            ? `생각한 목표 ${money(core.goal)}보다 ${money(core.goalDiff)} 많아요`
            : core.goal > 0
              ? `생각한 목표 ${money(core.goal)} 안에 들어와요`
              : '목적별로 필요한 돈이에요'
        }
      >
        <ul className="rs-need">
          {[
            ['비상자금', targets.emergency, `독립 후 생활비 ${input.emergency.months}개월치`],
            ['보증금', targets.deposit, housing.type === 'jeonse' ? '전세' : '월세'],
            ['이사·초기 비용', targets.initialCost, '중개수수료·이사비·가전'],
            ...(targets.loan > 0 ? [['대출로 채울 돈', -targets.loan, '필요한 돈에서 빼요']] : []),
          ].map(([label, value, note]) => (
            <li key={label}>
              <span className="rs-need__name">
                <strong>{label}</strong>
                <span>{note}</span>
              </span>
              <span className="rs-need__bar" aria-hidden="true">
                <span style={{ width: `${pct(Math.abs(value), core.needed || 1)}%` }} />
              </span>
              <span className="rs-need__value">{value < 0 ? `−${money(-value)}` : money(value)}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* 6. 체크 포인트 (인바디식) */}
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

      {/* 7. 부족분을 채우는 방법 */}
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

      {/* 8. 앞으로의 일정 */}
      <Card id="rs-plan" title="앞으로의 일정" sub="비상자금을 먼저 채우고 독립 자금을 모아요">
        <ol className="rs-plan">
          {milestones.map(item => (
            <li key={`${item.month}-${item.title}`} className={item.muted ? 'is-muted' : ''}>
              <span className="rs-plan__date">{item.label}</span>
              <span className="rs-plan__title">{item.title}</span>
              <span className="rs-plan__text">{item.text}</span>
            </li>
          ))}
        </ol>
        {allocation.emergencyDoneLabel === null && (
          <p className="rs-note">지금 계획으로는 비상자금을 채우지 못해요. 먼저 매달 모이는 돈을 만들어야 해요.</p>
        )}
      </Card>

      <footer className="rs-foot">
        <details>
          <summary>계산 방법 보기</summary>
          <ul>
            {report.basis.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
        <p>
          입력한 숫자로 계산한 참고용 시뮬레이션이며 실제 결과를 보장하지 않아요. 상품 추천이 아니에요. 비상자금 개월
          수, 이사·초기 비용, 주거비 기준(30%)은 팀 결정과 출처 확인 전 임시값이에요.
        </p>
      </footer>
    </article>
  );
}
