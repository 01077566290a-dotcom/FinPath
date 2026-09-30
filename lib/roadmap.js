import { EVENTS } from './schema.js';
import { evaluateRules } from './rules.js';

// 지도 단계는 수집한 이벤트·슬롯만으로 결정합니다. 날짜는 계산하지 않고 순서와 구간만 정합니다.
// 문구는 UX 검증용 초안이며 상품 추천이 아닙니다. 출처 연결과 검수가 필요합니다.

const isActive = (ctx, ...types) => types.some(type => ctx.active.includes(type));
const isPlanned = (ctx, ...types) => types.some(type => ctx.events[type]?.status === 'planned');
const isDone = (ctx, ...types) => types.some(type => ctx.events[type]?.status === 'yes');

// 구간 순서. label은 상황에 따라 바뀝니다.
const PHASES = [
  { id: 'now', label: () => '지금' },
  { id: 'before_job', label: () => '입사 전' },
  {
    id: 'first_pay',
    label: ctx => (ctx.earning ? '이번 달부터' : isPlanned(ctx, 'EMPLOYMENT', 'SALARY') ? '첫 월급 후' : '다음 달부터'),
  },
  { id: 'build_up', label: ctx => (['m6', 'y1'].includes(ctx.slots.move_timing) ? '3개월 후' : '목돈 정할 때') },
  { id: 'before_move', label: ctx => (isActive(ctx, 'INDEPENDENCE') ? '독립 전' : '계약 전') },
  { id: 'before_loan', label: () => '대출 받기 전' },
];

const HOUSING_VARIANTS = {
  monthly: {
    title: '월세로 감당할 수 있는 범위 정하기',
    why: '월세는 매달 빠져나가는 고정지출이라, 월 현금흐름 안에서 감당할 수 있는지가 먼저예요.',
    how: [
      '월 현금흐름에서 월세와 관리비로 쓸 수 있는 금액을 정해요.',
      '보증금을 올리면 월세가 줄어드는 경우가 많아 두 조합을 비교해 봐요.',
      '관리비에 포함된 항목과 따로 내는 공과금을 확인해요.',
    ],
  },
  jeonse: {
    title: '전세 보증금 마련 방법 정하기',
    why: '전세는 한 번에 큰돈이 들어가서, 모아둔 돈과 대출을 어떻게 나눌지에 따라 부담이 달라져요.',
    how: [
      '독립에 쓸 수 있는 돈으로 보증금의 몇 퍼센트를 채울 수 있는지 봐요.',
      '부족한 금액을 대출로 채운다면 매달 내는 이자를 월 현금흐름에 넣어 봐요.',
      '청년 대상 주거 대출이 있는지 공식 기관 안내를 확인해요.',
    ],
  },
  default: {
    title: '살 곳의 계약 형태 정하기',
    why: '전세인지 월세인지에 따라 한 번에 필요한 돈과 매달 나가는 돈의 구조가 달라져요.',
    how: [
      '형태별로 필요한 목돈과 매달 드는 비용을 비교해요.',
      '정해둔 보증금과 월 현금흐름에 넣어 감당할 수 있는지 봐요.',
      '대출을 쓸 계획이라면 갚는 방식과 부담도 함께 확인해요.',
    ],
  },
};

