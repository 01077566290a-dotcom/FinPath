import { readFile } from 'node:fs/promises';
import path from 'node:path';
export const runtime = 'nodejs';
// 기존 데모를 변경 없이 보존합니다. 공개 범위는 기존 index.html과 src 정적 파일로 한정합니다.
export async function GET(request, { params }) {
  const segments = (await params).path || [];
  const relative = segments.join('/');
  if (relative && (!relative.startsWith('src/') || segments.some(s => s === '..' || s.includes('\\')) || !/\.(js|css)$/.test(relative))) return new Response('Not found', { status: 404 });
  try {
    let body = await readFile(path.join(process.cwd(), relative || 'index.html'), 'utf8');
    if (!relative) body = body.replaceAll('"/src/', '"/legacy/src/');
    return new Response(body, { headers: { 'Content-Type': relative.endsWith('.js') ? 'text/javascript; charset=utf-8' : relative.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8' } });
  } catch { return new Response('Not found', { status: 404 }); }
}
