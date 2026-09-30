import { emptySlots, moneyBucket } from '../schema.js';

const mentions = {
  EMPLOYMENT: /취업|취직|입사|회사\s*(?:에\s*)?들어|첫\s*출근|신입|직장/,
  SALARY: /월급|급여|실수령|월소득/,
  INDEPENDENCE: /독립|자취|집\s*(?:을\s*)?나가|이사|원룸|오피스텔/,
  HOUSING: /월세|전세(?!\s*대출)|집\s*계약|방\s*계약|임대차|보증금/,
  LOAN: /대출|돈\s*(?:을\s*)?빌리/,
};
function statusOf(text) {
  // 부정 > 조건부 계획 > 불확실 > 예정 > 과거·현재. 단순 키워드는 확정하지 않습니다.
  if (/못\s*했|안\s*(?:했|해|할|받)|하지\s*않|계획[은이가]?\s*없|생각[은이가]?\s*없|받지\s*않|대출[은이가]?\s*없/.test(text)) return 'no';
  if (/하면|하려|할\s*예정|할\s*계획|할\s*생각|받을\s*생각|받으려|하고\s*싶|갈\s*예정/.test(text)) return 'planned';
  if (/될\s*것\s*같|준비\s*중|고민|불확실|모르|미정|미확정/.test(text)) return 'uncertain';
  if (/했|됐|되었|받았|받고|살고|다니|근무\s*중|년\s*차|개월\s*차|재직|계약했/.test(text)) return 'yes';
  if (/다음\s*달|이번\s*달|내년|반년\s*뒤|개월\s*(?:뒤|후|내)|예정|계획|확정/.test(text)) return 'planned';
  return 'uncertain';
}
function smallNumber(text) {
  const digits = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };
  let total = 0, current = '';
  for (const char of text) {
    if (/[\d.]/.test(char)) current += char;
    else if (digits[char]) current += digits[char];
    else if ({ 십: 10, 백: 100, 천: 1000 }[char]) { total += (Number(current) || 1) * { 십: 10, 백: 100, 천: 1000 }[char]; current = ''; }
  }
  return total + Number(current || 0);
}
export function normalizeMoney(text) {
  const cleaned = text.replace(/[\s,원]/g, '');
  if (!cleaned || !/^[\d.일이삼사오육칠팔구십백천만억]+$/.test(cleaned)) return null;
  let remaining = cleaned, won = 0;
  for (const [unit, multiplier] of [['억', 100000000], ['만', 10000]]) {
    if (remaining.includes(unit)) {
      const parts = remaining.split(unit);
      if (parts.length !== 2) return null;
      won += smallNumber(parts[0]) * multiplier;
      remaining = parts[1];
    }
  }
  if (/[억만]/.test(cleaned)) return (won + smallNumber(remaining)) / 10000;
  return smallNumber(cleaned) / (text.includes('원') ? 10000 : 1);
}
function extractMoney(clause, slots) {
  const anchors = [];
  const patterns = { monthly_income: /월급|급여|실수령|월소득/g, savings: /저축|모아|모았|모은|모으|저금|자산/g, deposit: /보증금/g, loan_amount: /대출|빌리/g };
  for (const [slot, pattern] of Object.entries(patterns)) for (const match of clause.matchAll(pattern)) anchors.push({ slot, start: match.index, end: match.index + match[0].length });
  const money = /(?:\d[\d,.]*|[일이삼사오육칠팔구십백천만억])(?:[\d,.\s일이삼사오육칠팔구십백천만억]*)(?:원|(?=\s*정도)|(?<=만)(?=\s|$))/g;
  const ranges = [...clause.matchAll(/[\d,.]+\s*(?:만\s*원?|원)?\s*(?:~|∼|에서|부터|-)\s*[\d,.]+\s*(?:만\s*원?|원)/g)];
  for (const match of clause.matchAll(money)) {
    if (!/[원만억천백]/.test(match[0])) continue;
    // 가장 가까운 금액 주체에만 연결하여 보증금과 대출 금액을 섞지 않습니다.
    const start = match.index, end = start + match[0].length;
    if (ranges.some(range => start < range.index + range[0].length && end > range.index)) continue;
    if (clause[start - 1] === '-') continue;
    const nearby = anchors.map(a => ({ ...a, distance: a.end <= start ? start - a.end : a.start >= end ? a.start - end : 0 })).sort((a, b) => a.distance - b.distance);
    if (nearby[0] && nearby[0].distance <= 18 && nearby[0].distance !== nearby[1]?.distance) {
      // 매달 납입하는 저축은 현재 보유액이 아닙니다.
      if (nearby[0].slot === 'savings' && /매달|매월|월마다/.test(clause) && !/모아\s*(?:뒀|두었|둔)|모았|모은|잔액/.test(clause)) continue;
      const amount = normalizeMoney(match[0]);
      const value = moneyBucket(nearby[0].slot, amount);
      if (value !== null) slots[nearby[0].slot] = value;
    }
  }
  if (/(?:저축|모은\s*돈|모아\s*둔\s*돈|저금)[은이가]?\s*(?:전혀\s*)?없/.test(clause)) slots.savings = 'none';
}
function monthsFrom(text) {
  if (/반년/.test(text)) return 6;
  if (/다음\s*달|한\s*달/.test(text)) return 1;
  if (/이번\s*달/.test(text)) return 0;
  // 달력 날짜를 상대 개월 수로 추측하지 않습니다. 날짜 해석 확장 전에는 질문으로 확인합니다.
  if (/내년|\d+\s*월/.test(text)) return null;
  if (/(?<!\d)1년|일\s*년/.test(text)) return 12;
  const match = text.match(/(\d+)\s*(?:개월|달)/);
  return match ? Number(match[1]) : null;
}
export async function ruleExtractor(text) {
  const slots = emptySlots(), events = new Map();
  const clauses = text.split(/\n|[!?]|\.(?!\d)|,(?!\d)|(?<=차고)|(?<=했고)|(?<=됐고)|(?<=받고)|(?<=다니고)|(?<=취업해서)|(?<=지만)|(?<=인데)|(?<=는데)|(?<=이고)/).map(s => s.trim()).filter(Boolean);
  for (const clause of clauses) {
    const found = Object.entries(mentions).filter(([, pattern]) => pattern.test(clause)).map(([type]) => type);
    for (const type of found) {
      let status = statusOf(clause);
      // 혼합 문장의 취업 연차는 이후의 이사 계획과 구분합니다.
      if (type === 'EMPLOYMENT' && /입사\s*\d+\s*년\s*차/.test(clause)) status = 'yes';
      events.set(type, { type, status, evidence: clause });
    }
    extractMoney(clause, slots);
    if (found.includes('EMPLOYMENT')) {
      const event = events.get('EMPLOYMENT');
      if (event.status === 'planned') slots.employment_timing = 'upcoming';
      if (event.status === 'yes') {
        const tenure = clause.match(/(\d+)\s*(년|개월)\s*(?:차|됐|되었)/);
        if (tenure) {
          const months = Number(tenure[1]) * (tenure[2] === '년' ? 12 : 1);
          slots.employment_timing = months < 12 ? 'lt1y' : months <= 36 ? 'y1_3' : 'gt3y';
        } else if (/이번에|최근|신입/.test(clause)) slots.employment_timing = 'lt1y';
      }
    }
    if (found.includes('SALARY') && events.get('SALARY').status !== 'no') {
      if (/받았|받고/.test(clause)) slots.salary_timing = 'received';
      else if (/이번\s*달/.test(clause)) slots.salary_timing = 'this_month';
      else if (/다음\s*달|내년|개월\s*(?:뒤|후)/.test(clause)) slots.salary_timing = 'later';
    }
    if (found.includes('INDEPENDENCE') && events.get('INDEPENDENCE').status === 'planned') {
      const months = monthsFrom(clause);
      if (months !== null && months <= 12) slots.move_timing = months <= 3 ? 'm3' : months <= 6 ? 'm6' : 'y1';
    }
    if (found.includes('HOUSING')) {
      if (/월세/.test(clause) && !/전세(?!\s*대출)/.test(clause)) slots.housing_type = 'monthly';
      else if (/전세(?!\s*대출)/.test(clause) && !/월세/.test(clause)) slots.housing_type = 'jeonse';
      // 이사일을 계약일로 추정하지 않습니다. 명시적인 계약 언급에만 시기를 연결합니다.
      if (/계약|임대차/.test(clause) && events.get('HOUSING').status === 'planned') {
        const months = monthsFrom(clause);
        if (months !== null && months <= 6) slots.contract_timing = months <= 1 ? 'm1' : months <= 3 ? 'm3' : 'm6';
      }
    }
    if (found.includes('LOAN')) {
      if (/전세\s*대출|주택\s*대출|주거\s*대출/.test(clause)) slots.loan_type = 'housing';
      else if (/학자금/.test(clause)) slots.loan_type = 'student';
      else if (/신용/.test(clause)) slots.loan_type = 'credit';
    }
  }
  return { events: [...events.values()], slots };
}
