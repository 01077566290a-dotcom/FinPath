// FinPath v4 입력 질문 정의 (1번: 입력·정책)
// 원칙: 이미 받은 정보는 다시 묻지 않고, 답에 따라 결과가 달라지는 것만 묻습니다.
// 금액은 모두 만 원 단위 정수로 받습니다. "잘 모르겠어요"는 UNKNOWN으로 저장합니다.

export const UNKNOWN = 'unknown';

// 목적은 세 가지로 좁혔어요. (결혼·빚 상환은 2026-10-04 팀 결정으로 제외. 엔진과 질문 정의는 남아 있어요)
export const PURPOSES = ['비상자금', '주거', '투자'];
export const MAX_PURPOSES = 3;

// 목적 선택지 아래에 보여주는 설명. 무엇을 고를지 헷갈리지 않게 해요.
export const PURPOSE_DESC = {
  비상자금: '갑자기 일을 쉬거나 큰 지출이 생겨도 버틸 돈',
  주거: '독립, 이사, 내 집 마련에 필요한 보증금과 비용',
  결혼: '결혼식, 신혼집 등 결혼 준비 비용',
  투자: '쓰고 남는 돈을 오래 불리고 싶어요',
  '빚 상환': '학자금 등 남은 빚을 빨리 갚고 싶어요',
};

export const SIDO = [
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  '경기',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
];

export const CUTTABLE_ITEMS = ['통신비', '구독', '외식·배달', '쇼핑', '기타'];
// 고정지출 항목에도 있는 절약 항목. 줄일 금액이 지금 쓰는 금액보다 클 수 없어요.
export const CUTTABLE_FROM_FIXED = ['통신비', '구독'];

const hasPurpose = name => answers => Array.isArray(answers.purposes) && answers.purposes.includes(name);

export const FIXED_ITEMS = ['통신비', '구독', '보험', '교통비', '가족 용돈', '기타'];

// 고른 목적에 맞춘 빠른 선택 (적응형)
const goalQuick = answers => {
  const p = Array.isArray(answers.purposes) ? answers.purposes : [];
  const amount = p.includes('주거')
    ? [1000, 1500, 3000, 5000]
    : p.includes('투자')
      ? [500, 1000, 3000]
      : [300, 500, 1000];
  return { amount, months: [6, 12, 24, 36] };
};
const depositQuick = answers =>
  answers.housing_type === '전세'
    ? [10000, 15000, 20000, 30000]
    : answers.housing_type === '매매'
      ? [10000, 20000, 30000]
      : [300, 500, 1000, 2000];
// 지금 교통비: 새 질문(commute_now)이나 예전 고정지출 답의 교통비
export const commuteNow = answers => {
  if (Number.isInteger(answers.commute_now)) return answers.commute_now;
  const items = answers.fixed_items;
  return items && items !== UNKNOWN ? items['교통비'] || 0 : 0;
};

