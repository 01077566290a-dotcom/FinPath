// 브라우저 저장소(localStorage)에만 저장합니다. 서버로 보내지 않습니다.
import { QUESTION_BY_ID } from './questions.js';
import { buildProfile } from './engine.js';

export const ANSWERS_KEY = 'finpath.answers';
export const PROFILE_KEY = 'finpath.profile'; // 2·3번이 읽는 이름

export function parseAnswers(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data).filter(([id]) => QUESTION_BY_ID[id]));
  } catch {
    return {};
  }
}

export function loadAnswers() {
  try {
    const raw = window.localStorage.getItem(ANSWERS_KEY);
    return { answers: raw ? parseAnswers(raw) : {}, persistent: true };
  } catch {
    return { answers: {}, persistent: false };
  }
}

// 답을 저장하고, 질문이 다 끝났으면 프로필도 같이 저장합니다.
export function saveAnswers(answers) {
  try {
    window.localStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
    const profile = buildProfile(answers);
    if (profile) window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    else window.localStorage.removeItem(PROFILE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function loadProfile() {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAll() {
  try {
    window.localStorage.removeItem(ANSWERS_KEY);
    window.localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* 저장소를 쓸 수 없는 환경 */
  }
}