// events: 이 단계와 관련된 이벤트(태그로 표시). when: 포함 조건. first: 먼저 볼 단계 후보.
export const STEP_CATALOG = [
  {
    id: 'income_expense',
    phase: 'now',
    events: ['EMPLOYMENT', 'SALARY', 'INDEPENDENCE'],
    when: ctx => isActive(ctx, 'EMPLOYMENT', 'SALARY', 'INDEPENDENCE') || isPlanned(ctx, 'LOAN'),
    title: ctx => (ctx.earning ? '월소득과 고정지출 파악하기' : '예상 월소득과 고정지출 파악하기'),
    why: () => '월 현금흐름, 저축, 주거비 계획이 모두 이 두 숫자에서 출발해요.',
    how: () => [
      '안내받은 연봉이나 계약서에서 세금을 뗀 월급을 확인해요.',
      '최근 통장과 카드 내역에서 매달 빠져나가는 항목을 적어요.',
      '매달 같은 돈과 달마다 달라지는 돈을 나눠 봐요.',
    ],
    note: ctx =>
      ctx.slots.monthly_income === 'unknown' ? '월소득을 아직 모른다고 답해서 가장 먼저 확인하도록 넣었어요.' : null,
  },
  {
    id: 'assets_debts',
    phase: 'now',
    events: ['INDEPENDENCE', 'HOUSING', 'LOAN'],
    when: ctx => isActive(ctx, 'INDEPENDENCE', 'HOUSING', 'LOAN') || ctx.slots.savings === 'unknown',
    title: () => '모아둔 돈과 갚아야 할 돈 정리하기',
    why: () => '독립에 쓸 수 있는 돈의 크기와 대출이 필요한지는 지금 가진 돈과 갚을 돈에서 갈려요.',
    how: () => [
      '계좌별 잔액을 한곳에 적어요.',
      '학자금 같은 대출의 남은 금액과 갚는 시기를 확인해요.',
      '바로 써도 되는 돈과 손대면 안 되는 돈을 나눠 봐요.',
    ],
    note: ctx => (ctx.slots.savings === 'unknown' ? '모아둔 돈을 아직 모른다고 답해서 앞쪽에 넣었어요.' : null),
  },
  {
    id: 'loan_repay',
    phase: 'now',
    events: ['LOAN'],
    first: ['assets_debts'],
    when: ctx => isDone(ctx, 'LOAN'),
    title: () => '갚고 있는 대출 정리하기',
    why: () => '매달 나가는 상환액을 정확히 알아야 저축과 생활비를 현실적으로 나눌 수 있어요.',
    how: () => [
      '대출별 남은 금액, 금리, 매달 갚는 날을 적어요.',
      '매달 갚는 금액을 고정지출에 넣어요.',
      '먼저 갚을 대출이 있는지, 일찍 갚을 때 수수료가 있는지 확인해요.',
    ],
  },
  {
    id: 'deposit_protect',
    phase: 'now',
    events: ['HOUSING'],
    when: ctx => isDone(ctx, 'HOUSING'),
    title: () => '계약한 집의 보증금 지키는 절차 확인하기',
    why: () => '이미 계약했다면, 보증금을 지키기 위한 신고와 절차를 놓치지 않았는지가 가장 중요해요.',
    how: () => [
      '전입신고와 확정일자를 받았는지 확인해요.',
      '보증금 보증보험에 가입할 수 있는지 알아봐요.',
      '계약서와 영수증을 한곳에 보관해요.',
    ],
  },
  {
    id: 'job_check',
    phase: 'before_job',
    events: ['EMPLOYMENT'],
    when: ctx => isPlanned(ctx, 'EMPLOYMENT'),
    title: () => '입사 전 급여 조건 확인하기',
    why: () => '첫 월급이 언제, 얼마나 들어오는지 알아야 그 전까지 쓸 돈을 계획할 수 있어요.',
    how: () => [
      '근로계약서에서 연봉, 급여일, 수습 기간 조건을 확인해요.',
      '세금과 4대보험을 뗀 실수령액이 어느 정도인지 알아봐요.',
      '첫 월급 전까지 필요한 생활비를 따로 챙겨 둬요.',
    ],
  },
  {
    id: 'cashflow',
    phase: 'first_pay',
    events: ['EMPLOYMENT', 'SALARY'],
    first: ['income_expense', 'job_check'],
    when: ctx => isActive(ctx, 'EMPLOYMENT', 'SALARY', 'INDEPENDENCE'),
    title: () => '월 현금흐름 만들기',
    why: () => '돈이 어디로 갈지 정해두지 않으면 저축이 쓰고 남은 돈이 되기 쉬워요.',
    how: () => [
      '세금을 뗀 월급에서 고정지출을 빼요.',
      '갚는 대출이 있다면 상환액도 함께 빼요.',
      '남은 돈에서 저축할 몫을 먼저 정해요.',
    ],
  },
  {
    id: 'after_move',
    phase: 'first_pay',
    events: ['INDEPENDENCE', 'HOUSING'],
    first: ['cashflow'],
    when: ctx => isDone(ctx, 'INDEPENDENCE', 'HOUSING'),
    title: () => '실제 주거비로 현금흐름 다시 짜기',
    why: () => '독립하고 나면 월세, 관리비, 공과금처럼 새로 생긴 지출이 계획과 다를 수 있어요.',
    how: () => [
      '지난달 실제로 낸 주거비를 항목별로 적어요.',
      '월 현금흐름의 고정지출을 실제 금액으로 바꿔요.',
      '줄어든 저축액이 괜찮은지, 조정할 지출이 있는지 봐요.',
    ],
  },
  {
    id: 'emergency',
    phase: 'first_pay',
    events: ['EMPLOYMENT', 'SALARY'],
    first: ['cashflow'],
    when: ctx => isActive(ctx, 'EMPLOYMENT', 'SALARY'),
    title: () => '비상자금 목표 정하기',
    why: () => '갑자기 돈이 나갈 때 독립 자금이나 대출 상환을 건드리지 않으려면 따로 둔 돈이 필요해요.',
    how: () => [
      '한 달 생활비를 계산해요.',
      '생활비의 몇 개월치를 둘지 정해요. 기준은 사람마다 달라요.',
      '바로 꺼낼 수 있는 보관 계좌의 유형을 알아봐요. 예: 입출금이 자유로운 파킹통장, CMA 등.',
    ],
  },
  {
    id: 'move_budget',
    phase: 'build_up',
    events: ['INDEPENDENCE'],
    first: ['assets_debts', 'emergency'],
    when: ctx => isPlanned(ctx, 'INDEPENDENCE', 'HOUSING'),
    title: () => '독립에 쓸 수 있는 돈 정하기',
    why: () => '살 곳의 형태와 가능한 범위가 이 금액에서 갈려요.',
    how: () => [
      '모아둔 돈에서 비상자금을 따로 빼요.',
      '이사비, 가구 등 처음에 드는 비용의 몫을 잡아요.',
      '남은 금액이 보증금으로 쓸 수 있는 몫이에요.',
    ],
    note: ctx =>
      ctx.slots.move_timing === 'undecided'
        ? '독립 시기를 아직 정하지 않았다고 해서, 시기와 상관없이 먼저 볼 수 있는 순서로 두었어요.'
        : null,
  },
  {
    id: 'housing_type',
    phase: 'before_move',
    events: ['INDEPENDENCE', 'HOUSING'],
    first: ['cashflow', 'move_budget'],
    when: ctx => isPlanned(ctx, 'INDEPENDENCE', 'HOUSING'),
    title: ctx => (HOUSING_VARIANTS[ctx.slots.housing_type] || HOUSING_VARIANTS.default).title,
    why: ctx => (HOUSING_VARIANTS[ctx.slots.housing_type] || HOUSING_VARIANTS.default).why,
    how: ctx => (HOUSING_VARIANTS[ctx.slots.housing_type] || HOUSING_VARIANTS.default).how,
    note: ctx =>
      ctx.slots.housing_type === 'undecided'
        ? '주거 형태를 아직 모른다고 답해서 두 형태를 함께 비교하도록 했어요.'
        : null,
  },
  {
    id: 'contract_check',
    phase: 'before_move',
    events: ['INDEPENDENCE', 'HOUSING'],
    first: ['housing_type'],
    when: ctx => isPlanned(ctx, 'INDEPENDENCE', 'HOUSING'),
    title: () => '계약 전 확인할 것 챙기기',
    why: () => '계약하고 나면 되돌리기 어려워서, 서명 전에 확인해야 해요.',
    how: () => [
      '집과 집주인에 관한 서류를 확인해요. 예: 등기부등본.',
      '보증금을 지키는 방법을 알아봐요. 예: 보증보험.',
      '계약서의 날짜와 특약 내용을 읽어요.',
    ],
  },
  {
    id: 'loan_compare',
    phase: 'before_loan',
    events: ['LOAN'],
    first: ['cashflow', 'housing_type', 'assets_debts'],
    when: ctx => isPlanned(ctx, 'LOAN'),
    title: ctx =>
      ctx.slots.loan_type === 'housing'
        ? '주거 대출 조건 비교하기'
        : ctx.slots.loan_type === 'student'
          ? '학자금 대출 조건 확인하기'
          : '대출 조건 비교하고 갚을 범위 정하기',
    why: () => '같은 금액이라도 금리, 기간, 갚는 방식에 따라 매달 부담과 전체 이자가 크게 달라져요.',
    how: () => [
      '매달 갚을 수 있는 금액을 월 현금흐름에서 먼저 정해요.',
      '대출별 금리, 기간, 갚는 방식을 나란히 비교해요.',
      '청년 대상 공공 대출이 있는지 공식 기관 안내를 확인해요.',
    ],
    note: ctx =>
      ctx.slots.loan_amount === 'undecided'
        ? '대출 금액을 아직 정하지 않았다면, 갚을 수 있는 범위부터 정하면 금액이 정해져요.'
        : null,
  },
];

