'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { analyzeInput } from '../../lib/pipeline.js';
import { createInitialState } from '../../lib/state.js';
import { useFlow } from './useFlow.js';
import { SiteHeader, StepProgress, PrivacyNote, ArrowIcon } from './Chrome.js';

const CHIPS = ['이번에 취업했어요.', '첫 월급을 받았어요.', '독립을 준비하고 있어요.'];

export default function SituationStep() {
  const router = useRouter();
  const { flow, update, persistent } = useFlow();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const loaded = useRef(false);
  useEffect(() => {
    if (flow && !loaded.current) { loaded.current = true; setText(flow.text); }
  }, [flow]);

  const hasAnswers = Boolean(flow && (flow.history.length || Object.keys(flow.engine.events).length));
  const ready = text.trim().length > 0 && !busy;

  function addChip(chip) {
    setMessage('');
    setText(current => (current.trim() ? `${current.trim()} ${chip}` : chip));
  }

  async function submit(event) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true); setMessage('');
    try {
      const { state } = await analyzeInput(text, createInitialState());
      if (!Object.keys(state.events).length) {
        setMessage('어떤 상황인지 아직 잘 모르겠어요. 취업, 월급, 독립, 집 계약, 대출 중 해당하는 이야기를 조금 더 적어 주세요.');
        return;
      }
      update({ text, engine: state, history: [], done: {} });
      router.push('/questions');
    } catch (error) {
      setMessage(error.message || '입력을 분석하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="flow-page">
        <div className="flow-column">
          <StepProgress current={0} />
          <div className="flow-heading">
            <h1>요즘 어떤 상황이에요?</h1>
            <p>말하듯 편하게 적어주세요. 금융 용어는 몰라도 돼요.</p>
          </div>
          <form onSubmit={submit} className="situation">
            <div className="situation__box">
              <label htmlFor="situation" className="sr-only">현재 상황</label>
              <textarea
                id="situation"
                rows={6}
                maxLength={2000}
                value={text}
                disabled={!flow || busy}
                onChange={e => { setText(e.target.value); setMessage(''); }}
                placeholder="예: 다음 달에 취업해서 반년 뒤 월세로 독립하려고 해요. 모아둔 돈은 천만 원 정도예요."
              />
              <div className="situation__actions">
                {hasAnswers && <span className="situation__hint">다시 분석하면 이전 답변은 초기화돼요.</span>}
                <button type="submit" className="btn btn--primary" disabled={!ready}>{busy ? '분석 중…' : '다음'} <ArrowIcon /></button>
              </div>
            </div>
            {message && <p className="notice" role="alert">{message}</p>}
            <PrivacyNote persistent={persistent} />
          </form>
          <div className="chips">
            <p className="chips__label">뭐라고 쓸지 모르겠다면, 하나 골라보세요.</p>
            <div className="chips__list">
              {CHIPS.map(chip => <button key={chip} type="button" className="chip" disabled={!flow || busy} onClick={() => addChip(chip)}>{chip.replace(/\.$/, '')}</button>)}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
