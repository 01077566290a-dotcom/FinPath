'use client';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { buildRoadmap } from '../../lib/roadmap.js';
import { createFlow } from '../../lib/flowStore.js';
import { useFlow } from './useFlow.js';
import { SiteHeader, StepProgress, PrivacyNote, Disclaimer } from './Chrome.js';
import ReportDialog from '../report/ReportDialog.js';
import { computeReport } from '../../lib/report/computeReport.js';
import { useReportInput } from '../report/useReportInput.js';

// 리포트 팝업을 닫았는지 이 탭 안에서만 기억합니다. (닫은 뒤 새로고침해도 다시 튀어나오지 않게)
const REPORT_CLOSED_KEY = 'finpath-report-closed';
const readClosed = () => {
  try {
    return window.sessionStorage.getItem(REPORT_CLOSED_KEY) === '1';
  } catch {
    return false;
  }
};
const writeClosed = value => {
  try {
    if (value) window.sessionStorage.setItem(REPORT_CLOSED_KEY, '1');
    else window.sessionStorage.removeItem(REPORT_CLOSED_KEY);
  } catch {
    // 저장이 막혀 있어도 팝업 동작에는 문제가 없습니다.
  }
};

const REDIRECT = { unrecognized: '/questions', collecting: '/questions', not_applicable: '/questions' };

export default function FinancialMap() {
  const router = useRouter();
  const { flow, update, persistent } = useFlow();
  const engine = flow?.engine;
  const roadmap = useMemo(() => (engine ? buildRoadmap(engine) : null), [engine]);
  const redirect = roadmap && REDIRECT[roadmap.status];
  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  // ⑤ 리포트: /report에서 직접 입력한 값이 있으면 그 값으로, 없으면 시연 인물 값으로 계산합니다.
  const { input: reportInput, edited: reportEdited } = useReportInput();
  const report = useMemo(() => computeReport(reportInput), [reportInput]);
  const ready = Boolean(roadmap && !redirect);
  const [reportOpen, setReportOpen] = useState(false);
  const reportButtonRef = useRef(null);
  useEffect(() => {
    if (ready && !readClosed()) setReportOpen(true);
  }, [ready]);
  function openReport() {
    writeClosed(false);
    setReportOpen(true);
  }
  function closeReport() {
    writeClosed(true);
    setReportOpen(false);
    requestAnimationFrame(() => reportButtonRef.current?.focus());
  }

  function restart() {
    writeClosed(false);
    update(createFlow());
    router.push('/start');
  }

  return (
    <>
      <SiteHeader>
        <div className="site-header__actions">
          <Link href="/questions" className="site-header__link">
            답변 고치기
          </Link>
          {ready && (
            <button type="button" ref={reportButtonRef} className="btn btn--primary btn--sm" onClick={openReport}>
              내 리포트 보기
            </button>
          )}
        </div>
      </SiteHeader>
      {ready && <ReportDialog open={reportOpen} report={report} edited={reportEdited} onClose={closeReport} />}
      <main className="map-page">
        <StepProgress current={2} />
        {roadmap && !redirect && (
          <>
            <MapIntro roadmap={roadmap} done={flow.done} />
            {roadmap.steps.length ? (
              <MapBoard
                roadmap={roadmap}
                done={flow.done}
                onToggleDone={id =>
                  update(current => ({ ...current, done: { ...current.done, [id]: !current.done[id] } }))
                }
              />
            ) : (
              <p className="card empty-map">
                아직 정해진 계획이 없어서 지도에 담을 단계가 없어요. 계획이 정해지면 답변을 고쳐 주세요.
              </p>
            )}
            <div className="map-footer">
              <PrivacyNote persistent={persistent} />
              <button type="button" className="btn btn--ghost" onClick={restart}>
                처음부터 다시 하기
              </button>
            </div>
          </>
        )}
      </main>
    </>
  );
}

function MapIntro({ roadmap, done }) {
  const doneCount = roadmap.steps.filter(step => done[step.id]).length;
  return (
    <div className="map-intro">
      <div className="flow-heading">
        <h1>나의 금융 지도</h1>
        <p>번호 순서대로 따라가 보세요. 단계를 누르면 설명이 열려요.</p>
      </div>
      {roadmap.deferred.length > 0 && (
        <p className="info-note">
          보류한 계획: {roadmap.deferred.join(', ')}. 정해지면 ‘답변 고치기’에서 상태를 바꿔 지도에 넣을 수 있어요.
        </p>
      )}
      <div className="map-legend">
        <span>
          <i className="legend-swatch legend-swatch--selected" />
          선택한 단계
        </span>
        <span>
          <i className="legend-swatch legend-swatch--first" />
          먼저 볼 단계
        </span>
        <span>
          <i className="legend-number">1</i>번호는 진행 순서
        </span>
        {roadmap.steps.length > 0 && (
          <span className="map-legend__progress">
            {doneCount} / {roadmap.steps.length} 완료
          </span>
        )}
      </div>
    </div>
  );
}

