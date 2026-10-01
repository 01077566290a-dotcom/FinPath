import { EVENTS, STATUSES, emptySlots, moneyBucket } from '../schema.js';
import { SLOT_BINDING, UNKNOWN_VALUE, CHOICE_DICT } from './config.js';
import { parseTime, timeBucket } from './time.js';
import { parseAmount } from './amount.js';

// LLM이 나눈 조각(spans)을 { events, slots }로 바꾸는 3단계 정규화기.
// 원칙: 확신이 없으면 채우지 않고(null) 재질문에 맡깁니다. 결과는 validator를 한 번 더 거칩니다.
export function normalize(spans) {
  const slots = emptySlots(),
    issues = [],
    events = new Map(),
    conflicted = new Set();
  const list = Array.isArray(spans) ? spans : [];
  const put = (slot, value) => {
    if (value === null || conflicted.has(slot)) return;
    if (slots[slot] !== null && slots[slot] !== value) {
      slots[slot] = null;
      conflicted.add(slot);
      issues.push(`${slot}: 값이 서로 달라 채우지 않았습니다.`);
    } else slots[slot] = value;
  };
  for (const span of list) {
    if (span?.kind !== 'event') continue;
    if (!Object.hasOwn(EVENTS, span.event) || !Object.hasOwn(STATUSES, span.status) || !String(span.text ?? '').trim())
      issues.push('유효하지 않은 이벤트 조각을 제외했습니다.');
    else events.set(span.event, { type: span.event, status: span.status, evidence: String(span.text) });
  }
  const statusOf = type => events.get(type)?.status ?? null;
  for (const span of list) {
    if (!span || span.kind === 'event') continue;
    const rule = SLOT_BINDING.find(row => row.kind === span.kind && row.about === span.about);
    const text = String(span.text ?? '');
    if (!rule || !text.trim()) {
      issues.push(`귀속 규칙이 없는 조각을 제외했습니다: ${span.kind}/${span.about}`);
      continue;
    }
    if (span.kind === 'time') {
      const status = statusOf(span.about);
      if (status === 'no' || status === 'uncertain') continue;
      const { tense, months } = parseTime(text);
      if (span.about === 'EMPLOYMENT') {
        if (tense === 'tenure' && status !== 'planned') put(rule.slot, timeBucket('employment_tenure', months));
        else if (tense === 'future' && status !== 'yes') put(rule.slot, 'upcoming');
      } else if (span.about === 'SALARY') {
        if (status === 'yes') put(rule.slot, 'received');
        else if (tense === 'future') put(rule.slot, months === 0 ? 'this_month' : 'later');
      } else if (tense === 'future' && status !== 'yes') put(rule.slot, timeBucket(rule.bucket, months));
    } else if (span.kind === 'amount') {
      const amount = parseAmount(text);
      if (amount.kind === 'unknown') put(rule.slot, UNKNOWN_VALUE[rule.slot]);
      else if (amount.kind === 'none') put(rule.slot, rule.slot === 'savings' ? 'none' : null);
      else if (amount.kind === 'value') put(rule.slot, moneyBucket(rule.slot, amount.manwon));
    } else if (span.kind === 'choice') {
      const hits = CHOICE_DICT[rule.slot].filter(([pattern]) => pattern.test(text)).map(([, value]) => value);
      if (hits.length === 1) put(rule.slot, hits[0]);
    }
  }
  return { events: [...events.values()], slots, issues };
}
