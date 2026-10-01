import { TIME_BUCKETS } from './config.js';

// 시간 조각을 개월 수로 바꿉니다. 달력 날짜는 이번 버전에서 추정하지 않고 months를 null로 둡니다.
// tense: tenure(경과 기간) | future(앞으로 N개월) | calendar(달력 날짜) | unknown
export function parseTime(text) {
  const t = String(text).replace(/\s+/g, '');
  const tenure = t.match(/(\d+)(년|개월)(?:차|됐|되었)/);
  if (tenure) return { tense: 'tenure', months: Number(tenure[1]) * (tenure[2] === '년' ? 12 : 1) };
  if (/이번달/.test(t)) return { tense: 'future', months: 0 };
  if (/다음달|한달(?:뒤|후)/.test(t)) return { tense: 'future', months: 1 };
  if (/반년(?:뒤|후|내|쯤)/.test(t)) return { tense: 'future', months: 6 };
  const later = t.match(/(\d+|일)(년|개월|달)(?:뒤|후|내|이내)/);
  if (later)
    return { tense: 'future', months: (later[1] === '일' ? 1 : Number(later[1])) * (later[2] === '년' ? 12 : 1) };
  if (/내년|올해|\d{4}년|\d{1,2}월/.test(t)) return { tense: 'calendar', months: null };
  return { tense: 'unknown', months: null };
}
export function timeBucket(table, months) {
  if (!Number.isFinite(months) || months < 0) return null;
  return TIME_BUCKETS[table].find(([limit]) => months <= limit)?.[1] ?? null;
}
