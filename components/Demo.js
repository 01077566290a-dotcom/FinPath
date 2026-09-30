'use client';
import { useRef, useState } from 'react';
import { createInitialState, applyAnswer } from '../lib/state.js';
import { analyzeInput } from '../lib/pipeline.js';
import { evaluateRules } from '../lib/rules.js';
import { selectNextQuestion, eventQuestion, QUESTIONS } from '../lib/questions.js';
import InputPanel from './InputPanel.js';
import UnderstandingPanel from './UnderstandingPanel.js';
import QuestionPanel from './QuestionPanel.js';
import ResultPanel from './ResultPanel.js';
import DebugPanel from './DebugPanel.js';

export default function Demo() {
  const [text, setText] = useState('');
  const [state, setState] = useState(createInitialState);
  const [analyzed, setAnalyzed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [extraction, setExtraction] = useState(null);
  const [issues, setIssues] = useState([]);
  const requestId = useRef(0);
  const result = evaluateRules(state), question = selectNextQuestion(result);
  async function analyze(event) {
    event.preventDefault();
    const id = ++requestId.current;
    setBusy(true); setError('');
    try {
      const response = await analyzeInput(text, createInitialState());
      if (id !== requestId.current) return;
      setState(response.state); setExtraction(response.extraction); setIssues(response.issues); setAnalyzed(true);
    } catch { if (id === requestId.current) setError('입력을 분석하지 못했어요. 내용을 확인하고 다시 시도해 주세요.'); }
    finally { if (id === requestId.current) setBusy(false); }
  }
  function reset() {
    requestId.current += 1; setText(''); setState(createInitialState()); setAnalyzed(false); setExtraction(null); setIssues([]); setError(''); setBusy(false);
  }
  function answer(q, value) { setState(current => applyAnswer(current, q, value)); }
  function updateSlot(key, value) {
    if (value) answer(QUESTIONS[key], value);
    else setState(current => ({ ...current, slots: { ...current.slots, [key]: null } }));
  }
  return <><header className="header"><a href="/" className="logo"><span aria-hidden="true">↗</span> FinPath<span className="logo-dot">.</span></a><div><span className="demo-badge">1·2단계 DEMO</span><button className="reset-button" onClick={reset}>처음부터</button></div></header><main><div className="page-intro"><div><span className="overline">YOUR NEXT STEP, A LITTLE CLEARER</span><h1>내 이야기가,<br className="mobile-break" /> 준비의 시작이 되도록.</h1><p>상황을 이해하고, 이미 말한 정보는 빼고, 필요한 것만 하나씩 확인해요.</p></div><div className="stage-indicator"><span>01 상황 이해</span><i>→</i><span>02 필요한 정보 확인</span></div></div><div className="demo-layout"><div className="main-column"><InputPanel text={text} setText={setText} onAnalyze={analyze} busy={busy} analyzed={analyzed} error={error} />{analyzed ? <><UnderstandingPanel state={state} result={result} onEventChange={(type, value) => answer(eventQuestion(type), value)} onSlotChange={updateSlot} /><QuestionPanel question={question} result={result} onAnswer={answer} /><ResultPanel state={state} result={result} /></> : <section className="empty-panel"><span aria-hidden="true">↳</span><h2>한 문장에서 다음 질문까지.</h2><p>입력하면 인식한 이벤트와 확인한 정보,<br />가장 먼저 필요한 질문을 이곳에서 보여드려요.</p><div><span>취업</span><span>월급</span><span>독립</span><span>주거계약</span><span>대출</span></div></section>}</div><DebugPanel state={state} result={result} question={question} extraction={extraction} issues={issues} /></div></main><footer><strong>FinPath</strong><span>핵심 흐름 검증용 데모 · AI API 미사용 · 브라우저 메모리에서만 처리</span></footer></>;
}
