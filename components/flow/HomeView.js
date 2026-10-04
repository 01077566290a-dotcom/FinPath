'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteHeader, PrivacyNote, ArrowIcon } from './Chrome.js';
import { FLOW_MODES, setFlowMode, useFlowMode } from '../../lib/flowMode.js';
import { loadAnswers } from '../../lib/goal/store.js';
import { isComplete } from '../../lib/goal/engine.js';

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
// 숫자는 시연 인물 정하은(docs/demo-persona.md)을 2번 엔진으로 계산한 값이에요. 엔진 결과가 바뀌면 여기도 맞춰 주세요.
const DEMO_TAG = '시연 예시';

function DemoTag() {
  return <span className="bento__tag">{DEMO_TAG}</span>;
}

function PlanHome() {
  // 입력을 마친 사람에게는 '내 결과', 아직이면 시연 인물의 '예시 결과'로 안내해요.
  const [hasMine, setHasMine] = useState(false);
  useEffect(() => {
    const { answers } = loadAnswers();
    setHasMine(Object.keys(answers).length > 0 && isComplete(answers));
  }, []);

  return (
    <main className="home2">
      <section className="home2__hero">
        <p className="home2__eyebrow">
          <i>①→⑤</i> 내 돈 상황 입력 → 타임라인 → 리포트
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
            {hasMine ? '내 답 확인하기' : '내 목표 입력하기'} <ArrowIcon />
          </Link>
          <Link href="/map" className="btn btn--outline btn--lg">
            {hasMine ? '내 결과 보기' : '예시 결과 보기'}
          </Link>
        </div>
        <PrivacyNote />
      </section>

      <section className="bento" aria-labelledby="bento-caption">
        <p id="bento-caption" className="bento__caption">
          아래 숫자는 <b>{DEMO_TAG}</b>예요. 정하은(27세, 월급 245만 원, 서울 마포구 월세 독립 준비)의 답으로
          계산했어요.
        </p>

        <article className="bento__cell bento__cell--wide">
          <p className="bento__step">
            ⑤ 맞춤 리포트 <DemoTag />
          </p>
          <h2>생각한 목표 1,500만 원, 실제로 필요한 돈은 1,884만 원</h2>
          <div
            className="mini-compare"
            role="img"
            aria-label="시연 예시: 생각한 목표 1,500만 원, 실제로 필요한 돈 1,884만 원, 2027년 9월까지 모을 수 있는 돈 1,483만 원"
          >
            <div className="mini-compare__row">
              <span>생각한 목표</span>
              <span className="mini-compare__bar">
                <i style={{ width: '79.6%' }} />
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
                <i style={{ width: '78.7%' }} />
              </span>
              <b>1,483만</b>
            </div>
            <span className="mini-compare__gap">2027년 9월까지 401만 원 부족 · 해결 방법 3가지</span>
          </div>
        </article>

        <article className="bento__cell bento__cell--tall bento__cell--ink">
          <p className="bento__step">
            ④ 우선순위 타임라인 <DemoTag />
          </p>
          <h2>무엇을 먼저 할지, 순서대로</h2>
          <p>돈의 순서와 행동의 순서를 한 장의 지도로 보여드려요. 다 한 단계는 완료로 표시해요.</p>
          <ol className="mini-path">
            <li className="is-now">
              월 현금흐름 확인하기<small>지금</small>
            </li>
            <li>
              통장 나누고 자동이체<small>지금</small>
            </li>
            <li>
              비상자금 채우기<small>2027년 1월</small>
            </li>
            <li>
              살 집 알아보기<small>2027년 10월</small>
            </li>
            <li>
              보증금 마련하기<small>2028년 1월</small>
            </li>
          </ol>
        </article>

        <article className="bento__cell bento__cell--third">
          <p className="bento__step">① 목표와 내 돈 상황</p>
          <h2>대략 적어도 돼요</h2>
          <div className="mini-fields" aria-hidden="true">
            <span>
              <small>모으고 싶은 돈</small>1,500 <em>만 원</em>
            </span>
            <span>
              <small>기간</small>12 <em>개월</em>
            </span>
          </div>
          <p className="bento__note">모르면 &lsquo;잘 모르겠어요&rsquo;를 눌러도 돼요.</p>
        </article>

        <article className="bento__cell bento__cell--third">
          <p className="bento__step">② 지역과 목적</p>
          <h2>목적은 최대 3개까지</h2>
          <div className="mini-chips" aria-hidden="true">
            <span className="is-on">비상자금</span>
            <span className="is-on">주거</span>
            <span>결혼</span>
            <span>투자</span>
            <span>빚 상환</span>
          </div>
          <p className="bento__note">살고 싶은 지역에 맞는 청년 정책도 찾아요.</p>
        </article>

        <article className="bento__cell bento__cell--third bento__cell--fill">
          <p className="bento__step">③ 목적별 상세 정보</p>
          <h2>고른 목적에 필요한 것만 물어요</h2>
          <p>주거를 고르면 보증금·월세·입주 시기를 물어요. 비상자금은 앞에서 받은 답으로 계산해서 더 묻지 않아요.</p>
        </article>

        <article className="bento__cell bento__cell--wide">
          <p className="bento__step">
            아낄 수 있는 것 <DemoTag />
          </p>
          <h2>구독·통신비 8만 원을 줄이면, 준비가 2개월 빨라져요</h2>
          <p>절약을 금액이 아니라 &lsquo;앞당겨지는 시간&rsquo;으로 보여드려요.</p>
          <div
            className="mini-sooner"
            role="img"
            aria-label="시연 예시: 준비가 끝나는 달이 2028년 3월에서 2028년 1월로 앞당겨져요"
          >
            <span className="mini-sooner__from">
              <small>지금 속도</small>2028년 3월
            </span>
            <span className="mini-sooner__arrow" aria-hidden="true">
              →
            </span>
            <span className="mini-sooner__to">
              <small>매달 8만 원 아끼면</small>2028년 1월
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
