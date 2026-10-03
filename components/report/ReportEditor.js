'use client';
import { useState } from 'react';

// '내 숫자로 바꿔 보기': 리포트 입력값을 직접 고쳐 보는 패널. 고치면 리포트가 바로 다시 계산됩니다.
// 입력 화면(①~③)이 연결되기 전까지 실제 사용자 값으로 리포트를 확인하는 용도입니다.
const FIELDS = [
  {
    group: '목표',
    items: [
      { path: 'goal.amount', label: '생각한 목표 금액', unit: '만 원' },
      { path: 'housing.moveInMonths', label: '독립까지 남은 기간', unit: '개월' },
    ],
  },
  {
    group: '매달 들어오고 나가는 돈',
    items: [
      { path: 'money.income', label: '월 실수령액', unit: '만 원' },
      { path: 'money.fixedNow', label: '고정지출 (지금)', unit: '만 원', hint: '통신비·보험·교통비·빚 상환 등' },
      { path: 'money.livingNow', label: '생활비 (지금)', unit: '만 원', hint: '식비·쇼핑·모임 등' },
      { path: 'money.fixedAfter', label: '고정지출 (독립 후)', unit: '만 원' },
      { path: 'money.livingAfter', label: '생활비 (독립 후)', unit: '만 원' },
    ],
  },
  {
    group: '모은 돈과 빚',
    items: [
      { path: 'money.saved', label: '지금 모아둔 돈', unit: '만 원' },
      { path: 'money.debt.balance', label: '남은 빚', unit: '만 원' },
      { path: 'money.debt.monthly', label: '매달 갚는 돈', unit: '만 원' },
    ],
  },
  {
    group: '살 곳',
    items: [
      { path: 'housing.deposit', label: '보증금', unit: '만 원' },
      { path: 'housing.monthlyCost', label: '월세 + 관리비', unit: '만 원' },
      { path: 'housing.loan', label: '대출로 채울 돈', unit: '만 원' },
      { path: 'housing.initialCost', label: '이사·초기 비용', unit: '만 원' },
    ],
  },
];

const get = (obj, path) => path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), obj);
function set(obj, path, value) {
  const copy = JSON.parse(JSON.stringify(obj));
  const keys = path.split('.');
  let cursor = copy;
  keys.slice(0, -1).forEach(key => {
    if (cursor[key] == null || typeof cursor[key] !== 'object') cursor[key] = key === 'debt' ? { label: '빚' } : {};
    cursor = cursor[key];
  });
  cursor[keys.at(-1)] = value;
  return copy;
}

export default function ReportEditor({ input, edited, onChange, onReset }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`re${open ? ' re--open' : ''}`} aria-labelledby="re-title">
      <div className="re__bar">
        <div>
          <h2 id="re-title">내 숫자로 바꿔 보기</h2>
          <p>{edited ? '직접 입력한 값으로 계산하고 있어요.' : '지금은 시연 인물(정하은)의 값이에요.'}</p>
        </div>
        <div className="re__actions">
          {edited && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onReset}>
              시연 값으로 되돌리기
            </button>
          )}
          <button
            type="button"
            className="btn btn--outline btn--sm"
            aria-expanded={open}
            aria-controls="re-fields"
            onClick={() => setOpen(value => !value)}
          >
            {open ? '접기' : '값 바꾸기'}
          </button>
        </div>
      </div>
      {open && (
        <div id="re-fields" className="re__fields">
          {FIELDS.map(group => (
            <fieldset key={group.group}>
              <legend>{group.group}</legend>
              {group.items.map(field => {
                const id = `re-${field.path.replace(/\./g, '-')}`;
                const value = get(input, field.path);
                return (
                  <label key={field.path} htmlFor={id} className="re__field">
                    <span className="re__label">
                      {field.label}
                      {field.hint && <small>{field.hint}</small>}
                    </span>
                    <span className="re__input">
                      <input
                        id={id}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step="1"
                        value={value ?? ''}
                        onChange={event => {
                          const raw = event.target.value;
                          onChange(set(input, field.path, raw === '' ? '' : Number(raw)));
                        }}
                      />
                      <span>{field.unit}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))}
          <p className="re__note">이 값은 이 브라우저에만 저장되고, 지도 화면의 리포트 팝업에도 똑같이 반영돼요.</p>
        </div>
      )}
    </section>
  );
}
