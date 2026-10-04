'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// ④ 타임라인을 한 단계씩 넘겨 보는 화면.
// 위에는 전체 단계가 한 줄로 보이고(지금 위치 표시), 아래 큰 카드에 지금 단계의 할 일·내 숫자·정책을 보여 줘요.
// 방향키(← →), 화면 밀기(스와이프), 이전·다음 버튼, 위 단계 점을 눌러서 움직여요.
// 기존 전체 지도(MapBoard)와 같은 roadmap 데이터를 써서, 완료 표시도 서로 이어져요.

const SWIPE = 50; // 이만큼(px) 밀면 다음·이전 단계로

function isTyping(target) {
  const tag = target?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
}

export default function TimelineStory({ roadmap, done, onToggleDone, onOpenReport, policyDate }) {
  const steps = roadmap.steps;
  const firstOpen = Math.max(
    0,
    steps.findIndex(step => !done[step.id]),
  );
  const [index, setIndex] = useState(firstOpen);
  const [dir, setDir] = useState('next');
  const railRefs = useRef({});
  const start = useRef(null);
  const step = steps[Math.min(index, steps.length - 1)];

  const go = useCallback(
    next => {
      const target = Math.max(0, Math.min(steps.length - 1, next));
      if (target === index) return;
      setDir(target > index ? 'next' : 'prev');
      setIndex(target);
    },
    [index, steps.length],
  );

  // 방향키: 글자를 입력하는 중이거나 리포트 팝업이 열려 있으면 움직이지 않아요.
  useEffect(() => {
    const onKey = event => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTyping(event.target) || document.querySelector('dialog[open]')) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        go(index + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        go(index - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index]);

  // 위의 단계 줄에서 지금 단계가 보이게 옆으로 맞춰요.
  useEffect(() => {
    const el = railRefs.current[step?.id];
    const rail = el?.parentElement?.parentElement;
    if (!el || !rail) return;
    const left = el.offsetLeft - rail.clientWidth / 2 + el.clientWidth / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [step?.id]);

  if (!step) return null;
  const isLast = index === steps.length - 1;
  const doneCount = steps.filter(s => done[s.id]).length;

  return (
    <section className="story" aria-labelledby="story-title" aria-roledescription="단계 넘겨 보기">
      <header className="story__head">
        <div>
          <h2 id="story-title">한 단계씩 따라가기</h2>
          <p>
            <span className="story__hint story__hint--key">← → 방향키로 넘겨요</span>
            <span className="story__hint story__hint--touch">옆으로 밀어서 넘겨요</span>
          </p>
        </div>
        <span className="story__progress">
          {doneCount} / {steps.length} 완료
        </span>
      </header>

      {/* 전체 단계 한 줄: 누르면 그 단계로 */}
      <div className="story__rail">
        <ol>
          {steps.map((s, i) => (
            <li
              key={s.id}
              ref={el => {
                railRefs.current[s.id] = el;
              }}
            >
              {(i === 0 || steps[i - 1].phaseLabel !== s.phaseLabel) && (
                <span className="story__phase">{s.phaseLabel}</span>
              )}
              <button
                type="button"
                className={`story__dot${i === index ? ' is-current' : ''}${done[s.id] ? ' is-done' : ''}`}
                aria-current={i === index ? 'step' : undefined}
                aria-label={`${s.number}번 ${s.title}${done[s.id] ? ' (완료)' : ''}`}
                onClick={() => go(i)}
              >
                {done[s.id] ? '✓' : s.number}
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* 지금 단계 카드 */}
      <div
        className="story__stage"
        onPointerDown={event => {
          start.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={event => {
          if (!start.current) return;
          const dx = event.clientX - start.current.x;
          const dy = event.clientY - start.current.y;
          start.current = null;
          if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1));
        }}
        onPointerCancel={() => {
          start.current = null;
        }}
      >
        <article key={step.id} className={`story__card story__card--${dir}`} aria-live="polite">
          <p className="story__meta">
            <b>
              {index + 1} / {steps.length}
            </b>
            <span>{step.phaseLabel}</span>
            {step.tags.length > 0 && <span>{step.tags.join(' · ')}</span>}
          </p>
          <h3 className="story__title">{step.title}</h3>
          {step.figure && <p className="story__figure">{step.figure}</p>}

          {step.personal.length > 0 && (
            <ul className="story__personal">
              {step.personal.map(line => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}

          <p className="story__why">{step.why}</p>

          {step.how.length > 0 && (
            <ol className="story__how">
              {step.how.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          )}

          {step.policies.length > 0 && (
            <div className="story__policies">
              <h4>이 단계에서 받을 수 있는 정책</h4>
              <ul>
                {step.policies.slice(0, 3).map(policy => (
                  <li key={policy.id}>
                    <a href={policy.url} target="_blank" rel="noreferrer">
                      <strong>{policy.name}</strong>
                      <span>{policy.summary}</span>
                    </a>
                  </li>
                ))}
              </ul>
              {step.policies.length > 3 && (
                <p className="story__more">외 {step.policies.length - 3}개는 전체 지도에서 볼 수 있어요.</p>
              )}
              <p className="story__source">확인 기준일 {policyDate} · 세부 조건은 공식 안내에서 확인하세요.</p>
            </div>
          )}

          <button
            type="button"
            className={`btn ${done[step.id] ? 'btn--done' : 'btn--outline'} btn--md story__done`}
            aria-pressed={Boolean(done[step.id])}
            onClick={() => onToggleDone(step.id)}
          >
            {done[step.id] ? '✓ 완료했어요' : '완료로 표시하기'}
          </button>
        </article>
      </div>

      <nav className="story__nav" aria-label="단계 이동">
        <button type="button" className="btn btn--ghost btn--md" onClick={() => go(index - 1)} disabled={index === 0}>
          ← 이전
        </button>
        {isLast ? (
          <button type="button" className="btn btn--primary btn--md" onClick={onOpenReport}>
            리포트 보기 →
          </button>
        ) : (
          <button type="button" className="btn btn--primary btn--md" onClick={() => go(index + 1)}>
            다음 단계 →
          </button>
        )}
      </nav>
    </section>
  );
}
