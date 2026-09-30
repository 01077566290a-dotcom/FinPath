import { EVENTS, STATUSES, SLOTS, emptySlots } from './schema.js';

export function validateExtraction(raw) {
  const result = { events: [], slots: emptySlots() },
    issues = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return { data: result, issues: ['해석 결과가 올바른 객체가 아닙니다.'] };
  if (!Array.isArray(raw.events)) issues.push('events는 배열이어야 합니다.');
  const seen = new Set();
  for (const event of Array.isArray(raw.events) ? raw.events : []) {
    if (
      !event ||
      !Object.hasOwn(EVENTS, event.type) ||
      !Object.hasOwn(STATUSES, event.status) ||
      typeof event.evidence !== 'string' ||
      !event.evidence.trim()
    ) {
      issues.push('유효하지 않은 이벤트를 제외했습니다.');
      continue;
    }
    if (seen.has(event.type)) {
      issues.push(`${event.type}: 중복 이벤트를 제외했습니다.`);
      continue;
    }
    seen.add(event.type);
    result.events.push({ type: event.type, status: event.status, evidence: event.evidence.slice(0, 2000) });
  }
  if (!raw.slots || typeof raw.slots !== 'object' || Array.isArray(raw.slots)) issues.push('slots는 객체여야 합니다.');
  else
    for (const [key, value] of Object.entries(raw.slots)) {
      if (!Object.hasOwn(SLOTS, key)) {
        issues.push(`알 수 없는 슬롯: ${key}`);
        continue;
      }
      if (value === null) continue;
      if (!SLOTS[key].options.some(option => option.value === value)) {
        issues.push(`${key}: 허용되지 않는 값을 제외했습니다.`);
        continue;
      }
      result.slots[key] = value;
    }
  return { data: result, issues };
}
