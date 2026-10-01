import { normalize } from '../normalizer/index.js';

// LLM 어댑터: async (text) => spans[] 를 기존 extractor 계약 async (text) => { events, slots } 로 맞춥니다.
export const createSpanExtractor = getSpans => async text => {
  const { events, slots } = normalize(await getSpans(text));
  return { events, slots };
};
