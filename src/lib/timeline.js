import { financial_decisions, lifeEvents } from '../data/financial-decisions.js';

export function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}
export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addMonths(date, amount) {
  const target = new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), last));
  return target;
}
export function generateTimeline(plan, completed = [], now = new Date()) {
  const today = dateKey(now);
  return financial_decisions.flatMap(decision => {
    const anchor = parseDate(plan[lifeEvents[decision.event].field]);
    if (!anchor) return [];
    const dueDate = dateKey(addMonths(anchor, decision.offsetMonths));
    return [{ ...decision, dueDate, anchorDate: dateKey(anchor), status: completed.includes(decision.id) ? 'done' : dueDate <= today ? 'now' : 'upcoming' }];
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
}
export function demoPlan(now = new Date()) {
  return { name: '', employmentDate: dateKey(addMonths(now, 1)), salaryDate: dateKey(addMonths(now, 2)), independenceDate: dateKey(addMonths(now, 5)) };
}
export function offsetLabel(value) { return value === 0 ? '이벤트 당월' : `${Math.abs(value)}개월 ${value < 0 ? '전' : '후'}`; }
export function formatDate(value, year = false) {
  const date = parseDate(value);
  return date ? `${year ? `${date.getFullYear()}. ` : ''}${date.getMonth() + 1}. ${date.getDate()}` : '미정';
}
