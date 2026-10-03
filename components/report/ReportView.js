'use client';
import Link from 'next/link';
import { SiteHeader, FlowSteps } from '../flow/Chrome.js';
import { ReportSheet } from './ReportSheet.js';
import ReportEditor from './ReportEditor.js';
import { usePlan } from './usePlan.js';
import { useGoalAnswers } from './useGoalAnswers.js';

// /report 전체 페이지 (기획안 ⑤): 리포트 한 장 + 인쇄.
// 답 고치기는 입력 단계(①~③, /goal의 확인 화면)에서 하고, 아래 '빠르게 숫자 바꿔 보기'는 시연용 보조 도구예요.
export default function ReportView() {
  const { plan, demo } = usePlan();
  const { answers, mode, update, reset } = useGoalAnswers();
  return (
    <>
      <SiteHeader>
        <div className="site-header__actions">
          <Link href="/goal" className="site-header__link">
            답 고치기
          </Link>
          <Link href="/map" className="site-header__link hide-sm">
            ④ 타임라인
          </Link>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => window.print()}>
            인쇄<span className="hide-sm"> · PDF 저장</span>
          </button>
        </div>
      </SiteHeader>
      <main className="rs-page">
        <FlowSteps current={5} />
        <ReportSheet key={demo ? 'demo' : 'mine'} plan={plan} demo={demo} />
        <ReportEditor answers={answers} mode={mode} onAnswer={update} onReset={reset} />
      </main>
    </>
  );
}
