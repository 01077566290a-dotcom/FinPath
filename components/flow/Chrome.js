import Link from 'next/link';
import BackButton from './BackButton.js';

// back: 뒤로 가기 버튼을 보일 때, 링크로 바로 들어온 경우 돌아갈 주소 (예: '/map')
// onBack: 화면 안에서 한 칸 뒤로 가기 (입력 화면의 이전 질문). 처리했으면 true
export function SiteHeader({ children, back, onBack }) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="site-header__left">
          {back && <BackButton fallback={back} onBack={onBack} />}
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
        </div>
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

// 서비스 흐름 5단계: ①~③ 입력(/goal) → ④ 타임라인(/map) → ⑤ 리포트(/report)
// 얇은 막대 + 이름. 헤더 아래 가운데에 놓아요. 타임라인·리포트 단계는 눌러서 갈 수 있어요.
// fill: 지금 단계 안에서 답한 비율 ({ ratio }). 주면 지금 단계 막대를 그만큼 채워요.
const FLOW = [
  { label: '목표·내 돈', href: '/goal' },
  { label: '맞춤 질문', href: '/goal' },
  { label: '정책 찾기', href: '/goal' },
  { label: '타임라인', href: '/map' },
  { label: '리포트', href: '/report' },
];
export function FlowSteps({ current, fill = null }) {
  const onGoal = current <= 3;
  return (
    <nav className="flowbar" aria-label="진행 단계">
      <ol className="stage-progress flow-steps">
        {FLOW.map((step, i) => {
          const n = i + 1;
          const isCurrent = n === current;
          const pct = isCurrent && fill ? Math.round(Math.max(0.08, fill.ratio) * 100) : null;
          // 입력 중에는 ①~③ 사이를 링크로 오가지 않아요 (질문 순서가 있어서)
          const linkable = !isCurrent && !(onGoal && n <= 3);
          const body = (
            <>
              <span
                className="stage-progress__bar"
                aria-hidden="true"
                style={
                  pct !== null
                    ? { background: `linear-gradient(to right, var(--primary) ${pct}%, var(--track) ${pct}%)` }
                    : undefined
                }
              />
              <span>
                <span className="flow-steps__n">{'①②③④⑤'[i]}</span> {step.label}
              </span>
            </>
          );
          return (
            <li
              key={step.label}
              className={n < current ? 'is-past' : isCurrent ? 'is-current' : ''}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {linkable ? (
                <Link href={step.href} className="flow-steps__link">
                  {body}
                </Link>
              ) : (
                <span className="flow-steps__link">{body}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
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
