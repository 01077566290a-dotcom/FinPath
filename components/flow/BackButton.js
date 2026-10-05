'use client';
import { useRouter } from 'next/navigation';

// 헤더 왼쪽 '이전 단계' 버튼: 5단계(① 목표·내 돈 → ② 맞춤 질문 → ③ 정책 찾기 → ④ 타임라인 → ⑤ 리포트)에서 한 칸 뒤로 가요.
// 버튼에는 돌아갈 단계 이름을 보여 줘요 (예: '← ④ 타임라인').
// 질문 하나 뒤로는 입력 화면 아래의 '이전' 버튼이 맡아요.
// onBack: 같은 화면 안에서 단계를 옮길 수 있으면 처리하고 true (입력 화면의 ①~③)
export default function BackButton({ fallback = '/', label = '이전 단계', onBack }) {
  const router = useRouter();
  const goBack = () => {
    if (onBack && onBack()) return;
    router.push(fallback);
  };
  return (
    <button type="button" className="back-btn" onClick={goBack} aria-label={`이전 단계: ${label}`}>
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
