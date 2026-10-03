import ReportView from '../../components/report/ReportView.js';

export const metadata = { title: '독립 자금 리포트 | FinPath' };

// 입력값은 브라우저에 저장된 값(없으면 시연 인물)을 화면에서 불러와 계산합니다.
export default function Page() {
  return <ReportView />;
}
