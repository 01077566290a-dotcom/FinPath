import { money } from '../../lib/report/format.js';

// 리포트 첫 카드와 결과 요약 팝업의 '세 숫자'. (둘이 같은 모양을 쓰도록 한 곳에 둬요)
//  - 보통: 생각한 목표 · 실제로 필요한 돈 · 모을 수 있는 돈
//  - 투자만 고른 경우: 원하는 투자 · 가능한 투자 · 기간 동안 원금
// 기한이 없는 목표라 세 숫자를 만들 수 없으면 null을 돌려줘요.
export default function Trio({ view, className = '' }) {
  const { core, investOnly } = view;
  if (investOnly)
    return (
      <dl className={`rs-trio ${className}`}>
        <div className="rs-trio__item rs-trio__item--goal">
          <dt>원하는 투자</dt>
          <dd>월 {money(investOnly.cap)}</dd>
        </div>
        <div className="rs-trio__item rs-trio__item--need">
          <dt>가능한 투자</dt>
          <dd>월 {money(investOnly.possible)}</dd>
          <small>지금 매달 모으는 돈 안에서</small>
        </div>
        <div className="rs-trio__item rs-trio__item--can">
          <dt>{investOnly.months}개월 동안 원금</dt>
          <dd>{money(investOnly.total)}</dd>
          <small>수익률은 넣지 않았어요</small>
        </div>
      </dl>
    );
  if (core.deadline === null) return null;
  return (
    <dl className={`rs-trio${core.goal ? '' : ' rs-trio--two'} ${className}`}>
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
  );
}
