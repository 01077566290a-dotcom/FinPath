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
import { sigunguOf } from '../../lib/goal/regions.js';

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
import { SiteHeader, PrivacyNote, ArrowIcon, FlowSteps, FLOW } from '../flow/Chrome.js';
import { useFlowMode } from '../../lib/flowMode.js';

export default function GoalQuestions() {
  const [state, setState] = useState(null); // { answers, persistent }
  const [editingId, setEditingId] = useState(null);
  const [editFrom, setEditFrom] = useState(null); // 'back'(이전으로 돌아옴) | 'summary'(확인 화면에서 고치기)
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
    if (editingId) {
      // '이전'·'이전 단계'로 돌아온 경우: '다음'은 순서대로 다음 질문으로 가요 (이미 답한 질문이면 그 답을 보여 줘요)
      const list = visibleQuestions(result.answers);
      const after = list[list.findIndex(q => q.id === question.id) + 1];
      if (editFrom === 'back' && after && result.answers[after.id] !== undefined) setEditingId(after.id);
      else {
        setEditingId(null);
        setEditFrom(null);
      }
    }
    return null;
  };
  // 지금 질문 바로 앞의 질문 (입력 순서 기준)
  const prevOf = id => {
    const list = visibleQuestions(answers);
    const i = list.findIndex(q => q.id === id);
    return i > 0 ? list[i - 1].id : null;
  };
  // '이전' 버튼: 질문 하나 뒤로
  const onBack = () => {
    if (editingId && editFrom === 'summary') {
      setEditingId(null);
      setEditFrom(null);
      return true;
    }
    const prev = question ? prevOf(question.id) : visibleQuestions(answers).at(-1)?.id;
    if (!prev) return false;
    setEditingId(prev);
    setEditFrom('back');
    return true;
  };
  // 헤더 '이전 단계': 5단계에서 한 칸 뒤로 (그 단계의 첫 질문으로). 확인 화면은 ③ 다음으로 봐요.
  const stageNow = question ? stageOf(question) : 4;
  const stageTarget = stageNow - 1;
  const stageBack = () => {
    if (stageTarget < 1) return false; // ①에서는 처음 화면으로
    const first = visibleQuestions(answers).find(q => stageOf(q) === stageTarget);
    if (!first) return false;
    setEditingId(first.id);
    setEditFrom('back');
    return true;
  };
  const stageBackLabel = stageTarget >= 1 ? `${'①②③'[stageTarget - 1]} ${FLOW[stageTarget - 1].label}` : '처음 화면';
  const editFromSummary = id => {
    setEditingId(id);
    setEditFrom('summary');
  };
  const onReset = () => {
    clearAll();
    try {
      window.localStorage.removeItem('finpath.plan-done'); // 타임라인 완료 표시도 처음부터
    } catch {
      // 저장소가 막혀 있으면 그냥 넘어가요
    }
    setEditingId(null);
    setEditFrom(null);
    setState(s => ({ ...s, answers: {} }));
  };

  return (
    <Page
      onBack={stageBack}
      backLabel={stageBackLabel}
      persistent={persistent}
      step={question ? stageOf(question) : 3}
      fill={question && !editingId ? stageFill(answers, stageOf(question)) : null}
      classic={classic}
    >
      {question ? (
        <QuestionView
          key={question.id}
          question={question}
          answers={answers}
          current={answers[question.id]}
          onSubmit={onSubmit}
          onBack={question && (prevOf(question.id) || editFrom === 'summary') ? onBack : null}
          editing={editFrom === 'summary'}
          classic={classic}
        />
      ) : (
        <Summary answers={answers} onEdit={editFromSummary} onReset={onReset} classic={classic} />
      )}
    </Page>
  );
}

// 지금 단계 안에서 몇 개를 답했는지 (진행 표시를 하나로 합치려고 단계 막대에 채워서 보여줘요)
function stageFill(answers, stage) {
  const inStage = visibleQuestions(answers).filter(q => stageOf(q) === stage);
  const done = inStage.filter(q => answers[q.id] !== undefined).length;
  return { ratio: inStage.length ? done / inStage.length : 0, done, total: inStage.length };
}

