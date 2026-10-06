// 금액 표시 (단위: 만 원). 1억 이상은 '1억 2,000만 원'처럼 씁니다.
export function money(value, { unit = true } = {}) {
  const v = Math.round(Number(value) || 0);
  if (v === 0) return unit ? '0원' : '0';
  const sign = v < 0 ? '−' : '';
  const abs = Math.abs(v);
  const eok = Math.floor(abs / 10000);
  const man = abs % 10000;
  let text;
  if (eok > 0) text = man ? `${eok}억 ${man.toLocaleString()}만` : `${eok}억`;
  else text = `${abs.toLocaleString()}만`;
  return `${sign}${text}${unit ? ' 원' : ''}`;
}

// 숫자만 (만 원 단위 생략, 천 단위 쉼표)
export const num = value => Math.round(Number(value) || 0).toLocaleString();

export function monthLabel(asOf, offset) {
  const index = asOf.year * 12 + (asOf.month - 1) + offset;
  return `${Math.floor(index / 12)}년 ${(index % 12) + 1}월`;
}

export function shortMonth(asOf, offset) {
  const index = asOf.year * 12 + (asOf.month - 1) + offset;
  return `${String(Math.floor(index / 12)).slice(2)}.${String((index % 12) + 1).padStart(2, '0')}`;
}

// 개월 수 → '1년 5개월'
export function duration(months) {
  if (months === null || months === undefined || !Number.isFinite(months)) return '-';
  if (months < 12) return `${months}개월`;
  const y = Math.floor(months / 12),
    m = months % 12;
  return m ? `${y}년 ${m}개월` : `${y}년`;
}
