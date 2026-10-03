'use client';
import { useEffect, useRef, useState } from 'react';
import { money } from '../../lib/report/format.js';

// 리포트 차트. 색은 세 가지 의미로만 씁니다: 초록(모은 돈), 회색(쓰는 돈·지금 계획), 빨강(부족).
// 팔레트 검증: 진초록·연초록, 연초록·빨강 통과. 진초록·빨강은 색약 구분이 약해 서로 붙여 칠하지 않고
// 부족분은 테두리와 '부족' 글자로 함께 표시합니다. 연초록은 대비가 낮아 값 라벨을 항상 붙입니다.

// 차트를 담은 칸의 실제 폭. 축소하지 않고 1:1로 그려 글자가 작아지지 않게 합니다.
export function useWidth(initial = 640, min = 240) {
  const ref = useRef(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(Math.max(min, next));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [min]);
  return [ref, width];
}

// 눈금: 최댓값을 넘는 깔끔한 단위(100·200·500·1,000 …)로 3~5칸
function niceTicks(max) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const step = [1, 2, 2.5, 5, 10].map(f => f * pow).find(s => s >= raw) || pow * 10;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}
const tickLabel = v => (v >= 10000 ? `${Math.round(v / 1000) / 10}억` : Math.round(v).toLocaleString());

// 모으는 속도: 지금 계획(회색) vs 아끼면(초록), 필요한 돈 기준선, 원래 계획 세로선. 크로스헤어 툴팁.
export function SavingsLines({ base, saving, target, deadline, ariaLabel, savingLabel }) {
  const [ref, W] = useWidth(680);
  const [hover, setHover] = useState(null);
  const compact = W < 520;
  const H = compact ? 240 : 280,
    left = 52,
    right = compact ? 64 : 92,
    top = 26,
    bottom = 36;
  const hasSaving = saving !== base;
  const maxMonth = base.at(-1).month;
  const ticks = niceTicks(Math.max(target, base.at(-1).value, saving.at(-1).value, 1) * 1.05);
  const maxY = ticks.at(-1);
  const x = month => left + (month / Math.max(1, maxMonth)) * (W - left - right);
  const y = value => top + (1 - Math.min(value, maxY) / maxY) * (H - top - bottom);
  const step = maxMonth <= 12 ? 3 : maxMonth <= 24 ? 6 : maxMonth <= 60 ? 12 : 24;
  const xTicks = base.filter(d => d.month % step === 0);
  const reach = list => list.find(d => d.value >= target);
  const reachBase = reach(base),
    reachSaving = hasSaving ? reach(saving) : null;

  function onMove(event) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * W;
    setHover(Math.max(0, Math.min(maxMonth, Math.round(((px - left) / (W - left - right)) * maxMonth))));
  }
  function onKey(event) {
    if (event.key === 'ArrowRight') setHover(h => Math.min(maxMonth, (h ?? -1) + 1));
    if (event.key === 'ArrowLeft') setHover(h => Math.max(0, (h ?? 1) - 1));
    if (event.key === 'Escape') setHover(null);
  }
  const point = hover === null ? null : { base: base[hover], saving: saving[hover] };
  const line = list => list.map(d => `${x(d.month)},${y(d.value)}`).join(' ');
  const edge = px => (px > W - right - 50 ? 'end' : px < left + 50 ? 'start' : 'middle');

  return (
    <figure className="rv" ref={ref}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        className="rv__svg rv__svg--plot"
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        {ticks.map(tick => (
          <g key={tick}>
            <line x1={left} x2={W - right} y1={y(tick)} y2={y(tick)} className="rv__grid" />
            <text x={left - 8} y={y(tick) + 4} textAnchor="end" className="rv__tick">
              {tickLabel(tick)}
            </text>
          </g>
        ))}
        {xTicks.map(d => (
          <text key={d.month} x={x(d.month)} y={H - bottom + 20} textAnchor="middle" className="rv__tick">
            {d.month === 0 ? '지금' : `${d.month}개월`}
          </text>
        ))}
        {deadline <= maxMonth && (
          <g>
            <line x1={x(deadline)} x2={x(deadline)} y1={top} y2={H - bottom} className="rv__ref" />
            <text x={x(deadline)} y={top - 10} textAnchor={edge(x(deadline))} className="rv__sub">
              원래 계획
            </text>
          </g>
        )}
        <line x1={left} x2={W - right} y1={y(target)} y2={y(target)} className="rv__target" />
        <text x={W - right + 8} y={y(target) - 4} className="rv__value rv__value--ink">
          필요한 돈
        </text>
        <text x={W - right + 8} y={y(target) + 13} className="rv__value rv__value--ink">
          {tickLabel(target)}
        </text>
        <polyline points={line(base)} className="rv__line rv__line--base" />
        {hasSaving && <polyline points={line(saving)} className="rv__line rv__line--saving" />}
        {reachBase && (
          <g>
            <circle cx={x(reachBase.month)} cy={y(target)} r="5" className="rv__dot rv__dot--base" />
            <text x={x(reachBase.month)} y={y(target) + 24} textAnchor={edge(x(reachBase.month))} className="rv__value">
              {reachBase.month}개월
            </text>
          </g>
        )}
        {reachSaving && reachSaving.month !== reachBase?.month && (
          <g>
            <circle cx={x(reachSaving.month)} cy={y(target)} r="6" className="rv__dot rv__dot--saving" />
            <text
              x={x(reachSaving.month)}
              y={y(target) - 14}
              textAnchor={edge(x(reachSaving.month))}
              className="rv__value rv__value--good"
            >
              {reachSaving.month}개월
            </text>
          </g>
        )}
        {point && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={top} y2={H - bottom} className="rv__crosshair" />
            <circle cx={x(hover)} cy={y(point.base.value)} r="4" className="rv__dot rv__dot--base" />
            {hasSaving && <circle cx={x(hover)} cy={y(point.saving.value)} r="4" className="rv__dot rv__dot--saving" />}
          </g>
        )}
      </svg>
      {point && (
        <div
          className={`rv__tooltip${x(hover) / W > 0.5 ? ' rv__tooltip--left' : ''}`}
          style={{ left: `${x(hover)}px` }}
          role="status"
        >
          <strong>
            {hover === 0 ? '지금' : `${hover}개월 뒤`} · {point.base.label}
          </strong>
          {hasSaving && (
            <span className="rv__tooltip-row">
              <i className="rv__key rv__key--saving" aria-hidden="true" />
              <b>{money(point.saving.value)}</b> {savingLabel}
            </span>
          )}
          <span className="rv__tooltip-row">
            <i className="rv__key rv__key--base" aria-hidden="true" />
            <b>{money(point.base.value)}</b> 지금 계획
          </span>
        </div>
      )}
      <div className="rv__legend">
        {hasSaving && (
          <span>
            <i className="rv__key rv__key--saving" aria-hidden="true" />
            {savingLabel}
          </span>
        )}
        <span>
          <i className="rv__key rv__key--base" aria-hidden="true" />
          지금 계획
        </span>
        <span>
          <i className="rv__key rv__key--target" aria-hidden="true" />
          필요한 돈
        </span>
      </div>
    </figure>
  );
}
