'use client';
import { useMemo } from 'react';
import { computeReport } from '../../lib/report/computeReport.js';
import { SiteHeader } from '../flow/Chrome.js';
import { ReportSheet } from './ReportSheet.js';
import ReportEditor from './ReportEditor.js';
import { useReportInput } from './useReportInput.js';

// /report 전체 페이지: 값 바꿔 보기 + 리포트 + 인쇄
export default function ReportView() {
  const { input, edited, update, reset } = useReportInput();
  const report = useMemo(() => computeReport(input), [input]);
  return (
    <>
      <SiteHeader>
        <button type="button" className="btn btn--outline btn--sm" onClick={() => window.print()}>
          인쇄 · PDF 저장
        </button>
      </SiteHeader>
      <main className="rs-page">
        <ReportEditor input={input} edited={edited} onChange={update} onReset={reset} />
        <ReportSheet report={report} edited={edited} />
      </main>
    </>
  );
}
