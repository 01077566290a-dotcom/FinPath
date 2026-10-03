'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { visibleQuestions } from '../../lib/goal/engine.js';
import { UNKNOWN } from '../../lib/goal/questions.js';

// '빠르게 숫자 바꿔 보기' (리포트 맨 아래, 시연용 보조 도구): 입력 화면(/goal)의 숫자 답을 리포트에서 바로 고칩니다.
// 답 고치기의 기본 자리는 입력 단계(①~③)의 확인 화면이에요.
// 고친 값은 1번 엔진이 검증하고 같은 저장소에 저장되어, 리포트·지도·입력 화면이 모두 같은 값을 씁니다.
// 고르는 질문(목적·지역·집 형태 등)은 입력 화면에서 바꿉니다.
const EDITABLE = ['number', 'numbers', 'goal', 'yearMonth', 'cuttable'];
const SHORT_LABEL = {
  income: '월 실수령액',
  saving_now: '매달 모으는 돈',
  saved: '지금 모아둔 돈',
  debt: '빚',
  goal: '생각한 목표',
  age: '나이',
  deposit: '보증금',
  rent: '월세 · 관리비',
  move_in: '입주 시기',
  commute_after: '독립 후 교통비',
  loan_amount: '대출 받을 돈',
  wedding_when: '결혼 시기',
  wedding_cost: '결혼 총비용',
  family_support: '가족 지원',
  partner_share: '배우자 부담 비율',
  invest_months: '투자 기간',
  invest_monthly: '매달 투자할 돈',
  debt_period: '빚 갚을 기간',
  cuttable: '줄일 수 있는 지출',
};
const GROUPS = [
  ['내 돈 상황', ['income', 'saving_now', 'saved', 'debt', 'age']],
  ['목표', ['goal']],
  ['주거', ['deposit', 'rent', 'move_in', 'commute_after', 'loan_amount']],
  ['결혼', ['wedding_when', 'wedding_cost', 'family_support', 'partner_share']],
  ['투자 · 빚 상환', ['invest_months', 'invest_monthly', 'debt_period']],
  ['아낄 수 있는 것', ['cuttable']],
];

const isUnknown = value => value === UNKNOWN || value === undefined || value === null;

// 숫자 칸 하나: 입력하는 동안은 그대로 두고, 칸을 벗어나거나 Enter를 누르면 저장합니다.
function NumberInput({ id, value, unit, onCommit, type = 'number' }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  const commit = () => {
    if (String(draft) === String(value ?? '')) return;
    onCommit(type === 'number' ? (draft === '' ? '' : Number(draft)) : draft);
  };
  return (
    <span className="re__input">
      <input
        id={id}
        type={type}
        inputMode={type === 'number' ? 'numeric' : undefined}
        min={type === 'number' ? '0' : undefined}
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') commit();
        }}
      />
      {unit && <span>{unit}</span>}
    </span>
  );
}

