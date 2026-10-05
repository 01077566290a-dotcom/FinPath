'use client';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { buildPlanRoadmap } from '../../lib/plan/steps.js';
import { filterPolicies } from '../../lib/goal/policies.js';
import { policyData } from '../../lib/goal/policyData.js';
import { clearAll } from '../../lib/goal/store.js';
import { usePlan } from '../report/usePlan.js';
import MoneyOrder from './MoneyOrder.js';
import { SiteHeader, FlowSteps, StepProgress, PrivacyNote, Disclaimer } from './Chrome.js';
import { useFlowMode } from '../../lib/flowMode.js';
import ReportDialog from '../report/ReportDialog.js';
import SummaryDialog from '../report/SummaryDialog.js';
import TimelineTrack from './TimelineTrack.js';

// 리포트 팝업을 닫았는지 이 탭 안에서만 기억합니다. (닫은 뒤 새로고침해도 다시 튀어나오지 않게)
const REPORT_CLOSED_KEY = 'finpath-report-closed';
function readClosed() {
  try {
    return window.sessionStorage.getItem(REPORT_CLOSED_KEY) === '1';
  } catch {
    return false;
  }
}
function writeClosed(value) {
  try {
    if (value) window.sessionStorage.setItem(REPORT_CLOSED_KEY, '1');
    else window.sessionStorage.removeItem(REPORT_CLOSED_KEY);
  } catch {
    // 저장이 막혀 있어도 팝업 동작에는 문제가 없습니다.
  }
}

const DONE_KEY = 'finpath.plan-done'; // 단계 완료 표시 (이 브라우저에만 저장)
// 완료 표시는 '어떤 답으로 만든 타임라인인지'와 함께 저장해요.
// 답이 바뀌면(새로 입력, 시연 인물 ↔ 내 답) 이전 완료 표시를 쓰지 않아서, 처음 들어갔는데 완료로 보이는 일이 없어요.
const doneOwner = profile =>
  JSON.stringify([profile?.purposes, profile?.goal, profile?.money, profile?.detail, profile?.region]);
function readDone(owner) {
  try {
    const data = JSON.parse(window.localStorage.getItem(DONE_KEY) || '{}');
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.owner !== owner) return {};
    return data.done && typeof data.done === 'object' ? data.done : {};
  } catch {
    return {};
  }
}
function writeDone(done, owner = '') {
  try {
    window.localStorage.setItem(DONE_KEY, JSON.stringify({ owner, done }));
    return true;
  } catch {
    return false;
  }
}

