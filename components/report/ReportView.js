'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SiteHeader, FlowSteps } from '../flow/Chrome.js';
import { ReportSheet } from './ReportSheet.js';
import ReportEditor from './ReportEditor.js';
import ShareMenu from './ShareMenu.js';
import { usePlan } from './usePlan.js';
import { useGoalAnswers } from './useGoalAnswers.js';
import { useFlowMode } from '../../lib/flowMode.js';
import { decodeShare } from '../../lib/report/share.js';
import { buildPlan } from '../../lib/plan/index.js';
import { DEMO_ASSUMPTIONS } from '../../lib/plan/demoProfile.js';

// 인쇄할 때는 접어 둔 '자세히 보기'와 '계산 방법'까지 모두 펼쳐서 한 번에 나오게 해요.
export function printReport() {
  document.querySelectorAll('.rs details').forEach(d => {
    d.open = true;
  });
  window.print();
}
const shareText = plan =>
  `FinPath 맞춤 리포트: 실제로 필요한 돈 ${plan.core.needed.toLocaleString()}만 원, 지금 계획으로 ${plan.core.doneLabel ?? '확인 필요'}에 다 모아요.`;

// /report 전체 페이지 (⑤): 리포트 한 장 + 공유 · 인쇄.
// 주소에 ?r=…(공유 링크)가 있으면 그 리포트를 보기 전용으로 보여 주고, 내 브라우저 답은 건드리지 않아요.
// ?print=1이면 열리자마자 인쇄 창을 띄워요. (지도 위 리포트 팝업의 '인쇄' 버튼)
export default function ReportView() {
  const mine = usePlan();
  const { answers, mode, update, reset } = useGoalAnswers();
  const classic = useFlowMode() === 'classic';
  const [shared, setShared] = useState(null); // { profile, demo } | 'invalid' | null

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('r');
    if (code) setShared(decodeShare(code) ?? 'invalid');
    const openAll = () =>
      document.querySelectorAll('.rs details').forEach(d => {
        d.open = true;
      });
    window.addEventListener('beforeprint', openAll);
    let timer;
    if (params.get('print') === '1') timer = setTimeout(printReport, 700);
    return () => {
      window.removeEventListener('beforeprint', openAll);
      clearTimeout(timer);
    };
  }, []);

  const sharedPlan = useMemo(
    () =>
      shared && shared !== 'invalid' && !shared.masked
        ? buildPlan(shared.profile, shared.demo ? { assumptions: DEMO_ASSUMPTIONS } : undefined)
        : null,
    [shared],
  );

  const printButton = (
    <button type="button" className="btn btn--outline btn--sm" onClick={printReport}>
      <span>
        인쇄<span className="hide-sm"> · PDF</span>
      </span>
    </button>
  );

  // 공유받은 리포트 (보기 전용)
  if (shared?.masked)
    return (
      <>
        <SiteHeader back="/" backLabel="처음 화면" />
        <main className="rs-page">
          <section className="rs-card rs-masked" aria-labelledby="rs-masked-title">
            <p className="rs-masked__eyebrow">공유받은 FinPath 목표</p>
            <h1 id="rs-masked-title">{shared.purposes.join(' · ')}을 준비하고 있어요</h1>
            <p className="rs-masked__note">
              공유한 사람이 월급·모아둔 돈·빚과 계산 결과를 비공개로 설정해서, 목표 종류만 보여요.
            </p>
            <Link href="/goal" className="btn btn--primary btn--md">
              내 숫자로 해 보기
            </Link>
          </section>
        </main>
      </>
    );
  if (sharedPlan)
    return (
      <>
        <SiteHeader back="/" backLabel="처음 화면">
          <div className="site-header__actions">
            <Link href="/goal" className="btn btn--primary btn--sm">
              내 숫자로 해 보기
            </Link>
            {printButton}
          </div>
        </SiteHeader>
        <main className="rs-page">
          <p className="rs-shared-note">공유받은 리포트예요. 보기만 할 수 있고, 내 브라우저에는 저장되지 않아요.</p>
          <ReportSheet key="shared" plan={sharedPlan} demo={shared.demo} shared />
        </main>
      </>
    );

  const { plan, profile, demo } = mine;
  const editor = <ReportEditor answers={answers} mode={mode} onAnswer={update} onReset={reset} classic={classic} />;
  const sheet = <ReportSheet key={demo ? 'demo' : 'mine'} plan={plan} demo={demo} />;
  const share = <ShareMenu profile={profile} demo={demo} summary={shareText(plan)} />;
  const invalid = shared === 'invalid' && (
    <p className="rs-shared-note rs-shared-note--warn" role="alert">
      공유 링크가 잘못되었거나 오래되어 열 수 없어요. 대신 이 브라우저의 리포트를 보여 드려요.
    </p>
  );

  if (classic)
    return (
      <>
        <SiteHeader back="/map" backLabel="④ 타임라인">
          <div className="site-header__actions">
            {share}
            {printButton}
          </div>
        </SiteHeader>
        <main className="rs-page">
          {invalid}
          {editor}
          {sheet}
        </main>
      </>
    );

  return (
    <>
      <SiteHeader back="/map" backLabel="④ 타임라인">
        <div className="site-header__actions">
          <Link href="/goal" className="site-header__link hide-sm">
            답 고치기
          </Link>
          {share}
          {printButton}
        </div>
      </SiteHeader>
      <FlowSteps current={5} />
      <main className="rs-page">
        {invalid}
        {sheet}
        {editor}
      </main>
    </>
  );
}
