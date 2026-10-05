// 타임라인 단계 설명의 금액에 색을 입혀요.
//   주황: 중요한 금액(만 원) · 빨강 ▲: 늘어나는 돈 · 파랑 ▼: 줄어드는 돈 · 노랑 형광: 권장·조정 문장
// 색만으로 구분하지 않도록 ▲▼ 기호를 함께 붙여요.

// '684만 원', '1억 2,345만 원', '3억 원'
const AMOUNT = /(?:\d+억 ?)?\d[\d,]*(?:\.\d+)?만 원|\d+억 원/g;
// 금액 바로 뒤 몇 글자로 늘어나는지·줄어드는지 판단해요. 괄호 속(예: "(6.9%)")은 건너뛰어요.
const UP = /^\s*(?:으로|로|이|가|을|를)?\s*(?:늘|증가|더 )/;
const DOWN = /^\s*(?:으로|로|이|가|을|를)?\s*(?:줄|감소|덜 )/;
// 권장·조정·해결 방법을 말하는 문장
const REC = /권해요|권장|좋아요|늘리기|줄이기|목표 조정|늦추면/;

export function direction(line, end) {
  const rest = line.slice(end, end + 18).replace(/\([^)]*\)/, '');
  if (UP.test(rest)) return 'up';
  if (DOWN.test(rest)) return 'down';
  return 'key';
}

export const isRecommendation = line => REC.test(line);

// 문장을 [글자, {금액, 방향}, 글자 …] 조각으로 나눠요.
export function splitAmounts(line) {
  const parts = [];
  let last = 0;
  for (const m of line.matchAll(AMOUNT)) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    parts.push({ amount: m[0], dir: direction(line, m.index + m[0].length) });
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}
