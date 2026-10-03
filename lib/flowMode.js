'use client';
import { useEffect, useState } from 'react';
import { applyQuestionOrder } from './goal/questions.js';

// 화면 흐름 전환 장치
//   plan    : 기획안 v4 흐름 (①②③ 입력 → ④ 타임라인 → ⑤ 리포트, 답 고치기는 입력 확인 화면)
//   classic : 이전 흐름 (PR #13 시점: 돈 상황 먼저 묻기, 리포트 위 '내 숫자로 바꿔 보기', 홈 → 상황 말하기)
//
// 팀 기본값을 바꾸려면 DEFAULT_FLOW 한 줄만 고치면 돼요.
// 배포된 화면에서 잠깐 비교할 때는 주소 뒤에 ?flow=classic 또는 ?flow=plan 을 붙이거나,
// 홈 화면 아래의 '화면 흐름' 스위치를 누르면 돼요. (이 브라우저에만 기억돼요)
export const FLOW_MODES = { plan: '기획안 v4', classic: '이전 흐름' };
export const DEFAULT_FLOW = 'plan';

const KEY = 'finpath.flow';
const CHANGED = 'finpath:flow-changed';
const valid = mode => Object.hasOwn(FLOW_MODES, mode);

export function readFlowMode() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('flow');
    if (valid(fromUrl)) {
      window.localStorage.setItem(KEY, fromUrl);
      return fromUrl;
    }
    const saved = window.localStorage.getItem(KEY);
    if (valid(saved)) return saved;
  } catch {
    // 저장소가 막혀 있으면 기본값
  }
  return DEFAULT_FLOW;
}

export function setFlowMode(mode) {
  if (!valid(mode)) return;
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    // 저장이 막혀 있어도 이번 화면에서는 바뀌게 합니다.
  }
  applyQuestionOrder(mode);
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: mode }));
}

// 첫 렌더는 기본값(정적 HTML과 같게), 화면이 뜬 뒤 저장된 값으로 바꿉니다.
export function useFlowMode() {
  const [mode, setMode] = useState(DEFAULT_FLOW);
  useEffect(() => {
    const load = () => {
      const next = readFlowMode();
      applyQuestionOrder(next);
      setMode(next);
    };
    load();
    const onChange = event => {
      applyQuestionOrder(event.detail);
      setMode(event.detail);
    };
    window.addEventListener(CHANGED, onChange);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener(CHANGED, onChange);
      window.removeEventListener('storage', load);
    };
  }, []);
  return mode;
}
