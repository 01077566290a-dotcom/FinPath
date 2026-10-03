'use client';
import Link from 'next/link';
import { SiteHeader, PrivacyNote, ArrowIcon } from './Chrome.js';
import { FLOW_MODES, setFlowMode, useFlowMode } from '../../lib/flowMode.js';

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

// 기획안 흐름의 홈: 큰 문장 + 벤토 그리드. 칸마다 실제 화면의 한 장면을 작게 보여줘요.
// 숫자는 시연 인물 정하은(docs/demo-persona.md) 기준이에요.
function PlanHome() {
  return (
    <main className="home2">
      <section className="home2__hero">
        <p className="home2__eyebrow">
          <i>①→⑤</i> 질문 몇 개로 끝나는 내 돈 계획
        </p>
        <h1 className="home2__title">
          얼마를 모아야 할지,
          <br />
          <span>내 숫자로</span> 알려드려요
        </h1>
        <p className="home2__lead">
          독립, 결혼, 비상자금. 목표와 지금 돈 상황을 알려주면 실제로 필요한 돈과 모으는 순서를 지도와 리포트 한 장으로
          보여드려요.
        </p>
        <div className="home2__cta">
          <Link href="/goal" className="btn btn--primary btn--lg">
            내 목표 입력하기 <ArrowIcon />
          </Link>
          <Link href="/map" className="btn btn--outline btn--lg">
            예시 결과 보기
          </Link>
        </div>
        <PrivacyNote />
      </section>

      <section className="bento" aria-label="FinPath가 보여주는 것">
        <article className="bento__cell bento__cell--wide">
          <p className="bento__step">⑤ 맞춤 리포트</p>
          <h2>생각한 목표 1,500만 원, 실제로 필요한 돈은 1,884만 원</h2>
          <div className="mini-compare" aria-label="예시: 생각한 목표, 실제로 필요한 돈, 모을 수 있는 돈">
            <div className="mini-compare__row">
              <span>생각한 목표</span>
              <span className="mini-compare__bar">
                <i style={{ width: '80%' }} />
              </span>
              <b>1,500만</b>
            </div>
            <div className="mini-compare__row mini-compare__row--need">
              <span>실제로 필요한 돈</span>
              <span className="mini-compare__bar">
                <i style={{ width: '100%' }} />
              </span>
              <b>1,884만</b>
            </div>
            <div className="mini-compare__row mini-compare__row--can">
              <span>모을 수 있는 돈</span>
              <span className="mini-compare__bar">
                <i style={{ width: '79%' }} />
              </span>
              <b>1,483만</b>
            </div>
            <span className="mini-compare__gap">401만 원 부족 · 해결 방법 3가지</span>
          </div>
        </article>

        <article className="bento__cell bento__cell--tall bento__cell--ink">
          <p className="bento__step">④ 우선순위 타임라인</p>
          <h2>무엇을 먼저 할지, 순서대로</h2>
          <p>돈의 순서와 행동의 순서를 한 장의 지도로 보여드려요.</p>
          <ol className="mini-path">
            <li className="is-done">
              비상자금 채우기<small>다음 달</small>
            </li>
            <li className="is-done">
              통장 나누기<small>자동이체</small>
            </li>
            <li>
              보증금 마련<small>1,000만</small>
            </li>
            <li>
              계약 전 확인<small>체크리스트</small>
            </li>
            <li>
              마포구 독립<small>2028년 3월</small>
            </li>
          </ol>
        </article>

        <article className="bento__cell bento__cell--third">
          <p className="bento__step">① 목표와 내 돈 상황</p>
          <h2>대략이면 충분해요</h2>
          <div className="mini-chips" aria-hidden="true">
            <span>6개월</span>
            <span className="is-on">1년</span>
            <span>2년</span>
            <span>잘 모르겠어요</span>
          </div>
        </article>

        <article className="bento__cell bento__cell--third">
          <p className="bento__step">② 지역과 목적</p>
          <h2>최대 3개까지 골라요</h2>
          <div className="mini-chips" aria-hidden="true">
            <span className="is-on">비상자금</span>
            <span className="is-on">주거</span>
            <span>결혼</span>
            <span>투자</span>
            <span>빚 상환</span>
          </div>
        </article>

        <article className="bento__cell bento__cell--third">
          <p className="bento__step">③ 목적별 상세 정보</p>
          <h2>이미 아는 건 다시 묻지 않아요</h2>
          <p>금액 대신 사실을 물어요. 목표 금액은 FinPath가 계산해요.</p>
        </article>

        <article className="bento__cell bento__cell--wide">
          <p className="bento__step">아낄 수 있는 것</p>
          <h2>구독·통신비 8만 원을 줄이면, 독립이 2개월 빨라져요</h2>
          <p>절약을 금액이 아니라 &lsquo;앞당겨지는 시간&rsquo;으로 보여드려요.</p>
          <div className="mini-sooner" aria-label="예시: 독립 시점이 2028년 3월에서 2028년 1월로 앞당겨져요">
            <span className="mini-sooner__from">
              <small>지금 속도</small>2028년 3월
            </span>
            <span className="mini-sooner__arrow" aria-hidden="true">
              →
            </span>
            <span className="mini-sooner__to">
              <small>8만 원 아끼면</small>2028년 1월
            </span>
            <b className="mini-sooner__badge">2개월 빨라져요</b>
          </div>
        </article>
      </section>

      <footer className="home2__foot">
        <p className="disclaimer">
          입력한 숫자로 계산한 참고용 시뮬레이션이며 실제 결과를 보장하지 않아요. 상품 추천이 아니에요.
        </p>
      </footer>
    </main>
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
      {classic ? (
        <main className="home">
          <section className="home__intro">
            <h1 className="home__title">
              가입할 상품보다,
              <br />
              먼저 알아볼 것부터.
            </h1>
            <p className="home__lead">
              취업, 첫 월급, 독립. 지금 상황을 말해주면 무엇을 어떤 순서로 정해야 하는지 지도로 보여드려요.
            </p>
            <div className="home__cta">
              <Link href="/start" className="btn btn--primary btn--lg">
                내 상황 말해보기 <ArrowIcon />
              </Link>
              <PrivacyNote />
            </div>
          </section>
          <section className="card home__preview" aria-label="안내 순서 예시">
            <p className="home__preview-label">이런 순서로 알려드려요 (예시)</p>
            <ol className="mini-timeline">
              {CLASSIC_PREVIEW.map(([when, what]) => (
                <li key={when}>
                  <strong>{when}</strong>
                  <span>{what}</span>
                </li>
              ))}
            </ol>
            <p className="disclaimer">참고용 정보이며 상품 추천이 아니에요.</p>
          </section>
        </main>
      ) : (
        <PlanHome />
      )}
      <FlowSwitch mode={mode} />
    </>
  );
}
