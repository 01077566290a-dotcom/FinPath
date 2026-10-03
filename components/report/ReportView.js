'use client';
import { SiteHeader } from '../flow/Chrome.js';
import { ReportSheet } from './ReportSheet.js';
import ReportEditor from './ReportEditor.js';
import { usePlan } from './usePlan.js';
import { useGoalAnswers } from './useGoalAnswers.js';

// /report 전체 페이지: 내 숫자로 바꿔 보기(입력 화면의 답) + 리포트(2번 엔진 결과) + 인쇄
export default function ReportView() {
  const { plan, demo } = usePlan();
  const { answers, mode, update, reset } = useGoalAnswers();
  return (
    <>
      <SiteHeader>
        <button type="button" className="btn btn--outline btn--sm" onClick={() => window.print()}>
          인쇄 · PDF 저장
        </button>
      </SiteHeader>
      <main className="rs-page">
        <ReportEditor answers={answers} mode={mode} onAnswer={update} onReset={reset} />
        <ReportSheet key={demo ? 'demo' : 'mine'} plan={plan} demo={demo} />
      </main>
    </>
  );
}
