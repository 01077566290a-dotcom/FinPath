import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeInput } from '../lib/pipeline.js';
import { createInitialState, applyAnswer } from '../lib/state.js';
import { evaluateRules } from '../lib/rules.js';
import { selectNextQuestion } from '../lib/questions.js';
import { buildRoadmap, STEP_CATALOG } from '../lib/roadmap.js';

async function answerAll(text, pick = options => options[0].value) {
  let { state } = await analyzeInput(text, createInitialState());
  for (let q, guard = 0; (q = selectNextQuestion(evaluateRules(state))) && guard < 30; guard++) state = applyAnswer(state, q, pick(q.options));
  return state;
}
const ids = roadmap => roadmap.steps.map(step => step.id);

test('취업 예정 + 독립 예정이면 목업 순서대로 단계를 만든다', async () => {
  const roadmap = buildRoadmap(await answerAll('다음 달에 취업해서 반년 뒤 월세로 자취하려고 해요. 지금 천만 원 정도 모았습니다.'));
  assert.equal(roadmap.status, 'complete');
  assert.deepEqual(ids(roadmap), ['income_expense', 'assets_debts', 'job_check', 'cashflow', 'emergency', 'move_budget', 'housing_type', 'contract_check']);
  assert.deepEqual(roadmap.groups.map(group => group.label), ['지금', '입사 전', '첫 월급 후', '3개월 후', '독립 전']);
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
  for (const text of ['다음 달에 취업해서 반년 뒤 월세로 자취하려고 해요.', '전세대출을 5000만원 정도 받을 생각이에요.', '작년에 독립했고 학자금 대출 갚고 있어요.']) {
    const roadmap = buildRoadmap(await answerAll(text));
    roadmap.steps.forEach((step, index) => {
      for (const id of step.first) assert.ok(ids(roadmap).indexOf(id) < index, `${text}: ${step.id} ← ${id}`);
      assert.ok(step.tags.length > 0 && step.how.length > 0 && step.next);
    });
  }
});

test('미정으로 보류한 이벤트는 단계 대신 보류 목록에 남는다', async () => {
  let state = await answerAll('취업 준비 중인데 곧 될 것 같아요.', options => options.find(option => option.value === 'uncertain')?.value ?? options[0].value);
  const roadmap = buildRoadmap(state);
  assert.equal(roadmap.status, 'deferred');
  assert.deepEqual(roadmap.deferred, ['취업']);
  assert.equal(roadmap.steps.length, 0);
});

test('단계 카탈로그의 id는 중복되지 않는다', () => {
  assert.equal(new Set(STEP_CATALOG.map(step => step.id)).size, STEP_CATALOG.length);
});
