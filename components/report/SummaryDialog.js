'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { viewFromPlan } from '../../lib/report/fromPlan.js';
import { scoreFromPlan } from '../../lib/report/score.js';
import { money } from '../../lib/report/format.js';
import ShareMenu from './ShareMenu.js';
import Trio from './Trio.js';

// '결과 보기'로 들어오면 타임라인 위에 바로 뜨는 결과 요약 (한 화면).
// 세 숫자(생각한 목표 · 실제로 필요한 돈 · 모을 수 있는 돈) + 점수와 한마디 + 할 일 하나.
// [타임라인 따라가기]로 닫고, [전체 리포트 보기]로 ⑤ 리포트 화면에 가요.
export default function SummaryDialog({ open, plan, profile, demo, onClose, onOpenReport }) {
  const ref = useRef(null);
  const mainRef = useRef(null);
  const bodyRef = useRef(null);
  const [saving, setSaving] = useState(false);

  // 요약 화면을 그림(PNG)으로 저장해요. 오른쪽 위 버튼과 아래 버튼은 빼고 담아요.
  const saveImage = async () => {
    if (!bodyRef.current || saving) return;
    setSaving(true);
    try {
      const { toPng } = await import('html-to-image');
      const url = await toPng(bodyRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        filter: node => !(node.classList?.contains('sum__tools') || node.classList?.contains('sum__actions')),
      });
      const a = document.createElement('a');
      a.href = url;
      const d = new Date();
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      a.download = `FinPath-결과-${day}.png`;
      a.click();
    } catch {
      window.alert('이미지로 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.');
    } finally {
      setSaving(false);
    }
  };
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
      onClose={event => {
        // 안쪽 공유 창이 닫힐 때는 이 팝업을 닫지 않아요
        if (event.target === ref.current) onClose();
      }}
      onClick={event => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="sum__body" ref={bodyRef}>
          {/* 오른쪽 위 작은 버튼: 공유 · 이미지로 저장 */}
          <div className="sum__tools">
            <ShareMenu small profile={profile} demo={demo} summary={`FinPath 맞춤 리포트: ${verdict.headline}`} />
            <button
              type="button"
              className="icon-btn"
              aria-label="이미지로 저장"
              title="이미지로 저장"
              onClick={saveImage}
              disabled={saving}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 4v11" />
                <path d="M7 10l5 5 5-5" />
                <path d="M5 20h14" />
              </svg>
            </button>
          </div>
          <p className="sum__eyebrow">
            {demo ? '시연 인물(정하은)의 결과' : '내 결과'} · {view.purposeLabel}
          </p>
          <h2 id="sum-title" className="sum__title">
            {verdict.headline}
          </h2>

          {hasDeadline || view.investOnly ? (
            <Trio view={view} className="sum__trio" />
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
