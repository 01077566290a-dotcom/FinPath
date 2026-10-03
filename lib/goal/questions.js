// FinPath v4 입력 질문 정의 (1번: 입력·정책)
// 원칙: 이미 받은 정보는 다시 묻지 않고, 답에 따라 결과가 달라지는 것만 묻습니다.
// 금액은 모두 만 원 단위 정수로 받습니다. "잘 모르겠어요"는 UNKNOWN으로 저장합니다.

export const UNKNOWN = 'unknown';

export const PURPOSES = ['비상자금', '주거', '결혼', '투자', '빚 상환'];
export const MAX_PURPOSES = 3;

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

export const QUESTIONS = [
  // ── ① 목표와 내 돈 상황 (공통) ──
  {
    id: 'goal',
    group: 'common',
    stage: 1,
    type: 'goal',
    title: '모으고 싶은 돈과 기간이 있어요?',
    hint: '"1년 동안 1,500만 원"처럼 대략 적어도 돼요. 리포트에서 실제로 필요한 돈과 비교해 드려요.',
    allowUnknown: true,
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
  {
    id: 'fixed_items',
    group: 'common',
    stage: 1,
    type: 'items',
    title: '매달 꼭 나가는 돈을 항목별로 적어주세요.',
    hint: '없는 항목은 비워두면 돼요. 빚 상환액은 앞에서 받았으니 빼고 적어주세요. 지금 월세를 내고 있다면 기타에 넣어주세요.',
    items: FIXED_ITEMS,
    unit: '만 원',
    allowUnknown: true,
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
  },
  {
    id: 'employment',
    group: 'common',
    stage: 1,
    type: 'choice',
    title: '지금 일하는 형태는요?',
    hint: '비상자금을 몇 개월치 모을지 정할 때 써요.',
    options: [
      { value: '정규직', label: '정규직' },
      { value: '계약직', label: '계약직' },
      { value: '프리랜서·기타', label: '프리랜서·기타' },
    ],
  },

  // ── ② 지역과 목적 선택 (공통) ──
  {
    id: 'region',
    group: 'common',
    stage: 2,
    type: 'region',
    title: '어디에 살 계획이에요?',
    hint: '독립할 예정이면 지금 사는 곳이 아니라 살고 싶은 곳을 골라주세요. 지역 정책을 찾을 때 써요.',
  },
  {
    id: 'age',
    group: 'common',
    stage: 2,
    type: 'number',
    title: '나이는요?',
    hint: '받을 수 있는 청년 정책을 고를 때만 써요.',
    unit: '세',
    min: 15,
    max: 80,
  },
  {
    id: 'purposes',
    group: 'common',
    stage: 2,
    type: 'multi',
    title: '무엇을 위해 모으고 싶어요?',
    hint: `최대 ${MAX_PURPOSES}개까지 고를 수 있어요.`,
    max: MAX_PURPOSES,
    // "빚 상환"은 빚이 있다고 답한 사람에게만 보여줍니다.
    options: answers =>
      PURPOSES.filter(p => p !== '빚 상환' || answers.has_debt === 'yes').map(p => ({ value: p, label: p })),
  },

  // ── ③ 목적별 상세 정보 ──
  // 비상자금은 추가 질문이 없어요. 생활비는 월급·고정지출·저축액으로 계산하고, 고용 형태는 공통에서 받았어요.
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
    when: hasPurpose('주거'),
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
    when: answers =>
      hasPurpose('주거')(answers) &&
      answers.fixed_items !== undefined &&
      answers.fixed_items !== UNKNOWN &&
      (answers.fixed_items['교통비'] || 0) > 0,
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
    when: answers => hasPurpose('주거')(answers) && answers.housing_type !== undefined,
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
  },
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
    id: 'invest_months',
    group: '투자',
    type: 'number',
    title: '얼마 동안 투자할 생각이에요?',
    hint: '',
    unit: '개월',
    min: 1,
    max: 600,
    when: hasPurpose('투자'),
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
  },

  // ③의 마지막: 아낄 수 있는 지출 (리포트의 '아끼면 이만큼 빨라져요'에 씀)
  {
    id: 'cuttable',
    group: 'common',
    stage: 3,
    type: 'cuttable',
    title: '줄일 수 있을 것 같은 지출이 있어요?',
    hint: '고른 항목마다 한 달에 얼마나 줄일 수 있을지 적어주세요. 없으면 그냥 넘어가도 돼요.',
    items: CUTTABLE_ITEMS,
  },
];

export const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));

export function optionsFor(question, answers) {
  return typeof question.options === 'function' ? question.options(answers) : question.options || [];
}

// 기획안 v4의 입력 3단계. 목적별 질문(group이 목적 이름)은 모두 ③이에요.
export const STAGES = [
  { n: 1, label: '목표와 내 돈 상황' },
  { n: 2, label: '지역과 목적 선택' },
  { n: 3, label: '목적별 상세 정보' },
];
export const stageOf = question => question.stage ?? 3;

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
