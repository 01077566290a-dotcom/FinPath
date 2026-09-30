'use client';
import { useCallback, useEffect, useState } from 'react';
import { loadFlow, saveFlow } from '../../lib/flowStore.js';

// 서버 렌더링 중에는 localStorage가 없으므로 마운트 후에 불러옵니다. 불러오기 전 flow는 null입니다.
export function useFlow() {
  const [flow, setFlow] = useState(null);
  const [persistent, setPersistent] = useState(true);
  useEffect(() => {
    const loaded = loadFlow();
    setFlow(loaded.flow);
    setPersistent(loaded.persistent);
  }, []);
  const update = useCallback(change => {
    setFlow(current => {
      const next = typeof change === 'function' ? change(current) : change;
      if (!saveFlow(next)) setPersistent(false);
      return next;
    });
  }, []);
  return { flow, update, persistent };
}
