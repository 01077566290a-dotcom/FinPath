'use client';
import { useEffect, useRef, useState } from 'react';

// 리포트 차트 (SVG). 색은 리포트 전체에서 같은 의미로만 씁니다. (globals.css .rp-page의 --c-* 변수)
// 팔레트 검증: 파랑·주황·보라, 진초록·초록, 주황·초록 조합 모두 통과. 초록은 배경 대비가 낮아
// 값 라벨을 항상 표시하고 '표로 보기'를 함께 둡니다.
// 모든 차트는 실제 칸 폭(W)에 맞춰 1:1로 그립니다. 축소해서 글자가 작아지지 않게 하기 위해서입니다.
export const COLOR = {
  emergency: 'var(--c-emergency)',
  housing: 'var(--c-housing)',
  initial: 'var(--c-initial)',
  saved: 'var(--c-saved)',
  saving: 'var(--c-saving)',
  needed: 'var(--c-needed)',
  muted: 'var(--c-muted)',
  base: 'var(--c-base)',
};
const fmt = value => Math.round(value).toLocaleString();

// 값의 크기에 맞는 눈금 간격(1·2·5 × 10^n)과 축 끝값. 금액이 커도 눈금이 6개 안팎으로 유지됩니다.
export function niceScale(maxValue) {
  const raw = Math.max(maxValue, 1) / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  const max = Math.ceil(maxValue / step) * step;
  return { step, max, ticks: Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step) };
}
const COMPACT = 520; // 이보다 좁으면 항목 이름을 막대 위로 올립니다.

// 글자 폭 어림 (12px 기준: 한글 12.5px, 그 밖 7px). 막대 안 라벨이 들어갈지 판단합니다.
const textWidth = (text, size = 12) =>
  [...text].reduce((w, ch) => w + (/[가-힣]/.test(ch) ? size * 1.04 : size * 0.6), 0);

