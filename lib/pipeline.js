import { extract } from './extractors/index.js';
import { validateExtraction } from './validator.js';
import { mergeExtraction } from './state.js';
// UI는 해석기의 종류를 알 필요가 없습니다. 테스트에서 다른 adapter를 주입할 수 있습니다.
export async function analyzeInput(text, state, extractor = extract) {
  const raw = await extractor(text);
  const { data, issues } = validateExtraction(raw);
  return { state: mergeExtraction(state, data), extraction: data, issues };
}
