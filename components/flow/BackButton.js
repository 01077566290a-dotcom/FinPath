'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 헤더 왼쪽 '뒤로' 버튼.
// 이 탭에서 사이트 안의 다른 화면을 거쳐 왔으면 브라우저 뒤로 가기처럼 돌아가고,
// 링크로 바로 들어왔으면 흐름상 앞 단계(fallback)로 가요. (리포트 → 타임라인 → 입력 → 홈)
const VIEWS_KEY = 'finpath.views';

export default function BackButton({ fallback = '/', label = '뒤로' }) {
  const router = useRouter();
  useEffect(() => {
    try {
      const n = Number(window.sessionStorage.getItem(VIEWS_KEY) || 0);
      window.sessionStorage.setItem(VIEWS_KEY, String(n + 1));
    } catch {
      // 저장이 막혀 있으면 늘 fallback으로 가요.
    }
  }, []);

  const goBack = () => {
    let views = 0;
    try {
      views = Number(window.sessionStorage.getItem(VIEWS_KEY) || 0);
    } catch {
      views = 0;
    }
    if (views > 1 && window.history.length > 1) router.back();
    else router.push(fallback);
  };

  return (
    <button type="button" className="back-btn" onClick={goBack} aria-label={`${label} (이전 화면으로)`}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 5l-7 7 7 7" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
