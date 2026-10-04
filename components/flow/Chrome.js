import Link from 'next/link';
import BackButton from './BackButton.js';

// back: 뒤로 가기 버튼을 보일 때, 링크로 바로 들어온 경우 돌아갈 주소 (예: '/map')
export function SiteHeader({ children, back }) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="site-header__left">
          {back && <BackButton fallback={back} />}
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
// 헤더 바로 아래 화면 폭 띠로 보여 줘요. 지난 단계는 체크, 지금 단계는 검정, 남은 단계는 회색이에요.
// fill: 지금 단계 안에서 답한 비율 ({ ratio }). 주면 지금 단계 아래 막대를 그만큼 채워요.
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
      <ol className="flowbar__list">
        {FLOW.map((step, i) => {
          const n = i + 1;
          const state = n < current ? 'is-past' : n === current ? 'is-current' : '';
          // 입력 중에는 ①~③ 사이를 링크로 오가지 않아요 (질문 순서가 있어서)
          const linkable = n !== current && !(onGoal && n <= 3);
          const body = (
            <>
              <span className="flowbar__dot" aria-hidden="true">
                {n < current ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : (
                  n
                )}
              </span>
              <span className="flowbar__label">{step.label}</span>
              {n === current && fill && (
                <span className="flowbar__fill" aria-hidden="true">
                  <i style={{ width: `${Math.round(Math.max(0.06, fill.ratio) * 100)}%` }} />
                </span>
              )}
            </>
          );
          return (
            <li key={step.label} className={`flowbar__step ${state}`} aria-current={n === current ? 'step' : undefined}>
              {linkable ? (
                <Link href={step.href} className="flowbar__link">
                  {body}
                </Link>
              ) : (
                <span className="flowbar__link">{body}</span>
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
