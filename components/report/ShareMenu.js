'use client';
import { useEffect, useRef, useState } from 'react';
import { shareUrl } from '../../lib/report/share.js';

// 리포트 '공유' 버튼. 누르면 어디를 읽고 있든 화면 가운데에 공유 창이 떠요(브라우저 기본 dialog).
// 링크에 내 숫자가 담긴다는 안내와 함께 [링크 복사], 지원하는 기기에서는 [다른 앱으로 공유]를 보여 줘요.
// small: 결과 요약 팝업 오른쪽 위처럼 작은 버튼으로 보여줄 때
export default function ShareMenu({ profile, demo, summary, small = false, className }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [canNative, setCanNative] = useState(false);
  const ref = useRef(null);
  useEffect(() => setCanNative(typeof navigator !== 'undefined' && typeof navigator.share === 'function'), []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const url = () => shareUrl(profile, { demo });

  const copy = async () => {
    const link = url();
    try {
      await navigator.clipboard.writeText(link);
      setStatus('링크를 복사했어요. 메신저에 붙여 넣으면 돼요.');
    } catch {
      // 복사가 막힌 브라우저: 직접 고를 수 있게 보여줘요.
      window.prompt('이 링크를 복사해 주세요', link);
      setStatus('');
    }
  };
  const nativeShare = async () => {
    try {
      await navigator.share({ title: 'FinPath 맞춤 리포트', text: summary, url: url() });
      setStatus('공유했어요.');
    } catch {
      // 사용자가 취소한 경우
    }
  };

  return (
    <>
      <button
        type="button"
        className={className ?? (small ? 'icon-btn' : 'btn btn--outline btn--sm')}
        aria-haspopup="dialog"
        aria-label={small ? '공유' : undefined}
        title={small ? '공유' : undefined}
        onClick={() => {
          setStatus('');
          setOpen(true);
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v12" />
          <path d="M7 8l5-5 5 5" />
          <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
        </svg>
        {!small && '공유'}
      </button>
      <dialog
        ref={ref}
        className="share-dialog"
        aria-labelledby="share-title"
        // 공유 창은 결과 요약·리포트 팝업 안에 있어서, 닫힘 신호가 바깥 팝업까지 올라가지 않게 막아요
        onClose={event => {
          event.stopPropagation();
          setOpen(false);
        }}
        onCancel={event => event.stopPropagation()}
        onClick={event => {
          if (event.target === ref.current) setOpen(false);
        }}
      >
        {open && (
          <div className="share__panel">
            <p id="share-title" className="share__title">
              리포트 공유하기
            </p>
            <p className="share__note">
              {demo
                ? '시연 인물(정하은)의 리포트 링크예요.'
                : '링크에 내가 입력한 숫자(월급, 모아둔 돈 등)가 담겨요. 받은 사람은 같은 리포트를 보기만 할 수 있어요.'}
            </p>
            <div className="share__actions">
              <button type="button" className="btn btn--primary btn--sm" onClick={copy}>
                링크 복사
              </button>
              {canNative && (
                <button type="button" className="btn btn--outline btn--sm" onClick={nativeShare}>
                  다른 앱으로 공유
                </button>
              )}
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>
            {status && (
              <p className="share__status" role="status">
                {status}
              </p>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
