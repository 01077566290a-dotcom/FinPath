'use client';
import { useEffect, useMemo, useRef } from 'react';
import { viewFromPlan } from '../../lib/report/fromPlan.js';
import { scoreFromPlan } from '../../lib/report/score.js';
import { money } from '../../lib/report/format.js';

// '결과 보기'로 들어오면 타임라인 위에 바로 뜨는 결과 요약 (한 화면).
// 세 숫자(생각한 목표 · 실제로 필요한 돈 · 모을 수 있는 돈) + 점수와 한마디 + 할 일 하나.
// [타임라인 따라가기]로 닫고, [전체 리포트 보기]로 전체 리포트 팝업을 열어요.
export default function SummaryDialog({ open, plan, demo, onClose, onOpenReport }) {
  const ref = useRef(null);
  const mainRef = useRef(null);
  const view = useMemo(() => viewFromPlan(plan, { demo }), [plan, demo]);
  const score = useMemo(() => scoreFromPlan(plan), [plan]);
  const { core, verdict } = view;
  const hasDeadline = core.deadline !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      mainRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sum"
      aria-labelledby="sum-title"
      onClose={onClose}
      onClick={event => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="sum__body">
          <p className="sum__eyebrow">
            {demo ? '시연 인물(정하은)의 결과' : '내 결과'} · {view.purposeLabel}
          </p>
          <h2 id="sum-title" className="sum__title">
            {verdict.headline}
          </h2>

          {hasDeadline ? (
            <dl className={`rs-trio sum__trio${core.goal ? '' : ' rs-trio--two'}`}>
              {core.goal ? (
                <div className="rs-trio__item rs-trio__item--goal">
                  <dt>생각한 목표</dt>
                  <dd>{money(core.goal)}</dd>
                </div>
              ) : null}
              <div className="rs-trio__item rs-trio__item--need">
                <dt>실제로 필요한 돈</dt>
                <dd>{money(core.needed)}</dd>
                {core.goal && core.goalDiff > 0 ? <small>생각보다 {money(core.goalDiff)} 더</small> : null}
              </div>
              <div className="rs-trio__item rs-trio__item--can">
                <dt>모을 수 있는 돈</dt>
                <dd>{money(core.collectable)}</dd>
                <small>{core.deadlineLabel}까지</small>
              </div>
            </dl>
          ) : (
            <p className="sum__need">
              필요한 돈 <b>{money(core.needed)}</b> ·{' '}
              {core.doneLabel ? `${core.doneLabel}에 다 모아요` : '지금 속도로는 닿지 않아요'}
            </p>
          )}

          <div className="sum__score">
            <p className="sum__points">
              <b>{score.total}</b>
              <span>/ 100점</span>
              <em
                className={`rs-level rs-level--${score.tone === 'good' ? 'high' : score.tone === 'warning' ? 'mid' : 'low'}`}
              >
                {score.grade}
              </em>
            </p>
            <p className="sum__comment">{score.comment}</p>
            {score.action && <p className="sum__action">→ {score.action}</p>}
          </div>

          <div className="sum__actions">
            <button type="button" ref={mainRef} className="btn btn--primary btn--lg" onClick={onClose}>
              타임라인 따라가기
            </button>
            <button type="button" className="btn btn--outline btn--lg" onClick={onOpenReport}>
              전체 리포트 보기
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
