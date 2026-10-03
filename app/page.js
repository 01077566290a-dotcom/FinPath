import Link from 'next/link';
import { SiteHeader, PrivacyNote, ArrowIcon } from '../components/flow/Chrome.js';

// 기획안 v4의 서비스 흐름 5단계
const PREVIEW = [
  ['①', '목표와 내 돈 상황', '모으고 싶은 돈과 기간, 월급·고정지출·모아둔 돈'],
  ['②', '지역과 목적 선택', '사는 곳, 비상자금·주거·결혼·투자·빚 상환 중 최대 3개'],
  ['③', '목적별 상세 정보', '고른 목적에 필요한 사실만 물어요'],
  ['④', '우선순위 타임라인', '돈의 순서와 행동의 순서를 지도로'],
  ['⑤', '맞춤 리포트', '생각한 목표 vs 실제로 필요한 돈 vs 모을 수 있는 돈'],
];

export default function Home() {
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
            독립, 결혼, 비상자금. 목표와 내 돈 상황을 알려주면 실제로 필요한 돈과 모으는 순서를 지도와 리포트로
            보여드려요.
          </p>
          <div className="home__cta">
            <Link href="/goal" className="btn btn--primary btn--lg">
              내 목표 입력하기 <ArrowIcon />
            </Link>
            <Link href="/map" className="btn btn--ghost btn--lg">
              결과 화면 미리 보기
            </Link>
            <PrivacyNote />
          </div>
        </section>
        <section className="card home__preview" aria-label="안내 순서 예시">
          <p className="home__preview-label">이런 순서로 진행돼요</p>
          <ol className="mini-timeline">
            {PREVIEW.map(([n, title, what]) => (
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
    </>
  );
}
