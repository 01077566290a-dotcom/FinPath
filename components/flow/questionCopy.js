import { EVENTS } from '../../lib/schema.js';

// 엔진 질문(lib/questions.js)을 화면용 대화체로 바꾸는 문구입니다. 엔진의 선택지 값은 그대로 사용합니다.
export const UNKNOWN_LABEL = '잘 모르겠어요';
const UNKNOWN_VALUES = ['unknown', 'undecided', 'uncertain'];

const SLOT_COPY = {
  employment_timing: { q: '입사는 언제 했거나 할 예정이에요?', hint: '대략적인 시기로 골라 주세요.' },
  salary_timing: { q: '월급은 언제 받았거나 받을 예정이에요?', hint: '첫 월급을 기준으로 생각해 주세요.' },
  monthly_income: {
    q: '한 달에 받을 월급은 어느 정도예요?',
    hint: '세금을 떼고 통장에 들어오는 금액으로 생각해 주세요.',
    unknown: "괜찮아요. 지도 맨 앞에 '월소득과 고정지출 파악하기' 단계를 넣어 드릴게요.",
  },
  move_timing: {
    q: '언제쯤 독립할 생각이에요?',
    hint: '정확하지 않아도 괜찮아요.',
    unknown: '괜찮아요. 시기와 상관없이 먼저 볼 수 있는 순서로 지도를 만들게요.',
  },
  housing_type: {
    q: '살 곳은 어떤 형태로 생각하고 있어요?',
    hint: '아직 정하지 않았다면 잘 모르겠어요를 골라도 돼요.',
    unknown: "괜찮아요. '살 곳의 계약 형태 정하기' 단계에서 함께 비교해 볼 수 있게 할게요.",
  },
  savings: {
    q: '지금 모아둔 돈은 어느 정도예요?',
    hint: '예금, 적금, 통장 잔액을 모두 합쳐서 생각해 주세요.',
    unknown: "괜찮아요. '모아둔 돈과 갚아야 할 돈 정리하기' 단계를 앞쪽에 넣어 드릴게요.",
  },
  contract_timing: {
    q: '집 계약은 언제쯤 할 예정이에요?',
    hint: '계약서에 서명하는 시점을 기준으로 생각해 주세요.',
    unknown: '괜찮아요. 계약 전에 확인할 것부터 지도에 담을게요.',
  },
  deposit: {
    q: '보증금은 어느 정도로 생각하고 있어요?',
    hint: '이미 계약했다면 계약한 금액으로 골라 주세요.',
    unknown: "괜찮아요. '독립에 쓸 수 있는 돈 정하기' 단계에서 함께 정할 수 있어요.",
  },
  loan_type: {
    q: '어떤 대출이에요?',
    hint: '학자금 대출도 포함해서 생각해 주세요.',
    unknown: '괜찮아요. 대출 조건을 비교하는 단계에서 함께 살펴볼 수 있게 할게요.',
  },
  loan_amount: {
    q: '대출 금액은 어느 정도예요?',
    hint: '지금 갚고 있거나 받을 예정인 금액이에요.',
    unknown: '괜찮아요. 매달 갚을 수 있는 범위부터 정하도록 지도에 담을게요.',
  },
};

const EVENT_OPTION_LABELS = {
  yes: '이미 했어요 · 지금 하고 있어요',
  planned: '할 예정이에요',
  uncertain: UNKNOWN_LABEL,
  no: '해당 없어요',
};
export const STATUS_SHORT = { yes: '했어요', planned: '예정', uncertain: '미정', no: '해당 없음' };

export function presentQuestion(question) {
  const isEvent = question.kind === 'event';
  const copy = isEvent
    ? {
        q: `${EVENTS[question.key]}은 어떤 상태예요?`,
        hint: '말씀하신 내용만으로는 확실하지 않아서 한 번만 여쭤볼게요.',
        unknown: '괜찮아요. 정해질 때까지 이 계획은 보류하고, 정해진 계획부터 지도에 담을게요.',
      }
    : SLOT_COPY[question.key];
  const options = question.options.map(option => ({
    value: option.value,
    label: isEvent
      ? EVENT_OPTION_LABELS[option.value]
      : UNKNOWN_VALUES.includes(option.value)
        ? UNKNOWN_LABEL
        : option.label,
    unknown: UNKNOWN_VALUES.includes(option.value),
  }));
  // '잘 모르겠어요'는 항상 마지막에 둡니다.
  options.sort((a, b) => Number(a.unknown) - Number(b.unknown));
  return {
    title: copy.q,
    hint: copy.hint,
    unknownNote: copy.unknown || '괜찮아요. 모르는 내용은 지도에서 먼저 확인하도록 할게요.',
    options,
  };
}

export const displaySlotValue = (key, value, options) =>
  UNKNOWN_VALUES.includes(value) ? UNKNOWN_LABEL : options.find(option => option.value === value)?.label || '';