function Field({ question, answers, onAnswer }) {
  const [error, setError] = useState(null);
  const value = answers[question.id];
  const id = `re-${question.id}`;
  const save = next => setError(onAnswer(question.id, next));
  const label = SHORT_LABEL[question.id] || question.title;

  let control;
  if (question.type === 'number')
    control = (
      <NumberInput
        id={id}
        value={isUnknown(value) ? '' : value}
        unit={question.unit}
        onCommit={v => save(v === '' && question.allowUnknown ? UNKNOWN : v)}
      />
    );
  else if (question.type === 'numbers')
    control = (
      <span className="re__group">
        {question.fields.map(field => (
          <label key={field.key} className="re__sub">
            <small>{field.label}</small>
            <NumberInput
              id={`${id}-${field.key}`}
              value={isUnknown(value) ? '' : value?.[field.key]}
              unit={field.unit}
              onCommit={v => save({ ...(isUnknown(value) ? {} : value), [field.key]: v })}
            />
          </label>
        ))}
      </span>
    );
  else if (question.type === 'goal')
    control = (
      <span className="re__group">
        <label className="re__sub">
          <small>금액</small>
          <NumberInput
            id={`${id}-amount`}
            value={isUnknown(value) ? '' : value.amount}
            unit="만 원"
            onCommit={v => save({ months: isUnknown(value) ? 12 : value.months, amount: v })}
          />
        </label>
        <label className="re__sub">
          <small>기간</small>
          <NumberInput
            id={`${id}-months`}
            value={isUnknown(value) ? '' : value.months}
            unit="개월"
            onCommit={v => save({ amount: isUnknown(value) ? 0 : value.amount, months: v })}
          />
        </label>
      </span>
    );
  else if (question.type === 'yearMonth') control = <NumberInput id={id} type="month" value={value} onCommit={save} />;
  else if (question.type === 'cuttable')
    control = (
      <span className="re__group">
        {(Array.isArray(value) ? value : []).map((item, i) => (
          <label key={item.item} className="re__sub">
            <small>{item.item}</small>
            <NumberInput
              id={`${id}-${i}`}
              value={item.monthly}
              unit="만 원"
              onCommit={v => save(value.map((c, j) => (j === i ? { ...c, monthly: v } : c)))}
            />
          </label>
        ))}
        {!(Array.isArray(value) && value.length) && (
          <small className="re__hint">입력 화면에서 줄일 항목을 고를 수 있어요.</small>
        )}
      </span>
    );

  return (
    <div className="re__field">
      <label
        htmlFor={question.type === 'number' || question.type === 'yearMonth' ? id : undefined}
        className="re__label"
      >
        {label}
      </label>
      {control}
      {error && (
        <p className="re__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function ReportEditor({ answers, mode, onAnswer, onReset }) {
  const [open, setOpen] = useState(false);
  const visible = answers ? visibleQuestions(answers).filter(q => EDITABLE.includes(q.type)) : [];
  const byId = Object.fromEntries(visible.map(q => [q.id, q]));
  const groups = GROUPS.map(([title, ids]) => [title, ids.map(id => byId[id]).filter(Boolean)]).filter(
    ([, items]) => items.length,
  );

  return (
    <section className={`re${open ? ' re--open' : ''}`} aria-labelledby="re-title">
      <div className="re__bar">
        <div>
          <h2 id="re-title">빠르게 숫자 바꿔 보기</h2>
          <p>
            {mode === 'demo'
              ? '시연 인물(정하은)의 숫자를 바꿔 보며 리포트가 어떻게 달라지는지 볼 수 있어요. 고치면 내 답으로 저장돼요.'
              : mode === 'partial'
                ? '입력 화면을 마치면 여기서 고칠 수 있어요.'
                : '숫자만 빠르게 바꿔 볼 수 있어요. 모든 답은 ‘답 고치기’(입력 확인 화면)에서 고쳐요.'}
          </p>
        </div>
        <div className="re__actions">
          {mode === 'mine' && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onReset}>
              시연 값으로 되돌리기
            </button>
          )}
          {mode === 'partial' ? (
            <Link href="/goal" className="btn btn--primary btn--sm">
              입력 이어서 하기
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn--outline btn--sm"
              aria-expanded={open}
              aria-controls="re-fields"
              onClick={() => setOpen(value => !value)}
            >
              {open ? '접기' : '값 바꾸기'}
            </button>
          )}
        </div>
      </div>
      {open && mode !== 'partial' && (
        <div id="re-fields" className="re__fields">
          {groups.map(([title, items]) => (
            <fieldset key={title}>
              <legend>{title}</legend>
              {items.map(question => (
                <Field key={question.id} question={question} answers={answers} onAnswer={onAnswer} />
              ))}
            </fieldset>
          ))}
          <p className="re__note">
            목적·지역·집 형태처럼 고르는 답은 <Link href="/goal">입력 화면</Link>에서 바꿔요. 값은 이 브라우저에만
            저장되고, 지도 화면의 리포트에도 똑같이 반영돼요.
          </p>
        </div>
      )}
    </section>
  );
}
