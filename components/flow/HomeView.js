'use client';
import Link from 'next/link';
import { SiteHeader, PrivacyNote, ArrowIcon } from './Chrome.js';
import { FLOW_MODES, setFlowMode, useFlowMode } from '../../lib/flowMode.js';

// 기획안 v4의 서비스 흐름 5단계
const PLAN_PREVIEW = [
  ['①', '목표와 내 돈 상황', '모으고 싶은 돈과 기간, 월급·고정지출·모아둔 돈'],
  ['②', '지역과 목적 선택', '사는 곳, 비상자금·주거·결혼·투자·빚 상환 중 최대 3개'],
  ['③', '목적별 상세 정보', '고른 목적에 필요한 사실만 물어요'],
  ['④', '우선순위 타임라인', '돈의 순서와 행동의 순서를 지도로'],
  ['⑤', '맞춤 리포트', '생각한 목표 vs 실제로 필요한 돈 vs 모을 수 있는 돈'],
];
// 이전 흐름(classic)의 홈 예시
const CLASSIC_PREVIEW = [
  ['지금', '예상 월소득과 고정지출 파악하기'],
  ['첫 월급 후', '월 현금흐름 만들기'],
  ['3개월 후', '비상자금 마련하기'],
];

// 팀에서 두 흐름을 비교해 볼 때 쓰는 스위치. 고른 값은 이 브라우저에만 기억돼요.
function FlowSwitch({ mode }) {
  return (
    <div className="flow-switch" role="group" aria-label="화면 흐름 비교">
      <span>화면 흐름</span>
      {Object.entries(FLOW_MODES).map(([value, label]) => (
        <button
          key={value}
          type="button"
          className={`flow-switch__btn${mode === value ? ' is-on' : ''}`}
          aria-pressed={mode === value}
          onClick={() => setFlowMode(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function HomeView() {
  const mode = useFlowMode();
  const classic = mode === 'classic';
  return (
    <>
      <SiteHeader>
        <span className="site-header__tagline">금융 정보 내비게이션</span>
      </SiteHeader>
      <main className="home">
        <section className="home__intro">
          <h1 className="home__title">
            가입할 상품보다,
            <br />
            먼저 알아볼 것부터.
          </h1>
          <p className="home__lead">
            {classic
              ? '취업, 첫 월급, 독립. 지금 상황을 말해주면 무엇을 어떤 순서로 정해야 하는지 지도로 보여드려요.'
              : '독립, 결혼, 비상자금. 목표와 내 돈 상황을 알려주면 실제로 필요한 돈과 모으는 순서를 지도와 리포트로 보여드려요.'}
          </p>
          <div className="home__cta">
            {classic ? (
              <Link href="/start" className="btn btn--primary btn--lg">
                내 상황 말해보기 <ArrowIcon />
              </Link>
            ) : (
              <>
                <Link href="/goal" className="btn btn--primary btn--lg">
                  내 목표 입력하기 <ArrowIcon />
                </Link>
                <Link href="/map" className="btn btn--ghost btn--lg">
                  결과 화면 미리 보기
                </Link>
              </>
            )}
            <PrivacyNote />
          </div>
        </section>
        <section className="card home__preview" aria-label="안내 순서 예시">
          <p className="home__preview-label">{classic ? '이런 순서로 알려드려요 (예시)' : '이런 순서로 진행돼요'}</p>
          <ol className="mini-timeline">
            {classic
              ? CLASSIC_PREVIEW.map(([when, what]) => (
                  <li key={when}>
                    <strong>{when}</strong>
                    <span>{what}</span>
                  </li>
                ))
              : PLAN_PREVIEW.map(([n, title, what]) => (
                  <li key={n}>
                    <strong>
                      {n} {title}
                    </strong>
                    <span>{what}</span>
                  </li>
                ))}
          </ol>
          <p className="disclaimer">참고용 정보이며 상품 추천이 아니에요.</p>
        </section>
      </main>
      <FlowSwitch mode={mode} />
    </>
  );
}
