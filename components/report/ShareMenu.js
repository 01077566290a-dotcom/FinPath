'use client';
import { useEffect, useRef, useState } from 'react';
import { shareUrl } from '../../lib/report/share.js';

// 리포트 '공유' 버튼. 누르면 작은 창이 열리고, 링크에 내 숫자가 담긴다는 안내와 함께
// [링크 복사]와 (휴대폰 등 지원하는 기기에서) [다른 앱으로 공유]를 보여 줘요.
export default function ShareMenu({ profile, demo, summary, className = 'btn btn--outline btn--sm' }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [canNative, setCanNative] = useState(false);
  const box = useRef(null);
  useEffect(() => setCanNative(typeof navigator !== 'undefined' && typeof navigator.share === 'function'), []);

  // 바깥을 누르거나 Esc를 누르면 닫혀요.
  useEffect(() => {
    if (!open) return;
    const onDown = event => {
      if (box.current && !box.current.contains(event.target)) setOpen(false);
    };
    const onKey = event => {
      if (event.key === 'Escape') {
        // 팝업 안에서 Esc는 공유 창만 닫고 리포트 팝업은 그대로 둬요
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
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
    <div className="share" ref={box}>
      <button
        type="button"
        className={className}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setStatus('');
          setOpen(value => !value);
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
        공유
      </button>
      {open && (
        <div className="share__panel" role="dialog" aria-label="리포트 공유">
          <p className="share__title">리포트 공유하기</p>
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
          </div>
          {status && (
            <p className="share__status" role="status">
              {status}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
