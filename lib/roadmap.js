import { EVENTS } from './schema.js';
import { evaluateRules } from './rules.js';

// 지도 단계는 수집한 이벤트·슬롯만으로 결정합니다. 날짜는 계산하지 않고 순서와 구간만 정합니다.
// 문구는 UX 검증용 초안이며 상품 추천이 아닙니다. 출처 연결과 검수가 필요합니다.

const isActive = (ctx, ...types) => types.some(type => ctx.active.includes(type));
const isPlanned = (ctx, ...types) => types.some(type => ctx.events[type]?.status === 'planned');
const isDone = (ctx, ...types) => types.some(type => ctx.events[type]?.status === 'yes');
const lines = (...items) => items.filter(Boolean);

// 답변 구간을 만원 범위로 바꿔 서로 비교합니다. (경계값은 schema.js의 MONEY_BOUNDS와 같습니다)
const RANGES = {
  savings: { none: [0, 0], lt500: [0, 500], '500_2000': [500, 2000], gt2000: [2000, Infinity] },
  deposit: { lt1000: [0, 1000], '1000_5000': [1000, 5000], gt5000: [5000, Infinity] },
};
// 보증금이 모아둔 돈으로 충분한지: 확실히 부족(short) / 확실히 충분(enough) / 구간이 겹쳐 알 수 없음(maybe)
export function depositGap(slots) {
  const saved = RANGES.savings[slots.savings],
    deposit = RANGES.deposit[slots.deposit];
  if (!saved || !deposit) return null;
  if (deposit[0] >= saved[1] && !(deposit[0] === 0 && saved[1] === 0)) return 'short';
  if (deposit[1] <= saved[0]) return 'enough';
  return 'maybe';
}

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

const LOAN_TYPE_LINES = {
  housing: '주거 대출이라면 보증금 마련 계획과 함께 보고, 집 계약 만기와 대출 만기를 맞춰 둬요.',
  student:
    '학자금 대출은 상환 방식(예: 취업 후 상환)에 따라 갚기 시작하는 때가 달라요. 내 대출의 방식을 먼저 확인해요.',
  credit: '신용대출은 다른 대출보다 금리가 높은 경우가 많아, 먼저 갚을지 검토해 볼 만해요.',
  other: '대출 기관과 금리, 갚는 날을 한곳에 적어 두면 관리가 쉬워져요.',
};
const LOAN_AMOUNT_LINES = {
  lt1000: '금액이 크지 않다면, 남는 돈으로 일찍 갚을지 비상자금을 먼저 모을지 비교해 볼 수 있어요.',
  '1000_5000': '매달 갚는 금액이 월 현금흐름에서 차지하는 비중을 계산해 두면 저축 계획을 세우기 쉬워요.',
  gt5000: '금액이 큰 편이라 금리가 조금만 달라져도 전체 이자 차이가 커요. 갚는 방식과 기간을 꼼꼼히 비교해요.',
};

