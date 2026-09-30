import test from 'node:test';
import assert from 'node:assert/strict';
import { languageCases } from './fixtures/language-cases.js';
import { ruleExtractor } from '../lib/extractors/ruleExtractor.js';
import { analyzeInput } from '../lib/pipeline.js';
import { createInitialState, applyAnswer } from '../lib/state.js';
import { evaluateRules } from '../lib/rules.js';
import { selectNextQuestion, QUESTIONS } from '../lib/questions.js';

for (const example of languageCases)
  test(`언어 회귀: ${example.text}`, async () => {
    const actual = await ruleExtractor(example.text);
    assert.deepEqual(Object.fromEntries(actual.events.map(event => [event.type, event.status])), example.events);
    for (const [key, value] of Object.entries(example.slots)) assert.equal(actual.slots[key], value, key);
  });

test('이미 취업한 사용자는 예정 시기를 선택할 수 없고 3년 초과도 답할 수 있다', async () => {
  const { state } = await analyzeInput('취업했어요.', createInitialState());
  const question = selectNextQuestion(evaluateRules(state));
  assert.equal(question.key, 'employment_timing');
  assert.deepEqual(
    question.options.map(option => option.value),
    ['lt1y', 'y1_3', 'gt3y'],
  );
  assert.throws(() => applyAnswer(state, QUESTIONS.employment_timing, 'upcoming'));
  assert.equal(applyAnswer(state, question, 'gt3y').slots.employment_timing, 'gt3y');
});
test('월소득 범위가 불명확하면 확보된 정보로 간주하지 않고 질문한다', async () => {
  const { state } = await analyzeInput('다음 달 취업해요. 월급 250~350만원 받을 예정이에요.', createInitialState());
  assert.ok(evaluateRules(state).missingSlots.includes('monthly_income'));
});