export const QUESTIONS = [
  // ── ① 목표와 내 돈 (공통 질문은 최소로) ──
  {
    id: 'purposes',
    group: 'common',
    stage: 1,
    type: 'multi',
    title: '무엇을 위해 모으고 싶어요?',
    hint: `최대 ${MAX_PURPOSES}개까지 고를 수 있어요.`,
    max: MAX_PURPOSES,
    options: PURPOSES.map(p => ({
      value: p,
      label: p,
      desc: PURPOSE_DESC[p],
    })),
  },
  {
    id: 'goal',
    group: 'common',
    stage: 1,
    type: 'goal',
    title: '얼마를, 언제까지 모으고 싶어요?',
    hint: '"1년 동안 1,500만 원"처럼 대략 적어도 돼요. 리포트에서 실제로 필요한 돈과 비교해 드려요.',
    allowUnknown: true,
    quick: goalQuick, // 고른 목적에 맞춰 빠른 선택 금액이 바뀌어요
  },
  {
    id: 'income',
    group: 'common',
    stage: 1,
    type: 'number',
    title: '한 달에 실제로 통장에 들어오는 월급은 얼마예요?',
    hint: '세금과 4대보험이 빠진 실수령액이에요.',
    unit: '만 원',
    min: 1,
    max: 5000,
    quick: [200, 250, 300, 350],
  },
  {
    id: 'saving_now',
    group: 'common',
    stage: 1,
    type: 'number',
    title: '지금 한 달에 얼마 정도 모으고 있어요?',
    hint: '적금과 통장에 남기는 돈을 합친 금액이에요. 안 모으고 있으면 0이에요.',
    unit: '만 원',
    min: 0,
    max: 5000,
    quick: [0, 30, 50, 100],
  },
  {
    id: 'saved',
    group: 'common',
    stage: 1,
    type: 'number',
    title: '지금까지 모아둔 돈은 얼마예요?',
    hint: '예적금, 통장 잔액을 대략 합친 금액이에요.',
    unit: '만 원',
    min: 0,
    max: 1000000,
    quick: [300, 500, 1000, 2000],
  },
  {
    id: 'has_debt',
    group: 'common',
    stage: 1,
    type: 'choice',
    title: '갚고 있는 빚이 있어요?',
    hint: '학자금 대출, 신용대출 등이에요.',
    options: [
      { value: 'yes', label: '있어요' },
      { value: 'no', label: '없어요' },
    ],
  },
  {
    id: 'debt',
    group: 'common',
    stage: 1,
    type: 'numbers',
    title: '남은 빚과 한 달 상환액은 얼마예요?',
    hint: '대략적인 금액이면 충분해요. 상환액은 다음 질문의 고정지출에 따로 넣지 않아도 돼요.',
    fields: [
      { key: 'remain', label: '남은 금액', unit: '만 원', min: 1, max: 1000000 },
      { key: 'monthly', label: '한 달 상환액', unit: '만 원', min: 0, max: 5000 },
    ],
    when: answers => answers.has_debt === 'yes',
  },

  // ── ② 나에게 맞춘 질문: 고른 목적과 앞의 답에 따라 질문 수가 달라져요 ──
  {
    id: 'employment',
    group: '비상자금',
    type: 'choice',
    title: '지금 일하는 형태는요?',
    hint: '고용이 불안정할수록 비상자금을 더 넉넉히(개월 수를 길게) 잡아요.',
    options: [
      { value: '정규직', label: '정규직' },
      { value: '계약직', label: '계약직' },
      { value: '프리랜서·기타', label: '프리랜서·기타' },
    ],
    when: hasPurpose('비상자금'),
  },
  {
    // 비상자금 목표를 몇 개월치로 잡을지 정할 때 써요.
    id: 'emergency_reason',
    group: '비상자금',
    type: 'choice',
    enrich: true,
    title: '비상자금은 주로 어떤 때를 대비하고 싶어요?',
    hint: '',
    options: [
      { value: '실직·이직', label: '일을 쉬거나 이직할 때' },
      { value: '갑작스러운 지출', label: '병원비처럼 갑자기 큰돈이 나갈 때' },
      { value: '둘 다', label: '둘 다' },
    ],
    // 결과에 쓰이지 않아 지금은 묻지 않아요. 계산에 연결하면 다시 켜 주세요.
    when: () => false,
  },
  {
    // 주거 목적을 구체적으로 파악해요. 내 집 마련이면 집 형태(매매)를 다시 묻지 않아요.
    id: 'housing_goal',
    group: '주거',
    type: 'choice',
    enrich: true,
    title: '어떤 주거 계획이에요?',
    hint: '',
    options: answers => [
      {
        value: '첫 독립',
        label: answers.living_now === '부모님 집' ? '부모님 집에서 나와 첫 독립' : '첫 독립',
      },
      { value: '이사', label: '지금보다 나은 집으로 이사' },
      { value: '내 집 마련', label: '내 집 마련' },
    ],
    // 결과에 쓰이지 않아 지금은 묻지 않아요. 계산에 연결하면 다시 켜 주세요.
    when: () => false,
  },
  {
    id: 'housing_type',
    group: '주거',
    type: 'choice',
    title: '어떤 집을 준비하고 있어요?',
    hint: '',
    options: [
      { value: '월세', label: '월세' },
      { value: '전세', label: '전세' },
      { value: '매매', label: '매매' },
    ],
    when: answers => hasPurpose('주거')(answers) && answers.housing_goal !== '내 집 마련',
  },
  {
    id: 'deposit',
    group: '주거',
    type: 'number',
    title: '생각하는 보증금(또는 집값)은 얼마예요?',
    hint: '알아본 대략적인 값이면 돼요. 모르면 지역 기준값으로 계산해 드려요.',
    unit: '만 원',
    min: 0,
    max: 10000000,
    allowUnknown: true,
    when: hasPurpose('주거'),
    quick: depositQuick, // 집 형태에 맞춘 빠른 선택
  },
  {
    id: 'rent',
    group: '주거',
    type: 'numbers',
    title: '생각하는 월세와 관리비는 얼마예요?',
    hint: '독립 후 매달 나가는 돈에 더해져요.',
    fields: [
      { key: 'rent', label: '월세', unit: '만 원', min: 0, max: 1000 },
      { key: 'maintenance', label: '관리비', unit: '만 원', min: 0, max: 200 },
    ],
    allowUnknown: true,
    when: answers => hasPurpose('주거')(answers) && answers.housing_type === '월세',
  },
  {
    id: 'move_in',
    group: '주거',
    type: 'yearMonth',
    title: '언제쯤 들어가고 싶어요?',
    hint: '대략적인 달이면 돼요.',
    when: hasPurpose('주거'),
  },
  {
    // 이사하면 바뀌는 교통비를 계산할 때만 써요. (예전 고정지출 6칸 중 계산에 쓰이던 유일한 값)
    id: 'commute_now',
    group: '주거',
    type: 'number',
    title: '지금 교통비는 한 달에 얼마예요?',
    hint: '독립하면 교통비가 바뀌는 만큼 매달 남는 돈도 바뀌어요. 없으면 0이에요.',
    unit: '만 원',
    min: 0,
    max: 500,
    allowUnknown: true,
    when: answers =>
      hasPurpose('주거')(answers) && answers.housing_type !== '매매' && answers.fixed_items === undefined,
    quick: [0, 5, 10, 15],
  },
  {
    // 이사하면 바뀌는 고정지출. 교통비를 적은 사람에게만 묻습니다.
    id: 'commute_after',
    group: '주거',
    type: 'number',
    title: '독립하면 교통비는 한 달에 얼마쯤 될까요?',
    hint: '지금보다 회사와 가까워지면 줄어들 수 있어요.',
    unit: '만 원',
    min: 0,
    max: 500,
    allowUnknown: true,
    when: answers => hasPurpose('주거')(answers) && commuteNow(answers) > 0,
    quick: [0, 5, 10],
  },
  {
    id: 'loan_plan',
    group: '주거',
    type: 'choice',
    title: '대출을 받을 생각이 있어요?',
    hint: '',
    options: [
      { value: '예', label: '예' },
      { value: '아니요', label: '아니요' },
      { value: UNKNOWN, label: '잘 모르겠어요' },
    ],
    // 적응형: 월세이면서 보증금이 작으면 대출을 거의 쓰지 않아 묻지 않아요. 전세·매매이거나 보증금이 3,000만 원 이상이면 물어요.
    when: answers =>
      hasPurpose('주거')(answers) &&
      answers.housing_type !== undefined &&
      (answers.housing_type !== '월세' || (Number.isInteger(answers.deposit) && answers.deposit >= 3000)),
  },
  {
    id: 'loan_amount',
    group: '주거',
    type: 'number',
    title: '대출은 얼마쯤 생각해요?',
    hint: '',
    unit: '만 원',
    min: 1,
    max: 10000000,
    when: answers => hasPurpose('주거')(answers) && answers.loan_plan === '예',
    quick: [1000, 3000, 5000],
  },
  {
    id: 'invest_months',
    group: '투자',
    type: 'number',
    title: '얼마 동안 투자할 생각이에요?',
    hint: '',
    unit: '개월',
    min: 1,
    max: 600,
    when: hasPurpose('투자'),
    quick: [12, 36, 60],
  },
  {
    id: 'invest_monthly',
    group: '투자',
    type: 'number',
    title: '매달 얼마 넣고 싶어요?',
    hint: '',
    unit: '만 원',
    min: 0,
    max: 5000,
    when: hasPurpose('투자'),
    quick: [10, 30, 50],
  },
  // 결혼·빚 상환은 목적에서 뺐어요(PURPOSES). 질문 정의는 남겨 두어 다시 켤 수 있어요.
  {
    id: 'wedding_when',
    group: '결혼',
    type: 'yearMonth',
    title: '결혼은 언제쯤 생각해요?',
    hint: '대략적인 달이면 돼요.',
    when: hasPurpose('결혼'),
  },
  {
    id: 'wedding_cost',
    group: '결혼',
    type: 'number',
    title: '예상하는 결혼 총비용은 얼마예요?',
    hint: '모르면 기준값으로 계산해 드려요.',
    unit: '만 원',
    min: 0,
    max: 1000000,
    allowUnknown: true,
    when: hasPurpose('결혼'),
    quick: [3000, 5000, 10000],
  },
  {
    id: 'family_support',
    group: '결혼',
    type: 'number',
    title: '가족에게 지원받을 금액이 있어요?',
    hint: '없으면 0이에요.',
    unit: '만 원',
    min: 0,
    max: 1000000,
    allowUnknown: true,
    when: hasPurpose('결혼'),
    quick: [0, 1000, 3000],
  },
  {
    id: 'partner_share',
    group: '결혼',
    type: 'number',
    title: '배우자가 부담할 비율은 몇 %예요?',
    hint: '선택 입력이에요. 건너뛰어도 돼요.',
    unit: '%',
    min: 0,
    max: 100,
    optional: true,
    when: hasPurpose('결혼'),
  },
  {
    id: 'debt_period',
    group: '빚 상환',
    type: 'number',
    title: '언제까지 다 갚고 싶어요?',
    hint: '남은 금액과 상환액은 앞에서 받았으니 기간만 알려주세요.',
    unit: '개월',
    min: 1,
    max: 600,
    when: hasPurpose('빚 상환'),
    quick: [12, 24, 36],
  },

  // ── ③ 정책 찾기 ──
  {
    id: 'region',
    group: 'common',
    stage: 3,
    type: 'region',
    title: '어디에 살 계획이에요?',
    hint: '독립할 예정이면 살고 싶은 곳을 골라주세요. 지역 기준값과 내 지역 청년 정책을 찾을 때 써요.',
  },
  {
    id: 'age',
    group: 'common',
    stage: 3,
    type: 'number',
    title: '나이는요?',
    hint: '받을 수 있는 청년 정책을 고를 때만 써요.',
    unit: '세',
    min: 15,
    max: 80,
    quick: [25, 27, 29, 32],
  },

  // ── 입력 흐름에서 묻지 않는 답 (inFlow: false) ──
  {
    id: 'fixed_items',
    group: 'common',
    stage: 1,
    inFlow: false, // 계산에는 교통비만 쓰여서 입력 흐름에서는 묻지 않아요(예전 답·시연 데이터는 그대로 써요)
    type: 'items',
    title: '매달 꼭 나가는 돈을 항목별로 적어주세요.',
    hint: '없는 항목은 비워두면 돼요. 빚 상환액은 앞에서 받았으니 빼고 적어주세요. 지금 월세를 내고 있다면 기타에 넣어주세요.',
    items: FIXED_ITEMS,
    unit: '만 원',
    allowUnknown: true,
  },
  {
    id: 'cuttable',
    group: 'common',
    stage: 3,
    inFlow: false, // 입력 흐름에서는 묻지 않고, 리포트의 '아끼면 이만큼 빨라져요'에서 골라요
    type: 'cuttable',
    title: '줄일 수 있을 것 같은 지출이 있어요?',
    hint: '고른 항목마다 한 달에 얼마나 줄일 수 있을지 적어주세요. 없으면 그냥 넘어가도 돼요.',
    items: CUTTABLE_ITEMS,
  },
  {
    // 빚 종류에 따라 맞는 지원 제도(학자금 이자 지원, 채무조정 등)가 달라요.
    id: 'debt_type',
    group: 'common',
    stage: 1,
    type: 'choice',
    enrich: true,
    title: '어떤 빚이에요?',
    hint: '여러 개면 가장 큰 것을 골라주세요.',
    options: [
      { value: '학자금 대출', label: '학자금 대출' },
      { value: '신용대출', label: '신용대출' },
      { value: '카드론·현금서비스', label: '카드론·현금서비스' },
      { value: '기타', label: '기타' },
    ],
    // 결과에 쓰이지 않아 지금은 묻지 않아요. 계산에 연결하면 다시 켜 주세요.
    when: () => false,
  },
  {
    // 입사 연차에 따라 신청할 수 있는 청년 제도와 안내 문구가 달라져요.
    id: 'work_years',
    group: 'common',
    stage: 1,
    type: 'choice',
    enrich: true,
    title: '일한 지 얼마나 됐어요?',
    hint: '',
    options: [
      { value: '입사 전', label: '아직 입사 전이에요' },
      { value: '1년 미만', label: '1년 미만' },
      { value: '1~3년', label: '1~3년' },
      { value: '3년 이상', label: '3년 이상' },
    ],
    // 결과에 쓰이지 않아 지금은 묻지 않아요. 계산에 연결하면 다시 켜 주세요.
    when: () => false,
  },
  {
    // 지금 사는 형태. 첫 독립인지, 이사인지 목적을 파악하고 주거 질문 문구를 고를 때 써요.
    id: 'living_now',
    group: 'common',
    stage: 2,
    type: 'choice',
    enrich: true,
    title: '지금은 어떻게 살고 있어요?',
    hint: '',
    options: [
      { value: '부모님 집', label: '부모님 집에서 살아요' },
      { value: '월세', label: '월세로 살아요' },
      { value: '전세', label: '전세로 살아요' },
      { value: '기숙사·기타', label: '기숙사·기타' },
    ],
    // 결과에 쓰이지 않아 지금은 묻지 않아요. 계산에 연결하면 다시 켜 주세요.
    when: () => false,
  },
];

