'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ReportSheet } from './ReportView.js';

// 지도 화면 위에 띄우는 리포트 팝업. 닫으면 뒤의 타임라인 지도가 보입니다.
// 브라우저 기본 <dialog>를 써서 포커스가 팝업 안에 머물고, Esc·바깥 클릭으로 닫힙니다.
export default function ReportDialog({ open, report, onClose }) {
  const ref = useRef(null);
  const closeRef = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // 주된 동작인 '지도 보기'에 포커스를 둡니다.
      closeRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="rp-dialog"
      aria-labelledby="rp-title"
      onClose={onClose}
      onClick={event => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="rp-dialog__bar">
        <p className="rp-dialog__title">
          <strong>나의 돈 구성 리포트</strong>
          <span>닫으면 타임라인 지도를 볼 수 있어요</span>
        </p>
        <div className="rp-dialog__actions">
          <Link href="/report" className="btn btn--outline btn--sm">
            크게 보기 · 인쇄
          </Link>
          <button type="button" className="btn btn--primary btn--sm" ref={closeRef} onClick={onClose}>
            지도 보기
          </button>
        </div>
      </div>
      <div className="rp-page rp-page--dialog">{open && <ReportSheet report={report} />}</div>
    </dialog>
  );
}