function MapBoard({ roadmap, done, onToggleDone }) {
  const [selectedId, setSelectedId] = useState(null);
  const [popTop, setPopTop] = useState(0);
  const [minHeight, setMinHeight] = useState(undefined);
  const trackRef = useRef(null);
  const popRef = useRef(null);
  const titleRef = useRef(null);
  const rowRefs = useRef({});
  const cardRefs = useRef({});

  const selected = roadmap.steps.find(step => step.id === selectedId) || null;
  const prerequisites = selected ? selected.first : [];
  const side = step => (step.number % 2 === 1 ? 'left' : 'right');
  const byId = id => roadmap.steps.find(step => step.id === id);

  // 말풍선을 선택한 단계 높이에 맞추되 지도 아래로 벗어나지 않게 합니다.
  useLayoutEffect(() => {
    if (!selected) {
      setMinHeight(undefined);
      return;
    }
    const row = rowRefs.current[selected.id],
      pop = popRef.current,
      track = trackRef.current;
    if (!row || !pop || !track) return;
    const trackHeight = track.offsetHeight,
      popHeight = pop.offsetHeight;
    const desired = row.offsetTop + row.offsetHeight / 2 - 150;
    setPopTop(Math.max(0, Math.min(desired, trackHeight - popHeight)));
    setMinHeight(popHeight > trackHeight ? popHeight : undefined);
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    titleRef.current?.focus({ preventScroll: true });
    const onKey = event => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  function close() {
    const id = selectedId;
    setSelectedId(null);
    cardRefs.current[id]?.focus();
  }

  return (
    <div className="map" style={{ minHeight }}>
      <div className="map__track" ref={trackRef}>
        <span className="map__spine" aria-hidden="true" />
        <div className="map__root">
          <strong>나의 상황</strong>
          <span>{roadmap.situation.join(' · ')}</span>
        </div>
        {roadmap.groups.map(group => (
          <Fragment key={group.phase}>
            <div className="map__phase">
              <span>{group.label}</span>
            </div>
            {group.steps.map(step => {
              const state = step.id === selectedId ? 'is-selected' : prerequisites.includes(step.id) ? 'is-first' : '';
              return (
                <div
                  key={step.id}
                  className={`map__row map__row--${side(step)}`}
                  ref={el => {
                    rowRefs.current[step.id] = el;
                  }}
                >
                  <div className="map__cell">
                    <button
                      type="button"
                      ref={el => {
                        cardRefs.current[step.id] = el;
                      }}
                      className={`map-card ${state} ${done[step.id] ? 'is-done' : ''}`}
                      aria-pressed={step.id === selectedId}
                      aria-label={`${step.number}번 ${step.title}${done[step.id] ? ' (완료)' : ''}`}
                      onClick={() => setSelectedId(current => (current === step.id ? null : step.id))}
                    >
                      <span className="map-card__text">
                        <span>{step.title}</span>
                        {step.personal.length > 0 && <span className="map-card__badge">내 답변 반영</span>}
                      </span>
                    </button>
                    <i className="map__link" aria-hidden="true" />
                  </div>
                  <span className={`map-dot ${state} ${done[step.id] ? 'is-done' : ''}`} aria-hidden="true">
                    {done[step.id] ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12l5 5 9-10" />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </span>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      {selected && (
        <section
          ref={popRef}
          className={`map-pop map-pop--${side(selected) === 'left' ? 'right' : 'left'}`}
          style={{ '--pop-top': `${popTop}px` }}
          aria-labelledby="map-pop-title"
        >
          <div className="map-pop__head">
            <div>
              <p className="map-pop__meta">
                {selected.phaseLabel} · {selected.tags.join(' · ')}
              </p>
              <h2 id="map-pop-title" ref={titleRef} tabIndex={-1}>
                {selected.title}
              </h2>
            </div>
            <button type="button" className="btn btn--outline btn--sm" onClick={close}>
              닫기
            </button>
          </div>
          {selected.first.length > 0 && (
            <p className="map-pop__first">
              먼저 보세요: {selected.first.map(id => `${byId(id).number}번 ${byId(id).title}`).join(' / ')}
            </p>
          )}
          {selected.note && <p className="info-note">{selected.note}</p>}
          {selected.personal.length > 0 && (
            <div className="map-pop__personal">
              <h3>내 답변 기준</h3>
              <ul>
                {selected.personal.map(line => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="map-pop__block">
            <h3>왜 지금 알아봐야 하나요</h3>
            <p>{selected.why}</p>
          </div>
          <div className="map-pop__block">
            <h3>이렇게 해보세요</h3>
            <ol className="how-list">
              {selected.how.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
          <div className="map-pop__block">
            <h3>다음 단계</h3>
            <p>{selected.next}</p>
          </div>
          <p className="map-pop__source">출처: [공식 기관 자료 연결 예정]</p>
          <Disclaimer />
          <button
            type="button"
            className={`btn ${done[selected.id] ? 'btn--done' : 'btn--primary'} btn--md`}
            aria-pressed={Boolean(done[selected.id])}
            onClick={() => onToggleDone(selected.id)}
          >
            {done[selected.id] ? '완료했어요' : '완료로 표시하기'}
          </button>
        </section>
      )}
    </div>
  );
}
