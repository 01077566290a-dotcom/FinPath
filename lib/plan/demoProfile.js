// 시연 인물 정하은의 1번 프로필 (docs/demo-persona.md, tests/goal-engine.test.js와 같은 답).
// 입력 화면을 거치지 않았을 때 리포트가 이 프로필로 계산합니다.
import { answer, buildProfile } from '../goal/engine.js';

const NOW = new Date(2026, 9, 15); // 기준 달: 2026년 10월

const HAEUN_ANSWERS = [
  ['income', 245],
  ['has_debt', 'yes'],
  ['debt', { remain: 420, monthly: 15 }],
  ['fixed_items', { 통신비: 9, 구독: 3, 보험: 7, 교통비: 13, '가족 용돈': 20 }],
  ['saving_now', 73],
  ['saved', 680],
  ['employment', '정규직'],
  ['age', 27],
  ['region', { sido: '서울', sigungu: '마포구' }],
  ['goal', { amount: 1500, months: 12 }],
  ['purposes', ['주거', '비상자금']],
  [
    'cuttable',
    [
      { item: '통신비', monthly: 5 },
      { item: '구독', monthly: 3 },
      { item: '외식·배달', monthly: 20 },
    ],
  ],
  ['housing_type', '월세'],
  ['deposit', 1000],
  ['rent', { rent: 60, maintenance: 8 }],
  ['move_in', '2027-09'],
  ['commute_after', 6],
  ['loan_plan', '아니요'],
];

// 리포트의 '내 숫자로 바꿔 보기'가 시연 인물의 답에서 출발할 때 씁니다.
export const DEMO_NOW = NOW;
export function buildDemoAnswers() {
  let answers = {};
  for (const [id, value] of HAEUN_ANSWERS) answers = answer(answers, id, value, { now: NOW }).answers;
  return answers;
}

export function buildDemoProfile() {
  let answers = {};
  for (const [id, value] of HAEUN_ANSWERS) answers = answer(answers, id, value, { now: NOW }).answers;
  return buildProfile(answers, { now: NOW });
}

// docs/demo-persona.md의 [가정]: 독립 후 변동 생활비 105 → 100
export const DEMO_ASSUMPTIONS = { variableAfterDelta: -5 };
