'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ReportSheet } from './ReportSheet.js';
import ShareMenu from './ShareMenu.js';
import { useFlowMode } from '../../lib/flowMode.js';

// 지도 화면 위에 띄우는 리포트 팝업. 닫으면 뒤의 타임라인 지도가 보입니다.
// 브라우저 기본 <dialog>를 써서 포커스가 팝업 안에 머물고, Esc·바깥 클릭으로 닫힙니다.
export default function ReportDialog({ open, plan, profile, demo, onClose }) {
  const ref = useRef(null);
  const closeRef = useRef(null);
  const classic = useFlowMode() === 'classic';
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
          <strong>나의 맞춤 리포트</strong>
          <span>닫으면 타임라인 지도를 볼 수 있어요</span>
        </p>
        <div className="rp-dialog__actions">
          {classic ? (
            <Link href="/report" className="btn btn--outline btn--sm">
              값 바꾸기 · 인쇄
            </Link>
          ) : (
            <>
              <Link href="/goal" className="btn btn--ghost btn--sm hide-sm">
                답 고치기
              </Link>
              <ShareMenu
                profile={profile}
                demo={demo}
                summary={`FinPath 맞춤 리포트: 실제로 필요한 돈 ${plan.core.needed.toLocaleString()}만 원`}
              />
              {/* 인쇄는 리포트 화면에서 열자마자 인쇄 창을 띄워요 (접힌 부분까지 펼쳐서) */}
              <Link href="/report?print=1" className="btn btn--outline btn--sm">
                인쇄
              </Link>
            </>
          )}
          <button type="button" className="btn btn--primary btn--sm" ref={closeRef} onClick={onClose}>
            지도 보기
          </button>
        </div>
      </div>
      <div className="rs-page rs-page--dialog">
        {open && <ReportSheet key={demo ? 'demo' : 'mine'} plan={plan} demo={demo} />}
      </div>
    </dialog>
  );
}
