'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EVENTS, SLOTS, STATUSES, availableOptions } from '../../lib/schema.js';
import { applyAnswer } from '../../lib/state.js';
import { evaluateRules } from '../../lib/rules.js';
import { selectNextQuestion, eventQuestion, QUESTIONS } from '../../lib/questions.js';
import { useFlow } from './useFlow.js';
import { presentQuestion, displaySlotValue, STATUS_SHORT, UNKNOWN_LABEL } from './questionCopy.js';
import { SiteHeader, StepProgress, PrivacyNote, ArrowIcon } from './Chrome.js';

const MAP_READY = ['complete', 'deferred'];

export default function QuestionStep() {
  const router = useRouter();
  const { flow, update, persistent } = useFlow();
  const unrecognized = flow && !Object.keys(flow.engine.events).length;
  useEffect(() => {
    if (unrecognized) router.replace('/start');
  }, [unrecognized, router]);
  if (!flow || unrecognized) return <Shell persistent={persistent} />;

  const { engine, history } = flow;
  const result = evaluateRules(engine);
  const question = selectNextQuestion(result);
  const remaining = result.pendingEvents.length + result.missingSlots.length;

  const commit = next =>
    update(current => ({ ...current, history: [...current.history, current.engine], engine: next }));
  const goBack = () =>
    update(current => ({ ...current, engine: current.history.at(-1), history: current.history.slice(0, -1) }));

  function answer(value) {
    const next = applyAnswer(engine, question, value);
    commit(next);
    const after = evaluateRules(next);
    if (!selectNextQuestion(after) && MAP_READY.includes(after.status)) router.push('/map');
  }

  return (
    <Shell persistent={persistent}>
      <Understood text={flow.text} engine={engine} />
      {question ? (
        <QuestionCard
          key={`${question.kind}:${question.key}:${history.length}`}
          question={question}
          engine={engine}
          answered={history.length}
          total={history.length + remaining}
          focusOnMount={history.length > 0}
          onAnswer={answer}
          onBack={history.length ? goBack : null}
        />
      ) : (
        <Review engine={engine} result={result} onChange={commit} onBack={history.length ? goBack : null} />
      )}
    </Shell>
  );
}

function Shell({ children, persistent }) {
  return (
    <>
      <SiteHeader />
      <main className="flow-page">
        <div className="flow-column">
          <StepProgress current={1} />
          {children}
          <PrivacyNote persistent={persistent} />
        </div>
      </main>
    </>
  );
}

