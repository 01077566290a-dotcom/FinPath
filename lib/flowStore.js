import { EVENTS, STATUSES, SLOTS } from './schema.js';
import { createInitialState } from './state.js';

// 입력·답변·완료 표시는 이 브라우저의 localStorage에만 저장합니다. (기존 타임라인 데모는 finpath-v1 사용)
export const STORAGE_KEY = 'finpath-flow-v1';

export const createFlow = () => ({ text: '', engine: createInitialState(), history: [], done: {} });

function isEngineState(value) {
  if (!value || typeof value !== 'object') return false;
  const { events, slots, meta } = value;
  if (!events || typeof events !== 'object' || !slots || typeof slots !== 'object' || !meta) return false;
  if (!Array.isArray(meta.confirmedUncertain) || typeof meta.slotSources !== 'object') return false;
  const validEvents = Object.entries(events).every(
    ([type, event]) => Object.hasOwn(EVENTS, type) && Object.hasOwn(STATUSES, event?.status),
  );
  const validSlots = Object.keys(SLOTS).every(
    key => slots[key] === null || SLOTS[key].options.some(option => option.value === slots[key]),
  );
  return validEvents && validSlots;
}

// 저장된 값이 손상됐거나 스키마가 바뀌었으면 버리고 새로 시작합니다.
export function parseFlow(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data.text !== 'string' || !isEngineState(data.engine)) return createFlow();
    const history = Array.isArray(data.history) ? data.history.filter(isEngineState) : [];
    const done =
      data.done && typeof data.done === 'object'
        ? Object.fromEntries(Object.entries(data.done).filter(([, v]) => v === true))
        : {};
    return { text: data.text.slice(0, 2000), engine: data.engine, history, done };
  } catch {
    return createFlow();
  }
}

export function loadFlow() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return { flow: raw ? parseFlow(raw) : createFlow(), persistent: true };
  } catch {
    return { flow: createFlow(), persistent: false };
  }
}

export function saveFlow(flow) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(flow));
    return true;
  } catch {
    return false;
  }
}
