'use client';
import { useEffect, useMemo, useState } from 'react';
import { loadProfile } from '../../lib/goal/store.js';
import { validateProfile } from '../../lib/goal/engine.js';
import { buildPlan } from '../../lib/plan/index.js';
import { buildDemoProfile, DEMO_ASSUMPTIONS } from '../../lib/plan/demoProfile.js';

// 입력 화면(/goal)에서 저장한 프로필이 있으면 그 숫자로, 없으면 시연 인물(정하은)로 계산합니다.
// 서버 렌더링에는 localStorage가 없으므로 처음엔 시연 인물로 그리고, 마운트 뒤에 저장된 프로필로 바꿉니다.
export function usePlan() {
  const [saved, setSaved] = useState(null);
  useEffect(() => {
    const profile = loadProfile();
    if (profile && validateProfile(profile).length === 0) setSaved(profile);
  }, []);
  return useMemo(() => {
    if (saved) return { plan: buildPlan(saved), profile: saved, demo: false };
    const profile = buildDemoProfile();
    return { plan: buildPlan(profile, { assumptions: DEMO_ASSUMPTIONS }), profile, demo: true };
  }, [saved]);
}
