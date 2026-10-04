'use client';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';

// ④ 누워 있는 타임라인.
// 가로 줄기 위에 단계 카드를 위·아래로 번갈아 놓고, 시기(지금 · 2027년 1월 …)를 줄기 위에 표시해요.
//  - 마우스를 올리면 카드가 커져요.
//  - 카드를 누르거나 ← → 방향키를 누르면 그 단계의 상세 박스가 리포트처럼 화면 가운데 크게 떠요.
//  - 크게 뜬 상태에서 ← → (휴대폰은 밀기)로 다음·이전 단계로 넘어가고, 뒤의 타임라인도 따라 움직여요.
// 기존 전체 지도(MapBoard)와 같은 roadmap 데이터를 써서 완료 표시가 서로 이어져요.

const SWIPE = 50;
const isTyping = t => ['INPUT', 'TEXTAREA', 'SELECT'].includes(t?.tagName) || t?.isContentEditable;
const Check = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

function Spotlight({ steps, index, dir, open, done, onClose, onMove, onToggleDone, onOpenReport, policyDate }) {
  const ref = useRef(null);
  const start = useRef(null);
  const step = steps[index];

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const isLast = index === steps.length - 1;
  return (
    <dialog
      ref={ref}
      className="spot"
      aria-labelledby="spot-title"
      onClose={onClose}
      onClick={event => {
        if (event.target === ref.current) onClose();
      }}
      onKeyDown={event => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          onMove(index + 1);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          onMove(index - 1);
        }
      }}
      onPointerDown={event => {
        if (event.pointerType !== 'mouse') start.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={event => {
        if (!start.current) return;
        const dx = event.clientX - start.current.x;
        const dy = event.clientY - start.current.y;
        start.current = null;
        if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy) * 1.5) onMove(index + (dx < 0 ? 1 : -1));
      }}
    >
      {open && step && (
        <div className="spot__frame">
          <div className="spot__bar">
            <p className="spot__count">
              <b>
                {index + 1} / {steps.length}
              </b>
              <span>{step.phaseLabel}</span>
            </p>
            <button type="button" className="btn btn--outline btn--sm" onClick={onClose}>
              닫기
            </button>
          </div>

          <article key={step.id} className={`spot__body spot__body--${dir}`} aria-live="polite">
            {step.tags.length > 0 && <p className="spot__tags">{step.tags.join(' · ')}</p>}
            <h2 id="spot-title" className="spot__title">
              {step.title}
            </h2>
            {step.figure && <p className="spot__figure">{step.figure}</p>}
            {step.personal.length > 0 && (
              <ul className="spot__personal">
                {step.personal.map(line => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            <p className="spot__why">{step.why}</p>
            {step.how.length > 0 && (
              <ol className="spot__how">
                {step.how.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            )}
            {step.policies.length > 0 && (
              <div className="spot__policies">
                <h3>이 단계에서 받을 수 있는 정책</h3>
                <ul>
                  {step.policies.map(policy => (
                    <li key={policy.id}>
                      <a href={policy.url} target="_blank" rel="noreferrer">
                        <strong>{policy.name}</strong>
                        <span>{policy.summary}</span>
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="spot__source">확인 기준일 {policyDate} · 세부 조건은 공식 안내에서 확인하세요.</p>
              </div>
            )}
            <button
              type="button"
              className={`btn ${done[step.id] ? 'btn--done' : 'btn--outline'} btn--md spot__done`}
              aria-pressed={Boolean(done[step.id])}
              onClick={() => onToggleDone(step.id)}
            >
              {done[step.id] ? '✓ 완료했어요' : '완료로 표시하기'}
            </button>
          </article>

          <nav className="spot__nav" aria-label="단계 이동">
            <button
              type="button"
              className="btn btn--ghost btn--md"
              onClick={() => onMove(index - 1)}
              disabled={index === 0}
            >
              ← 이전
            </button>
            <span className="spot__hint">← → 방향키로 넘겨요</span>
            {isLast ? (
              <button type="button" className="btn btn--primary btn--md" onClick={onOpenReport}>
                리포트 보기 →
              </button>
            ) : (
              <button type="button" className="btn btn--primary btn--md" onClick={() => onMove(index + 1)}>
                다음 →
              </button>
            )}
          </nav>
        </div>
      )}
    </dialog>
  );
}

export default function TimelineTrack({ roadmap, done, onToggleDone, onOpenReport, policyDate }) {
  const steps = roadmap.steps;
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      steps.findIndex(step => !done[step.id]),
    ),
  );
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState('next');
  const viewport = useRef(null);
  const cards = useRef({});
  const drag = useRef(null);

  const center = useCallback(
    (i, smooth = true) => {
      const card = cards.current[steps[i]?.id];
      const box = viewport.current;
      if (!card || !box) return;
      const li = card.closest('li');
      box.scrollTo({
        left: li.offsetLeft - box.clientWidth / 2 + li.clientWidth / 2,
        behavior: smooth ? 'smooth' : 'auto',
      });
    },
    [steps],
  );

  const move = useCallback(
    next => {
      const target = Math.max(0, Math.min(steps.length - 1, next));
      if (target === active) return;
      setDir(target > active ? 'next' : 'prev');
      setActive(target);
    },
    [active, steps.length],
  );

  // 지금 단계가 화면 가운데 오게 (처음에는 바로, 그다음부터는 부드럽게)
  const first = useRef(true);
  useEffect(() => {
    center(active, !first.current);
    first.current = false;
  }, [active, center]);

  // 박스가 닫혀 있을 때 ← →를 누르면 지금 단계 박스를 크게 띄워요.
  useEffect(() => {
    const onKey = event => {
      if (open || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      if (isTyping(event.target) || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      setDir(event.key === 'ArrowRight' ? 'next' : 'prev');
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => cards.current[steps[active]?.id]?.focus({ preventScroll: true }));
  };

  if (!steps.length) return null;
  const doneCount = steps.filter(s => done[s.id]).length;
  const scrollBy = delta => viewport.current?.scrollBy({ left: delta, behavior: 'smooth' });

  return (
    <section className="track" aria-label="나의 타임라인 지도">
      <div className="track__bar">
        <p className="track__hint">
          <span className="track__hint--key">← → 방향키를 누르거나 카드를 누르면 크게 볼 수 있어요</span>
          <span className="track__hint--touch">옆으로 밀어 보고, 카드를 누르면 크게 볼 수 있어요</span>
        </p>
        <div className="track__tools">
          <span className="track__done">
            {doneCount} / {steps.length} 완료
          </span>
          <button type="button" className="track__arrow" aria-label="타임라인 왼쪽으로" onClick={() => scrollBy(-480)}>
            ‹
          </button>
          <button type="button" className="track__arrow" aria-label="타임라인 오른쪽으로" onClick={() => scrollBy(480)}>
            ›
          </button>
        </div>
      </div>

      <div
        className="track__viewport"
        ref={viewport}
        onPointerDown={event => {
          if (event.pointerType !== 'mouse' || event.button !== 0) return;
          drag.current = { x: event.clientX, left: viewport.current.scrollLeft, moved: false };
        }}
        onPointerMove={event => {
          const d = drag.current;
          if (!d) return;
          const dx = event.clientX - d.x;
          if (Math.abs(dx) > 5) d.moved = true;
          if (d.moved) viewport.current.scrollLeft = d.left - dx;
        }}
        onPointerUp={() => {
          // 끌어서 옮긴 경우에는 카드 클릭으로 치지 않아요
          setTimeout(() => {
            drag.current = null;
          }, 0);
        }}
        onPointerLeave={() => {
          drag.current = null;
        }}
      >
        <ol className="track__rail">
          {steps.map((step, i) => (
            <Fragment key={step.id}>
              {(i === 0 || steps[i - 1].phaseLabel !== step.phaseLabel) && (
                <li className="track__phase" aria-hidden="true">
                  <span>{step.phaseLabel}</span>
                </li>
              )}
              <li
                className={`track__step track__step--${i % 2 ? 'down' : 'up'}${i === active ? ' is-active' : ''}${done[step.id] ? ' is-done' : ''}`}
              >
                <button
                  type="button"
                  ref={el => {
                    cards.current[step.id] = el;
                  }}
                  className="track__card"
                  aria-label={`${step.number}번 ${step.title}, ${step.phaseLabel}${done[step.id] ? ' (완료)' : ''}. 눌러서 크게 보기`}
                  onFocus={() => setActive(i)}
                  onClick={() => {
                    if (drag.current?.moved) return;
                    setDir(i >= active ? 'next' : 'prev');
                    setActive(i);
                    setOpen(true);
                  }}
                >
                  <span className="track__title">{step.title}</span>
                  {step.figure && <span className="track__figure">{step.figure}</span>}
                  {step.policies.length > 0 && <span className="track__policy">정책 {step.policies.length}개</span>}
                </button>
                <span className="track__stem" aria-hidden="true" />
                <span className="track__node" aria-hidden="true">
                  {done[step.id] ? <Check /> : step.number}
                </span>
              </li>
            </Fragment>
          ))}
        </ol>
      </div>

      <Spotlight
        steps={steps}
        index={active}
        dir={dir}
        open={open}
        done={done}
        onClose={close}
        onMove={move}
        onToggleDone={onToggleDone}
        onOpenReport={() => {
          setOpen(false);
          onOpenReport();
        }}
        policyDate={policyDate}
      />
    </section>
  );
}
