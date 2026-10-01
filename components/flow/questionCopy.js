import { EVENTS } from '../../lib/schema.js';

// 엔진 질문(lib/questions.js)을 화면용 대화체로 바꾸는 문구입니다. 엔진의 선택지 값은 그대로 사용합니다.
export const UNKNOWN_LABEL = '잘 모르겠어요';
const UNKNOWN_VALUES = ['unknown', 'undecided', 'uncertain'];

const SLOT_COPY = {
  employment_timing: { q: '입사는 언제 했거나 할 예정이에요?', hint: '대략적인 시기로 골라 주세요.' },
  employment_type: {
    q: '어떤 형태로 일하게 됐어요?',
    hint: '근로계약서에 적힌 형태를 기준으로 골라 주세요.',
    unknown: '괜찮아요. 근로계약서에서 고용 형태부터 확인하도록 지도에 안내해 드릴게요.',
  },
  salary_timing: { q: '월급은 언제 받았거나 받을 예정이에요?', hint: '첫 월급을 기준으로 생각해 주세요.' },
  monthly_income: {
    q: '한 달에 받는 월급은 어느 정도예요?',
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
    hint: '이미 계약했다면 계약한 금액으로 골라 주세요. 모아둔 돈과 비교해서 부족한지 알려 드려요.',
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

// 상태 확인 질문: 이벤트마다 자연스러운 질문과 선택지를 씁니다. uncertain은 '보류'로 이어집니다.
const EVENT_COPY = {
  EMPLOYMENT: {
    q: '취업은 어디까지 진행됐어요?',
    labels: {
      yes: '이미 회사에 다니고 있어요',
      planned: '입사가 정해졌어요',
      uncertain: '아직 준비 중이에요',
      no: '취업 계획은 없어요',
    },
  },
  SALARY: {
    q: '첫 월급은 받으셨어요?',
    labels: {
      yes: '네, 이미 받고 있어요',
      planned: '곧 받을 예정이에요',
      uncertain: '아직 잘 모르겠어요',
      no: '월급을 받을 일은 없어요',
    },
  },
  INDEPENDENCE: {
    q: '독립은 어떤 상황이에요?',
    labels: {
      yes: '이미 혼자 살고 있어요',
      planned: '나가 살 계획이 있어요',
      uncertain: '아직 고민 중이에요',
      no: '당분간 계획이 없어요',
    },
  },
  HOUSING: {
    q: '집 계약은 어떤 상황이에요?',
    labels: {
      yes: '이미 계약했어요',
      planned: '계약할 예정이에요',
      uncertain: '아직 알아보는 중이에요',
      no: '계약할 일은 없어요',
    },
  },
  LOAN: {
    q: '대출은 어떤 상황이에요?',
    labels: {
      yes: '지금 갚고 있어요',
      planned: '받을 예정이에요',
      uncertain: '아직 고민 중이에요',
      no: '대출은 없어요',
    },
  },
};
const DEFER_NOTE = '괜찮아요. 정해질 때까지 이 부분은 보류하고, 정해진 계획부터 지도에 담을게요.';

export const STATUS_SHORT = { yes: '했어요', planned: '예정', uncertain: '미정', no: '해당 없음' };

const quote = text => (text.length > 32 ? `${text.slice(0, 31)}…` : text);

// event: 상태 확인 질문일 때 해당 이벤트(근거 문장 포함)
export function presentQuestion(question, event) {
  if (question.kind === 'event') {
    const copy = EVENT_COPY[question.key];
    const hint =
      event && !event.picked
        ? `“${quote(event.evidence)}”라고 하셔서, 지금 어느 쪽인지 한 번만 확인할게요.`
        : `고르신 ‘${EVENTS[question.key]}’의 지금 상황을 알려 주세요.`;
    const options = question.options.map(option => ({
      value: option.value,
      label: copy.labels[option.value],
      unknown: option.value === 'uncertain',
    }));
    options.sort((a, b) => Number(a.unknown) - Number(b.unknown));
    return { title: copy.q, hint, unknownNote: DEFER_NOTE, options };
  }
  const copy = SLOT_COPY[question.key];
  const options = question.options.map(option => ({
    value: option.value,
    label: UNKNOWN_VALUES.includes(option.value) ? UNKNOWN_LABEL : option.label,
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

// '왜 묻는지' 한 줄: 이 답이 반영될 지도 단계 제목을 보여 줍니다.
export function whyWeAsk(question, steps) {
  if (question.kind === 'event') return '이 답에 따라 지도에 어떤 단계를 넣을지 정해요.';
  if (!steps.length) return null;
  const titles = steps.slice(0, 2).map(step => `‘${step.title}’`);
  const more = steps.length > 2 ? ` 외 ${steps.length - 2}개` : '';
  return `이 답은 지도의 ${titles.join(', ')}${more} 단계에 반영돼요.`;
}

export const displaySlotValue = (key, value, options) =>
  UNKNOWN_VALUES.includes(value) ? UNKNOWN_LABEL : options.find(option => option.value === value)?.label || '';

// 문장에서 상황을 못 찾았을 때 고르는 카드
export const PICKABLE_EVENTS = [
  { type: 'EMPLOYMENT', title: '취업', summary: '입사했거나 입사를 앞두고 있어요' },
  { type: 'SALARY', title: '월급', summary: '첫 월급을 받았거나 곧 받아요' },
  { type: 'INDEPENDENCE', title: '독립', summary: '혼자 살고 있거나 나가 살 계획이에요' },
  { type: 'HOUSING', title: '집 계약', summary: '월세·전세 계약을 했거나 앞두고 있어요' },
  { type: 'LOAN', title: '대출', summary: '갚고 있거나 받을 예정인 대출이 있어요' },
];