// 가로 막대, 데이터 끝만 4px 둥글게 (기준선 쪽은 각지게)
function barPath(x, y, w, h, r = 4) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${x},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} H${x} Z`;
}
const rectPath = (x, y, w, h) => `M${x},${y} h${w} v${h} h${-w} Z`;

// 차트를 담은 칸의 실제 폭. 서버 렌더링 때는 기본값을 쓰고, 화면에 붙은 뒤 잽니다.
function useWidth(initial = 640, min = 240) {
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
  }, []);
  return [ref, width];
}

function useHover() {
  const [hover, setHover] = useState(null);
  const bind = id => ({
    tabIndex: 0,
    className: 'viz__hit',
    onPointerEnter: () => setHover(id),
    onPointerLeave: () => setHover(null),
    onFocus: () => setHover(id),
    onBlur: () => setHover(null),
  });
  return [hover, bind];
}

// 막대 행 배치: 넓으면 이름을 왼쪽에, 좁으면 막대 위에 둡니다.
function rowLayout(W, { labelW, rowH, compactRowH, barH, rightPad }) {
  const compact = W < COMPACT;
  const left = compact ? 0 : labelW;
  return {
    compact,
    left,
    plotW: W - left - rightPad,
    rowH: compact ? compactRowH : rowH,
    barTop: rowTop => (compact ? rowTop + 22 : rowTop + (rowH - barH) / 2),
    labelPos: (rowTop, barY) =>
      compact ? { x: 0, y: rowTop + 14, anchor: 'start' } : { x: labelW - 12, y: barY + barH / 2 + 5, anchor: 'end' },
  };
}

// 1) 목표 진단: 같은 축 위의 가로 막대 + 모자란 부분(빈 칸과 괄호)
export function CompareBars({ rows, max, ticks, ariaLabel }) {
  const [ref, W] = useWidth();
  const [hover, bind] = useHover();
  const barH = 22,
    top = 4;
  const L = rowLayout(W, { labelW: 172, rowH: 52, compactRowH: 62, barH, rightPad: 92 });
  const H = top + rows.length * L.rowH + 24;
  const x = value => L.left + (value / max) * L.plotW;
  const active = rows[hover];
  return (
    <figure className="viz" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="viz__svg">
        {ticks.map(tick => (
          <g key={tick}>
            <line x1={x(tick)} x2={x(tick)} y1={top} y2={H - 22} className="viz__grid" />
            <text x={x(tick)} y={H - 6} className="viz__tick" textAnchor={tick === 0 && L.compact ? 'start' : 'middle'}>
              {fmt(tick)}
            </text>
          </g>
        ))}
        {!L.compact && <line x1={L.left} x2={L.left} y1={top} y2={H - 22} className="viz__axis" />}
        {rows.map((row, i) => {
          const rowTop = top + i * L.rowH;
          const y = L.barTop(rowTop);
          const label = L.labelPos(rowTop, y);
          const w = Math.max(2, x(row.value) - L.left);
          const dim = hover !== null && hover !== i;
          return (
            <g key={row.label} {...bind(i)}>
              <rect x={0} y={rowTop} width={W} height={L.rowH} fill="transparent" />
              <text x={label.x} y={label.y} textAnchor={label.anchor} className="viz__label">
                {row.label}
              </text>
              {row.shortfallTo && (
                <g>
                  <path d={barPath(L.left, y, x(row.shortfallTo) - L.left, barH)} className="viz__track" />
                  <line
                    x1={x(row.value)}
                    x2={x(row.shortfallTo)}
                    y1={y + barH + 5}
                    y2={y + barH + 5}
                    className="viz__bracket"
                  />
                  <line
                    x1={x(row.value)}
                    x2={x(row.value)}
                    y1={y + barH + 2}
                    y2={y + barH + 8}
                    className="viz__bracket"
                  />
                  <line
                    x1={x(row.shortfallTo)}
                    x2={x(row.shortfallTo)}
                    y1={y + barH + 2}
                    y2={y + barH + 8}
                    className="viz__bracket"
                  />
                </g>
              )}
              <path d={barPath(L.left, y, w, barH)} fill={row.color} opacity={dim ? 0.5 : 1} />
              <text
                x={(row.shortfallTo ? x(row.shortfallTo) : L.left + w) + 8}
                y={y + barH / 2 + 5}
                className={row.strong ? 'viz__value viz__value--strong' : 'viz__value'}
              >
                {fmt(row.value)}만 원
              </text>
              {row.shortfallTo && (
                <text
                  x={(x(row.value) + x(row.shortfallTo)) / 2}
                  y={y + barH / 2 + 4.5}
                  textAnchor="middle"
                  className="viz__gap"
                >
                  {x(row.shortfallTo) - x(row.value) >= 64
                    ? `부족 ${fmt(row.shortfallTo - row.value)}`
                    : fmt(row.shortfallTo - row.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="viz__hint" aria-live="polite">
        {active
          ? `${active.label}: ${fmt(active.value)}만 원 · ${active.note}`
          : '막대를 누르거나 마우스를 올리면 계산 내용을 볼 수 있어요.'}
      </figcaption>
    </figure>
  );
}

// 2) 누적 가로 막대 (같은 축). 조각 사이 2px 흰 간격. 라벨은 조각에 들어갈 때만 안에 씁니다.
export function StackedBars({ rows, max, ariaLabel }) {
  const [ref, W] = useWidth();
  const [hover, bind] = useHover();
  const barH = 26,
    top = 2;
  const L = rowLayout(W, { labelW: 172, rowH: 50, compactRowH: 58, barH, rightPad: 8 });
  const H = top + rows.length * L.rowH;
  const scale = value => (value / max) * L.plotW;
  let active = null;
  return (
    <figure className="viz" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="viz__svg">
        {rows.map((row, r) => {
          const rowTop = top + r * L.rowH;
          const y = L.barTop(rowTop);
          const label = L.labelPos(rowTop, y);
          let cursor = L.left;
          return (
            <g key={row.label}>
              <text x={label.x} y={label.y} textAnchor={label.anchor} className="viz__label">
                {row.label}
              </text>
              {row.track && <path d={barPath(L.left, y, scale(row.track), barH)} className="viz__track" />}
              {row.parts.map((part, p) => {
                const w = scale(part.value);
                const last = p === row.parts.length - 1;
                const drawW = Math.max(1, w - (last ? 0 : 2));
                const px = cursor;
                cursor += w;
                const id = `${r}-${p}`;
                if (hover === id) active = part;
                const full = `${part.short} ${fmt(part.value)}`;
                const text =
                  drawW >= textWidth(full) + 16
                    ? full
                    : drawW >= textWidth(fmt(part.value)) + 12
                      ? fmt(part.value)
                      : '';
                return (
                  <g key={part.label} {...bind(id)}>
                    <path
                      d={last && !row.track ? barPath(px, y, drawW, barH) : rectPath(px, y, drawW, barH)}
                      fill={part.color}
                      opacity={hover !== null && hover !== id ? 0.5 : 1}
                    />
                    {text && (
                      <text x={px + 6} y={y + barH / 2 + 4.5} className="viz__inbar" fill={part.ink || '#ffffff'}>
                        {text}
                      </text>
                    )}
                  </g>
                );
              })}
              {row.trackLabel &&
                (() => {
                  const gapW = L.left + scale(row.track) - cursor;
                  const text =
                    gapW >= textWidth(row.trackLabel) + 12 ? row.trackLabel : gapW >= 30 ? row.trackShort : '';
                  return (
                    text && (
                      <text x={cursor + gapW / 2} y={y + barH / 2 + 4.5} textAnchor="middle" className="viz__gap">
                        {text}
                      </text>
                    )
                  );
                })()}
            </g>
          );
        })}
      </svg>
      <figcaption className="viz__hint" aria-live="polite">
        {active ? `${active.label}: ${fmt(active.value)}만 원` : ' '}
      </figcaption>
    </figure>
  );
}

// 3) 월 현금흐름: 실수령액을 100%로 놓고 어디로 가는지 (지금 vs 독립 후)
export function CashflowBars({ rows, income, ariaLabel }) {
  const [ref, W] = useWidth();
  const [hover, bind] = useHover();
  const barH = 28,
    top = 2;
  const compact = W < COMPACT;
  const labelW = compact ? 0 : 84,
    rightW = compact ? 0 : 150,
    rowH = compact ? 60 : 52;
  const plotW = W - labelW - rightW - (compact ? 0 : 8);
  const H = top + rows.length * rowH;
  const scale = value => (value / income) * plotW;
  let active = null;
  return (
    <figure className="viz" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="viz__svg">
        {rows.map((row, r) => {
          const rowTop = top + r * rowH;
          const y = compact ? rowTop + 22 : rowTop + (rowH - barH) / 2;
          let cursor = labelW;
          const parts = row.parts.filter(part => part.value > 0);
          const saveText = `모으는 돈 ${fmt(row.save)}만 원`;
          const rateText = `월급의 ${Math.round((row.save / income) * 100)}%`;
          return (
            <g key={row.label}>
              <text
                x={compact ? 0 : labelW - 12}
                y={compact ? rowTop + 14 : y + barH / 2 + 5}
                textAnchor={compact ? 'start' : 'end'}
                className="viz__label"
              >
                {row.label}
              </text>
              {compact && (
                <text x={W} y={rowTop + 14} textAnchor="end" className="viz__value viz__value--strong">
                  {saveText} · {rateText}
                </text>
              )}
              {parts.map((part, p) => {
                const w = scale(part.value);
                const last = p === parts.length - 1;
                const drawW = Math.max(1, w - (last ? 0 : 2));
                const px = cursor;
                cursor += w;
                const id = `${r}-${p}`;
                if (hover === id) active = { ...part, row: row.label };
                const full = `${part.short} ${fmt(part.value)}`;
                const text =
                  drawW >= textWidth(full) + 16
                    ? full
                    : drawW >= textWidth(fmt(part.value)) + 12
                      ? fmt(part.value)
                      : '';
                return (
                  <g key={part.key} {...bind(id)}>
                    <path
                      d={last ? barPath(px, y, drawW, barH) : rectPath(px, y, drawW, barH)}
                      fill={part.color}
                      opacity={hover !== null && hover !== id ? 0.5 : 1}
                    />
                    {text && (
                      <text x={px + 6} y={y + barH / 2 + 4.5} className="viz__inbar" fill={part.ink || '#ffffff'}>
                        {text}
                      </text>
                    )}
                  </g>
                );
              })}
              {!compact && (
                <>
                  <text x={labelW + plotW + 16} y={y + barH / 2 - 4} className="viz__value viz__value--strong">
                    {saveText}
                  </text>
                  <text x={labelW + plotW + 16} y={y + barH / 2 + 15} className="viz__sub">
                    {rateText}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="viz__hint" aria-live="polite">
        {active
          ? `${active.row} · ${active.label}: ${fmt(active.value)}만 원 (월급의 ${Math.round((active.value / income) * 100)}%)`
          : ' '}
      </figcaption>
    </figure>
  );
}

// 4) 모으는 속도: 지금 계획(회색) vs 절약 시(초록) + 필요한 돈 기준선 + 원래 입주 계획 세로선
export function SavingsLines({ data, target, deadline, series, ariaLabel }) {
  const [ref, W] = useWidth(680);
  const [hover, setHover] = useState(null);
  const compact = W < COMPACT;
  const H = compact ? 260 : 300,
    left = 48,
    right = compact ? 78 : 112,
    top = 22,
    bottom = 40;
  const maxMonth = Math.max(1, data.at(-1).month);
  const scale = niceScale(Math.max(target, ...data.flatMap(d => series.map(s => d[s.key]))));
  const maxY = scale.max;
  const x = month => left + (month / maxMonth) * (W - left - right);
  const y = value => top + (1 - value / maxY) * (H - top - bottom);
  const yTicks = scale.ticks.filter((tick, i) => !compact || i % 2 === 0);
  const xTicks = data.filter(d => d.month % (compact ? 6 : 3) === 0);
  const cross = series.map(s => data.find(d => d[s.key] >= target));

  function onMove(event) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * W;
    const month = Math.round(((px - left) / (W - left - right)) * maxMonth);
    setHover(Math.max(0, Math.min(maxMonth, month)));
  }
  function onKey(event) {
    if (event.key === 'ArrowRight') setHover(h => Math.min(maxMonth, (h ?? -1) + 1));
    if (event.key === 'ArrowLeft') setHover(h => Math.max(0, (h ?? 1) - 1));
    if (event.key === 'Escape') setHover(null);
  }
  const point = hover === null ? null : data[hover];
  const last = data.at(-1);
  // 끝 라벨: '필요한 돈' 라벨(기준선 위 26px) 위쪽에 두고, 서로 18px 이상 띄웁니다. 아래에서 위로 밀어 올립니다.
  const endLabels = series.map(s => ({ s, y: Math.min(y(last[s.key]), y(target) - 26) })).sort((a, b) => b.y - a.y);
  for (let i = 1; i < endLabels.length; i++) endLabels[i].y = Math.min(endLabels[i].y, endLabels[i - 1].y - 18);

  return (
    <figure className="viz" ref={ref}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        className="viz__svg viz__svg--plot"
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        {yTicks.map(tick => (
          <g key={tick}>
            <line x1={left} x2={W - right} y1={y(tick)} y2={y(tick)} className="viz__grid" />
            <text x={left - 8} y={y(tick) + 4} textAnchor="end" className="viz__tick">
              {fmt(tick)}
            </text>
          </g>
        ))}
        {xTicks.map(d => (
          <text key={d.month} x={x(d.month)} y={H - bottom + 20} textAnchor="middle" className="viz__tick">
            {d.month === 0 ? '지금' : `${d.month}개월`}
          </text>
        ))}
        <line x1={left} x2={W - right} y1={H - bottom} y2={H - bottom} className="viz__axis" />
        {deadline && (
          <>
            <line x1={x(deadline.month)} x2={x(deadline.month)} y1={top} y2={H - bottom} className="viz__ref" />
            <text x={x(deadline.month) - 6} y={top - 8} textAnchor="end" className="viz__sub">
              {deadline.label}
            </text>
          </>
        )}
        <line x1={left} x2={W - right} y1={y(target)} y2={y(target)} className="viz__target" />
        <text x={W - right + 8} y={y(target) - 5} className="viz__value viz__value--strong">
          필요한 돈
        </text>
        <text x={W - right + 8} y={y(target) + 15} className="viz__value viz__value--strong">
          {fmt(target)}
        </text>
        {series.map(s => (
          <polyline
            key={s.key}
            points={data.map(d => `${x(d.month)},${y(d[s.key])}`).join(' ')}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {endLabels.map(({ s, y: ly }) => (
          <text key={s.key} x={W - right + 8} y={ly + 4} className="viz__value">
            {s.short}
          </text>
        ))}
        {cross.map(
          (d, i) =>
            d && (
              <g key={series[i].key}>
                <circle cx={x(d.month)} cy={y(target)} r="5" fill={series[i].color} className="viz__dot" />
                <text
                  x={x(d.month) > W - right - 28 ? x(d.month) - 8 : x(d.month)}
                  y={y(target) + (i === 0 ? 24 : -14)}
                  textAnchor={x(d.month) > W - right - 28 ? 'end' : 'middle'}
                  className="viz__value viz__value--strong"
                >
                  {d.month}개월
                </text>
              </g>
            ),
        )}
        {point && (
          <g>
            <line x1={x(point.month)} x2={x(point.month)} y1={top} y2={H - bottom} className="viz__crosshair" />
            {series.map(s => (
              <circle key={s.key} cx={x(point.month)} cy={y(point[s.key])} r="4" fill={s.color} className="viz__dot" />
            ))}
          </g>
        )}
      </svg>
      {point && (
        <div
          className={`viz__tooltip${x(point.month) / W > 0.5 ? ' viz__tooltip--left' : ''}`}
          style={{ left: `${x(point.month)}px` }}
          role="status"
        >
          <strong>
            {point.month === 0 ? '지금' : `${point.month}개월 뒤`} · {point.label}
          </strong>
          {series.map(s => (
            <span key={s.key} className="viz__tooltip-row">
              <i style={{ background: s.color }} aria-hidden="true" />
              <b>{fmt(point[s.key])}만 원</b> {s.short}
            </span>
          ))}
          <span className="viz__tooltip-foot">
            {point.base >= target
              ? '필요한 돈을 다 모았어요 (지금 계획)'
              : `필요한 돈까지 ${fmt(target - point.base)}만 원 (지금 계획)`}
          </span>
        </div>
      )}
      <div className="viz__legend">
        {series.map(s => (
          <span key={s.key}>
            <i className="viz__key-line" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </span>
        ))}
        <span>
          <i className="viz__key-line viz__key-line--target" aria-hidden="true" />
          필요한 돈 {fmt(target)}만 원
        </span>
      </div>
    </figure>
  );
}

// 5) 핵심 지표: 인바디식 눈금 막대. 행마다 한 줄 (지금 / 독립 후), 기준 범위 띠와 목표선.
export const METRIC_ROW_COLOR = { now: 'var(--c-base)', after: 'var(--c-housing)', both: 'var(--c-base)' };
export function MetricBar({ metric }) {
  const [ref, W] = useWidth(360, 120);
  const pad = 8,
    plotW = W - pad * 2,
    rowGap = 16,
    barH = 10,
    top = 6;
  const H = top + metric.rows.length * rowGap + 22;
  const x = value => pad + (Math.min(value, metric.max) / metric.max) * plotW;
  const ticks = Array.from({ length: 5 }, (_, i) => (metric.max / 4) * i);
  return (
    <div className="metric__chart" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="viz__svg" aria-hidden="true">
        {metric.band && (
          <rect
            x={x(metric.band.from)}
            y={2}
            width={x(metric.band.to) - x(metric.band.from)}
            height={H - 22}
            className="metric__band"
          />
        )}
        {ticks.map(tick => (
          <g key={tick}>
            <line x1={x(tick)} x2={x(tick)} y1={2} y2={H - 20} className="viz__grid" />
            <text x={x(tick)} y={H - 5} textAnchor="middle" className="viz__tick">
              {Number.isInteger(tick) ? tick : tick.toFixed(1)}
            </text>
          </g>
        ))}
        {metric.rows.map((row, i) => (
          <path
            key={row.key}
            d={barPath(x(0), top + i * rowGap, Math.max(2, x(row.value) - x(0)), barH)}
            fill={METRIC_ROW_COLOR[row.key]}
          />
        ))}
        {metric.marker && (
          <line x1={x(metric.marker.value)} x2={x(metric.marker.value)} y1={0} y2={H - 20} className="metric__target" />
        )}
      </svg>
    </div>
  );
}

// 6) 앞으로의 일정: 시간 축 위의 시점들 (라벨은 위·아래 번갈아 배치). 좁으면 아래 목록만 보여 줍니다.
export function MilestoneTimeline({ items, toneColor, ariaLabel }) {
  const [ref, W] = useWidth(680);
  const H = 168,
    left = 44,
    right = 64,
    axisY = 84;
  const maxMonth = Math.max(1, ...items.map(item => item.month));
  const x = month => left + (month / maxMonth) * (W - left - right);
  return (
    <figure className="viz timeline" ref={ref}>
      {W >= COMPACT && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="viz__svg">
          <line x1={left} x2={W - right} y1={axisY} y2={axisY} className="timeline__axis" />
          {items.map((item, i) => {
            const up = i % 2 === 0;
            const cx = x(item.month);
            const anchor = cx < left + 40 ? 'start' : cx > W - right - 40 ? 'end' : 'middle';
            const tx = anchor === 'start' ? cx - 6 : anchor === 'end' ? cx + 6 : cx;
            return (
              <g key={item.title}>
                <line
                  x1={cx}
                  x2={cx}
                  y1={up ? axisY - 22 : axisY}
                  y2={up ? axisY : axisY + 22}
                  className="timeline__stem"
                />
                <circle
                  cx={cx}
                  cy={axisY}
                  r="7"
                  fill={item.tone === 'missed' ? '#ffffff' : toneColor[item.tone]}
                  stroke={item.tone === 'missed' ? 'var(--c-muted-strong)' : '#ffffff'}
                  strokeWidth="2"
                />
                <text x={tx} y={up ? axisY - 50 : axisY + 38} textAnchor={anchor} className="timeline__date">
                  {item.short}
                </text>
                <text x={tx} y={up ? axisY - 31 : axisY + 57} textAnchor={anchor} className="timeline__title">
                  {item.title}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </figure>
  );
}