function Page({ persistent, step = 1, fill = null, classic = false, onBack = null, backLabel, children }) {
  return (
    <>
      <SiteHeader back="/" backLabel={backLabel} onBack={onBack}>
        <span className="site-header__tagline">내 돈 상황 입력</span>
      </SiteHeader>
      {!classic && <FlowSteps current={step} fill={fill} />}
      <main className="flow-page">
        <div className="flow-column">
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
      {classic && !editing && (
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
        {question.group !== 'common' && <p className="goal-group">{question.group}</p>}
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
          <button type="button" className="btn btn--outline btn--md goal-prev" onClick={onBack}>
            {editing ? (
              '취소'
            ) : (
              <>
                <span aria-hidden="true">←</span> 이전
              </>
            )}
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

// 입력한 숫자를 바로 읽어 줘요. (예: 12000 → 1억 2,000만 원, 36개월 → 3년)
export function readAmount(value, unit) {
  const n = parseAmount(value);
  if (!Number.isFinite(n)) return null;
  if (unit === '만 원') {
    if (n === 0) return '0원';
    const eok = Math.floor(n / 10000);
    const rest = n % 10000;
    // 1억 이상일 때만 '1억 2,000만 원'처럼 읽어 줘요. (그보다 작으면 칸 옆 '만 원'으로 충분해요)
    return eok ? `${eok.toLocaleString()}억${rest ? ` ${rest.toLocaleString()}만` : ''} 원` : null;
  }
  if (unit === '개월' && n >= 12) return `${Math.floor(n / 12)}년${n % 12 ? ` ${n % 12}개월` : ''}`;
  return null;
}

// current: 지금 칸에 들어 있는 값. 같은 칩은 눌린 모양으로 보여 줘요.
function QuickPicks({ values, unit, onPick, label, current }) {
  const now = String(current ?? '').replace(/[^0-9]/g, '');
  if (!values?.length) return null;
  return (
    <div className="goal-quick" role="group" aria-label={label ? `${label} 빠른 선택` : '빠른 선택'}>
      {values.map(v => (
        <button
          key={v}
          type="button"
          className={`goal-quick__btn${now !== '' && now === String(v) ? ' is-on' : ''}`}
          aria-pressed={now !== '' && now === String(v)}
          onClick={() => onPick(String(v))}
        >
          {unit === '만 원' ? readShort(v) : `${v}${unit}`}
        </button>
      ))}
    </div>
  );
}

const readShort = n => (n >= 10000 && n % 10000 === 0 ? `${n / 10000}억` : `${n.toLocaleString()}만`);

function NumberField({ id, label, unit, value, onChange, quick, prefix, short }) {
  const reading = readAmount(value, unit);
  return (
    <div className="goal-field-wrap">
      <NumberInput id={id} label={label} unit={unit} value={value} onChange={onChange} prefix={prefix} short={short} />
      {reading && (
        <p className="goal-reading" aria-live="polite">
          {reading}
        </p>
      )}
      <QuickPicks values={quick} unit={unit} onPick={onChange} label={label} current={value} />
    </div>
  );
}

function NumberInput({ id, label, unit, value, onChange, prefix, short }) {
  return (
    <label className="goal-field" htmlFor={id}>
      {label && <span className="goal-field__label">{label}</span>}
      <span className={`goal-field__box${short ? ' goal-field__box--short' : ''}`}>
        {prefix && <span className="goal-field__unit goal-field__prefix">{prefix}</span>}
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

function OptionText({ option }) {
  return (
    <span className="option__text">
      {option.desc ? (
        <>
          <strong>{option.label}</strong>
          <span>{option.desc}</span>
        </>
      ) : (
        option.label
      )}
    </span>
  );
}

function Input({ question, answers, draft, setDraft, onPick }) {
  const q = question;
  // 빠른 선택은 앞의 답(목적, 집 형태)에 따라 바뀔 수 있어요.
  const quick = typeof q.quick === 'function' ? q.quick(answers) : q.quick;
  switch (q.type) {
    case 'number':
      return (
        <NumberField
          id={`f-${q.id}`}
          unit={q.unit}
          prefix={q.prefix}
          short={q.short}
          value={draft}
          onChange={setDraft}
          quick={quick}
        />
      );
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
            quick={quick?.amount}
          />
          <NumberField
            id="f-goal-months"
            label="기간"
            unit="개월"
            value={draft.months}
            onChange={v => setDraft(d => ({ ...d, months: v }))}
            quick={quick?.months}
          />
        </div>
      );
    case 'region':
      return (
        <div className="goal-fields">
          <label className="goal-field" htmlFor="f-sido">
            <span className="goal-field__label">시·도</span>
            <select id="f-sido" value={draft.sido} onChange={e => setDraft({ sido: e.target.value, sigungu: '' })}>
              <option value="">골라주세요</option>
              {SIDO.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          {sigunguOf(draft.sido).length > 0 && (
            <label className="goal-field" htmlFor="f-sigungu">
              <span className="goal-field__label">시·군·구 (선택)</span>
              <select
                id="f-sigungu"
                value={draft.sigungu}
                onChange={e => setDraft(d => ({ ...d, sigungu: e.target.value }))}
              >
                <option value="">아직 안 정했어요</option>
                {sigunguOf(draft.sido).map(name => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      );
    case 'choice':
      return (
        <div className="options" role="group" aria-labelledby="goal-question-title">
          {optionsFor(q, answers).map(o => (
            <button key={o.value} type="button" className="option" onClick={() => onPick(o.value)}>
              <span className="option__dot" aria-hidden="true" />
              <OptionText option={o} />
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
                <OptionText option={o} />
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
      return `${question.prefix ? `${question.prefix} ` : ''}${value.toLocaleString()}${question.unit === '%' || question.unit === '세' ? question.unit : ` ${question.unit}`}`;
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

// 이전 흐름의 확인 화면 (답 목록 + 정책 목록)
function ClassicSummary({ answers, onEdit, onReset }) {
  const profile = buildProfile(answers);
  const policies = profile ? filterPolicies(profile, policyData) : [];
  return (
    <section className="question review" aria-labelledby="goal-summary-title">
      <div className="flow-heading">
        <h1 id="goal-summary-title">필요한 정보를 모두 받았어요</h1>
        <p>틀린 답이 있으면 고칠 수 있어요. 고치면 리포트와 타임라인 숫자도 다시 계산돼요.</p>
      </div>
      <SummaryRows questions={visibleQuestions(answers)} answers={answers} onEdit={onEdit} />
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
        <Link href="/map" className="btn btn--outline btn--md">
          타임라인 지도 보기
        </Link>
        <Link href="/report" className="btn btn--primary btn--md">
          내 리포트 보기 <ArrowIcon />
        </Link>
      </div>
    </section>
  );
}

// 입력을 마친 화면: 다음 할 일(결과 보기) 하나만 크게. 누르면 결과 요약이 뜨고, 닫으면 타임라인이에요. 답 목록은 접어 두고, 정책은 타임라인 단계에 붙여 보여줘요.
function Summary({ answers, onEdit, onReset, classic }) {
  if (classic) return <ClassicSummary answers={answers} onEdit={onEdit} onReset={onReset} />;
  const profile = buildProfile(answers);
  const policies = profile ? filterPolicies(profile, policyData) : [];
  const rows = visibleQuestions(answers);
  return (
    <section className="question review review--done" aria-labelledby="goal-summary-title">
      <div className="flow-heading">
        <h1 id="goal-summary-title">다 됐어요. 내 결과를 만들었어요</h1>
        <p>
          답 {rows.length}개로 실제로 필요한 돈과 모으는 순서를 계산했어요.
          {policies.length > 0 && ` 나에게 맞을 수 있는 정책 ${policies.length}개는 타임라인 단계마다 붙여 두었어요.`}
        </p>
      </div>

      <div className="flow-nav flow-nav--done">
        <Link
          href="/map"
          className="btn btn--primary btn--lg"
          onClick={() => {
            // 새로 계산한 결과라서, 전에 닫은 적이 있어도 결과 요약을 다시 띄워요 (FinancialMap의 같은 키)
            try {
              window.sessionStorage.removeItem('finpath-report-closed');
            } catch {
              // 저장소가 막혀 있으면 그냥 넘어가요
            }
          }}
        >
          결과 보기 <ArrowIcon />
        </Link>
      </div>

      <details className="goal-review">
        <summary>내 답 확인하고 고치기 ({rows.length}개)</summary>
        {STAGES.map(stage => {
          const inStage = rows.filter(q => stageOf(q) === stage.n);
          if (!inStage.length) return null;
          return (
            <div key={stage.n} className="goal-summary-stage">
              <h2 className="goal-subtitle">
                {'①②③'[stage.n - 1]} {stage.label}
              </h2>
              <SummaryRows questions={inStage} answers={answers} onEdit={onEdit} />
            </div>
          );
        })}
        <button type="button" className="btn btn--ghost" onClick={onReset}>
          처음부터 다시
        </button>
      </details>
    </section>
  );
}
