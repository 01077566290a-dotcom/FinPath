import { EVENTS, STATUSES, SLOTS, emptySlots, availableOptions } from './schema.js';
export const createInitialState = () => ({
  events: {},
  slots: emptySlots(),
  meta: { confirmedUncertain: [], slotSources: {} },
});
export function mergeExtraction(state, extraction) {
  const next = {
    events: { ...state.events },
    slots: { ...state.slots },
    meta: { confirmedUncertain: [...state.meta.confirmedUncertain], slotSources: { ...state.meta.slotSources } },
  };
  for (const { type, ...event } of extraction.events) {
    next.events[type] = event;
    next.meta.confirmedUncertain = next.meta.confirmedUncertain.filter(key => key !== type);
  }
  for (const [key, value] of Object.entries(extraction.slots)) {
    if (value !== null) {
      next.slots[key] = value;
      next.meta.slotSources[key] = 'extracted';
    }
  }
  return next;
}
export function applyAnswer(state, question, value) {
  if (!question || !question.options.some(option => option.value === value))
    throw new Error('허용되지 않는 답변입니다.');
  if (question.kind === 'event') {
    if (!Object.hasOwn(EVENTS, question.key) || !Object.hasOwn(STATUSES, value) || !state.events[question.key])
      throw new Error('유효하지 않은 이벤트입니다.');
    const slots = { ...state.slots };
    // 상태 수정 후 서로 모순되는 시기 정보는 다시 확인합니다. 공유 소득은 유지합니다.
    if (
      question.key === 'EMPLOYMENT' &&
      ((value === 'yes' && slots.employment_timing === 'upcoming') ||
        (value === 'planned' && slots.employment_timing && slots.employment_timing !== 'upcoming'))
    )
      slots.employment_timing = null;
    if (
      question.key === 'SALARY' &&
      ((value === 'yes' && slots.salary_timing && slots.salary_timing !== 'received') ||
        (value === 'planned' && slots.salary_timing === 'received'))
    )
      slots.salary_timing = null;
    return {
      ...state,
      slots,
      events: {
        ...state.events,
        [question.key]: { ...state.events[question.key], status: value, confirmedByUser: true },
      },
      meta: {
        ...state.meta,
        confirmedUncertain: [
          ...new Set([
            ...state.meta.confirmedUncertain.filter(key => key !== question.key),
            ...(value === 'uncertain' ? [question.key] : []),
          ]),
        ],
      },
    };
  }
  if (
    !Object.hasOwn(SLOTS, question.key) ||
    !availableOptions(question.key, state.events).some(option => option.value === value)
  )
    throw new Error('현재 이벤트 상태에 맞지 않는 슬롯입니다.');
  return {
    ...state,
    slots: { ...state.slots, [question.key]: value },
    meta: { ...state.meta, slotSources: { ...state.meta.slotSources, [question.key]: 'answer' } },
  };
}
