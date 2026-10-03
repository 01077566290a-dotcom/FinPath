'use client';
import { useCallback, useEffect, useState } from 'react';
import { DEMO_PERSONA } from '../../lib/report/demoPersona.js';

// 리포트 입력값. 사용자가 '내 숫자로 바꿔 보기'에서 고친 값은 이 브라우저에만 저장되고,
// /report 페이지와 지도 화면의 리포트 팝업이 같은 값을 씁니다. 없으면 시연 인물 값을 씁니다.
const KEY = 'finpath-report-input-v1';

function load() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function useReportInput() {
  const [custom, setCustom] = useState(null);
  useEffect(() => {
    setCustom(load());
  }, []);
  const update = useCallback(next => {
    setCustom(next);
    try {
      if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
      else window.localStorage.removeItem(KEY);
    } catch {
      // 저장이 막혀 있어도 이번 화면에서는 반영됩니다.
    }
  }, []);
  return { input: custom || DEMO_PERSONA, edited: Boolean(custom), update, reset: () => update(null) };
}
