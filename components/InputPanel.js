export const EXAMPLES = [
  { label: '취업 + 독립', text: '다음 달에 취업해서 반년 뒤 월세로 자취하려고 해요. 지금 천만 원 정도 모았습니다.' },
  { label: '첫 월급', text: '첫 월급 260만 원 받았어요.' },
  { label: '아직 미정', text: '취업 준비 중인데 곧 될 것 같아요.' },
  { label: '대출 계획', text: '전세대출을 5000만원 정도 받을 생각이에요.' },
];
export default function InputPanel({ text, setText, onAnalyze, busy, analyzed, error }) {
  return <section className="panel input-panel"><div className="section-top"><span className="step">01</span><h2>현재 상황을 들려주세요</h2><span className="small-badge">자연어 입력</span></div><p className="muted">지금의 상황과 앞으로의 계획을 편하게 적어 주세요.</p><form onSubmit={onAnalyze}><label className="sr-only" htmlFor="situation">현재 상황과 계획</label><textarea id="situation" value={text} onChange={e => setText(e.target.value)} maxLength={2000} rows={5} placeholder="예: 다음 달에 취업해서 반년 뒤 월세로 자취하려고 해요. 지금 천만 원 정도 모았습니다." disabled={busy} /><div className="input-bottom"><span>{text.length.toLocaleString()} / 2,000</span><button className="primary" disabled={busy || !text.trim()} type="submit">{busy ? '분석 중…' : analyzed ? '새 입력으로 다시 분석 →' : '분석하기 →'}</button></div></form><div className="examples"><span>예시로 시작</span>{EXAMPLES.map(example => <button disabled={busy} type="button" key={example.label} onClick={() => setText(example.text)}>{example.label}</button>)}</div><p className="note">규칙 기반 데모예요. 다시 분석하면 이전 답변이 초기화됩니다. 입력은 저장하거나 외부로 전송하지 않아요.</p>{error && <p className="error" role="alert">{error}</p>}</section>;
}
