import ReportView from '../../components/report/ReportView.js';
import { computeReport } from '../../lib/report/computeReport.js';
import { DEMO_PERSONA } from '../../lib/report/demoPersona.js';

export const metadata = { title: '돈 구성 리포트 | FinPath' };

// 엔진(A)과 입력 화면이 연결되기 전까지는 시연 인물(정하은)의 숫자로 보여 줍니다.
export default function Page() {
  return <ReportView report={computeReport(DEMO_PERSONA)} />;
}