export default function FinancialMap() {
  const router = useRouter();
  // 지도는 입력 화면(/goal)의 프로필로 계산합니다. 입력 전에는 시연 인물(정하은)로 보여 줍니다.
  const { plan, profile, demo } = usePlan();
  const roadmap = useMemo(() => buildPlanRoadmap(plan, filterPolicies(profile, policyData)), [plan, profile]);
  const [done, setDone] = useState({});
  const [persistent, setPersistent] = useState(true);
  const owner = useMemo(() => doneOwner(profile), [profile]);
  useEffect(() => setDone(readDone(owner)), [owner]);
  function toggleDone(id) {
    setDone(current => {
      const next = { ...current, [id]: !current[id] };
      if (!next[id]) delete next[id];
      if (!writeDone(next, owner)) setPersistent(false);
      return next;
    });
  }

  // ⑤ 결과: 지도에 처음 들어오면 한 화면짜리 '결과 요약'이 바로 떠요 (세 숫자 + 점수, 시연의 첫 장면).
  // 닫으면 타임라인, [전체 리포트 보기]나 '맞춤 리포트 받기'로 전체 리포트 팝업을 열어요. 이전 흐름에서는 전체 리포트가 바로 떠요.
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const reportButtonRef = useRef(null);
  const flow = useFlowMode(); // 이전 흐름으로 보기 (lib/flowMode.js)
  const [fullMap, setFullMap] = useState(false); // 기본은 한 단계씩 넘겨 보기, 누르면 전체 지도
  useEffect(() => {
    if (readClosed()) return;
    if (flow === 'classic') setReportOpen(true);
    else setSummaryOpen(true);
  }, [flow]);
  function closeSummary() {
    writeClosed(true);
    setSummaryOpen(false);
  }
  function summaryToReport() {
    setSummaryOpen(false);
    setReportOpen(true);
  }
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
    writeDone({});
    clearAll();
    router.push('/goal');
  }

  return (
    <>
      <SiteHeader back="/goal">
        <div className="site-header__actions">
          <Link href="/goal" className="site-header__link">
            답변 고치기
          </Link>
          <button type="button" ref={reportButtonRef} className="btn btn--primary btn--sm" onClick={openReport}>
            맞춤 리포트 받기
          </button>
        </div>
      </SiteHeader>
      <SummaryDialog
        open={summaryOpen}
        plan={plan}
        profile={profile}
        demo={demo}
        onClose={closeSummary}
        onOpenReport={summaryToReport}
      />
      <ReportDialog open={reportOpen} plan={plan} profile={profile} demo={demo} onClose={closeReport} />
      {flow !== 'classic' && <FlowSteps current={4} />}
      <main className="map-page">
        {flow === 'classic' && <StepProgress current={2} />}
        <MapIntro demo={demo} />
        {flow === 'classic' ? (
          <>
            <MoneyOrder plan={plan} />
            {roadmap.steps.length ? (
              <>
                <RoadmapHeading roadmap={roadmap} done={done} />
                <MapBoard roadmap={roadmap} done={done} onToggleDone={toggleDone} />
              </>
            ) : (
              <p className="card empty-map">지도에 담을 단계가 없어요. 입력 화면에서 목적을 골라 주세요.</p>
            )}
          </>
        ) : roadmap.steps.length ? (
          <>
            <TimelineTrack
              roadmap={roadmap}
              done={done}
              onToggleDone={toggleDone}
              onOpenReport={openReport}
              policyDate={policyData.checked_at}
            />
            <DemoNote demo={demo} />
            <details className="map-fold">
              <summary>
                돈의 순서 <span>매달 모으는 돈을 어디에 먼저 넣을지 (자금 배분)</span>
              </summary>
              <MoneyOrder plan={plan} />
            </details>
            <div className="map-fold-row">
              <button
                type="button"
                className="btn btn--outline btn--md"
                aria-expanded={fullMap}
                onClick={() => setFullMap(value => !value)}
              >
                {fullMap ? '전체 지도 접기' : '전체 지도로 보기'}
              </button>
            </div>
            {fullMap && (
              <>
                <RoadmapHeading roadmap={roadmap} done={done} />
                <MapBoard roadmap={roadmap} done={done} onToggleDone={toggleDone} />
              </>
            )}
          </>
        ) : (
          <p className="card empty-map">지도에 담을 단계가 없어요. 입력 화면에서 목적을 골라 주세요.</p>
        )}
        <div className="map-report-cta">
          <p>점수와 계산 방법까지, 내 숫자를 한 장으로 정리한 리포트도 볼 수 있어요.</p>
          <button type="button" className="btn btn--primary btn--md" onClick={openReport}>
            맞춤 리포트 받기
          </button>
        </div>
        <div className="map-footer">
          <PrivacyNote persistent={persistent} />
          <button type="button" className="btn btn--ghost" onClick={restart}>
            처음부터 다시 하기
          </button>
        </div>
      </main>
    </>
  );
}

function MapIntro({ demo }) {
  return (
    <div className="map-intro">
      <div className="flow-heading">
        <h1>나의 타임라인</h1>
        <p>지금부터 무엇을 어떤 순서로 하면 되는지 내 숫자로 정리했어요.</p>
      </div>
    </div>
  );
}

// 시연 인물 안내: 타임라인이 제목 바로 아래 오도록 지도 아래에 둬요.
function DemoNote({ demo }) {
  if (!demo) return null;
  return (
    <p className="info-note map-demo-note">
      지금은 시연 인물(정하은) 기준이에요. <Link href="/goal">내 돈 상황을 입력</Link>하면 내 숫자로 바뀌어요.
    </p>
  );
}

function RoadmapHeading({ roadmap, done }) {
  const doneCount = roadmap.steps.filter(step => done[step.id]).length;
  return (
    <div className="roadmap-head">
      <h2 id="roadmap-title">실행 로드맵</h2>
      <p className="roadmap-head__sub">
        언제 무엇을 해야 하는지, 번호 순서대로 따라가 보세요. 단계를 누르면 내 숫자로 환산한 설명이 열려요.
      </p>
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
          <i className="legend-swatch legend-swatch--done" />
          완료
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
                        {step.figure && <span className="map-card__badge">{step.figure}</span>}
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
              <h3>내 숫자 기준</h3>
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
          {selected.policies.length > 0 && (
            <div className="map-pop__block">
              <h3>관련 정책·제도</h3>
              <ul className="map-pop__policies">
                {selected.policies.map(policy => (
                  <li key={policy.id}>
                    <strong>{policy.name}</strong>
                    <span>{policy.summary}</span>
                    <span className="map-pop__policy-note">{policy.condition_note}</span>
                    <a href={policy.url} target="_blank" rel="noreferrer">
                      공식 안내 보기
                    </a>
                  </li>
                ))}
              </ul>
              <p className="map-pop__source">
                확인 기준일 {policyData.checked_at} · 세부 조건은 공식 안내에서 확인하세요.
              </p>
            </div>
          )}
          {selected.policies.length === 0 && (
            <p className="map-pop__source">출처: 입력한 숫자와 일반적인 기준으로 계산했어요.</p>
          )}
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