function Understood({ text, engine }) {
  const extracted = Object.entries(engine.slots).filter(
    ([key, value]) => value !== null && engine.meta.slotSources[key] === 'extracted',
  );
  return (
    <section className="card understood" aria-label="이해한 내용">
      <p className="understood__label">이렇게 이해했어요. 말씀하신 내용은 다시 묻지 않아요.</p>
      <blockquote className="understood__quote">“{text}”</blockquote>
      <ul className="tag-list">
        {Object.entries(engine.events).map(([type, event]) => (
          <li key={type} className="tag">
            {EVENTS[type]} · {STATUS_SHORT[event.status]}
          </li>
        ))}
        {extracted.map(([key, value]) => (
          <li key={key} className="tag tag--soft">
            {SLOTS[key].label} · {displaySlotValue(key, value, SLOTS[key].options)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuestionCard({ question, engine, answered, total, focusOnMount, onAnswer, onBack }) {
  const [selected, setSelected] = useState(null);
  const titleRef = useRef(null);
  useEffect(() => {
    if (focusOnMount) titleRef.current?.focus();
  }, [focusOnMount]);
  const view = presentQuestion(question);
  const choice = view.options.find(option => option.value === selected);

  // 이 답으로 질문이 끝나는지 미리 계산해 버튼 문구를 정합니다.
  let finishes = false;
  if (selected) {
    const after = evaluateRules(applyAnswer(engine, question, selected));
    finishes = !selectNextQuestion(after) && MAP_READY.includes(after.status);
  }

  return (
    <section className="question" aria-labelledby="question-title">
      <div className="question__progress">
        <div className="segments" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={i < answered ? 'is-done' : i === answered ? 'is-current' : ''} />
          ))}
        </div>
        <span className="question__count">
          {answered + 1} / {total}
        </span>
      </div>
      <div className="flow-heading">
        <h1 id="question-title" ref={titleRef} tabIndex={-1}>
          {view.title}
        </h1>
        <p>{view.hint}</p>
      </div>
      <div className="options" role="group" aria-labelledby="question-title">
        {view.options.map(option => (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected === option.value}
            className="option"
            onClick={() => setSelected(option.value)}
          >
            <span className="option__dot" aria-hidden="true" />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
      {choice?.unknown && (
        <p className="info-note" role="status">
          {view.unknownNote}
        </p>
      )}
      <div className="flow-nav">
        {onBack ? (
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            이전 질문
          </button>
        ) : (
          <Link href="/start" className="btn btn--ghost">
            상황 다시 쓰기
          </Link>
        )}
        <button
          type="button"
          className="btn btn--primary btn--md"
          disabled={!selected}
          onClick={() => onAnswer(selected)}
        >
          {finishes ? '내 지도 보기' : '다음 질문'} <ArrowIcon />
        </button>
      </div>
    </section>
  );
}

function Review({ engine, result, onChange, onBack }) {
  const ready = MAP_READY.includes(result.status);
  const setEvent = (type, value) => onChange(applyAnswer(engine, eventQuestion(type), value));
  const setSlot = (key, value) =>
    onChange(
      value ? applyAnswer(engine, QUESTIONS[key], value) : { ...engine, slots: { ...engine.slots, [key]: null } },
    );

  return (
    <section className="question review" aria-labelledby="review-title">
      <div className="flow-heading">
        <h1 id="review-title">{ready ? '필요한 내용을 모두 확인했어요' : '지도에 담을 계획이 없어요'}</h1>
        <p>
          {ready
            ? '답을 바꾸고 싶으면 아래에서 고칠 수 있어요. 바꾸면 지도도 다시 만들어요.'
            : '말씀하신 계획이 모두 해당 없음이에요. 상태를 바꾸거나 상황을 다시 적어 주세요.'}
        </p>
      </div>
      <dl className="review__list">
        {Object.entries(engine.events).map(([type, event]) => (
          <div key={type} className="review__row">
            <dt>
              <label htmlFor={`event-${type}`}>{EVENTS[type]}</label>
            </dt>
            <dd>
              <select id={`event-${type}`} value={event.status} onChange={e => setEvent(type, e.target.value)}>
                {Object.keys(STATUSES).map(value => (
                  <option key={value} value={value}>
                    {value === 'uncertain' ? `${UNKNOWN_LABEL} (보류)` : STATUS_SHORT[value]}
                  </option>
                ))}
              </select>
            </dd>
          </div>
        ))}
        {result.requiredSlots.map(key => (
          <div key={key} className="review__row">
            <dt>
              <label htmlFor={`slot-${key}`}>{SLOTS[key].label}</label>
            </dt>
            <dd>
              <select id={`slot-${key}`} value={engine.slots[key] ?? ''} onChange={e => setSlot(key, e.target.value)}>
                <option value="">다시 답하기</option>
                {availableOptions(key, engine.events).map(option => (
                  <option key={option.value} value={option.value}>
                    {displaySlotValue(key, option.value, SLOTS[key].options)}
                  </option>
                ))}
              </select>
            </dd>
          </div>
        ))}
      </dl>
      {result.deferredEvents.length > 0 && (
        <p className="info-note">
          보류한 계획: {result.deferredEvents.map(type => EVENTS[type]).join(', ')}. 정해지면 상태를 바꿔 지도에 넣을 수
          있어요.
        </p>
      )}
      <div className="flow-nav">
        {onBack ? (
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            이전 질문
          </button>
        ) : (
          <Link href="/start" className="btn btn--ghost">
            상황 다시 쓰기
          </Link>
        )}
        {ready ? (
          <Link href="/map" className="btn btn--primary btn--md">
            내 지도 보기 <ArrowIcon />
          </Link>
        ) : (
          <Link href="/start" className="btn btn--primary btn--md">
            상황 다시 쓰기 <ArrowIcon />
          </Link>
        )}
      </div>
    </section>
  );
}