const CLOSING = '여기까지 보면 지금 상황에서 알아볼 것은 다 봤어요. 상황이 바뀌면 답변을 고쳐 지도를 다시 만들어요.';

export function buildRoadmap(state) {
  const result = evaluateRules(state);
  const events = state.events;
  const ctx = {
    events,
    slots: state.slots,
    active: result.activeEvents,
    earning: events.EMPLOYMENT?.status === 'yes' || events.SALARY?.status === 'yes',
  };
  const phaseOrder = PHASES.map(phase => phase.id);
  const picked = STEP_CATALOG.filter(step => step.when(ctx))
    .map((step, i) => ({ step, i }))
    .sort((a, b) => phaseOrder.indexOf(a.step.phase) - phaseOrder.indexOf(b.step.phase) || a.i - b.i)
    .map(({ step }) => step);
  const ids = picked.map(step => step.id);
  const steps = picked.map((step, index) => {
    const tags = step.events.filter(type => ctx.active.includes(type)).map(type => EVENTS[type]);
    return {
      id: step.id,
      number: index + 1,
      phase: step.phase,
      phaseLabel: PHASES.find(phase => phase.id === step.phase).label(ctx),
      title: step.title(ctx),
      tags: tags.length ? tags : result.activeEvents.slice(0, 1).map(type => EVENTS[type]),
      first: (step.first || []).filter(id => ids.indexOf(id) > -1 && ids.indexOf(id) < index),
      why: step.why(ctx),
      how: step.how(ctx),
      note: step.note?.(ctx) || null,
    };
  });
  steps.forEach((step, i) => {
    step.next = steps[i + 1]?.title || CLOSING;
  });
  const groups = [];
  for (const step of steps) {
    const last = groups.at(-1);
    if (last?.phase === step.phase) last.steps.push(step);
    else groups.push({ phase: step.phase, label: step.phaseLabel, steps: [step] });
  }
  return {
    status: result.status,
    situation: result.activeEvents.map(type => EVENTS[type]),
    deferred: result.deferredEvents.map(type => EVENTS[type]),
    steps,
    groups,
  };
}
