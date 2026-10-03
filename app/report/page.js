import ReportView from '../../components/report/ReportView.js';

export const metadata = { title: '맞춤 리포트 | FinPath' };

// 입력 화면(/goal)에서 저장한 프로필로 계산하고(2번 엔진 lib/plan), 없으면 시연 인물(정하은)의 숫자로 보여 줍니다.
export default function Page() {
  return <ReportView />;
}
