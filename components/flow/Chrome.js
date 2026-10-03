import Link from 'next/link';

export function SiteHeader({ children }) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="brand" aria-label="FinPath 처음으로">
          <span className="brand__mark" aria-hidden="true">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 19L12 5l7 14" />
              <path d="M8.5 13h7" />
            </svg>
          </span>
          <span className="brand__name">FinPath</span>
        </Link>
        {children}
      </div>
    </header>
  );
}

const STAGES = ['상황 말하기', '질문 답하기', '나의 지도 보기'];
export function StepProgress({ current }) {
  return (
    <ol className="stage-progress" aria-label="진행 단계">
      {STAGES.map((label, i) => (
        <li
          key={label}
          className={i < current ? 'is-past' : i === current ? 'is-current' : ''}
          aria-current={i === current ? 'step' : undefined}
        >
          <span className="stage-progress__bar" aria-hidden="true" />
          {label}
        </li>
      ))}
    </ol>
  );
}

// 기획안 v4의 서비스 흐름 5단계: ①~③ 입력(/goal) → ④ 타임라인(/map) → ⑤ 리포트(/report)
const FLOW = ['목표·내 돈', '지역·목적', '상세 정보', '타임라인', '리포트'];
export function FlowSteps({ current }) {
  return (
    <ol className="stage-progress flow-steps" aria-label="진행 단계">
      {FLOW.map((label, i) => {
        const n = i + 1;
        return (
          <li
            key={label}
            className={n < current ? 'is-past' : n === current ? 'is-current' : ''}
            aria-current={n === current ? 'step' : undefined}
          >
            <span className="stage-progress__bar" aria-hidden="true" />
            <span>
              <span className="flow-steps__n">{'①②③④⑤'[i]}</span> {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function PrivacyNote({ persistent = true }) {
  return (
    <p className="privacy-note">
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
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      <span>
        {persistent
          ? '입력한 내용은 이 브라우저에만 저장되고, 밖으로 보내지 않아요.'
          : '이 브라우저에서 저장이 막혀 있어요. 새로고침하면 입력한 내용이 사라져요.'}
      </span>
    </p>
  );
}

export function Disclaimer() {
  return (
    <p className="disclaimer">참고용 정보이며 상품 추천이 아니에요. 가입이나 계약 전에는 전문가와 상담해 보세요.</p>
  );
}

export const ArrowIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);
