import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeInput } from '../lib/pipeline.js';
import { createInitialState, applyAnswer } from '../lib/state.js';
import { evaluateRules, EVENT_RULES } from '../lib/rules.js';
import { selectNextQuestion } from '../lib/questions.js';
import { buildRoadmap, STEP_CATALOG, stepsUsingSlot, depositGap } from '../lib/roadmap.js';
import { EXAMPLE_SITUATIONS } from '../lib/examples.js';

async function answerAll(text, pick = options => options[0].value) {
  let { state } = await analyzeInput(text, createInitialState());
  for (let q, guard = 0; (q = selectNextQuestion(evaluateRules(state))) && guard < 30; guard++)
    state = applyAnswer(state, q, pick(q.options));
  return state;
}
const ids = roadmap => roadmap.steps.map(step => step.id);

test('취업 예정 + 독립 예정이면 목업 순서대로 단계를 만든다', async () => {
  const roadmap = buildRoadmap(
    await answerAll('다음 달에 취업해서 반년 뒤 월세로 자취하려고 해요. 지금 천만 원 정도 모았습니다.'),
  );
  assert.equal(roadmap.status, 'complete');
  assert.deepEqual(ids(roadmap), [
    'income_expense',
    'assets_debts',
    'job_check',
    'cashflow',
    'emergency',
    'move_budget',
    'housing_type',
    'contract_check',
  ]);
  assert.deepEqual(
    roadmap.groups.map(group => group.label),
    ['지금', '입사 전', '첫 월급 후', '3개월 후', '독립 전'],
  );
  assert.equal(roadmap.steps.find(step => step.id === 'housing_type').title, '월세로 감당할 수 있는 범위 정하기');
});

test('이미 월급을 받으면 구간 이름이 바뀌고 독립 단계는 없다', async () => {
  const roadmap = buildRoadmap(await answerAll('첫 월급 260만 원 받았어요.'));
  assert.deepEqual(ids(roadmap), ['income_expense', 'cashflow', 'emergency']);
  assert.equal(roadmap.groups[1].label, '이번 달부터');
});

test('잘 모르겠어요 답변은 해당 단계에 안내를 남긴다', async () => {
  const roadmap = buildRoadmap(await answerAll('이번에 취업했어요.', options => options.at(-1).value));
  assert.equal(roadmap.steps[0].id, 'income_expense');
  assert.match(roadmap.steps[0].note, /모른다고/);
});

test('먼저 볼 단계는 지도에 있고 앞선 번호만 가리킨다', async () => {
  for (const text of [
    '다음 달에 취업해서 반년 뒤 월세로 자취하려고 해요.',
    '전세대출을 5000만원 정도 받을 생각이에요.',
    '작년에 독립했고 학자금 대출 갚고 있어요.',
  ]) {
    const roadmap = buildRoadmap(await answerAll(text));
    roadmap.steps.forEach((step, index) => {
      for (const id of step.first) assert.ok(ids(roadmap).indexOf(id) < index, `${text}: ${step.id} ← ${id}`);
      assert.ok(step.tags.length > 0 && step.how.length > 0 && step.next);
    });
  }
});

test('미정으로 보류한 이벤트는 단계 대신 보류 목록에 남는다', async () => {
  let state = await answerAll(
    '취업 준비 중인데 곧 될 것 같아요.',
    options => options.find(option => option.value === 'uncertain')?.value ?? options[0].value,
  );
  const roadmap = buildRoadmap(state);
  assert.equal(roadmap.status, 'deferred');
  assert.deepEqual(roadmap.deferred, ['취업']);
  assert.equal(roadmap.steps.length, 0);
});

test('단계 카탈로그의 id는 중복되지 않는다', () => {
  assert.equal(new Set(STEP_CATALOG.map(step => step.id)).size, STEP_CATALOG.length);
});

test('예시 상황은 모두 해석되고 서로 다른 지도를 만든다', async () => {
  const maps = [];
  for (const example of EXAMPLE_SITUATIONS) {
    const { state } = await analyzeInput(example.text, createInitialState());
    assert.ok(Object.keys(state.events).length > 0, `${example.id}: 인식한 이벤트 없음`);
    assert.equal(evaluateRules(state).pendingEvents.length, 0, `${example.id}: 상태를 다시 묻지 않아야 함`);
    const roadmap = buildRoadmap(await answerAll(example.text));
    assert.equal(roadmap.status, 'complete', example.id);
    maps.push(ids(roadmap).join(','));
  }
  assert.equal(new Set(maps).size, EXAMPLE_SITUATIONS.length);
});

test('묻는 질문은 모두 지도의 어떤 단계에 반영된다', async () => {
  const usedSlots = new Set(STEP_CATALOG.flatMap(step => step.uses || []));
  for (const slot of new Set(Object.values(EVENT_RULES).flatMap(rule => Object.values(rule).flat())))
    assert.ok(usedSlots.has(slot), `${slot}: 어느 단계의 uses에도 없음`);
  // 실제 흐름에서도 질문을 받는 순간 반영될 단계가 지도에 있어야 합니다.
  const texts = [...EXAMPLE_SITUATIONS.map(example => example.text), '이번에 취업했어요.', '독립을 준비하고 있어요.'];
  for (const text of texts)
    for (const pick of [options => options[0].value, options => options.at(-1).value]) {
      let { state } = await analyzeInput(text, createInitialState());
      for (let q, guard = 0; (q = selectNextQuestion(evaluateRules(state))) && guard < 30; guard++) {
        if (q.kind === 'slot') assert.ok(stepsUsingSlot(state, q.key).length > 0, `${text}: ${q.key}`);
        state = applyAnswer(state, q, q.kind === 'event' ? 'planned' : pick(q.options));
      }
    }
});

test('보증금과 모아둔 돈을 비교해 부족 여부를 알려 준다', () => {
  assert.equal(depositGap({ savings: 'lt500', deposit: '1000_5000' }), 'short');
  assert.equal(depositGap({ savings: '500_2000', deposit: 'gt5000' }), 'short');
  assert.equal(depositGap({ savings: 'gt2000', deposit: 'lt1000' }), 'enough');
  assert.equal(depositGap({ savings: '500_2000', deposit: '1000_5000' }), 'maybe');
  assert.equal(depositGap({ savings: 'unknown', deposit: '1000_5000' }), null);
});

test('같은 상황이라도 답에 따라 지도 내용이 달라진다', async () => {
  const text = '다음 달에 취업해서 반년 뒤 월세로 자취하려고 해요. 지금 천만 원 정도 모았습니다.';
  const answer = values => options => values.find(v => options.some(o => o.value === v)) ?? options[0].value;
  const regular = buildRoadmap(await answerAll(text, answer(['regular', '200_300', 'm6', 'lt1000'])));
  const freelance = buildRoadmap(await answerAll(text, answer(['freelance', 'lt200', 'm1', 'gt5000'])));
  assert.ok(!ids(regular).includes('irregular_income'));
  assert.ok(ids(freelance).includes('irregular_income'));
  const personal = (roadmap, id) => roadmap.steps.find(step => step.id === id).personal.join(' ');
  assert.match(personal(freelance, 'housing_type'), /모아둔 돈보다 많아요/);
  assert.match(personal(regular, 'housing_type'), /비슷한 범위/);
  assert.match(personal(freelance, 'contract_check'), /한 달 안/);
  assert.notEqual(personal(regular, 'emergency'), personal(freelance, 'emergency'));
});