// events: 이 단계와 관련된 이벤트(태그로 표시). when: 포함 조건. first: 먼저 볼 단계 후보.
// uses: 이 단계 내용에 반영되는 답변(슬롯). 질문 화면의 '이 답이 반영되는 단계'에 쓰입니다.
// personal: 답변에 맞춘 안내. 지도 말풍선의 '내 답변 기준'에 표시됩니다.
// 새 질문(슬롯)을 추가하면 적어도 한 단계의 uses·personal에 반영합니다. (tests/roadmap.test.js에서 확인)
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
    uses: ['monthly_income', 'employment_timing', 'employment_type'],
    personal: ctx =>
      lines(
        {
          upcoming: '아직 입사 전이라, 근로계약서의 연봉을 기준으로 예상 실수령액을 계산해요.',
          lt1y: '입사 1년 미만이라면 급여명세서에서 세금과 4대보험이 얼마나 빠지는지 같이 봐 두면 좋아요.',
          y1_3: '일한 지 1~3년이라면 연봉 인상이나 성과급처럼 달라진 소득이 있는지 반영해요.',
          gt3y: '일한 지 3년이 넘었다면 지금의 고정지출이 처음 정했던 기준과 맞는지 점검해 보세요.',
        }[ctx.slots.employment_timing],
        ctx.slots.employment_type === 'unknown' &&
          '고용 형태를 아직 모른다면 근로계약서에서 먼저 확인해요. 형태에 따라 준비할 것이 달라져요.',
      ),
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
    uses: ['savings'],
    personal: ctx =>
      lines(
        ['none', 'lt500'].includes(ctx.slots.savings) &&
          '모아둔 돈이 아직 많지 않다면, 큰 목표보다 비상자금을 조금씩 만드는 것부터 시작해요.',
        ['500_2000', 'gt2000'].includes(ctx.slots.savings) &&
          '모아둔 돈 중 비상자금으로 둘 몫과 독립·목표에 쓸 몫을 나눠 적어 봐요.',
      ),
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
    uses: ['loan_type', 'loan_amount'],
    personal: ctx => lines(LOAN_TYPE_LINES[ctx.slots.loan_type], LOAN_AMOUNT_LINES[ctx.slots.loan_amount]),
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
    uses: ['deposit'],
    personal: ctx =>
      lines(
        ctx.slots.deposit === 'gt5000' && '보증금이 큰 편이라 보증보험에 가입할 수 있는지 꼭 확인해요.',
        ['lt1000', '1000_5000'].includes(ctx.slots.deposit) &&
          '보증금 규모와 상관없이 전입신고와 확정일자는 꼭 챙겨요. 월세 보증금도 보호 대상이에요.',
        ctx.slots.deposit === 'undecided' && '계약서에서 보증금 금액과 돌려받는 날짜부터 다시 확인해요.',
      ),
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
    uses: ['employment_type'],
    personal: ctx =>
      lines(
        {
          regular: '정규직이라도 수습 기간에는 급여가 다를 수 있어요. 계약서에서 수습 조건을 확인해요.',
          contract: '계약직·인턴이라면 계약 기간과 갱신 조건, 1년 이상 일할 때 받는 퇴직금 조건을 확인해요.',
          freelance: '프리랜서·아르바이트라면 대금(급여) 지급일과 세금을 떼는 방식(예: 3.3% 원천징수)을 확인해요.',
        }[ctx.slots.employment_type],
      ),
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
    uses: ['monthly_income', 'salary_timing'],
    personal: ctx =>
      lines(
        {
          lt200:
            '월 200만원 미만이라면 고정지출이 소득에서 차지하는 비중부터 확인해요. 저축은 적은 금액이라도 먼저 떼어 두는 습관이 중요해요.',
          '200_300': '월 200~300만원이라면 고정지출, 저축, 생활비의 몫을 정해 두면 매달 흐름이 안정돼요.',
          gt300: '월 300만원이 넘는다면 저축할 몫을 먼저 떼고 남은 돈으로 생활하는 방식을 시도해 볼 만해요.',
        }[ctx.slots.monthly_income],
        {
          received: '이미 월급을 받고 있으니, 지난달 통장 내역으로 바로 시작할 수 있어요.',
          this_month: '이번 달 월급이 들어오는 날에 맞춰 저축 자동이체 날짜를 정해 두면 좋아요.',
          later: '첫 월급까지 한 달 넘게 남았다면, 그때까지 쓸 생활비를 따로 계산해 둬요.',
        }[ctx.slots.salary_timing],
      ),
  },
  {
    id: 'irregular_income',
    phase: 'first_pay',
    events: ['EMPLOYMENT'],
    first: ['cashflow'],
    when: ctx => isActive(ctx, 'EMPLOYMENT') && ctx.slots.employment_type === 'freelance',
    title: () => '들쭉날쭉한 소득에 맞춰 생활비 정하기',
    why: () => '수입이 달마다 다르면, 많이 번 달에 쓰고 적게 번 달에 부족해지기 쉬워요.',
    how: () => [
      '최근 몇 달 수입 중 가장 적었던 달을 기준으로 생활비를 정해요.',
      '많이 번 달의 남는 돈은 따로 모아 적게 번 달을 메워요.',
      '종합소득세 신고 시기(보통 5월)와 낼 세금을 미리 확인해요.',
    ],
    uses: ['employment_type'],
    personal: () => ['프리랜서·아르바이트로 일한다고 답해서 추가한 단계예요.'],
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
    uses: ['housing_type'],
    personal: ctx =>
      lines(
        {
          monthly: '월세라면 월세와 관리비를 고정지출에 넣고, 이사 비용으로 줄어든 저축부터 다시 채워요.',
          jeonse: '전세라면 대출 이자와 관리비를 고정지출에 넣고, 계약 만기일도 함께 적어 둬요.',
          undecided: '지금 사는 집의 계약서를 꺼내 월세·전세 여부와 매달 내는 금액을 먼저 확인해요.',
        }[ctx.slots.housing_type],
      ),
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
    uses: ['employment_type'],
    personal: ctx =>
      lines(
        ['contract', 'freelance'].includes(ctx.slots.employment_type) &&
          '계약이 끝나거나 일이 끊기는 때를 대비해, 비상자금을 정규직보다 넉넉하게 잡는 게 안전해요.',
        ctx.slots.employment_type === 'regular' &&
          '소득이 안정적인 편이라면, 비상자금을 먼저 채운 뒤 다른 목표로 저축을 넓혀 가요.',
      ),
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
    uses: ['move_timing', 'savings'],
    personal: ctx =>
      lines(
        {
          m3: '3개월 안에 독립한다면 시간이 짧아요. 지금 가진 돈 안에서 가능한 조건부터 정해요.',
          m6: '독립까지 3~6개월이라면, 그동안 더 모을 수 있는 금액까지 계산에 넣어요.',
          y1: '독립까지 반년 이상 남았다면, 매달 모을 금액을 정해 목표 금액을 만들어 갈 수 있어요.',
        }[ctx.slots.move_timing],
        {
          none: '아직 모아둔 돈이 없다면, 보증금이 낮은 조건부터 살펴보거나 독립 시기를 조정할 수 있어요.',
          lt500: '모아둔 돈이 500만원 미만이라면, 이사비와 첫 달 생활비를 먼저 떼고 보증금 몫을 계산해요.',
          '500_2000': '모아둔 돈 500~2,000만원에서 비상자금과 이사비를 먼저 떼고 보증금 몫을 계산해요.',
          gt2000: '모아둔 돈이 2,000만원을 넘는다면, 보증금을 높여 월세를 줄이는 조합도 비교해 볼 수 있어요.',
        }[ctx.slots.savings],
      ),
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
    uses: ['housing_type', 'deposit', 'savings'],
    personal: ctx =>
      lines(
        {
          short:
            '생각하는 보증금이 모아둔 돈보다 많아요. 부족한 금액을 어떻게 채울지(대출, 독립 시기 조정 등) 함께 정해야 해요.',
          enough:
            '생각하는 보증금은 모아둔 돈 안에서 마련할 수 있는 범위예요. 다만 비상자금까지 쓰지 않도록 나눠 두세요.',
          maybe: '보증금과 모아둔 돈이 비슷한 범위라, 정확한 금액을 적어 보면 부족한지 바로 알 수 있어요.',
        }[depositGap(ctx.slots)],
        ctx.slots.deposit === 'undecided' &&
          '보증금을 아직 정하지 않았다면, 독립에 쓸 수 있는 돈에서 거꾸로 정해 봐요.',
      ),
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
    uses: ['contract_timing'],
    personal: ctx =>
      lines(
        {
          m1: '계약이 한 달 안이라면, 등기부등본 확인과 보증금 보호 방법을 지금 바로 챙겨야 해요.',
          m3: '계약까지 1~3개월이라면, 집을 보러 다니며 확인 목록을 미리 연습해 두세요.',
          m6: '계약까지 시간이 있으니, 여러 집을 비교하며 확인 목록을 익혀 둬요.',
          undecided: '계약 시기가 정해지면 이 단계를 가장 먼저 다시 확인하세요.',
        }[ctx.slots.contract_timing],
      ),
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
    uses: ['loan_type', 'loan_amount'],
    personal: ctx => lines(LOAN_TYPE_LINES[ctx.slots.loan_type], LOAN_AMOUNT_LINES[ctx.slots.loan_amount]),
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
      personal: step.personal?.(ctx) || [],
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

// 질문 화면용: 이 슬롯의 답이 지금 지도의 어느 단계에 반영되는지 돌려줍니다.
export function stepsUsingSlot(state, slot) {
  return buildRoadmap(state).steps.filter(step =>
    STEP_CATALOG.find(entry => entry.id === step.id).uses?.includes(slot),
  );
}
