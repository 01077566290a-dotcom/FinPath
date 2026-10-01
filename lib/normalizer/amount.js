import { normalizeMoney } from '../extractors/ruleExtractor.js';

// 금액 조각을 만원 숫자로 바꿉니다. 범위·불명확한 값은 manwon null (추측 금지).
// kind: value | range | flow(매달 납입) | none(없음) | unknown(모르겠음) | unparsed
export function parseAmount(text) {
  const raw = String(text).trim();
  if (/모르|미정/.test(raw)) return { kind: 'unknown', manwon: null };
  if (/없/.test(raw)) return { kind: 'none', manwon: 0 };
  if (/[\d,.]+\s*(?:만\s*원?|원)?\s*(?:~|∼|에서|부터|-)\s*[\d,.]+/.test(raw)) return { kind: 'range', manwon: null };
  if (/매달|매월|월마다/.test(raw)) return { kind: 'flow', manwon: null };
  const amount = normalizeMoney(raw.replace(/정도|쯤|약|가량|대략/g, ''));
  return Number.isFinite(amount) ? { kind: 'value', manwon: amount } : { kind: 'unparsed', manwon: null };
}
