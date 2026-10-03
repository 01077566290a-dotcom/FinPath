'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  QUESTION_BY_ID,
  UNKNOWN,
  SIDO,
  CUTTABLE_ITEMS,
  STAGES,
  stageOf,
  optionsFor,
} from '../../lib/goal/questions.js';

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => THIS_YEAR + i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
import {
  answer,
  skip,
  nextQuestion,
  progress,
  buildProfile,
  parseAmount,
  visibleQuestions,
} from '../../lib/goal/engine.js';
import { loadAnswers, saveAnswers, clearAll } from '../../lib/goal/store.js';
import { filterPolicies } from '../../lib/goal/policies.js';
import { policyData } from '../../lib/goal/policyData.js';
import { SiteHeader, PrivacyNote, ArrowIcon, FlowSteps } from '../flow/Chrome.js';
import { useFlowMode } from '../../lib/flowMode.js';

export default function GoalQuestions() {
  const [state, setState] = useState(null); // { answers, persistent }
  const [history, setHistory] = useState([]); // 지나온 질문 id (이전 질문 버튼용)
  const [editingId, setEditingId] = useState(null);
  const classic = useFlowMode() === 'classic'; // 이전 흐름으로 보기 (lib/flowMode.js)

  useEffect(() => setState(loadAnswers()), []);
  if (!state) return <Page persistent />;

  const { answers, persistent } = state;
  const question = editingId ? QUESTION_BY_ID[editingId] : nextQuestion(answers);

  const commit = next => {
    saveAnswers(next);
    setState(s => ({ ...s, answers: next }));
  };
  const onSubmit = value => {
    const result = value === 'skipped' ? skip(answers, question.id) : answer(answers, question.id, value);
    if (result.error) return result.error;
    commit(result.answers);
    if (editingId) setEditingId(null);
    else setHistory(h => [...h, question.id]);
    return null;
  };
  const onBack = () => {
    if (editingId) return setEditingId(null);
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory(h => h.slice(0, -1));
    setEditingId(prev);
  };
  const onReset = () => {
    clearAll();
    setHistory([]);
    setEditingId(null);
    setState(s => ({ ...s, answers: {} }));
  };

  return (
    <Page persistent={persistent} step={question ? stageOf(question) : 3} classic={classic}>
      {question ? (
        <QuestionView
          key={question.id}
          question={question}
          answers={answers}
          current={answers[question.id]}
          onSubmit={onSubmit}
          onBack={history.length || editingId ? onBack : null}
          editing={Boolean(editingId)}
          classic={classic}
        />
      ) : (
        <Summary answers={answers} onEdit={setEditingId} onReset={onReset} classic={classic} />
      )}
    </Page>
  );
}

function Page({ persistent, step = 1, classic = false, children }) {
  return (
    <>
      <SiteHeader>
        <span className="site-header__tagline">내 돈 상황 입력</span>
      </SiteHeader>
      <main className="flow-page">
        <div className="flow-column">
          {!classic && <FlowSteps current={step} />}
          {children}
          <PrivacyNote persistent={persistent} />
        </div>
      </main>
    </>
  );
}

