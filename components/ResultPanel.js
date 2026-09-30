import { EVENTS, STATUSES, SLOTS, slotLabel } from '../lib/schema.js';
const messages = {
  complete: ['필요한 정보가 모두 모였습니다.', '필요 정보 수집 완료 → 추후 타임라인 엔진으로 전달 가능'],
  deferred: ['확정된 계획의 정보 수집을 마쳤어요.', '미정 이벤트는 보류 중이에요. 상태를 변경하면 필요한 질문이 다시 시작됩니다.'],
  not_applicable: ['현재 추가로 확인할 정보가 없어요.', '언급한 이벤트가 모두 해당 없음으로 확인되었어요. 계획이 생기면 상태를 바꿔 주세요.'],
};
export default function ResultPanel({ state, result }) {
  const message = result.status === 'deferred' && result.activeEvents.length === 0
    ? ['계획이 정해지면 이어서 확인할게요.', '미정 이벤트는 보류 중이에요. 상태를 변경하면 필요한 질문이 시작됩니다.']
    : messages[result.status];
  if (!message) return null;
  return <section className="panel result-panel" role="status"><div className="result-icon" aria-hidden="true">{result.status === 'complete' ? '✓' : '—'}</div><h2>{message[0]}</h2><p>{message[1]}</p><div className="summary-events">{Object.entries(state.events).map(([key, event]) => <span key={key}>{EVENTS[key]} · {STATUSES[event.status]}</span>)}</div><dl className="result-values">{result.requiredSlots.map(key => <div key={key}><dt>{SLOTS[key].label}</dt><dd>{slotLabel(key, state.slots[key])}</dd></div>)}</dl>{result.status === 'complete' && <small>이 데모에서는 실제 타임라인을 생성하지 않습니다. ‘미정’ 선택값도 그대로 전달됩니다.</small>}</section>;
}
