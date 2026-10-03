import './globals.css';
// 디자인 층 "Quiet Planner" (docs/design-direction.md). 이 줄을 지우면 이전 디자인으로 돌아가요.
import './design.css';

// 글꼴: Pretendard (SIL 오픈 폰트 라이선스). 불러오지 못하면 기기 기본 글꼴로 보여요.
const PRETENDARD =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';

export const metadata = {
  title: 'FinPath | 금융 정보 내비게이션',
  description: '목표와 내 돈 상황을 알려주면 실제로 필요한 돈과 모으는 순서를 지도와 리포트로 보여주는 FinPath 데모',
};
export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD} precedence="default" />
      </head>
      <body>{children}</body>
    </html>
  );
}
