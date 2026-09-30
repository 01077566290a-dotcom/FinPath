// 기존 타임라인 데모(index.html, src/)를 public/legacy/로 복사합니다.
// 정적 내보내기(GitHub Pages)에서는 서버 라우트를 쓸 수 없어서 정적 파일로 제공합니다.
// dev·build 전에 자동 실행되며, 결과물은 .gitignore에 포함됩니다.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const out = new URL('../public/legacy/', import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(new URL('../src/', import.meta.url), new URL('src/', out), { recursive: true });
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
await writeFile(new URL('index.html', out), html.replaceAll('"/src/', '"src/'));
