'use client';
import { useCallback, useEffect, useState } from 'react';
import { answer, isComplete } from '../../lib/goal/engine.js';
import { loadAnswers, saveAnswers, clearAll } from '../../lib/goal/store.js';
import { buildDemoAnswers } from '../../lib/plan/demoProfile.js';

// 입력 화면(/goal)의 답(answers)을 리포트에서 직접 고칠 때 씁니다.
// 고친 값은 1번 엔진의 answer()로 검증한 뒤 같은 저장소에 저장하고, 프로필도 다시 만듭니다.
// 그러면 usePlan이 이 이벤트를 듣고 리포트·지도를 다시 계산합니다.
export const ANSWERS_CHANGED = 'finpath:answers-changed';
const notify = () => window.dispatchEvent(new Event(ANSWERS_CHANGED));

export function useGoalAnswers() {
  // mode: 'demo' (아직 입력 전 → 시연 인물의 답에서 출발) / 'mine' (입력 완료) / 'partial' (입력 중)
  const [state, setState] = useState({ answers: null, mode: 'demo' });
  const load = useCallback(() => {
    const { answers } = loadAnswers();
    const hasAny = Object.keys(answers).length > 0;
    if (!hasAny) setState({ answers: buildDemoAnswers(), mode: 'demo' });
    else setState({ answers, mode: isComplete(answers) ? 'mine' : 'partial' });
  }, []);
  useEffect(() => {
    load();
    window.addEventListener(ANSWERS_CHANGED, load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener(ANSWERS_CHANGED, load);
      window.removeEventListener('storage', load);
    };
  }, [load]);

  // 답 하나를 고칩니다. 잘못된 값이면 저장하지 않고 엔진의 안내 문구를 돌려줍니다.
  const update = useCallback(
    (id, value) => {
      if (!state.answers || state.mode === 'partial') return '입력 화면을 먼저 마쳐 주세요.';
      const { answers: next, error } = answer(state.answers, id, value);
      if (error) return error;
      saveAnswers(next);
      setState({ answers: next, mode: 'mine' });
      notify();
      return null;
    },
    [state],
  );

  const reset = useCallback(() => {
    clearAll();
    notify();
  }, []);

  return { ...state, update, reset };
}