function QuestionView({ question, answers, current, onSubmit, onBack, editing, classic }) {
  const [draft, setDraft] = useState(() => initialDraft(question, current));
  const [error, setError] = useState(null);
  const titleRef = useRef(null);
  useEffect(() => titleRef.current?.focus(), []);
  const { answered, total } = progress(answers);

  const submit = value => setError(onSubmit(value));
  const submitDraft = () => submit(draftToValue(question, draft));

  return (
    <section className="question" aria-labelledby="goal-question-title">
      {!editing && (
        <div className="question__progress">
          <div className="segments" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={i < answered ? 'is-done' : i === answered ? 'is-current' : ''} />
            ))}
          </div>
          <span className="question__count">
            {Math.min(answered + 1, total)} / {total}
          </span>
        </div>
      )}
      <div className="flow-heading">
        {classic ? (
          question.group !== 'common' && <p className="goal-group">{question.group}</p>
        ) : (
          <p className="goal-group">
            {'①②③'[stageOf(question) - 1]} {STAGES[stageOf(question) - 1].label}
            {question.group !== 'common' && ` · ${question.group}`}
          </p>
        )}
        <h1 id="goal-question-title" ref={titleRef} tabIndex={-1}>
          {question.title}
        </h1>
        {question.hint && <p>{question.hint}</p>}
      </div>

      <Input question={question} answers={answers} draft={draft} setDraft={setDraft} onPick={submit} />

      {error && (
        <p className="info-note goal-error" role="alert">
          {error}
        </p>
      )}

      <div className="flow-nav">
        {onBack ? (
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            {editing ? '취소' : '이전 질문'}
          </button>
        ) : (
          <Link href="/" className="btn btn--ghost">
            처음으로
          </Link>
        )}
        <div className="goal-nav-right">
          {question.allowUnknown && question.type !== 'choice' && (
            <button type="button" className="btn btn--ghost" onClick={() => submit(UNKNOWN)}>
              잘 모르겠어요
            </button>
          )}
          {question.optional && (
            <button type="button" className="btn btn--ghost" onClick={() => submit('skipped')}>
              건너뛰기
            </button>
          )}
          {question.type !== 'choice' && (
            <button type="button" className="btn btn--primary btn--md" onClick={submitDraft}>
              {editing ? '고치기' : '다음'} <ArrowIcon />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function initialDraft(question, current) {
  const known = current !== undefined && current !== UNKNOWN && current !== 'skipped';
  switch (question.type) {
    case 'number':
      return known ? String(current) : '';
    case 'numbers':
      return Object.fromEntries(question.fields.map(f => [f.key, known ? String(current[f.key]) : '']));
    case 'goal':
      return known ? { amount: String(current.amount), months: String(current.months) } : { amount: '', months: '' };
    case 'region':
      return known ? { sido: current.sido, sigungu: current.sigungu || '' } : { sido: '', sigungu: '' };
    case 'items':
      return Object.fromEntries(question.items.map(i => [i, known && current[i] ? String(current[i]) : '']));
    case 'yearMonth': {
      const [y, m] = known ? current.split('-') : ['', ''];
      return { year: y, month: m ? String(Number(m)) : '' };
    }
    case 'multi':
      return known ? [...current] : [];
    case 'cuttable':
      return known ? Object.fromEntries(current.map(c => [c.item, String(c.monthly)])) : {};
    default:
      return null;
  }
}

function draftToValue(question, draft) {
  switch (question.type) {
    case 'number':
      return parseAmount(draft);
    case 'numbers':
      return Object.fromEntries(question.fields.map(f => [f.key, parseAmount(draft[f.key])]));
    case 'goal':
      return { amount: parseAmount(draft.amount), months: parseAmount(draft.months) };
    case 'region':
      return { sido: draft.sido, sigungu: draft.sigungu.trim() || null };
    case 'items':
      return Object.fromEntries(
        Object.entries(draft)
          .filter(([, v]) => String(v).trim() !== '')
          .map(([k, v]) => [k, parseAmount(v)]),
      );
    case 'yearMonth':
      return draft.year && draft.month ? `${draft.year}-${String(draft.month).padStart(2, '0')}` : '';
    case 'multi':
      return draft;
    case 'cuttable':
      return Object.entries(draft).map(([item, monthly]) => ({ item, monthly: parseAmount(monthly) }));
    default:
      return draft;
  }
}

function NumberField({ id, label, unit, value, onChange }) {
  return (
    <label className="goal-field" htmlFor={id}>
      {label && <span className="goal-field__label">{label}</span>}
      <span className="goal-field__box">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        {unit && <span className="goal-field__unit">{unit}</span>}
      </span>
    </label>
  );
}

function Input({ question, answers, draft, setDraft, onPick }) {
  const q = question;
  switch (q.type) {
    case 'number':
      return <NumberField id={`f-${q.id}`} unit={q.unit} value={draft} onChange={setDraft} />;
    case 'numbers':
      return (
        <div className="goal-fields">
          {q.fields.map(f => (
            <NumberField
              key={f.key}
              id={`f-${q.id}-${f.key}`}
              label={f.label}
              unit={f.unit}
              value={draft[f.key]}
              onChange={v => setDraft(d => ({ ...d, [f.key]: v }))}
            />
          ))}
        </div>
      );
    case 'items':
      return (
        <div className="goal-fields goal-fields--grid">
          {q.items.map(item => (
            <NumberField
              key={item}
              id={`f-${q.id}-${item}`}
              label={item}
              unit={q.unit}
              value={draft[item]}
              onChange={v => setDraft(d => ({ ...d, [item]: v }))}
            />
          ))}
        </div>
      );
    case 'yearMonth':
      return (
        <div className="goal-fields goal-fields--row">
          <label className="goal-field" htmlFor={`f-${q.id}-year`}>
            <span className="goal-field__label">연도</span>
            <select
              id={`f-${q.id}-year`}
              value={draft.year}
              onChange={e => setDraft(d => ({ ...d, year: e.target.value }))}
            >
              <option value="">연도</option>
              {YEARS.map(y => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </label>
          <label className="goal-field" htmlFor={`f-${q.id}-month`}>
            <span className="goal-field__label">달</span>
            <select
              id={`f-${q.id}-month`}
              value={draft.month}
              onChange={e => setDraft(d => ({ ...d, month: e.target.value }))}
            >
              <option value="">달</option>
              {MONTHS.map(m => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
          </label>
        </div>
      );
    case 'goal':
      return (
        <div className="goal-fields">
          <NumberField
            id="f-goal-amount"
            label="모으고 싶은 돈"
            unit="만 원"
            value={draft.amount}
            onChange={v => setDraft(d => ({ ...d, amount: v }))}
          />
          <NumberField
            id="f-goal-months"
            label="기간"
            unit="개월"
            value={draft.months}
            onChange={v => setDraft(d => ({ ...d, months: v }))}
          />
        </div>
      );
    case 'region':
      return (
        <div className="goal-fields">
          <label className="goal-field" htmlFor="f-sido">
            <span className="goal-field__label">시·도</span>
            <select id="f-sido" value={draft.sido} onChange={e => setDraft(d => ({ ...d, sido: e.target.value }))}>
              <option value="">골라주세요</option>
              {SIDO.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="goal-field" htmlFor="f-sigungu">
            <span className="goal-field__label">시·군·구 (선택)</span>
            <span className="goal-field__box">
              <input
                id="f-sigungu"
                type="text"
                placeholder="예: 마포구"
                value={draft.sigungu}
                onChange={e => setDraft(d => ({ ...d, sigungu: e.target.value }))}
              />
            </span>
          </label>
        </div>
      );
    case 'choice':
      return (
        <div className="options" role="group" aria-labelledby="goal-question-title">
          {optionsFor(q, answers).map(o => (
            <button key={o.value} type="button" className="option" onClick={() => onPick(o.value)}>
              <span className="option__dot" aria-hidden="true" />
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      );
    case 'multi':
      return (
        <div className="options" role="group" aria-labelledby="goal-question-title">
          {optionsFor(q, answers).map(o => {
            const on = draft.includes(o.value);
            const full = !on && draft.length >= q.max;
            return (
              <button
                key={o.value}
                type="button"
                className="option option--check"
                aria-pressed={on}
                disabled={full}
                onClick={() => setDraft(d => (on ? d.filter(v => v !== o.value) : [...d, o.value]))}
              >
                <span className="option__box" aria-hidden="true" />
                <span className="option__text">{o.label}</span>
              </button>
            );
          })}
        </div>
      );
    case 'cuttable':
      return (
        <div className="options" role="group" aria-labelledby="goal-question-title">
          {CUTTABLE_ITEMS.map(item => {
            const on = draft[item] !== undefined;
            return (
              <div key={item} className="goal-cut">
                <button
                  type="button"
                  className="option option--check"
                  aria-pressed={on}
                  onClick={() =>
                    setDraft(d => {
                      const next = { ...d };
                      if (on) delete next[item];
                      else next[item] = '';
                      return next;
                    })
                  }
                >
                  <span className="option__box" aria-hidden="true" />
                  <span className="option__text">{item}</span>
                </button>
                {on && (
                  <NumberField
                    id={`f-cut-${item}`}
                    label="한 달에 줄일 금액"
                    unit="만 원"
                    value={draft[item]}
                    onChange={v => setDraft(d => ({ ...d, [item]: v }))}
                  />
                )}
              </div>
            );
          })}
        </div>
      );
    default:
      return null;
  }
}

function show(question, value) {
  if (value === UNKNOWN) return '잘 모르겠어요';
  if (value === 'skipped') return '건너뜀';
  switch (question.type) {
    case 'number':
      return `${value.toLocaleString()}${question.unit === '%' ? '%' : ` ${question.unit}`}`;
    case 'numbers':
      return question.fields.map(f => `${f.label} ${value[f.key].toLocaleString()} ${f.unit}`).join(', ');
    case 'items': {
      const entries = Object.entries(value).filter(([, v]) => v > 0);
      return entries.length ? entries.map(([k, v]) => `${k} ${v}`).join(', ') + ' (만 원)' : '없음';
    }
    case 'yearMonth': {
      const [y, m] = value.split('-');
      return `${y}년 ${Number(m)}월`;
    }
    case 'goal':
      return `${value.months}개월 동안 ${value.amount.toLocaleString()} 만 원`;
    case 'region':
      return [value.sido, value.sigungu].filter(Boolean).join(' ');
    case 'multi':
      return value.join(', ');
    case 'cuttable':
      return value.length ? value.map(c => `${c.item} ${c.monthly}만 원`).join(', ') : '없음';
    case 'choice':
      return optionsFor(question, {}).find(o => o.value === value)?.label ?? value;
    default:
      return String(value);
  }
}

function SummaryRows({ questions, answers, onEdit }) {
  return (
    <dl className="card goal-summary">
      {questions.map(q => (
        <div key={q.id} className="goal-summary__row">
          <dt>{q.title}</dt>
          <dd>
            <span>{show(q, answers[q.id])}</span>
            <button type="button" className="btn btn--ghost goal-edit" onClick={() => onEdit(q.id)}>
              고치기
            </button>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Summary({ answers, onEdit, onReset, classic }) {
  const profile = buildProfile(answers);
  const policies = profile ? filterPolicies(profile, policyData) : [];
  return (
    <section className="question review" aria-labelledby="goal-summary-title">
      <div className="flow-heading">
        <h1 id="goal-summary-title">필요한 정보를 모두 받았어요</h1>
        <p>
          {classic
            ? '틀린 답이 있으면 고칠 수 있어요. 고치면 리포트와 타임라인 숫자도 다시 계산돼요.'
            : '①~③에서 답한 내용이에요. 틀린 답은 여기서 고치면 ④ 타임라인과 ⑤ 리포트 숫자가 함께 다시 계산돼요.'}
        </p>
      </div>

      {classic ? (
        <SummaryRows questions={visibleQuestions(answers)} answers={answers} onEdit={onEdit} />
      ) : (
        STAGES.map(stage => {
          const rows = visibleQuestions(answers).filter(q => stageOf(q) === stage.n);
          if (!rows.length) return null;
          return (
            <div key={stage.n} className="goal-summary-stage">
              <h2 className="goal-subtitle">
                {'①②③'[stage.n - 1]} {stage.label}
              </h2>
              <SummaryRows questions={rows} answers={answers} onEdit={onEdit} />
            </div>
          );
        })
      )}

      <h2 className="goal-subtitle">나에게 맞을 수 있는 정책 {policies.length}개</h2>
      {policies.length === 0 ? (
        <p className="info-note">지금 입력한 목적·지역·나이에 맞는 정책을 찾지 못했어요.</p>
      ) : (
        <ul className="goal-policies">
          {policies.map(p => (
            <li key={p.id} className="card goal-policy">
              <strong>{p.name}</strong>
              <p>{p.summary}</p>
              <p className="goal-policy__note">{p.condition_note}</p>
              <a href={p.url} target="_blank" rel="noreferrer">
                공식 안내 보기
              </a>
              {p.source === 'gov24' && <span className="goal-policy__source">보조금24에서 가져옴</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="disclaimer">
        대상일 수 있는 정책이에요. 실제 대상 여부와 신청 시기는 공식 안내에서 확인하세요. (확인 기준일{' '}
        {policyData.checked_at}
        {policyData.fetched_at ? `, 보조금24 수집일 ${policyData.fetched_at}` : ''})
      </p>

      <div className="flow-nav">
        <button type="button" className="btn btn--ghost" onClick={onReset}>
          처음부터 다시
        </button>
        {classic ? (
          <>
            <Link href="/map" className="btn btn--outline btn--md">
              타임라인 지도 보기
            </Link>
            <Link href="/report" className="btn btn--primary btn--md">
              내 리포트 보기 <ArrowIcon />
            </Link>
          </>
        ) : (
          <>
            <Link href="/report" className="btn btn--outline btn--md">
              리포트만 보기
            </Link>
            <Link href="/map" className="btn btn--primary btn--md">
              ④ 타임라인 보기 <ArrowIcon />
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
