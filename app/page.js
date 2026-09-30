import Link from 'next/link';
import { SiteHeader, PrivacyNote, ArrowIcon } from '../components/flow/Chrome.js';

const PREVIEW = [
  ['지금', '예상 월소득과 고정지출 파악하기'],
  ['첫 월급 후', '월 현금흐름 만들기'],
  ['3개월 후', '비상자금 마련하기'],
];

export default function Home() {
  return (
    <>
      <SiteHeader><span className="site-header__tagline">금융 정보 내비게이션</span></SiteHeader>
      <main className="home">
        <section className="home__intro">
          <h1 className="home__title">가입할 상품보다,<br />먼저 알아볼 것부터.</h1>
          <p className="home__lead">취업, 첫 월급, 독립. 지금 상황을 말해주면 무엇을 어떤 순서로 정해야 하는지 지도로 보여드려요.</p>
          <div className="home__cta">
            <Link href="/start" className="btn btn--primary btn--lg">내 상황 말해보기 <ArrowIcon /></Link>
            <PrivacyNote />
          </div>
        </section>
        <section className="card home__preview" aria-label="안내 순서 예시">
          <p className="home__preview-label">이런 순서로 알려드려요 (예시)</p>
          <ol className="mini-timeline">
            {PREVIEW.map(([when, what]) => (
              <li key={when}><strong>{when}</strong><span>{what}</span></li>
            ))}
          </ol>
          <p className="disclaimer">참고용 정보이며 상품 추천이 아니에요.</p>
        </section>
      </main>
    </>
  );
}
