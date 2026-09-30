import { ruleExtractor } from './ruleExtractor.js';
// 교체 지점: AI 해석기도 async (text) => { events, slots } 계약을 사용합니다.
export function createExtractor(adapter) {
  return async function extract(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('현재 상황을 먼저 입력해 주세요.');
    if (text.length > 2000) throw new Error('입력은 2,000자 이내로 작성해 주세요.');
    return adapter(text.trim());
  };
}
export const extract = createExtractor(ruleExtractor);