export const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));

export function optionsFor(question, answers) {
  return typeof question.options === 'function' ? question.options(answers) : question.options || [];
}

// 입력 3단계. 목적별 질문(group이 목적 이름)은 stage가 없어서 모두 ②예요.
export const STAGES = [
  { n: 1, label: '목표와 내 돈' },
  { n: 2, label: '나에게 맞춘 질문' },
  { n: 3, label: '정책 찾기' },
];
export const stageOf = question => question.stage ?? 2;

// 이전 흐름(classic)의 질문 순서: 돈 상황 → 나이·지역 → 목표 → 목적 → 줄일 지출 → 목적별 질문
// 화면 흐름 전환(lib/flowMode.js)에서 씁니다. 엔진은 QUESTIONS 순서대로 묻기 때문에 배열 순서만 바꿔요.
const PLAN_ORDER = QUESTIONS.map(q => q.id);
const CLASSIC_FIRST = [
  'income',
  'has_debt',
  'debt',
  'fixed_items',
  'saving_now',
  'saved',
  'employment',
  'age',
  'region',
  'goal',
  'purposes',
  'cuttable',
];
export const CLASSIC_ORDER = [...CLASSIC_FIRST, ...PLAN_ORDER.filter(id => !CLASSIC_FIRST.includes(id))];

export function applyQuestionOrder(mode = 'plan') {
  const order = mode === 'classic' ? CLASSIC_ORDER : PLAN_ORDER;
  QUESTIONS.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
